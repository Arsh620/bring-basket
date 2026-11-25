const mongoose = require('mongoose');
const AppError = require('../../utils/AppError');
const { orderModel } = require('./order-data');
const PosHeldCart = require('../../models/orders/PosHeldCart');

// ── Inline PosCart schema (ephemeral, no separate model file needed) ──────────
const posCartSchema = new mongoose.Schema({
  sessionId:  { type: String, required: true, unique: true, index: true },
  storeId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Store' },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  orderMode:  { type: String, enum: ['counter', 'delivery'], default: 'counter' },
  items: [{
    itemId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
    itemName:     { type: String, required: true },
    variant:      { type: String, default: '' },
    variations:   { type: mongoose.Schema.Types.Mixed, default: [] },
    addOns:       [{ addOnId: mongoose.Schema.Types.ObjectId, name: String, qty: Number, unitPrice: Number }],
    addOnTotal:   { type: Number, min: 0, default: 0 },
    offerLabel:   { type: String, default: '' },
    qty:          { type: Number, required: true, min: 0.001 },
    unitPrice:    { type: Number, required: true, min: 0 },
    discountAmt:  { type: Number, default: 0 },
    taxAmt:       { type: Number, default: 0 },
    lineTotal:    { type: Number, required: true },
    image:        { type: String },
    scaleWeight:  { type: Boolean, default: false },
  }],
  extraDiscount:     { type: Number, default: 0 },
  extraDiscountType: { type: String, enum: ['flat', 'percent'], default: 'flat' },
  taxPercent:        { type: Number, default: 0 },
  deliveryAddress:   { type: mongoose.Schema.Types.Mixed, default: null },
  deliveryCharge:    { type: Number, min: 0, default: 0 },
  distanceKm:        { type: Number, min: 0, default: 0 },
  useLoyaltyPoints:  { type: Boolean, default: false },
  notes:             { type: String },
}, { timestamps: true });

posCartSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 86400 }); // auto-expire after 24h

const PosCart = mongoose.models.PosCart || mongoose.model('PosCart', posCartSchema);

// ── Helpers ───────────────────────────────────────────────────────────────────
const money = (v) => Number(Number(v).toFixed(2));

const asArray = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
  }
  return [];
};

const priceFoodOptions = (definitions, selected) => {
  const groups = asArray(definitions);
  const picks = Array.isArray(selected) ? selected : [];
  let amount = 0;
  const canonical = [];
  for (const group of groups) {
    const pick = picks.find((entry) => entry?.name === group?.name);
    const labels = Array.isArray(pick?.values?.label) ? pick.values.label : [];
    const available = Array.isArray(group?.values) ? group.values : [];
    const required = group?.required === true || group?.required === 'on' || group?.required === 1;
    const min = Math.max(0, Number(group?.min) || 0);
    const max = Math.max(0, Number(group?.max) || 0);
    if ((required && labels.length === 0) || labels.length < min) throw new AppError(`Please select at least ${Math.max(1, min)} option(s) from ${group.name}`, 422);
    if (max && labels.length > max) throw new AppError(`Please select no more than ${max} option(s) from ${group.name}`, 422);
    const values = available.filter((option) => labels.includes(option.label));
    if (values.length !== labels.length) throw new AppError(`Invalid option selected for ${group.name}`, 422);
    amount += values.reduce((sum, option) => sum + (Number(option.optionPrice) || 0), 0);
    if (values.length) canonical.push({ ...group, values });
  }
  if (picks.some((pick) => !groups.some((group) => group?.name === pick?.name))) throw new AppError('Invalid food option group', 422);
  return { amount: money(amount), variations: canonical };
};

const discountForLine = (item, unitPrice, qty) => {
  const listedDiscount = Math.max(0, Number(item.discount) || 0);
  let discount = (item.discountType === 'percent' ? unitPrice * listedDiscount / 100 : listedDiscount) * qty;
  const buy = Number(item.offerBuyQty) || 0;
  const get = Number(item.offerGetQty) || 0;
  if (buy > 0 && get > 0) {
    const getDiscount = Math.max(0, Math.min(100, Number(item.offerGetDiscount ?? 100)));
    discount += Math.floor(qty / (buy + get)) * get * unitPrice * getDiscount / 100;
  }
  return money(Math.min(unitPrice * qty, discount));
};

const offerLabelForItem = (item) => {
  const buy = Number(item.offerBuyQty) || 0;
  const get = Number(item.offerGetQty) || 0;
  if (!buy || !get) return '';
  const discount = Math.max(0, Math.min(100, Number(item.offerGetDiscount ?? 100)));
  const benefit = discount >= 100 ? 'free' : `${discount}% off`;
  return `Buy ${buy}, get ${get} ${benefit}`;
};

const assertPosQuantity = (item, qty, cart, excludedIndex = -1, scaleWeight = false) => {
  const buy = Number(item.offerBuyQty) || 0;
  const get = Number(item.offerGetQty) || 0;
  if (buy > 0 && get > 0 && item.offerAllowSingle === false && qty < buy + get) {
    throw new AppError(`${item.name}: minimum quantity for this offer is ${buy + get}`, 422);
  }
  const maximum = Number(item.maximumCartQuantity) || 0;
  if (maximum > 0 && !scaleWeight) {
    const alreadyInCart = cart.items.reduce((sum, line, index) => (
      index !== excludedIndex && String(line.itemId) === String(item._id) ? sum + Number(line.qty || 0) : sum
    ), 0);
    if (alreadyInCart + qty > maximum) throw new AppError(`${item.name}: maximum cart quantity is ${maximum}`, 422);
  }
};

const batchMetadata = async (storeId, items) => {
  const tracked = items.filter((item) => item.trackBatch);
  if (!tracked.length) return new Map();
  const ItemBatch = require('../../models/catalog/ItemBatch');
  const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  today.setHours(0, 0, 0, 0);
  const batches = await ItemBatch.find({
    storeId,
    itemId: { $in: tracked.map((item) => item._id) },
    qty: { $gt: 0 },
    $or: [{ expiryDate: null }, { expiryDate: { $gte: today } }],
  }).select('_id itemId batchCode qty expiryDate').lean();
  const result = new Map();
  for (const item of tracked) {
    const rows = batches.filter((batch) => String(batch.itemId) === String(item._id));
    rows.sort((left, right) => {
      if (!left.expiryDate) return right.expiryDate ? 1 : 0;
      if (!right.expiryDate) return -1;
      return new Date(left.expiryDate).getTime() - new Date(right.expiryDate).getTime();
    });
    result.set(String(item._id), {
      sellableQty: money(rows.reduce((sum, batch) => sum + Number(batch.qty || 0), 0)),
      nearestExpiry: rows.find((batch) => batch.expiryDate)?.expiryDate || null,
      batches: rows.map((batch) => ({ _id: batch._id, batchCode: batch.batchCode, qty: Number(batch.qty), expiryDate: batch.expiryDate })),
    });
  }
  return result;
};

const calcCartTotals = (cart) => {
  const itemSubtotal = money(cart.items.reduce((s, i) => s + i.unitPrice * i.qty + (Number(i.addOnTotal) || 0), 0));
  const itemDiscount = money(cart.items.reduce((s, i) => s + i.discountAmt, 0));
  const taxTotal = money(cart.items.reduce((s, i) => s + i.taxAmt, 0));

  let extraDiscount = 0;
  if (cart.extraDiscount > 0) {
    extraDiscount = cart.extraDiscountType === 'percent'
      ? money((itemSubtotal - itemDiscount) * cart.extraDiscount / 100)
      : money(cart.extraDiscount);
  }

  const deliveryCharge = money(Math.max(0, Number(cart.deliveryCharge) || 0));
  const grandTotal = money(Math.max(0, itemSubtotal - itemDiscount - extraDiscount + taxTotal + deliveryCharge));
  return { itemSubtotal, itemDiscount, extraDiscount, taxTotal, deliveryCharge, grandTotal };
};

// ── Cart CRUD ─────────────────────────────────────────────────────────────────

const getCart = async (sessionId) => {
  const cart = await PosCart.findOne({ sessionId })
    .populate('customerId', 'fName lName phone walletBalance loyaltyPoint')
    .populate('items.itemId', 'name image stock');
  if (!cart) return null;
  return { cart, totals: calcCartTotals(cart) };
};

const getOrCreateCart = async (sessionId, storeId) => {
  let cart = await PosCart.findOne({ sessionId });
  if (!cart) {
    if (!storeId || !mongoose.isValidObjectId(storeId)) throw new AppError('storeId is required to start a cart', 400);
    cart = await PosCart.create({ sessionId, storeId });
  } else if (storeId && String(cart.storeId) !== String(storeId)) {
    throw new AppError('This POS session belongs to a different store', 409);
  }
  return cart;
};

const addItem = async (sessionId, storeId, itemData) => {
  const Item = require('../../models/catalog/Item');
  const { itemId, qty = 1 } = itemData;

  if (!mongoose.isValidObjectId(itemId)) throw new AppError('Invalid itemId', 400);
  const qty_ = Number(qty);
  if (!Number.isFinite(qty_) || qty_ <= 0) throw new AppError('qty must be > 0', 400);

  const item = await Item.findById(itemId);
  if (!item) throw new AppError('Item not found', 404);
  if (item.status === false || item.isApproved === false) throw new AppError('Item is not available for POS orders', 422);
  if (String(item.storeId) !== String(storeId)) throw new AppError('Item does not belong to the selected store', 403);
  const cart = await getOrCreateCart(sessionId, storeId);
  assertPosQuantity(item, qty_, cart, -1, Boolean(itemData.scaleWeight));

  const foodOptions = priceFoodOptions(item.foodVariations, itemData.variations);
  const choices = asArray(item.choiceOptions);
  const selectedChoices = itemData.choices && typeof itemData.choices === 'object' ? itemData.choices : {};
  const choiceLabels = choices.map((choice) => {
    const label = selectedChoices[choice.name];
    const options = Array.isArray(choice.options) ? choice.options : [];
    if (!label || !options.includes(label)) throw new AppError(`Select a valid ${choice.title || choice.name}`, 422);
    return String(label).replace(/\s/g, '');
  });
  const variant = choiceLabels.join('-');
  const catalogVariants = asArray(item.variations);
  let variantPrice = 0;
  if (variant) {
    const selectedVariant = catalogVariants.find((entry) => entry?.type === variant);
    if (!selectedVariant) throw new AppError('Selected product variant is unavailable', 422);
    variantPrice = Number(selectedVariant.price) || 0;
      const variantInCart = cart.items.reduce((sum, line) => (
        String(line.itemId) === String(itemId) && line.variant === variant ? sum + Number(line.qty || 0) : sum
      ), 0);
      if (Number.isFinite(Number(selectedVariant.stock)) && Number(selectedVariant.stock) < variantInCart + qty_) throw new AppError('Selected variant is out of stock', 409);
  }
  const AddOn = require('../../models/GeneratedBusinessModels').registeredModels.add_ons;
  const requestedAddOns = Array.isArray(itemData.addOns) ? itemData.addOns : [];
  const allowedAddOnIds = (item.addOns || []).map(String);
  const addOns = [];
  for (const requested of requestedAddOns) {
    const id = String(requested?.id || '');
    const addOnQty = Number(requested?.qty);
    if (!mongoose.isValidObjectId(id) || !allowedAddOnIds.includes(id)) throw new AppError('Selected add-on is not available for this product', 422);
    if (!Number.isFinite(addOnQty) || addOnQty <= 0 || addOnQty > 99) throw new AppError('Add-on quantity must be between 1 and 99', 422);
    const record = await AddOn.findOne({ _id: id, storeId, status: { $ne: false } }).select('name price').lean();
    if (!record) throw new AppError('Selected add-on is unavailable at this store', 422);
    addOns.push({ addOnId: record._id, name: record.name, qty: addOnQty, unitPrice: money(Number(record.price) || 0) });
  }
  const addOnPrice = money(addOns.reduce((sum, entry) => sum + entry.qty * entry.unitPrice, 0));
  const unitPrice = money((variant ? variantPrice : Number(item.price) || 0) + foodOptions.amount);
  const discountAmt = discountForLine(item, unitPrice, qty_);
  const taxValue = Number(item.tax) || 0;
  const taxAmt = money(item.taxType === 'flat'
    ? taxValue * qty_
    : (unitPrice * qty_ - discountAmt) * taxValue / 100);
  const lineTotal = money(Math.max(0, unitPrice * qty_ - discountAmt + taxAmt + addOnPrice));

  // Merge if same item+variant already in cart
  const existing = cart.items.find(
    (i) => String(i.itemId) === String(itemId) && i.variant === variant
      && JSON.stringify(i.variations || []) === JSON.stringify(foodOptions.variations)
      && JSON.stringify((i.addOns || []).map((entry) => [String(entry.addOnId), entry.qty])) === JSON.stringify(addOns.map((entry) => [String(entry.addOnId), entry.qty])),
  );
  if (existing && !itemData.scaleWeight) {
    existing.qty = money(existing.qty + qty_);
    existing.discountAmt = discountForLine(item, unitPrice, existing.qty);
    existing.taxAmt = money(item.taxType === 'flat'
      ? taxValue * existing.qty
      : (unitPrice * existing.qty - existing.discountAmt) * taxValue / 100);
    existing.offerLabel = offerLabelForItem(item);
    existing.lineTotal = money(Math.max(0, unitPrice * existing.qty - existing.discountAmt + existing.taxAmt + (Number(existing.addOnTotal) || 0)));
  } else {
    cart.items.push({
      itemId,
      itemName: item.name,
      variant,
      variations: foodOptions.variations,
      addOns,
      addOnTotal: addOnPrice,
      offerLabel: offerLabelForItem(item),
      qty: qty_,
      unitPrice,
      discountAmt,
      taxAmt,
      lineTotal,
      image: item.image,
      scaleWeight: Boolean(itemData.scaleWeight),
    });
  }

  await cart.save();
  return { cart, totals: calcCartTotals(cart) };
};

const updateItem = async (sessionId, itemIndex, qty) => {
  const cart = await PosCart.findOne({ sessionId });
  if (!cart) throw new AppError('Cart not found', 404);

  const idx = Number(itemIndex);
  if (!Number.isFinite(idx) || idx < 0 || idx >= cart.items.length) throw new AppError('Invalid item index', 400);

  const qty_ = Number(qty);
  if (!Number.isFinite(qty_) || qty_ <= 0) throw new AppError('qty must be > 0', 400);

  const line = cart.items[idx];
  const Item = require('../../models/catalog/Item');
  const item = await Item.findById(line.itemId).select('name storeId status isApproved discount discountType tax taxType offerBuyQty offerGetQty offerGetDiscount offerAllowSingle maximumCartQuantity').lean();
  if (!item || item.status === false || item.isApproved === false || String(item.storeId) !== String(cart.storeId)) {
    throw new AppError('This cart item is no longer available at the selected store', 409);
  }
  assertPosQuantity(item, qty_, cart, idx, Boolean(line.scaleWeight));
  line.qty = qty_;
  line.discountAmt = discountForLine(item, line.unitPrice, qty_);
  line.offerLabel = offerLabelForItem(item);
  const taxValue = Number(item.tax) || 0;
  line.taxAmt = money(item.taxType === 'flat'
    ? taxValue * qty_
    : (line.unitPrice * qty_ - line.discountAmt) * taxValue / 100);
  line.lineTotal = money(Math.max(0, line.unitPrice * qty_ - line.discountAmt + line.taxAmt + (Number(line.addOnTotal) || 0)));

  await cart.save();
  return { cart, totals: calcCartTotals(cart) };
};

const removeItem = async (sessionId, itemIndex) => {
  const cart = await PosCart.findOne({ sessionId });
  if (!cart) throw new AppError('Cart not found', 404);

  const idx = Number(itemIndex);
  if (!Number.isFinite(idx) || idx < 0 || idx >= cart.items.length) throw new AppError('Invalid item index', 400);

  cart.items.splice(idx, 1);
  await cart.save();
  return { cart, totals: calcCartTotals(cart) };
};

const holdCart = async (sessionId, storeId, actor, label) => {
  if (!storeId || !mongoose.isValidObjectId(storeId)) throw new AppError('storeId is required', 400);
  return PosCart.db.transaction(async (session) => {
    const cart = await PosCart.findOne({ sessionId }).session(session);
    if (!cart || !cart.items.length) throw new AppError('Add at least one item before holding this cart', 400);
    if (String(cart.storeId) !== String(storeId)) throw new AppError('Cart belongs to a different store', 403);
    const [held] = await PosHeldCart.create([{
      storeId,
      actorId: actor.id,
      actorRole: actor.role,
      label: String(label || '').trim().slice(0, 120) || `Held ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`,
      cart: cart.toObject(),
    }], { session });
    await PosCart.deleteOne({ _id: cart._id }, { session });
    return { _id: held._id, label: held.label, itemCount: cart.items.length, createdAt: held.createdAt };
  });
};

const listHeldCarts = async (storeId, actor) => {
  if (!storeId || !mongoose.isValidObjectId(storeId)) throw new AppError('storeId is required', 400);
  const held = await PosHeldCart.find({ storeId, actorId: actor.id, actorRole: actor.role })
    .sort({ createdAt: -1 }).limit(100).lean();
  return held.map((entry) => ({
    _id: entry._id,
    label: entry.label,
    itemCount: Array.isArray(entry.cart?.items) ? entry.cart.items.length : 0,
    createdAt: entry.createdAt,
  }));
};

const resumeHeldCart = async (sessionId, storeId, heldId, actor) => {
  if (!mongoose.isValidObjectId(heldId)) throw new AppError('Invalid held cart ID', 400);
  await PosCart.db.transaction(async (session) => {
    const held = await PosHeldCart.findOneAndDelete({ _id: heldId, storeId, actorId: actor.id, actorRole: actor.role }, { session });
    if (!held) throw new AppError('Held cart not found', 404);

    const snapshot = { ...held.cart };
    for (const field of ['_id', 'sessionId', 'createdAt', 'updatedAt', '__v']) delete snapshot[field];
    await PosCart.updateOne({ sessionId }, { $set: { ...snapshot, sessionId, storeId } }, { upsert: true, session });
  });
  return getCart(sessionId);
};

const discardHeldCart = async (storeId, heldId, actor) => {
  if (!mongoose.isValidObjectId(heldId)) throw new AppError('Invalid held cart ID', 400);
  const deleted = await PosHeldCart.findOneAndDelete({ _id: heldId, storeId, actorId: actor.id, actorRole: actor.role });
  if (!deleted) throw new AppError('Held cart not found', 404);
  return { deleted: true };
};

const scanItem = async (storeId, code) => {
  const Item = require('../../models/catalog/Item');
  const AddOn = require('../../models/GeneratedBusinessModels').registeredModels.add_ons;
  const value = String(code || '').trim().slice(0, 64);
  if (!value) throw new AppError('Barcode or SKU is required', 400);
  if (!mongoose.isValidObjectId(storeId)) throw new AppError('storeId is required', 400);
  const digits = value.replace(/\D/g, '');
  const codes = [...new Set([value, digits].filter(Boolean))];
  const available = {
    storeId,
    status: { $ne: false },
    isApproved: { $ne: false },
  };
  const fields = '_id name price stock barcode sku image tax taxType discount discountType offerBuyQty offerGetQty offerGetDiscount offerAllowSingle maximumCartQuantity trackBatch isPerishable variations foodVariations choiceOptions addOns';
  const withOptions = (query) => query.select(fields).populate({ path: 'addOns', model: AddOn, select: 'name price status storeId' });
  let item = null;
  let suggestedQty = 1;
  let scaleWeight = false;

  const weighted = (() => {
    if (digits.length < 10 || digits.length > 18) return null;
    let plu;
    let weightDigits;
    if (digits.length === 13 && digits.startsWith('2') && !digits.startsWith('02')) {
      plu = digits.slice(0, 7);
      weightDigits = digits.slice(7, 13);
    } else if (digits.startsWith('02')) {
      plu = `2${digits.slice(2, 7)}`;
      weightDigits = digits.slice(7, 12);
    } else if (digits.startsWith('2')) {
      plu = digits.slice(0, 7);
      weightDigits = digits.slice(7);
    }
    if (!plu || weightDigits.length < 3 || weightDigits.length > 6) return null;
    const grams = Number(weightDigits);
    if (!Number.isInteger(grams) || grams < 1 || grams > 30000) return null;
    const article = plu.length >= 7 ? plu.slice(2) : plu;
    return { plu, codes: [...new Set([plu, article, article.replace(/^0+/, '') || '0'])], qty: grams / 1000 };
  })();

  if (weighted) {
    item = await withOptions(Item.findOne({
      ...available,
      $or: [
        { barcode: { $in: weighted.codes } },
        { sku: { $in: weighted.codes } },
        { barcode: new RegExp(`^${weighted.plu}`) },
      ],
    }));
    if (item) {
      suggestedQty = weighted.qty;
      scaleWeight = true;
    }
  }

  // Some scale labels place the store's 6–8 digit barcode first, then the weight.
  if (!item && digits.length >= 10) {
    for (let prefixLength = Math.min(8, digits.length - 3); prefixLength >= 6; prefixLength -= 1) {
      const prefix = digits.slice(0, prefixLength);
      const grams = Number(digits.slice(prefixLength));
      if (!Number.isInteger(grams) || grams < 1 || grams > 30000) continue;
      item = await withOptions(Item.findOne({ ...available, barcode: prefix }));
      if (item) {
        suggestedQty = grams / 1000;
        scaleWeight = true;
        break;
      }
    }
  }

  if (!item) {
    item = await withOptions(Item.findOne({
      ...available,
      $or: [{ barcode: { $in: codes } }, { sku: { $in: codes } }],
    }));
  }
  if (!item) throw new AppError('No available item matches this barcode or SKU', 404);
  const batchInfo = await batchMetadata(storeId, [item.toObject()]);
  const batch = batchInfo.get(String(item._id));
  return { ...item.toObject(), ...(batch || {}), stock: batch?.sellableQty ?? Number(item.stock || 0), sellableQty: batch?.sellableQty ?? Number(item.stock || 0), suggestedQty, scaleWeight };
};

const clearCart = async (sessionId) => {
  await PosCart.deleteOne({ sessionId });
  return { cleared: true };
};

const setCartMeta = async (sessionId, meta, storeId) => {
  const cart = await PosCart.findOne({ sessionId }) || await getOrCreateCart(sessionId, storeId);
  if (meta.orderMode !== undefined) {
    if (!['counter', 'delivery'].includes(meta.orderMode)) throw new AppError('orderMode must be counter or delivery', 400);
    cart.orderMode = meta.orderMode;
  }
  if (meta.customerId !== undefined) {
    if (!mongoose.isValidObjectId(meta.customerId)) throw new AppError('Invalid customer ID', 400);
    const User = require('../../models/auth/User');
    if (!await User.exists({ _id: meta.customerId, status: { $ne: false } })) throw new AppError('Customer not found', 404);
    cart.customerId = meta.customerId;
  }
  if (meta.extraDiscount !== undefined) {
    const amount = Number(meta.extraDiscount);
    if (!Number.isFinite(amount) || amount < 0) throw new AppError('Discount must be a non-negative number', 400);
    cart.extraDiscount = amount;
  }
  if (meta.extraDiscountType !== undefined) {
    if (!['flat', 'percent'].includes(meta.extraDiscountType)) throw new AppError('Invalid discount type', 400);
    cart.extraDiscountType = meta.extraDiscountType;
  }
  if (cart.extraDiscountType === 'percent' && cart.extraDiscount > 100) {
    throw new AppError('Percentage discount cannot exceed 100', 400);
  }
  if (meta.taxPercent !== undefined) {
    const taxPercent = Number(meta.taxPercent);
    if (!Number.isFinite(taxPercent) || taxPercent < 0 || taxPercent > 100) throw new AppError('Tax must be between 0 and 100', 400);
    cart.taxPercent = taxPercent;
  }
  if (meta.deliveryAddress !== undefined) {
    if (cart.orderMode !== 'delivery') throw new AppError('Set delivery mode before adding a delivery address', 409);
    const address = meta.deliveryAddress;
    const required = ['contact_person_name', 'contact_person_number', 'address', 'floor', 'road', 'house'];
    if (!address || typeof address !== 'object' || Array.isArray(address)
      || required.some((key) => typeof address[key] !== 'string' || !address[key].trim())) {
      throw new AppError('Contact, address, floor, road and house details are required', 400);
    }
    const orderService = require('./order.service');
    const quote = await orderService.quoteDeliveryAddress(cart.storeId, address);
    cart.deliveryAddress = quote.deliveryAddress;
    cart.deliveryCharge = quote.deliveryCharge;
    cart.distanceKm = quote.distanceKm;
  }
  if (meta.useLoyaltyPoints !== undefined) cart.useLoyaltyPoints = Boolean(meta.useLoyaltyPoints);
  if (meta.notes !== undefined) {
    if (typeof meta.notes !== 'string' || meta.notes.length > 1000) throw new AppError('Notes must be 1,000 characters or fewer', 400);
    cart.notes = meta.notes;
  }
  if (cart.orderMode === 'counter') {
    cart.deliveryAddress = null;
    cart.deliveryCharge = 0;
    cart.distanceKm = 0;
  }
  await cart.save();
  return { cart, totals: calcCartTotals(cart) };
};

// ── Place POS Order ───────────────────────────────────────────────────────────
const placeOrder = async (sessionId, { paymentMethod, actorId, actorRole }) => {
  const Order = orderModel();
  const User = require('../../models/auth/User');
  const WalletTransaction = require('../../models/auth/WalletTransaction');
  const crypto = require('node:crypto');

  const cart = await PosCart.findOne({ sessionId });
  if (!cart) throw new AppError('Cart not found', 404);
  if (!cart.items.length) throw new AppError('Cart is empty', 400);

  const Store = require('../../models/store/Store');
  const store = await Store.findById(cart.storeId).select('name moduleId zoneId status active');
  if (!store || store.status === false || store.active === false) throw new AppError('Store is not available', 409);

  let deliveryAddress = null;
  let deliveryCharge = 0;
  let distanceKm = 0;
  if (cart.orderMode === 'delivery') {
    if (!cart.customerId) throw new AppError('Select a customer for delivery orders', 400);
    if (!cart.deliveryAddress) throw new AppError('Add delivery details before placing this order', 400);
    const orderService = require('./order.service');
    const quote = await orderService.quoteDeliveryAddress(cart.storeId, cart.deliveryAddress);
    deliveryAddress = quote.deliveryAddress;
    deliveryCharge = quote.deliveryCharge;
    distanceKm = quote.distanceKm;
    cart.deliveryAddress = deliveryAddress;
    cart.deliveryCharge = deliveryCharge;
    cart.distanceKm = distanceKm;
    await cart.save();
  }

  const VALID_METHODS = ['cash', 'card', 'upi', 'wallet', 'other'];
  if (!VALID_METHODS.includes(paymentMethod)) {
    throw new AppError(`paymentMethod must be one of: ${VALID_METHODS.join(', ')}`, 400);
  }

  const totals = calcCartTotals(cart);

  // Wallet balance check
  if (paymentMethod === 'wallet') {
    if (!cart.customerId) throw new AppError('Customer required for wallet payment', 400);
    const user = await User.findById(cart.customerId).select('walletBalance');
    if (!user || user.walletBalance < totals.grandTotal) throw new AppError('Insufficient wallet balance', 400);
  }

  const orderService = require('./order.service');
  const order = new Order({
    orderNumber: `POS-${Date.now()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
    ownerId: String(cart.customerId || new mongoose.Types.ObjectId()),
    isGuest: !cart.customerId,
    moduleId: String(store.moduleId),
    storeId: String(cart.storeId),
    storeName: store.name,
    ...(store.zoneId ? { zoneId: String(store.zoneId) } : {}),
    orderType: cart.orderMode === 'counter' ? 'pos' : 'delivery',
    orderStatus: 'stock_pending',
    paymentMethod: paymentMethod === 'cash' && cart.orderMode === 'delivery' ? 'cash_on_delivery'
      : ['card', 'upi', 'other'].includes(paymentMethod) ? 'digital_payment' : paymentMethod,
    paymentStatus: 'unpaid',
    items: cart.items.map((i) => ({
      itemId: String(i.itemId),
      itemName: i.itemName,
      variant: i.variant,
      variations: i.variations,
      addOns: i.addOns,
      addOnTotal: i.addOnTotal,
      offerLabel: i.offerLabel,
      quantity: i.qty,
      unitPrice: i.unitPrice,
      discountAmount: i.discountAmt,
      taxAmount: i.taxAmt,
      lineTotal: i.lineTotal,
    })),
    itemSubtotal: totals.itemSubtotal,
    itemDiscount: totals.itemDiscount + totals.extraDiscount,
    taxAmount: totals.taxTotal,
    deliveryCharge,
    distanceKm,
    orderAmount: totals.grandTotal,
    deliveryAddress,
    orderNote: cart.notes,
  });
  let stockReserved = false;
  try {
    await order.save();
    await orderService.reserveOrderStock(order._id.toString(), cart.storeId.toString(), cart.items.map((item) => ({
      itemId: item.itemId.toString(),
      variant: item.variant || '',
      qty: item.qty,
    })));
    stockReserved = true;
    order.stockReserved = true;
    await order.save();
    await orderService.commitOrderStock(order._id.toString());

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const consumed = await PosCart.deleteOne({ _id: cart._id, updatedAt: cart.updatedAt }, { session });
        if (consumed.deletedCount !== 1) throw new AppError('POS cart changed or was already checked out', 409);
        if (paymentMethod === 'wallet' && cart.customerId) {
          const user = await User.findById(cart.customerId).session(session);
          if (!user || user.walletBalance < totals.grandTotal) throw new AppError('Insufficient wallet balance', 400);
          user.walletBalance = money(user.walletBalance - totals.grandTotal);
          await user.save({ session });
          await WalletTransaction.create([{
            userId: user._id,
            type: 'debit',
            amount: totals.grandTotal,
            balance: user.walletBalance,
            referenceType: 'order',
            reference: order._id,
            note: `POS Order ${order.orderNumber}`,
          }], { session });
        }
        order.orderStatus = cart.orderMode === 'counter' ? 'delivered' : 'confirmed';
        order.deliveredAt = cart.orderMode === 'counter' ? new Date() : undefined;
        order.confirmedAt = cart.orderMode === 'delivery' ? new Date() : undefined;
        if (cart.orderMode === 'counter' || paymentMethod === 'wallet') order.paymentStatus = 'paid';
        await order.save({ session });
      });
    } finally {
      await session.endSession();
    }
  } catch (error) {
    if (stockReserved) {
      try {
        await orderService.releaseOrderStock(order._id.toString());
        order.stockReserved = false;
      } catch (releaseError) {
        error.message = `${error.message}; stock rollback also failed: ${releaseError.message}`;
      }
    }
    order.orderStatus = 'failed';
    order.failedReason = String(error.message || 'POS order failed').slice(0, 500);
    await order.save().catch(() => {});
    throw error;
  }

  return order;
};

// ── Customer search ───────────────────────────────────────────────────────────
const searchCustomers = async (q) => {
  const User = require('../../models/auth/User');
  if (!q?.trim()) {
    return User.find({ status: true }).sort({ createdAt: -1 }).limit(8)
      .select('fName lName phone walletBalance loyaltyPoint').lean();
  }
  const pattern = new RegExp(q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  return User.find({
    status: true,
    $or: [{ fName: pattern }, { lName: pattern }, { phone: pattern }],
  }).limit(8).select('fName lName phone walletBalance loyaltyPoint').lean();
};

const listItems = async (storeId, query = {}) => {
  const Item = require('../../models/catalog/Item');
  const AddOn = require('../../models/GeneratedBusinessModels').registeredModels.add_ons;
  if (!mongoose.isValidObjectId(storeId)) throw new AppError('storeId is required', 400);
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || 24));
  const filter = { storeId, status: { $ne: false }, isApproved: { $ne: false } };
  const keyword = String(query.search || '').trim().slice(0, 100);
  if (keyword) {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const matcher = new RegExp(escaped, 'i');
    filter.$or = [{ name: matcher }, { sku: matcher }, { barcode: matcher }];
  }
  const [items, total] = await Promise.all([
    Item.find(filter).sort({ name: 1, _id: 1 }).skip((page - 1) * limit).limit(limit)
      .select('_id name price stock image barcode sku tax taxType discount discountType offerBuyQty offerGetQty offerGetDiscount offerAllowSingle maximumCartQuantity trackBatch isPerishable variations foodVariations choiceOptions addOns').populate({ path: 'addOns', model: AddOn, select: 'name price status storeId' }).lean(),
    Item.countDocuments(filter),
  ]);
  const batchInfo = await batchMetadata(storeId, items);
  const enrichedItems = items.map((item) => {
    const batch = batchInfo.get(String(item._id));
    return { ...item, ...(batch || {}), stock: batch?.sellableQty ?? Number(item.stock || 0), sellableQty: batch?.sellableQty ?? Number(item.stock || 0) };
  });
  return { items: enrichedItems, pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
};

const listAdminStores = async (adminId) => {
  const Admin = require('../../models/auth/Admin');
  const Store = require('../../models/store/Store');
  const admin = await Admin.findById(adminId).select('zoneId status').lean();
  if (!admin || admin.status === false) throw new AppError('Admin account is not available', 403);
  const filter = { status: { $ne: false }, active: { $ne: false } };
  if (admin.zoneId) filter.zoneId = admin.zoneId;
  return Store.find(filter).sort({ name: 1 }).select('_id name moduleId zoneId').lean();
};

module.exports = {
  PosCart,
  getCart,
  addItem,
  updateItem,
  removeItem,
  holdCart,
  listHeldCarts,
  resumeHeldCart,
  discardHeldCart,
  scanItem,
  clearCart,
  setCartMeta,
  placeOrder,
  searchCustomers,
  listItems,
  listAdminStores,
};

const BrandSale = require('../../models/store/BrandSale');
const AppError = require('../../utils/AppError');
const { paginate } = require('../../utils/pagination');

const computeStatus = (sale) => {
  if (!sale.isActive) return 'paused';
  const now = new Date();
  if (now < sale.startAt) return 'scheduled';
  return now > sale.endAt ? 'ended' : 'running';
};

const getAll = async ({ status, page, limit: lim } = {}) => {
  const { skip, page: pg, limit } = paginate({ page, limit: lim });
  const [sales, total] = await Promise.all([
    BrandSale.find().sort({ createdAt: -1 }).skip(skip).limit(limit).populate('createdBy', 'fName lName'),
    BrandSale.countDocuments(),
  ]);
  const data = sales.map((s) => ({ ...s.toObject(), status: computeStatus(s) }));
  const filtered = status ? data.filter((s) => s.status === status) : data;
  return { sales: filtered, total, page: pg, limit, pages: Math.ceil(total / limit) };
};

const getById = async (id) => {
  const sale = await BrandSale.findById(id).populate('createdBy', 'fName lName');
  if (!sale) throw new AppError('Brand sale not found', 404);
  return { ...sale.toObject(), status: computeStatus(sale) };
};

const create = async (body, adminId) => {
  const { title, storeIds, brands, discountType, discount, applyOn, protectPurchasePrice, startAt, endAt, isActive } = body;
  if (!title || !brands?.length || !discountType || !discount || !startAt || !endAt)
    throw new AppError('title, brands, discountType, discount, startAt, endAt are required', 400);
  if (discountType === 'percent' && Number(discount) > 100)
    throw new AppError('Percent discount cannot exceed 100', 400);
  if (new Date(endAt) <= new Date(startAt))
    throw new AppError('endAt must be after startAt', 400);

  return BrandSale.create({
    title: title.trim(),
    storeIds: storeIds?.length ? storeIds : [],
    brands: brands.map((b) => b.trim()).filter(Boolean),
    discountType,
    discount: Number(discount),
    applyOn: applyOn || 'selling',
    protectPurchasePrice: !!protectPurchasePrice,
    startAt: new Date(startAt),
    endAt: new Date(endAt),
    isActive: isActive !== false,
    createdBy: adminId,
  });
};

const update = async (id, body) => {
  const allowed = ['title', 'storeIds', 'brands', 'discountType', 'discount', 'applyOn', 'protectPurchasePrice', 'startAt', 'endAt', 'isActive'];
  const fields = Object.fromEntries(allowed.filter((k) => body[k] !== undefined).map((k) => [k, body[k]]));
  if (!Object.keys(fields).length) throw new AppError('No valid fields to update', 400);
  if (fields.discountType === 'percent' && Number(fields.discount) > 100)
    throw new AppError('Percent discount cannot exceed 100', 400);

  const sale = await BrandSale.findByIdAndUpdate(id, fields, { new: true });
  if (!sale) throw new AppError('Brand sale not found', 404);
  return { ...sale.toObject(), status: computeStatus(sale) };
};

const toggle = async (id) => {
  const sale = await BrandSale.findById(id);
  if (!sale) throw new AppError('Brand sale not found', 404);
  sale.isActive = !sale.isActive;
  await sale.save();
  return { ...sale.toObject(), status: computeStatus(sale) };
};

const endNow = async (id) => {
  const sale = await BrandSale.findById(id);
  if (!sale) throw new AppError('Brand sale not found', 404);
  if (computeStatus(sale) !== 'running') throw new AppError('Sale is not currently running', 400);
  sale.endAt = new Date(Date.now() - 60000);
  await sale.save();
  return { ...sale.toObject(), status: 'ended' };
};

const remove = async (id) => {
  const sale = await BrandSale.findByIdAndDelete(id);
  if (!sale) throw new AppError('Brand sale not found', 404);
};

/** Returns running sales that match a brand name — used by order/POS pricing */
const getRunningForBrand = async (brandName) => {
  const now = new Date();
  return BrandSale.find({
    isActive: true,
    startAt: { $lte: now },
    endAt: { $gte: now },
    $or: [{ brands: brandName }, { brands: { $size: 0 } }],
  });
};

module.exports = { getAll, getById, create, update, toggle, endNow, remove, getRunningForBrand };

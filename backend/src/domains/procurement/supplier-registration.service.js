const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const PurchaseVendor = require('../../models/purchase/PurchaseVendor');
const AppError = require('../../utils/AppError');
const options = require('./supplier-registration-options');

const uploadDirectory = path.resolve(__dirname, '../../../storage/supplier-registration');
const text = (value) => typeof value === 'string' ? value.trim() : '';
const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const within = (value, values) => values.includes(value);

const readJsonField = (value, name) => {
  if (typeof value !== 'string') throw new AppError(`${name} must be provided`, 400);
  try {
    return JSON.parse(value);
  } catch {
    throw new AppError(`${name} must be valid JSON`, 400);
  }
};

const validateRegistration = (body, files) => {
  const requiredText = [
    'firstName', 'lastName', 'legalName', 'displayName', 'email', 'gstTreatment',
    'sourceOfSupply', 'mobile', 'language', 'gstin', 'pan', 'currency',
    'billingAddressLine1', 'billingCity', 'billingState', 'billingZip',
  ];
  for (const field of requiredText) {
    if (!text(body[field])) throw new AppError(`${field} is required`, 400);
  }
  for (const field of ['firstName', 'lastName', 'legalName', 'displayName', 'email']) {
    if (text(body[field]).length > 255) throw new AppError(`${field} must be at most 255 characters`, 400);
  }
  if (!isEmail(text(body.email))) throw new AppError('email must be valid', 400);
  if (!within(body.gstTreatment, Object.keys(options.gstTreatments))) {
    throw new AppError('gstTreatment is invalid', 400);
  }
  if (!within(body.sourceOfSupply, options.states)) throw new AppError('sourceOfSupply is invalid', 400);
  if (!within(body.billingState, options.states)) throw new AppError('billingState is invalid', 400);
  if (!within(body.language, options.languages)) throw new AppError('language is invalid', 400);
  if (!within(body.currency, options.currencies)) throw new AppError('currency is invalid', 400);
  if (body.paymentTerms && !within(body.paymentTerms, options.paymentTerms)) {
    throw new AppError('paymentTerms is invalid', 400);
  }
  if (body.salutation && !within(body.salutation, options.salutations)) {
    throw new AppError('salutation is invalid', 400);
  }
  if (body.termsAccepted !== 'true') throw new AppError('Please accept the Terms of Trade', 400);

  const contacts = readJsonField(body.contacts, 'contacts');
  const banks = readJsonField(body.banks, 'banks');
  const addresses = readJsonField(body.addresses, 'addresses');
  const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
  if (!Array.isArray(contacts) || contacts.length < 1 || contacts.length > 10
    || contacts.some((contact) => !isRecord(contact))
    || !text(contacts[0]?.firstName) || !text(contacts[0]?.mobile)) {
    throw new AppError('At least one contact with a first name and mobile is required', 400);
  }
  if (!Array.isArray(banks) || banks.length < 1 || banks.length > 10
    || banks.some((bank) => !isRecord(bank))) {
    throw new AppError('At least one bank account is required', 400);
  }
  const primaryBank = banks[0];
  if (!text(primaryBank?.accountHolderName) || !text(primaryBank?.bankName)
    || !text(primaryBank?.accountNumber) || !text(primaryBank?.ifsc)) {
    throw new AppError('The first bank account requires holder name, bank name, account number, and IFSC', 400);
  }
  for (const [index, bank] of banks.entries()) {
    if (text(bank.accountNumber) && text(bank.accountNumber) !== text(bank.accountNumberConfirm)) {
      throw new AppError(`Bank account numbers do not match for bank ${index + 1}`, 400);
    }
  }
  if (!Array.isArray(addresses) || addresses.length < 1 || addresses.length > 2
    || addresses.some((address) => !isRecord(address))
    || !text(addresses[0]?.addressLine1) || !text(addresses[0]?.city)
    || !text(addresses[0]?.state) || !text(addresses[0]?.zip)) {
    throw new AppError('Complete billing address details are required', 400);
  }
  if (!Array.isArray(files.documents) || files.documents.length < 1 || files.documents.length > 10) {
    throw new AppError('Upload between 1 and 10 supporting documents', 400);
  }
  if (files.photo?.[0]?.size > 5 * 1024 * 1024) {
    throw new AppError('Profile photo must not exceed 5 MB', 400);
  }

  return {
    contacts: contacts.filter((contact) => (
      text(contact.firstName) || text(contact.email) || text(contact.mobile)
    )),
    banks: banks.filter((bank) => text(bank.accountNumber) || text(bank.bankName)),
    addresses,
  };
};

const persistFile = async (file, subdirectory) => {
  const directory = path.join(uploadDirectory, subdirectory);
  await fs.mkdir(directory, { recursive: true });
  const extension = path.extname(path.basename(file.originalname)).toLowerCase();
  const filename = `${crypto.randomUUID()}${extension}`;
  await fs.writeFile(path.join(directory, filename), file.buffer, { flag: 'wx' });
  return {
    path: `supplier-registration/${subdirectory}/${filename}`,
    originalName: path.basename(file.originalname).slice(0, 255),
    size: file.size,
    contentType: file.mimetype,
  };
};

exports.register = async (body, files = {}) => {
  const parsed = validateRegistration(body, files);
  const email = text(body.email).toLowerCase();
  if (await PurchaseVendor.exists({ email })) {
    throw new AppError('An account with this email already exists', 409);
  }

  const writtenFiles = [];
  let supplier;
  try {
    const documents = [];
    for (const file of files.documents) {
      const saved = await persistFile(file, 'documents');
      writtenFiles.push(saved.path);
      documents.push(saved);
    }
    let photo;
    if (files.photo?.[0]) {
      const savedPhoto = await persistFile(files.photo[0], 'photos');
      writtenFiles.push(savedPhoto.path);
      photo = savedPhoto.path;
    }

    supplier = await PurchaseVendor.create({
      salutation: text(body.salutation) || undefined,
      firstName: text(body.firstName),
      lastName: text(body.lastName),
      legalName: text(body.legalName),
      displayName: text(body.displayName),
      email,
      mobile: text(body.mobile),
      workPhone: text(body.workPhone) || undefined,
      currency: body.currency,
      gstTreatment: body.gstTreatment,
      gstin: text(body.gstin),
      pan: text(body.pan),
      sourceOfSupply: body.sourceOfSupply,
      state: body.sourceOfSupply,
      language: body.language,
      paymentTerms: text(body.paymentTerms) || undefined,
      msmeRegistered: body.msmeRegistered === 'true',
      tds: text(body.tds) || undefined,
      notes: text(body.notes) || undefined,
      photo,
      approvalStatus: 'pending',
      portalStatus: 'enabled',
      status: true,
      termsAcceptedAt: new Date(),
      addresses: parsed.addresses.filter((address, index) => (
        index === 0 || text(address.addressLine1) || text(address.city)
      )).map((address, index) => ({
        ...address,
        type: index === 0 ? 'billing' : 'shipping',
        country: text(address.country) || 'India',
        isDefault: index === 0,
      })),
      banks: parsed.banks.map((bank, index) => ({
        accountHolderName: text(bank.accountHolderName),
        bankName: text(bank.bankName),
        accountNumber: text(bank.accountNumber),
        ifsc: text(bank.ifsc),
        branch: text(bank.branch) || undefined,
        isPrimary: index === 0,
      })),
      contacts: parsed.contacts.map((contact) => ({
        salutation: text(contact.salutation) || undefined,
        firstName: text(contact.firstName),
        lastName: text(contact.lastName) || undefined,
        email: text(contact.email).toLowerCase() || undefined,
        workPhone: text(contact.workPhone) || undefined,
        mobile: text(contact.mobile),
      })),
      documents,
    });
  } catch (error) {
    if (error.code === 11000) {
      throw new AppError('An account with this email already exists', 409);
    }
    if (supplier?._id) await PurchaseVendor.deleteOne({ _id: supplier._id });
    await Promise.all(writtenFiles.map((relativePath) => (
      fs.unlink(path.join(path.resolve(__dirname, '../../../storage'), relativePath))
    )));
    throw error;
  }

  return { id: supplier._id, email: supplier.email, displayName: supplier.displayName };
};

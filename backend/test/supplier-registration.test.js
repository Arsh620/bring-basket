const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs/promises');
const path = require('path');
const PurchaseVendor = require('../src/models/purchase/PurchaseVendor');
const registration = require('../src/domains/procurement/supplier-registration.service');

const makeRequest = (overrides = {}) => ({
  firstName: 'Asha',
  lastName: 'Sharma',
  legalName: 'Asha Foods Pvt Ltd',
  displayName: 'Asha Foods',
  email: 'SUPPLIER@example.com',
  gstTreatment: 'registered_regular',
  sourceOfSupply: 'Delhi',
  mobile: '9876543210',
  language: 'English',
  gstin: '07ABCDE1234F1Z5',
  pan: 'ABCDE1234F',
  currency: 'INR',
  billingAddressLine1: '12 Market Road',
  billingCity: 'New Delhi',
  billingState: 'Delhi',
  billingZip: '110001',
  termsAccepted: 'true',
  contacts: JSON.stringify([{ firstName: 'Asha', mobile: '9876543210' }]),
  banks: JSON.stringify([{
    accountHolderName: 'Asha Sharma',
    bankName: 'Example Bank',
    accountNumber: '1234567890',
    accountNumberConfirm: '1234567890',
    ifsc: 'EXAM0001234',
  }]),
  addresses: JSON.stringify([
    { addressLine1: '12 Market Road', city: 'New Delhi', state: 'Delhi', zip: '110001' },
    {},
  ]),
  ...overrides,
});

test('public registration persists a complete pending supplier and documents', async (t) => {
  const originalExists = PurchaseVendor.exists;
  const originalCreate = PurchaseVendor.create;
  let created;
  PurchaseVendor.exists = async () => false;
  PurchaseVendor.create = async (data) => {
    created = data;
    return { _id: 'supplier-id', email: data.email, displayName: data.displayName };
  };
  t.after(() => {
    PurchaseVendor.exists = originalExists;
    PurchaseVendor.create = originalCreate;
  });

  const file = {
    originalname: '../../gst-certificate.pdf',
    mimetype: 'application/pdf',
    size: 12,
    buffer: Buffer.from('%PDF-test'),
  };
  const result = await registration.register(makeRequest(), { documents: [file] });
  t.after(async () => {
    const storedFile = path.resolve(__dirname, '../storage', created.documents[0].path);
    await fs.unlink(storedFile).catch(() => {});
  });

  assert.deepEqual(result, {
    id: 'supplier-id',
    email: 'supplier@example.com',
    displayName: 'Asha Foods',
  });
  assert.equal(created.approvalStatus, 'pending');
  assert.equal(created.portalStatus, 'enabled');
  assert.equal(created.status, true);
  assert.equal(created.password, undefined);
  assert.equal(created.termsAcceptedAt instanceof Date, true);
  assert.equal(created.addresses.length, 1);
  assert.equal(created.addresses[0].type, 'billing');
  assert.equal(created.banks[0].isPrimary, true);
  assert.equal(created.contacts[0].firstName, 'Asha');
  assert.equal(created.documents[0].originalName, 'gst-certificate.pdf');
  assert.match(created.documents[0].path, /^supplier-registration\/documents\/[a-f\d-]+\.pdf$/i);

  const storedFile = path.resolve(__dirname, '../storage', created.documents[0].path);
  assert.deepEqual(await fs.readFile(storedFile), file.buffer);
});

test('registration rejects mismatched bank confirmation before creating supplier', async (t) => {
  const originalExists = PurchaseVendor.exists;
  const originalCreate = PurchaseVendor.create;
  PurchaseVendor.exists = async () => false;
  PurchaseVendor.create = async () => {
    throw new Error('Supplier must not be created for invalid bank details');
  };
  t.after(() => {
    PurchaseVendor.exists = originalExists;
    PurchaseVendor.create = originalCreate;
  });

  const body = makeRequest({
    banks: JSON.stringify([{
      accountHolderName: 'Asha Sharma',
      bankName: 'Example Bank',
      accountNumber: '1234567890',
      accountNumberConfirm: 'different',
      ifsc: 'EXAM0001234',
    }]),
  });
  await assert.rejects(
    registration.register(body, { documents: [{ originalname: 'id.pdf' }] }),
    (error) => error.statusCode === 400 && /do not match/i.test(error.message),
  );
});

test('registration rejects an existing email and invalid terms acceptance', async (t) => {
  const originalExists = PurchaseVendor.exists;
  PurchaseVendor.exists = async () => true;
  t.after(() => { PurchaseVendor.exists = originalExists; });

  await assert.rejects(
    registration.register(makeRequest(), { documents: [{ originalname: 'id.pdf' }] }),
    (error) => error.statusCode === 409,
  );

  PurchaseVendor.exists = async () => false;
  await assert.rejects(
    registration.register(makeRequest({ termsAccepted: 'false' }), { documents: [{ originalname: 'id.pdf' }] }),
    (error) => error.statusCode === 400 && /Terms of Trade/i.test(error.message),
  );
});

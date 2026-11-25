const test = require('node:test');
const assert = require('node:assert/strict');
const { backfillRoleReferences } = require('../scripts/importFromMySQL');

const makeDatabase = (initial) => {
  const collections = Object.fromEntries(
    Object.entries(initial).map(([name, records]) => [name, records.map((record) => ({ ...record }))]),
  );
  return {
    collection(name) {
      const records = collections[name] ?? (collections[name] = []);
      return {
        find(filter) {
          let selected = records.filter((record) => {
            const [field, condition] = Object.entries(filter)[0];
            if (condition.$exists !== undefined) return (field in record) === condition.$exists;
            if (condition.$type === 'number') return typeof record[field] === 'number';
            return false;
          });
          return {
            project() {
              return {
                async toArray() {
                  return selected;
                },
              };
            },
          };
        },
        async bulkWrite(operations) {
          let modifiedCount = 0;
          for (const { updateOne } of operations) {
            const record = records.find(({ _id }) => _id === updateOne.filter._id);
            Object.assign(record, updateOne.update.$set);
            modifiedCount += 1;
          }
          return { modifiedCount };
        },
      };
    },
    records: collections,
  };
};

test('role backfill converts legacy ids to Mongo references and is idempotent', async () => {
  const db = makeDatabase({
    adminroles: [{ _id: 'admin-role', legacyId: 1 }],
    employeeroles: [{ _id: 'employee-role', legacyId: 2, storeId: 3 }],
    vendors: [{ _id: 'vendor', legacyId: 4 }],
    stores: [{ _id: 'store', legacyId: 3, vendorId: 4 }],
    zones: [{ _id: 'zone', legacyId: 5 }],
    admins: [{ _id: 'admin', roleId: 1, zoneId: 5 }, { _id: 'root', roleId: 1, zoneId: 0 }],
    vendoremployees: [{ _id: 'employee', employeeRoleId: 2, vendorId: 4, storeId: 3 }],
  });

  assert.equal(await backfillRoleReferences(db), 9);
  assert.deepEqual(db.records.admins.map(({ roleId, zoneId }) => [roleId, zoneId]), [
    ['admin-role', 'zone'],
    ['admin-role', null],
  ]);
  assert.equal(db.records.employeeroles[0].storeId, 'store');
  assert.deepEqual(
    [db.records.vendoremployees[0].employeeRoleId, db.records.vendoremployees[0].vendorId, db.records.vendoremployees[0].storeId],
    ['employee-role', 'vendor', 'store'],
  );
  assert.equal(db.records.stores[0].vendorId, 'vendor');
  assert.equal(await backfillRoleReferences(db), 0);
});

test('role backfill fails explicitly when a required legacy reference cannot be resolved', async () => {
  const db = makeDatabase({
    adminroles: [],
    admins: [{ _id: 'admin', roleId: 17 }],
  });

  await assert.rejects(backfillRoleReferences(db), /admins\.roleId=17/);
});

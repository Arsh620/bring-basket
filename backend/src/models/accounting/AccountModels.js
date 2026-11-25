const mongoose = require('mongoose');

const ledgerSchema = new mongoose.Schema({
  code:       { type: String, required: true, unique: true, trim: true, maxlength: 32 },
  name:       { type: String, required: true, trim: true, maxlength: 191 },
  type:       { type: String, required: true, enum: ['asset', 'liability', 'equity', 'income', 'expense'] },
  gstFlag:    { type: String, maxlength: 32, default: null },
  isSystem:   { type: Boolean, default: false },
  isCashBank: { type: Boolean, default: false },
  status:     { type: Boolean, default: true },
}, { timestamps: true });

const journalEntrySchema = new mongoose.Schema({
  entryDate:  { type: Date, required: true },
  voucherNo:  { type: String, required: true, unique: true, trim: true },
  sourceType: { type: String, maxlength: 64, index: true },
  sourceId:   { type: String, maxlength: 64, index: true },
  narration:  { type: String, maxlength: 500 },
}, { timestamps: true });

journalEntrySchema.index({ sourceType: 1, sourceId: 1 }, { unique: true, sparse: true });

const journalLineSchema = new mongoose.Schema({
  entryId:  { type: mongoose.Schema.Types.ObjectId, ref: 'AccountJournalEntry', required: true, index: true },
  ledgerId: { type: mongoose.Schema.Types.ObjectId, ref: 'AccountLedger', required: true, index: true },
  debit:    { type: Number, default: 0 },
  credit:   { type: Number, default: 0 },
}, { timestamps: true });

const AccountLedger       = mongoose.models.AccountLedger       || mongoose.model('AccountLedger', ledgerSchema);
const AccountJournalEntry = mongoose.models.AccountJournalEntry || mongoose.model('AccountJournalEntry', journalEntrySchema);
const AccountJournalLine  = mongoose.models.AccountJournalLine  || mongoose.model('AccountJournalLine', journalLineSchema);

module.exports = { AccountLedger, AccountJournalEntry, AccountJournalLine };

const mongoose = require('mongoose');

// Block Schema
const blockSchema = new mongoose.Schema({
  height: { type: Number, unique: true, required: true, index: true },
  hash: { type: String, unique: true, required: true, index: true },
  confirmations: Number,
  size: Number,
  version: Number,
  merkleroot: String,
  time: { type: Date, index: true },
  nonce: Number,
  bits: String,
  difficulty: Number,
  chainwork: String,
  previousblockhash: String,
  nextblockhash: String,
  txCount: Number,
  reward: Number
}, {
  timestamps: true
});

// Transaction Schema
const transactionSchema = new mongoose.Schema({
  txid: { type: String, unique: true, required: true, index: true },
  blockHeight: { type: Number, index: true },
  blockHash: String,
  blockTime: { type: Date, index: true },
  version: Number,
  size: Number,
  locktime: Number,
  inputs: [{
    txid: String,
    vout: Number,
    scriptSig: String,
    sequence: Number,
    coinbase: String,
    value: Number,
    addresses: [String]
  }],
  outputs: [{
    value: Number,
    n: Number,
    scriptPubKey: mongoose.Schema.Types.Mixed
  }],
  totalInput: Number,
  totalOutput: Number,
  fees: Number
}, {
  timestamps: true
});

// Address Schema
const addressSchema = new mongoose.Schema({
  address: { type: String, unique: true, required: true, index: true },
  balance: { type: Number, default: 0 },
  totalReceived: { type: Number, default: 0 },
  totalSent: { type: Number, default: 0 },
  txCount: { type: Number, default: 0 },
  firstSeen: Date,
  lastSeen: Date
}, {
  timestamps: true
});

// Sync Status Schema
const syncStatusSchema = new mongoose.Schema({
  key: { type: String, unique: true, default: 'main' },
  lastBlockHeight: { type: Number, default: 0 },
  lastBlockHash: String,
  lastSyncTime: Date,
  syncing: { type: Boolean, default: false }
});

// Create indexes for performance
blockSchema.index({ time: -1 });
transactionSchema.index({ blockTime: -1 });
transactionSchema.index({ 'outputs.scriptPubKey.addresses': 1 });
transactionSchema.index({ 'inputs.addresses': 1 });

module.exports = {
  Block: mongoose.model('Block', blockSchema),
  Transaction: mongoose.model('Transaction', transactionSchema),
  Address: mongoose.model('Address', addressSchema),
  SyncStatus: mongoose.model('SyncStatus', syncStatusSchema)
};

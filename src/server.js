const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const rpc = require('./rpc');
const { Block, Transaction, Address, SyncStatus } = require('./models');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✓ Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// API Routes

// Network status
app.get('/api/status', async (req, res) => {
  try {
    const [blockchainInfo, networkInfo, syncStatus, blockCount, txCount] = await Promise.all([
      rpc.getBlockchainInfo(),
      rpc.getNetworkInfo(),
      SyncStatus.findOne({ key: 'main' }),
      Block.countDocuments(),
      Transaction.countDocuments()
    ]);

    res.json({
      network: {
        version: networkInfo.version,
        subversion: networkInfo.subversion,
        protocolversion: networkInfo.protocolversion,
        connections: networkInfo.connections
      },
      blockchain: {
        chain: blockchainInfo.chain,
        blocks: blockchainInfo.blocks,
        headers: blockchainInfo.headers,
        difficulty: blockchainInfo.difficulty,
        mediantime: blockchainInfo.mediantime
      },
      sync: {
        indexedBlocks: syncStatus ? syncStatus.lastBlockHeight + 1 : 0,
        totalBlocks: blockchainInfo.blocks,
        percentage: syncStatus ? ((syncStatus.lastBlockHeight + 1) / blockchainInfo.blocks * 100).toFixed(2) : 0,
        lastSyncTime: syncStatus ? syncStatus.lastSyncTime : null
      },
      database: {
        blocks: blockCount,
        transactions: txCount
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Latest blocks
app.get('/api/blocks', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const blocks = await Block.find()
      .sort({ height: -1 })
      .limit(limit)
      .select('-_id -__v -createdAt -updatedAt');

    res.json(blocks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get block by height or hash
app.get('/api/block/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    let block;

    if (/^\d+$/.test(identifier)) {
      // It's a height
      block = await Block.findOne({ height: parseInt(identifier) })
        .select('-_id -__v -createdAt -updatedAt');
    } else {
      // It's a hash
      block = await Block.findOne({ hash: identifier })
        .select('-_id -__v -createdAt -updatedAt');
    }

    if (!block) {
      return res.status(404).json({ error: 'Block not found' });
    }

    // Get transactions for this block
    const transactions = await Transaction.find({ blockHash: block.hash })
      .select('-_id -__v -createdAt -updatedAt')
      .limit(100);

    res.json({
      ...block.toObject(),
      transactions
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Latest transactions
app.get('/api/transactions', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const transactions = await Transaction.find()
      .sort({ blockTime: -1 })
      .limit(limit)
      .select('-_id -__v -createdAt -updatedAt');

    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get transaction by txid
app.get('/api/transaction/:txid', async (req, res) => {
  try {
    const transaction = await Transaction.findOne({ txid: req.params.txid })
      .select('-_id -__v -createdAt -updatedAt');

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json(transaction);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get address info
app.get('/api/address/:address', async (req, res) => {
  try {
    const address = await Address.findOne({ address: req.params.address })
      .select('-_id -__v -createdAt -updatedAt');

    if (!address) {
      return res.status(404).json({ error: 'Address not found' });
    }

    // Get transactions for this address
    const transactions = await Transaction.find({
      $or: [
        { 'outputs.scriptPubKey.addresses': req.params.address },
        { 'inputs.addresses': req.params.address }
      ]
    })
      .sort({ blockTime: -1 })
      .limit(50)
      .select('-_id -__v -createdAt -updatedAt');

    res.json({
      ...address.toObject(),
      transactions
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Search endpoint
app.get('/api/search/:query', async (req, res) => {
  try {
    const { query } = req.params;

    // Check if it's a block height
    if (/^\d+$/.test(query)) {
      const block = await Block.findOne({ height: parseInt(query) });
      if (block) {
        return res.json({ type: 'block', data: block });
      }
    }

    // Check if it's a block hash
    if (/^[0-9a-f]{64}$/i.test(query)) {
      const block = await Block.findOne({ hash: query });
      if (block) {
        return res.json({ type: 'block', data: block });
      }

      // Check if it's a transaction
      const tx = await Transaction.findOne({ txid: query });
      if (tx) {
        return res.json({ type: 'transaction', data: tx });
      }
    }

    // Check if it's an address
    const address = await Address.findOne({ address: query });
    if (address) {
      return res.json({ type: 'address', data: address });
    }

    res.status(404).json({ error: 'Not found' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`✓ Badcoin Explorer running on port ${PORT}`);
  console.log(`  API: http://localhost:${PORT}/api/status`);
  console.log(`  Web: http://localhost:${PORT}`);
});

module.exports = app;

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const rpc = require('./rpc');
const { Block, Transaction, Address, SyncStatus, NetworkStatus } = require('./models');
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

// Network status - reads from DB (populated by sync worker)
app.get('/api/status', async (req, res) => {
  try {
    const [networkStatus, syncStatus, blockCount, txCount] = await Promise.all([
      NetworkStatus.findOne({ key: 'main' }),
      SyncStatus.findOne({ key: 'main' }),
      Block.countDocuments(),
      Transaction.countDocuments()
    ]);

    if (!networkStatus) {
      return res.status(503).json({ error: 'Network status not yet available. Sync worker may still be starting.' });
    }

    res.json({
      network: {
        version: networkStatus.version,
        subversion: networkStatus.subversion,
        protocolversion: networkStatus.protocolversion,
        connections: networkStatus.connections
      },
      blockchain: {
        chain: networkStatus.chain,
        blocks: networkStatus.blocks,
        headers: networkStatus.headers,
        difficulty: networkStatus.difficulty,
        mediantime: networkStatus.mediantime
      },
      mining: {
        hashrate: networkStatus.hashrate,
        mempoolSize: networkStatus.mempoolSize,
        mempoolBytes: networkStatus.mempoolBytes
      },
      sync: {
        indexedBlocks: syncStatus ? syncStatus.lastBlockHeight + 1 : 0,
        totalBlocks: networkStatus.blocks,
        percentage: syncStatus ? ((syncStatus.lastBlockHeight + 1) / networkStatus.blocks * 100).toFixed(2) : 0,
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

// Rich list
app.get('/api/richlist', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const addresses = await Address.find({ balance: { $gt: 0 } })
      .sort({ balance: -1 })
      .limit(limit)
      .select('-_id address balance totalReceived totalSent txCount');

    res.json(addresses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Network statistics
app.get('/api/stats', async (req, res) => {
  try {
    const [totalBlocks, totalTxs, totalAddresses, recentBlocks] = await Promise.all([
      Block.countDocuments(),
      Transaction.countDocuments(),
      Address.countDocuments(),
      Block.find().sort({ height: -1 }).limit(100).select('time difficulty')
    ]);

    // Calculate total supply from blocks (coinbase rewards)
    const blockRewards = await Block.aggregate([
      { $group: { _id: null, total: { $sum: '$reward' } } }
    ]);
    const totalSupply = blockRewards[0]?.total || 0;

    // Calculate average block time from recent blocks
    let avgBlockTime = 600; // default 10 min
    if (recentBlocks.length > 1) {
      const times = recentBlocks.map(b => b.time.getTime());
      const diffs = [];
      for (let i = 0; i < times.length - 1; i++) {
        diffs.push(Math.abs(times[i] - times[i + 1]));
      }
      avgBlockTime = diffs.reduce((a, b) => a + b, 0) / diffs.length / 1000; // convert to seconds
    }

    res.json({
      totalBlocks,
      totalTransactions: totalTxs,
      totalAddresses,
      totalSupply,
      avgBlockTime: Math.round(avgBlockTime)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Chart data - Block times
app.get('/api/charts/blocktimes', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const blocks = await Block.find()
      .sort({ height: -1 })
      .limit(limit)
      .select('height time');

    const data = [];
    for (let i = 0; i < blocks.length - 1; i++) {
      const timeDiff = Math.abs(blocks[i].time - blocks[i + 1].time) / 1000; // seconds
      data.push({
        height: blocks[i].height,
        time: timeDiff
      });
    }

    res.json(data.reverse());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Chart data - Difficulty
app.get('/api/charts/difficulty', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const blocks = await Block.find()
      .sort({ height: -1 })
      .limit(limit)
      .select('height difficulty');

    const data = blocks.reverse().map(b => ({
      height: b.height,
      difficulty: b.difficulty
    }));

    res.json(data);
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

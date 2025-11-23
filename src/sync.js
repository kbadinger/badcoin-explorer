const mongoose = require('mongoose');
const rpc = require('./rpc');
const { Block, Transaction, Address, SyncStatus } = require('./models');
require('dotenv').config();

class BlockchainSync {
  constructor() {
    this.syncing = false;
    this.batchSize = parseInt(process.env.BATCH_SIZE) || 100;
  }

  async connect() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✓ Connected to MongoDB');
  }

  async start() {
    await this.connect();
    console.log('Starting blockchain sync...');

    while (true) {
      try {
        await this.syncBlocks();
        await this.sleep(parseInt(process.env.SYNC_INTERVAL) || 5000);
      } catch (error) {
        console.error('Sync error:', error.message);
        await this.sleep(10000);
      }
    }
  }

  async syncBlocks() {
    const chainHeight = await rpc.getBlockCount();
    let syncStatus = await SyncStatus.findOne({ key: 'main' });

    if (!syncStatus) {
      syncStatus = new SyncStatus({ key: 'main', lastBlockHeight: -1 });
    }

    const startHeight = syncStatus.lastBlockHeight + 1;

    if (startHeight > chainHeight) {
      // Fully synced
      return;
    }

    const endHeight = Math.min(startHeight + this.batchSize - 1, chainHeight);
    console.log(`Syncing blocks ${startHeight} to ${endHeight} (${chainHeight - endHeight} remaining)`);

    for (let height = startHeight; height <= endHeight; height++) {
      await this.indexBlock(height);

      // Update sync status every 10 blocks
      if (height % 10 === 0) {
        syncStatus.lastBlockHeight = height;
        syncStatus.lastSyncTime = new Date();
        await syncStatus.save();
      }
    }

    // Final update
    syncStatus.lastBlockHeight = endHeight;
    syncStatus.lastSyncTime = new Date();
    await syncStatus.save();
  }

  async indexBlock(height) {
    try {
      const hash = await rpc.getBlockHash(height);
      const blockData = await rpc.getBlock(hash, 2);

      // Check if block already indexed
      const exists = await Block.findOne({ height });
      if (exists) return;

      // Save block
      const block = new Block({
        height: blockData.height,
        hash: blockData.hash,
        confirmations: blockData.confirmations,
        size: blockData.size,
        version: blockData.version,
        merkleroot: blockData.merkleroot,
        time: new Date(blockData.time * 1000),
        nonce: blockData.nonce,
        bits: blockData.bits,
        difficulty: blockData.difficulty,
        chainwork: blockData.chainwork,
        previousblockhash: blockData.previousblockhash,
        nextblockhash: blockData.nextblockhash,
        txCount: blockData.tx ? blockData.tx.length : 0
      });

      await block.save();

      // Index transactions
      if (blockData.tx && blockData.tx.length > 0) {
        for (const tx of blockData.tx) {
          await this.indexTransaction(tx, blockData);
        }
      }

      if (height % 100 === 0) {
        console.log(`✓ Indexed block ${height}`);
      }
    } catch (error) {
      console.error(`Error indexing block ${height}:`, error.message);
      throw error;
    }
  }

  async indexTransaction(txData, blockData) {
    try {
      // Check if already indexed
      const exists = await Transaction.findOne({ txid: txData.txid });
      if (exists) return;

      const tx = new Transaction({
        txid: txData.txid,
        blockHeight: blockData.height,
        blockHash: blockData.hash,
        blockTime: new Date(blockData.time * 1000),
        version: txData.version,
        size: txData.size,
        locktime: txData.locktime,
        inputs: txData.vin ? txData.vin.map(vin => ({
          txid: vin.txid,
          vout: vin.vout,
          scriptSig: vin.scriptSig ? vin.scriptSig.hex : null,
          sequence: vin.sequence,
          coinbase: vin.coinbase
        })) : [],
        outputs: txData.vout ? txData.vout.map(vout => ({
          value: vout.value,
          n: vout.n,
          scriptPubKey: vout.scriptPubKey
        })) : [],
        totalOutput: txData.vout ? txData.vout.reduce((sum, vout) => sum + vout.value, 0) : 0
      });

      await tx.save();

      // Update address balances (simplified - in production you'd want more sophisticated tracking)
      for (const vout of txData.vout || []) {
        if (vout.scriptPubKey && vout.scriptPubKey.addresses) {
          for (const addr of vout.scriptPubKey.addresses) {
            await this.updateAddress(addr, vout.value, blockData.time);
          }
        }
      }
    } catch (error) {
      console.error(`Error indexing transaction ${txData.txid}:`, error.message);
    }
  }

  async updateAddress(address, value, time) {
    try {
      let addr = await Address.findOne({ address });

      if (!addr) {
        addr = new Address({
          address,
          balance: value,
          totalReceived: value,
          txCount: 1,
          firstSeen: new Date(time * 1000),
          lastSeen: new Date(time * 1000)
        });
      } else {
        addr.balance += value;
        addr.totalReceived += value;
        addr.txCount += 1;
        addr.lastSeen = new Date(time * 1000);
      }

      await addr.save();
    } catch (error) {
      // Ignore address update errors for now
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Run sync if executed directly
if (require.main === module) {
  const sync = new BlockchainSync();
  sync.start().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = BlockchainSync;

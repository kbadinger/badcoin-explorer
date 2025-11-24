#!/usr/bin/env node

/**
 * Backfill Block Rewards
 * Calculates and updates the reward field for existing blocks
 * Run this after updating sync.js to populate historical data
 */

const mongoose = require('mongoose');
const rpc = require('./src/rpc');
const { Block } = require('./src/models');
require('dotenv').config();

async function backfillRewards() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✓ Connected');

  // Find all blocks without reward field
  const blocksWithoutReward = await Block.find({
    $or: [
      { reward: { $exists: false } },
      { reward: null },
      { reward: 0 }
    ]
  }).sort({ height: 1 });

  console.log(`Found ${blocksWithoutReward.length} blocks to update`);

  if (blocksWithoutReward.length === 0) {
    console.log('✓ All blocks already have rewards calculated');
    process.exit(0);
  }

  let updated = 0;
  let errors = 0;

  for (const block of blocksWithoutReward) {
    try {
      // Get full block data with transactions
      const blockData = await rpc.getBlock(block.hash, 2);

      // Calculate reward from coinbase transaction
      let reward = 0;
      if (blockData.tx && blockData.tx.length > 0) {
        const coinbaseTx = blockData.tx[0];
        if (coinbaseTx.vout) {
          reward = coinbaseTx.vout.reduce((sum, vout) => sum + vout.value, 0);
        }
      }

      // Update block
      block.reward = reward;
      await block.save();

      updated++;

      if (updated % 100 === 0) {
        console.log(`Progress: ${updated}/${blocksWithoutReward.length} blocks updated`);
      }
    } catch (error) {
      errors++;
      console.error(`Error updating block ${block.height}:`, error.message);

      // Continue with next block
      if (errors > 10) {
        console.error('Too many errors, stopping');
        break;
      }
    }
  }

  console.log('');
  console.log('================================');
  console.log('Backfill Complete!');
  console.log('================================');
  console.log(`✓ Updated: ${updated} blocks`);
  console.log(`✗ Errors: ${errors} blocks`);
  console.log('');

  // Show total supply
  const totalSupplyResult = await Block.aggregate([
    { $group: { _id: null, total: { $sum: '$reward' } } }
  ]);
  const totalSupply = totalSupplyResult[0]?.total || 0;
  console.log(`Total Supply: ${totalSupply.toFixed(8)} BAD`);

  await mongoose.disconnect();
  process.exit(0);
}

// Run backfill
backfillRewards().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

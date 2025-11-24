# Badcoin Explorer - Project Status

**Last Updated:** 2025-11-24
**Repository:** https://github.com/kbadinger/badcoin-explorer
**Live URL:** https://badcoin.kbadinger.com

---

## Project Overview

Custom blockchain explorer for Badcoin built with Node.js, Express, and MongoDB.
- **Tech Stack:** Node.js, Express, MongoDB, PM2, Nginx
- **Deployment:** VPS at badcoin.kbadinger.com
- **Purpose:** Fast, custom explorer that actually works with Badcoin (unlike Iquidus/BlockBook)

---

## Current Status

### ✅ Completed (2025-11-24)

1. **UI Color Fixes** (Commit: de3815c)
   - Fixed BADCOIN header - now bright red (#e74c3c) and bold
   - Fixed address links - changed from invisible dark gray to bright blue (#3498db)
   - Added proper hover states
   - All Rich List addresses now readable

2. **Total Supply Fix** (Commit: 403e34d)
   - Fixed "0 supply" bug
   - Modified `src/sync.js` to calculate block rewards from coinbase transactions
   - Created `backfill-rewards.js` script to update existing blocks
   - Supply will calculate correctly once backfill runs

### 🔄 In Progress

- **Initial blockchain sync** - Syncing ~1.7M blocks
  - Running via PM2 in background on server
  - Can disconnect - sync continues automatically
  - Syncs in batches of 100 blocks
  - Expected time: 2-4 hours total
  - Current progress: Check with `pm2 logs badcoin-explorer-sync`

### 📋 Pending Actions

1. **On Server (badcoin.kbadinger.com):**
   ```bash
   cd /root/badcoin-explorer
   git pull
   node backfill-rewards.js  # Fix supply for already-synced blocks
   pm2 restart all
   ```

2. **Known Issues:**
   - Logo might have display issues (user noticed, needs investigation)
   - Initial sync must complete before full functionality

---

## Architecture

```
badcoind (RPC) → Sync Worker → MongoDB → API Server → Web UI
                     ↓              ↓         ↓
                   PM2          Indexed     Nginx
                                 Data      (Port 80/443)
```

### Services (PM2)
- `badcoin-explorer-api` - Express API server (port 3001)
- `badcoin-explorer-sync` - Blockchain indexer (background worker)

### Database (MongoDB)
- Blocks collection (includes height, hash, difficulty, **reward**)
- Transactions collection
- Addresses collection (balances, tx counts)
- SyncStatus collection (tracks sync progress)

---

## Recent Changes

### Commit: de3815c - UI Color Fixes
**Files changed:**
- `public/css/style.css` - Fixed header and link colors
- `COLOR-FIXES.md` - Documentation
- `update-css.sh` - Quick deployment script

**What was fixed:**
- Header text visibility
- Address link contrast (was #32373c on #000000 = invisible)
- Rich List readability

### Commit: 403e34d - Total Supply Fix
**Files changed:**
- `src/sync.js` - Added reward calculation (lines 76-83, 101)
- `backfill-rewards.js` - New script to update existing blocks

**What was fixed:**
- Block reward now calculated from coinbase transaction outputs
- Total supply calculation will work once backfill runs
- New blocks automatically get reward field

---

## Key Features

### Frontend (public/)
- Network status dashboard
- Rich List (top 50 addresses by balance)
- Block explorer with search
- Transaction history
- Charts (block time, difficulty)

### API Endpoints
- `GET /api/status` - Network and sync status
- `GET /api/blocks` - Latest blocks
- `GET /api/block/:identifier` - Block by height/hash
- `GET /api/transactions` - Latest transactions
- `GET /api/transaction/:txid` - Transaction details
- `GET /api/address/:address` - Address info and history
- `GET /api/richlist` - Top addresses by balance
- `GET /api/stats` - Network statistics (includes total supply)
- `GET /api/charts/blocktimes` - Block time chart data
- `GET /api/charts/difficulty` - Difficulty chart data
- `GET /api/search/:query` - Search blocks/txs/addresses

### Sync Worker
- Indexes blockchain in batches (100 blocks default)
- Runs every 5 seconds when syncing
- Tracks addresses and balances
- Calculates block rewards
- Auto-resumes from last synced block

---

## Configuration

### Environment Variables (.env on server)
```env
RPC_HOST=127.0.0.1
RPC_PORT=9332
RPC_USER=badcoinrpc
RPC_PASSWORD=AtXZoFZcRapKn@zJg8@uNfHZZms^dRyBU9sBMjQ9WDCs
MONGODB_URI=mongodb://localhost:27017/badcoin_explorer
PORT=3001
SYNC_INTERVAL=5000
BATCH_SIZE=100
```

### Nginx Configuration
- Proxies port 3001 to public domain
- SSL via Let's Encrypt
- Static file serving for frontend

---

## Monitoring & Management

### Check Status
```bash
pm2 status                              # Process status
pm2 logs badcoin-explorer-sync         # Watch sync progress
curl http://localhost:3001/api/status  # API status
```

### Common Commands
```bash
pm2 restart all                        # Restart both services
pm2 stop all                           # Stop services
pm2 logs badcoin-explorer-api          # API logs
pm2 monit                              # Resource monitor
```

### Database Queries
```bash
mongosh badcoin_explorer

# Check progress
db.blocks.countDocuments()
db.transactions.countDocuments()
db.syncstatuses.findOne()

# Check supply (after backfill)
db.blocks.aggregate([
  { $group: { _id: null, total: { $sum: '$reward' } } }
])
```

---

## Next Steps / TODO

### Immediate
- [ ] Complete initial sync (~1.7M blocks)
- [ ] Run backfill-rewards.js on server
- [ ] Verify total supply displays correctly
- [ ] Investigate logo display issue

### Future Enhancements
- [ ] Add mempool display
- [ ] Add block reward schedule graph
- [ ] Implement address tagging (exchange addresses, etc.)
- [ ] Add API rate limiting
- [ ] Implement caching for frequently accessed data
- [ ] Add websocket support for real-time updates
- [ ] Create admin dashboard

---

## Related Projects

This is a **side project** related to the main Badcoin node:
- **Main Node:** `/Users/kevinbadinger/Projects/badcoin`
- **Explorer:** `/Users/kevinbadinger/Projects/badcoin-explorer`

The explorer connects to the main badcoind node via RPC to index blockchain data.

---

## Glossary

**Rich List:** Ranking of top addresses by coin balance (shows who holds the most coins)

**Coinbase Transaction:** First transaction in every block that creates new coins (miner reward)

**Block Reward:** Amount of new coins created in each block (decreases over time per halvings)

**Sync Status:** Current progress of blockchain indexing (stored in MongoDB)

---

## Troubleshooting

### Sync Not Progressing
- Check badcoind is running: `ps aux | grep badcoind`
- Check RPC connectivity: `curl --user badcoinrpc:password --data-binary '{"jsonrpc":"1.0","id":"1","method":"getblockcount","params":[]}' http://127.0.0.1:9332`
- Check sync worker logs: `pm2 logs badcoin-explorer-sync`

### Total Supply Shows 0
- Ensure sync worker has the reward calculation code
- Run backfill script: `node backfill-rewards.js`
- Check blocks have reward field: `mongosh badcoin_explorer` → `db.blocks.findOne({}, {reward: 1})`

### API Errors
- Check MongoDB is running: `systemctl status mongod`
- Check API logs: `pm2 logs badcoin-explorer-api`
- Verify .env file exists with correct credentials

---

**Status:** Active development
**Priority:** Medium (side project, but important for community)
**Blocked By:** Initial sync completion
**Owner:** Kevin Badinger
**Assistant:** Claude Code

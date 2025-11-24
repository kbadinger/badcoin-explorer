# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Badcoin Explorer is a custom blockchain explorer for Badcoin cryptocurrency, built with Node.js, Express, MongoDB, and vanilla JavaScript frontend. It consists of two main services that run independently:

1. **API Server** (`src/server.js`) - Express REST API and web interface
2. **Sync Worker** (`src/sync.js`) - Background blockchain indexing service

These services communicate through a shared MongoDB database and both connect to a badcoind RPC node.

## Development Commands

### Start Services (Development)
```bash
# Start API server (with auto-restart on file changes)
npm run dev

# Start sync worker (in separate terminal)
npm run sync

# Or start manually
node src/server.js
node src/sync.js
```

### Production Deployment
```bash
# Deploy with automated script (Ubuntu/Debian)
sudo ./deploy.sh

# PM2 management commands
pm2 status
pm2 logs badcoin-explorer-api
pm2 logs badcoin-explorer-sync
pm2 restart all
pm2 stop all
```

### Database Operations
```bash
# Connect to MongoDB
mongosh badcoin_explorer

# Check indexed data counts
db.blocks.countDocuments()
db.transactions.countDocuments()
db.addresses.countDocuments()

# View sync progress
db.syncstatuses.findOne()
```

## Architecture Details

### Data Flow
```
badcoind (RPC) → Sync Worker → MongoDB ← API Server → Frontend
```

### Key Components

**RPC Client (`src/rpc.js`)**
- Singleton class that wraps axios for badcoind JSON-RPC calls
- Handles authentication and error formatting
- Used by both sync worker and API server
- Connects via credentials from environment variables

**Mongoose Models (`src/models.js`)**
- **Block**: Stores block metadata including height, hash, difficulty, time, txCount, and calculated reward
- **Transaction**: Stores full transaction data with inputs/outputs and block references
- **Address**: Tracks balance, totalReceived, totalSent, txCount for each address
- **SyncStatus**: Single document (key='main') that tracks lastBlockHeight for sync coordination

**Sync Worker (`src/sync.js`)**
- Runs infinite loop checking for new blocks every SYNC_INTERVAL (default 5s)
- Syncs in batches (BATCH_SIZE blocks, default 100) for efficiency
- For each block: fetches from RPC, calculates coinbase reward, saves block + all transactions
- Updates address balances by tracking transaction outputs
- Saves sync progress every 10 blocks to handle interruptions gracefully
- Block rewards calculated from coinbase transaction outputs (first tx in block)

**API Server (`src/server.js`)**
- Express server with CORS, Morgan logging, static file serving from `public/`
- Key endpoints:
  - `/api/status` - Network info, blockchain height, sync progress, database stats
  - `/api/blocks` - Latest blocks with pagination
  - `/api/block/:identifier` - Get block by height or hash, includes transactions
  - `/api/transaction/:txid` - Get transaction details
  - `/api/address/:address` - Get address info and recent transactions
  - `/api/richlist` - Top addresses by balance
  - `/api/stats` - Network statistics including total supply from block rewards
  - `/api/charts/blocktimes` - Chart data for block time analysis
  - `/api/charts/difficulty` - Chart data for difficulty tracking
  - `/api/search/:query` - Smart search (tries block height, block hash, txid, address)

### Important Implementation Notes

**Total Supply Calculation**: The total supply is calculated by summing the `reward` field from all blocks. Each block's reward is computed from its coinbase transaction outputs during indexing (see `sync.js:76-82`). This was added to fix incorrect supply calculations.

**Address Tracking**: The address update logic in `updateAddress()` (sync.js:166-190) is simplified and only tracks received amounts. It doesn't currently handle spent outputs properly, so address balances may not be 100% accurate. This is noted as a production consideration.

**Sync State Management**: The sync worker uses a single SyncStatus document (key='main') to coordinate where to resume. It saves progress every 10 blocks to minimize re-indexing after crashes.

**Block Height vs Hash Queries**: The API supports querying blocks by either numeric height or 64-character hex hash. The server automatically detects the type using regex patterns.

## Environment Configuration

Required variables in `.env`:
- `RPC_HOST`, `RPC_PORT`, `RPC_USER`, `RPC_PASSWORD` - badcoind connection
- `MONGODB_URI` - MongoDB connection string (e.g., `mongodb://localhost:27017/badcoin_explorer`)
- `PORT` - API server port (default 3001)
- `SYNC_INTERVAL` - Milliseconds between sync checks (default 5000)
- `BATCH_SIZE` - Blocks per sync batch (default 100)

## Database Indexes

Critical indexes for performance (defined in `models.js`):
- Block: `height` (unique), `hash` (unique), `time` (sorted queries)
- Transaction: `txid` (unique), `blockHeight`, `blockTime`, `outputs.scriptPubKey.addresses`, `inputs.addresses`
- Address: `address` (unique)

## Frontend Architecture

The frontend (`public/`) is vanilla JavaScript with no framework:
- `index.html` - Single page application structure
- `css/style.css` - Dark theme matching badcoin.net branding
- `js/app.js` - API calls, routing, DOM manipulation

The frontend fetches from the API server and renders views client-side with simple JavaScript DOM manipulation.

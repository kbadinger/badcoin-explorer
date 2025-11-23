# Badcoin Explorer

A custom, modern blockchain explorer for Badcoin built with Node.js, Express, and MongoDB.

## Features

- **Real-time blockchain sync** - Efficiently indexes blocks and transactions
- **RESTful API** - Clean API for blocks, transactions, and addresses
- **Modern web interface** - Responsive UI for exploring the blockchain
- **Search functionality** - Search by block height, hash, transaction ID, or address
- **Lightweight** - ~300MB RAM usage, fast sync times (2-4 hours)
- **Self-hosted** - Full control, no third-party dependencies

## Why Build This?

After trying several existing blockchain explorers (Iquidus, BlockBook, Insight) and running into issues with:
- Slow sync times (7+ days)
- Hardcoded coin support
- Broken dependencies with modern Node.js

We built a custom solution that:
- ✅ Actually works with Badcoin
- ✅ Uses modern, maintained dependencies
- ✅ Syncs in hours, not days
- ✅ Is simple and extensible

## Architecture

```
badcoind (RPC) → Sync Worker → MongoDB → API Server → Web UI
```

- **Sync Worker** (`src/sync.js`) - Indexes blockchain in background
- **API Server** (`src/server.js`) - Serves REST API and web interface
- **MongoDB** - Stores indexed blocks, transactions, addresses
- **Frontend** (`public/`) - Clean, responsive web interface

## Requirements

- Ubuntu 20.04+ (or similar Linux)
- Node.js 18+
- MongoDB 5.0+
- badcoind with RPC enabled
- 2GB+ RAM
- 10-20GB disk space for indexed data

## Quick Start

### 1. Clone Repository

```bash
git clone https://github.com/kbadinger/badcoin-explorer.git
cd badcoin-explorer
```

### 2. Configure

```bash
cp .env.example .env
nano .env
```

Update with your badcoind RPC credentials:

```env
RPC_HOST=127.0.0.1
RPC_PORT=9332
RPC_USER=badcoinrpc
RPC_PASSWORD=your_rpc_password

MONGODB_URI=mongodb://localhost:27017/badcoin_explorer
PORT=3001
```

### 3. Deploy

```bash
chmod +x deploy.sh
sudo ./deploy.sh
```

The script will:
- Install Node.js, MongoDB, PM2
- Install dependencies
- Start API server and sync worker
- Configure Nginx (if installed)

### 4. Monitor Sync

```bash
# Watch sync progress
pm2 logs badcoin-explorer-sync

# Check API status
curl http://localhost:3001/api/status
```

### 5. Access Explorer

Visit: http://YOUR_VPS_IP:3001

Or with domain: http://badcoin.kbadinger.com

## Manual Setup

If you prefer manual setup:

```bash
# Install dependencies
npm install

# Start API server
node src/server.js

# Start sync worker (in another terminal)
node src/sync.js
```

## API Documentation

### GET /api/status

Network and sync status

```json
{
  "network": {
    "connections": 5,
    "version": 150100,
    "protocolversion": 70015
  },
  "blockchain": {
    "blocks": 1773774,
    "difficulty": 2670.97
  },
  "sync": {
    "indexedBlocks": 10000,
    "percentage": "0.56"
  }
}
```

### GET /api/blocks?limit=10

Latest blocks

### GET /api/block/:identifier

Get block by height or hash

### GET /api/transactions?limit=10

Latest transactions

### GET /api/transaction/:txid

Get transaction by ID

### GET /api/address/:address

Get address info and transactions

### GET /api/search/:query

Search for block, transaction, or address

## Configuration

### Environment Variables

- `RPC_HOST` - badcoind RPC host (default: 127.0.0.1)
- `RPC_PORT` - badcoind RPC port (default: 9332)
- `RPC_USER` - RPC username
- `RPC_PASSWORD` - RPC password
- `MONGODB_URI` - MongoDB connection string
- `PORT` - Web server port (default: 3001)
- `SYNC_INTERVAL` - Sync check interval in ms (default: 5000)
- `BATCH_SIZE` - Blocks to sync per batch (default: 100)

### badcoin.conf

Ensure your badcoin.conf has:

```ini
server=1
rpcuser=badcoinrpc
rpcpassword=your_strong_password
rpcallowip=127.0.0.1
rpcbind=127.0.0.1
rpcport=9332
```

## Management

### PM2 Commands

```bash
# View status
pm2 status

# View logs
pm2 logs badcoin-explorer-api
pm2 logs badcoin-explorer-sync

# Restart
pm2 restart all

# Stop
pm2 stop all

# Monitor
pm2 monit
```

### Database Queries

```bash
# Connect to MongoDB
mongosh badcoin_explorer

# Check counts
db.blocks.countDocuments()
db.transactions.countDocuments()
db.addresses.countDocuments()

# Check sync status
db.syncstatuses.findOne()
```

## Performance

### Sync Times

- **Initial sync:** 2-4 hours for 1.7M blocks
- **Incremental sync:** Real-time (5 second intervals)

### Resource Usage

- **RAM:** ~300-400MB total
- **CPU:** Low (< 10% average)
- **Disk:** ~10-20GB for full index
- **Network:** Minimal (only RPC calls)

## Development

### Local Development

```bash
# Install dev dependencies
npm install

# Run in development mode (auto-restart)
npm run dev

# Run sync worker
npm run sync
```

### Project Structure

```
badcoin-explorer/
├── src/
│   ├── server.js     # Express API server
│   ├── sync.js       # Blockchain sync worker
│   ├── rpc.js        # badcoind RPC client
│   └── models.js     # MongoDB schemas
├── public/
│   ├── index.html    # Web interface
│   ├── css/
│   │   └── style.css # Styling
│   └── js/
│       └── app.js    # Frontend logic
├── deploy.sh         # Deployment script
├── package.json      # Dependencies
├── .env.example      # Config template
└── README.md         # This file
```

## Troubleshooting

### Sync not progressing

Check badcoind is running and RPC is accessible:

```bash
curl --user badcoinrpc:password \
  --data-binary '{"jsonrpc":"1.0","id":"1","method":"getblockcount","params":[]}' \
  http://127.0.0.1:9332
```

### MongoDB connection errors

Ensure MongoDB is running:

```bash
systemctl status mongod
```

### Port 3001 already in use

Change `PORT` in `.env` file.

### API returns errors

Check API logs:

```bash
pm2 logs badcoin-explorer-api
```

## SSL Setup

```bash
# Install certbot
apt-get install -y certbot python3-certbot-nginx

# Get certificate
certbot --nginx -d badcoin.kbadinger.com

# Auto-renewal is configured automatically
```

## Contributing

This is a community project! Contributions welcome:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - See LICENSE file

## Credits

Built by the Badcoin community as part of the 2025 network revival.

## Support

- GitHub Issues: https://github.com/kbadinger/badcoin-explorer/issues
- Badcoin Community: [Telegram/Discord links]

---

**Built with ❤️ by the Badcoin Community**

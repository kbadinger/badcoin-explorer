#!/bin/bash

# Badcoin Explorer Deployment Script
# Run this on your VPS to deploy the explorer

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() { echo -e "${GREEN}[✓]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[!]${NC} $1"; }

echo "=================================="
echo "Badcoin Explorer Deployment"
echo "=================================="
echo ""

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo "Run as root: sudo ./deploy.sh"
   exit 1
fi

# Install Node.js if not present
if ! command -v node &> /dev/null; then
    print_status "Installing Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi

# Install PM2 for process management
if ! command -v pm2 &> /dev/null; then
    print_status "Installing PM2..."
    npm install -g pm2
fi

# Install MongoDB if not present
if ! command -v mongosh &> /dev/null; then
    print_status "Installing MongoDB..."
    curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
       gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor

    echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | \
       tee /etc/apt/sources.list.d/mongodb-org-7.0.list

    apt-get update
    apt-get install -y mongodb-org mongodb-mongosh
    systemctl start mongod
    systemctl enable mongod
fi

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    print_status "Creating .env file..."
    cp .env.example .env

    # Prompt for RPC password
    read -p "Enter badcoind RPC password: " rpc_password
    sed -i "s/your_rpc_password_here/$rpc_password/g" .env

    print_warning "Review and edit .env file if needed"
fi

# Install dependencies
print_status "Installing dependencies..."
npm install --production

# Setup PM2 ecosystem
print_status "Setting up PM2..."
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'badcoin-explorer-api',
      script: './src/server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'badcoin-explorer-sync',
      script: './src/sync.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
EOF

# Stop any existing processes
pm2 delete badcoin-explorer-api badcoin-explorer-sync 2>/dev/null || true

# Start services
print_status "Starting services..."
pm2 start ecosystem.config.js
pm2 save
pm2 startup

# Configure Nginx
if command -v nginx &> /dev/null; then
    print_status "Configuring Nginx..."

    cat > /etc/nginx/sites-available/badcoin-explorer << 'NGINXCONF'
server {
    listen 80;
    server_name badcoin.kbadinger.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
NGINXCONF

    # Remove old configs
    rm -f /etc/nginx/sites-enabled/blockbook-badcoin
    rm -f /etc/nginx/sites-enabled/insight-badcoin
    rm -f /etc/nginx/sites-enabled/badcoin-explorer

    ln -sf /etc/nginx/sites-available/badcoin-explorer /etc/nginx/sites-enabled/
    nginx -t && systemctl reload nginx

    print_status "Nginx configured"
else
    print_warning "Nginx not installed. Install it separately."
fi

echo ""
echo "=================================="
echo "Deployment Complete!"
echo "=================================="
echo ""
echo "Services:"
echo "  API Server: pm2 logs badcoin-explorer-api"
echo "  Sync Worker: pm2 logs badcoin-explorer-sync"
echo ""
echo "Management:"
echo "  Status: pm2 status"
echo "  Restart: pm2 restart all"
echo "  Stop: pm2 stop all"
echo ""
echo "Access:"
echo "  Local: http://localhost:3001"
echo "  Public: http://badcoin.kbadinger.com"
echo ""
echo "Setup SSL:"
echo "  certbot --nginx -d badcoin.kbadinger.com"
echo ""
print_status "Explorer is now running!"

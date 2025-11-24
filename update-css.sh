#!/bin/bash

# Quick CSS Update Script
# Uploads updated CSS to the server without full redeployment

set -e

SERVER="badcoin.kbadinger.com"
EXPLORER_DIR="/root/badcoin-explorer"

echo "=================================="
echo "Updating Badcoin Explorer CSS"
echo "=================================="
echo ""

# Upload updated CSS file
echo "Uploading style.css..."
scp public/css/style.css root@${SERVER}:${EXPLORER_DIR}/public/css/style.css

echo ""
echo "✓ CSS updated successfully!"
echo ""
echo "Clear your browser cache (Ctrl+Shift+R or Cmd+Shift+R) to see changes"
echo "Visit: https://badcoin.kbadinger.com"
echo ""

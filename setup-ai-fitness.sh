#!/bin/bash

# Setup script for AI Fitness domain mapping
# This script configures pseudo-url-localhost to map ai-fitness.local to port 3000

set -e

echo "=========================================="
echo "AI Fitness Domain Setup"
echo "=========================================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed."
    echo ""
    echo "Please install Node.js first:"
    echo "  - macOS: brew install node"
    echo "  - Linux: sudo apt install nodejs npm"
    echo "  - Or download from: https://nodejs.org/"
    echo ""
    exit 1
fi

echo "✓ Node.js found: $(node --version)"
echo ""

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# Backup hosts file
echo "💾 Backing up hosts file..."
BACKUP_FILE="/etc/hosts.backup.$(date +%Y%m%d-%H%M%S)"
if sudo cp /etc/hosts "$BACKUP_FILE" 2>/dev/null; then
    echo "✓ Hosts file backed up to: $BACKUP_FILE"
else
    echo "⚠️  Could not backup hosts file (may need sudo)"
fi
echo ""

# Add the AI fitness domain mapping
echo "🔧 Adding domain mapping: ai-fitness.local -> localhost:3000"
node bin/cli.js add ai-fitness.local 3000 -y
echo ""

# Sync hosts file
echo "📝 Syncing hosts file (requires sudo)..."
if sudo node bin/cli.js sync; then
    echo "✓ Hosts file updated successfully"
else
    echo "⚠️  Could not update hosts file. Please run manually:"
    echo "    sudo node bin/cli.js sync"
fi
echo ""

# Show status
echo "📊 Current configuration:"
node bin/cli.js status
echo ""

# Instructions for starting the proxy
echo "=========================================="
echo "✓ Setup Complete!"
echo "=========================================="
echo ""
echo "To start the proxy server, run:"
echo "  sudo node bin/cli.js start"
echo ""
echo "Or for a non-privileged port (8080):"
echo "  node bin/cli.js start -p 8080"
echo ""
echo "Then access your AI fitness app at:"
echo "  http://ai-fitness.local"
echo ""
echo "Make sure your development server is running on port 3000!"
echo ""


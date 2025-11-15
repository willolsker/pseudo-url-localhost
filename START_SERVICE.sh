#!/bin/bash

# Quick start script for pseudo-url-localhost with AI Fitness domain

echo "🚀 Starting pseudo-url-localhost proxy service..."
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js is not installed."
    echo ""
    echo "Please install Node.js first:"
    echo "  - macOS: brew install node"
    echo "  - Linux: sudo apt install nodejs npm"
    echo "  - Or download from: https://nodejs.org/"
    echo ""
    exit 1
fi

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# Show current configuration
echo "📋 Current Configuration:"
node bin/cli.js list
echo ""

# Check if hosts file is synced
echo "🔍 Checking hosts file..."
if grep -q "ai-fitness.local" /etc/hosts 2>/dev/null; then
    echo "✓ Hosts file is configured"
else
    echo "⚠️  Hosts file not synced. Run this first:"
    echo "   sudo node bin/cli.js sync"
    echo ""
fi
echo ""

# Ask user which port to use
echo "Select proxy port:"
echo "  1) Port 80 (requires sudo, no port in URL)"
echo "  2) Port 8080 (no sudo required, use :8080 in URL)"
echo ""
read -p "Choice [1/2]: " choice

case $choice in
    1)
        echo ""
        echo "Starting proxy on port 80 (requires sudo)..."
        echo "Access your app at: http://ai-fitness.local"
        echo ""
        sudo node bin/cli.js start
        ;;
    2)
        echo ""
        echo "Starting proxy on port 8080..."
        echo "Access your app at: http://ai-fitness.local:8080"
        echo ""
        node bin/cli.js start -p 8080
        ;;
    *)
        echo "Invalid choice. Using port 8080 (no sudo)..."
        echo ""
        echo "Access your app at: http://ai-fitness.local:8080"
        echo ""
        node bin/cli.js start -p 8080
        ;;
esac


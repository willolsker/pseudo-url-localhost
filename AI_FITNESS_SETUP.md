# AI Fitness Domain Setup Guide

This guide shows you how to set up a custom domain for your AI fitness application running on `localhost:3000`.

## Quick Setup

### Option 1: Automated Setup (Recommended)

Run the setup script:

```bash
cd /Users/willolsker/pseudo-url-localhost
./setup-ai-fitness.sh
```

This will:
1. ✅ Backup your hosts file
2. ✅ Install dependencies
3. ✅ Add the domain mapping `ai-fitness.local -> localhost:3000`
4. ✅ Update your hosts file
5. ✅ Show you how to start the proxy

### Option 2: Manual Setup

If you prefer manual setup:

```bash
# 1. Install dependencies
npm install

# 2. Backup hosts file
sudo cp /etc/hosts /etc/hosts.backup.$(date +%Y%m%d-%H%M%S)

# 3. Add domain mapping
node bin/cli.js add ai-fitness.local 3000

# 4. Sync hosts file (requires sudo)
sudo node bin/cli.js sync

# 5. Start the proxy server (requires sudo for port 80)
sudo node bin/cli.js start
```

## Starting Your AI Fitness App

### Step 1: Start Your Development Server

Make sure your AI fitness application is running on port 3000:

```bash
# Example for React/Next.js apps
cd your-ai-fitness-app
npm start
# or
npm run dev
```

Verify it's running by visiting: `http://localhost:3000`

### Step 2: Start the Proxy Server

In a separate terminal:

```bash
cd /Users/willolsker/pseudo-url-localhost
sudo node bin/cli.js start
```

**Alternative (no sudo required):**

```bash
node bin/cli.js start -p 8080
# Then access: http://ai-fitness.local:8080
```

### Step 3: Access Your App

Open your browser and visit:

```
http://ai-fitness.local
```

🎉 Your AI fitness app is now accessible via a custom domain!

## Domain Name Options

You can use different AI fitness-related domains:

```bash
# Option 1: Simple
node bin/cli.js add aifitness.local 3000

# Option 2: Hyphenated (current)
node bin/cli.js add ai-fitness.local 3000

# Option 3: Descriptive
node bin/cli.js add fitai.local 3000
node bin/cli.js add smartfit.local 3000
node bin/cli.js add fitness-ai.local 3000
node bin/cli.js add myfitnessai.local 3000
```

## Verifying Setup

Check your configuration:

```bash
# View all mappings
node bin/cli.js list

# Check status
node bin/cli.js status

# Verify hosts file entry
cat /etc/hosts | grep ai-fitness
```

You should see:

```
Configured Mappings:

  ai-fitness.local               → localhost:3000
```

## Troubleshooting

### Domain doesn't resolve

1. **Verify hosts file entry:**
   ```bash
   cat /etc/hosts | grep pseudo-url
   ```
   You should see `127.0.0.1 ai-fitness.local`

2. **Flush DNS cache:**
   ```bash
   # macOS
   sudo dscacheutil -flushcache
   sudo killall -HUP mDNSResponder
   ```

3. **Re-sync hosts file:**
   ```bash
   sudo node bin/cli.js sync
   ```

### Can't connect to the app

1. **Verify your dev server is running:**
   ```bash
   curl http://localhost:3000
   ```
   If this fails, your app isn't running.

2. **Check proxy status:**
   ```bash
   node bin/cli.js status
   ```

3. **Verify proxy is running:**
   ```bash
   # Check if something is listening on port 80
   sudo lsof -i :80
   ```

### Permission errors

- Use `sudo` for modifying hosts file: `sudo node bin/cli.js sync`
- Use `sudo` for port 80: `sudo node bin/cli.js start`
- Or use a higher port: `node bin/cli.js start -p 8080`

## Restoring Original Hosts File

If you need to restore your original hosts file:

```bash
# Find your backup
ls -la /etc/hosts.backup.*

# Restore it (replace with your backup filename)
sudo cp /etc/hosts.backup.YYYYMMDD-HHMMSS /etc/hosts
```

Or use the built-in cleanup:

```bash
# Remove all mappings
node bin/cli.js clear

# Clean up hosts file
sudo node bin/cli.js sync
```

## Advanced: Multiple AI Services

If you're running multiple AI-related services:

```bash
# Frontend
node bin/cli.js add ai-fitness.local 3000

# API server
node bin/cli.js add api.ai-fitness.local 8000

# ML model server
node bin/cli.js add ml.ai-fitness.local 5000

# Admin dashboard
node bin/cli.js add admin.ai-fitness.local 4000

# Sync all at once
sudo node bin/cli.js sync

# Start proxy
sudo node bin/cli.js start
```

Now you can access:
- Frontend: `http://ai-fitness.local`
- API: `http://api.ai-fitness.local`
- ML Server: `http://ml.ai-fitness.local`
- Admin: `http://admin.ai-fitness.local`

## Keeping the Proxy Running

### Background Process

```bash
# Start in background with nohup
nohup sudo node bin/cli.js start > proxy.log 2>&1 &

# View logs
tail -f proxy.log
```

### Using PM2 (Recommended for Production)

```bash
# Install PM2
npm install -g pm2

# Start with PM2
sudo pm2 start bin/cli.js --name "pseudo-url" -- start

# View status
sudo pm2 status

# View logs
sudo pm2 logs pseudo-url

# Stop
sudo pm2 stop pseudo-url
```

## Next Steps

- Add more domain mappings for other services
- Set up HTTPS (future feature)
- Share your domain configuration with your team
- Check the [ROADMAP.md](ROADMAP.md) for upcoming features

## Support

If you encounter issues:
1. Check this guide's troubleshooting section
2. Review the [README.md](README.md) for complete documentation
3. Check [USAGE_EXAMPLES.md](USAGE_EXAMPLES.md) for more scenarios
4. Open an issue on GitHub

---

**Current Configuration:**
- Domain: `ai-fitness.local`
- Target: `localhost:3000`
- Proxy Port: `80` (default)

Enjoy your AI fitness app at a friendly domain! 🏃‍♂️🤖


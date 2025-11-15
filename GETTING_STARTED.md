# Getting Started with pseudo-url-localhost

This guide will help you get started with pseudo-url-localhost in just a few minutes.

## Installation

Install the package globally using npm:

```bash
npm install -g pseudo-url-localhost
```

Or using yarn:

```bash
yarn global add pseudo-url-localhost
```

## Quick Setup (3 Steps)

### Step 1: Add a Mapping

Let's say you have a web app running on `http://localhost:3000`. Let's map it to `myapp.local`:

```bash
pseudo-url add myapp.local 3000
```

You can add as many mappings as you need:

```bash
pseudo-url add frontend.local 3000
pseudo-url add backend.local 8000
pseudo-url add api.local 8080
```

### Step 2: Sync the Hosts File

This adds entries to your system's hosts file (requires sudo):

```bash
sudo pseudo-url sync
```

**Note:** You only need to run this when you add or remove mappings.

### Step 3: Start the Proxy Server

Start the proxy server to route requests (requires sudo for port 80):

```bash
sudo pseudo-url start
```

That's it! Now you can access your app at `http://myapp.local` instead of `http://localhost:3000`.

## Understanding What Just Happened

When you ran those three commands, pseudo-url-localhost:

1. **Saved a mapping** between your custom domain (`myapp.local`) and your localhost port (`3000`)
2. **Added an entry to your hosts file** so `myapp.local` resolves to `127.0.0.1`
3. **Started a proxy server** on port 80 that forwards requests from `myapp.local` to `localhost:3000`

## Verifying It Works

1. Make sure your development server is running:
   ```bash
   # In another terminal
   cd your-project
   npm start  # or whatever starts your dev server
   ```

2. Open your browser and go to: `http://myapp.local`

3. You should see your application!

## Common Commands

```bash
# List all mappings
pseudo-url list

# Check status
pseudo-url status

# Remove a mapping
pseudo-url remove myapp.local

# Clear all mappings
pseudo-url clear

# Get help
pseudo-url --help
```

## Using a Different Port (No Sudo Required)

If you don't want to use sudo, you can run the proxy on a port >= 1024:

```bash
# Set default port to 8080
pseudo-url port 8080

# Start without sudo
pseudo-url start

# Access your app with port number
# http://myapp.local:8080
```

## Troubleshooting

### "Permission denied" error

You need sudo for:
- Modifying the hosts file: `sudo pseudo-url sync`
- Running proxy on port 80: `sudo pseudo-url start`

Or use a non-privileged port: `pseudo-url start -p 8080`

### "Port already in use"

Something else is using port 80. Options:
1. Stop the other service
2. Use a different port: `pseudo-url start -p 8080`

### Domain doesn't resolve

1. Make sure you ran `sudo pseudo-url sync`
2. Flush DNS cache:
   - **macOS**: `sudo dscacheutil -flushcache && sudo killall -HUP mDNSResponder`
   - **Linux**: `sudo systemd-resolve --flush-caches`
   - **Windows**: `ipconfig /flushdns`

### Can't connect to the app

1. Make sure your dev server is actually running on the port you specified
2. Test with curl: `curl http://localhost:3000` (should work)
3. Check proxy is running: `pseudo-url status`

## Next Steps

- Read the [README](README.md) for complete documentation
- Check out [USAGE_EXAMPLES](USAGE_EXAMPLES.md) for more advanced scenarios
- Learn about [contributing](CONTRIBUTING.md) if you want to help improve the project

## Real-World Example

Here's a complete example of setting up a full-stack app:

```bash
# Install pseudo-url-localhost
npm install -g pseudo-url-localhost

# Add mappings for your stack
pseudo-url add frontend.local 3000    # React app
pseudo-url add api.local 8000         # Express API
pseudo-url add db.local 5050          # pgAdmin

# Sync hosts file once
sudo pseudo-url sync

# Start proxy server
sudo pseudo-url start

# In other terminals, start your services:
# Terminal 2: cd frontend && npm start
# Terminal 3: cd backend && npm start
# Terminal 4: docker-compose up  # for database

# Now access:
# http://frontend.local      → React app
# http://api.local          → Express API
# http://db.local           → pgAdmin
```

## Tips

1. **Use `.local` domains**: They're recognized as local-only and won't conflict with real websites

2. **Descriptive names**: Use clear names like `projectname-frontend.local` instead of just `app.local`

3. **Keep proxy running**: You can leave the proxy running in a terminal or background process

4. **One-time sync**: You only need to `sudo pseudo-url sync` when you add/remove mappings, not every time

5. **Share with team**: Your team members can use the same domain names for consistency

## Need Help?

- Check the [README](README.md) for detailed documentation
- Review [USAGE_EXAMPLES](USAGE_EXAMPLES.md) for more scenarios
- Open an issue on GitHub if you find a bug
- Run `pseudo-url --help` for command reference

Happy developing! 🚀


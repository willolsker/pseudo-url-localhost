# pseudo-url-localhost

Map custom pseudo-URLs to your localhost development servers with ease! Never type `localhost:3000` again.

## Features

- 🚀 Map custom domains (like `myapp.local`) to localhost ports
- 🔄 Built-in proxy server to route requests
- 🔒 HTTPS support with automatic SSL certificate generation (via mkcert)
- 📝 Automatic hosts file management
- 💻 Simple CLI interface
- 🎯 Works with any local development server
- ⚡ Run serverless architectures locally with proper domain routing
- 🛠️ Easy configuration management
- ✅ Enable Chrome's HTTP-only features (geolocation, camera, service workers, etc.)

## Installation

```bash
npm install -g pseudo-url-localhost
```

## Quick Start

1. **Install mkcert** (for HTTPS support - optional but recommended):

```bash
# macOS
brew install mkcert
mkcert -install

# Linux
# See: https://github.com/FiloSottile/mkcert#installation
# or run: pseudo-url cert-install

# Windows
choco install mkcert
mkcert -install
```

2. **Add a mapping** (map a domain to a port):

```bash
pseudo-url add myapp.local 3000
```

3. **Start the proxy server** (requires sudo for ports 80/443):

```bash
sudo pseudo-url start
```

4. **Access your app** at `https://myapp.local` (or `http://myapp.local`)

## Running as a System Service (Recommended)

For the best experience, install pseudo-url as a system service that runs automatically on startup:

```bash
sudo pseudo-url service install
```

**Benefits:**

- ✓ Starts automatically on boot
- ✓ Runs in background (no terminal needed)
- ✓ Auto-restarts if it crashes
- ✓ Automatically reloads when you add/remove domains
- ✓ Zero downtime configuration updates

**Service Management:**

```bash
pseudo-url service status          # Check if running
pseudo-url service logs             # View logs
pseudo-url service restart          # Restart service
sudo pseudo-url service reinstall   # Update after npm upgrade
```

**Daily Usage with Service:**

```bash
# Just add mappings - they work immediately!
pseudo-url add myapp.local 3000    # No restart needed
pseudo-url add api.local 8080      # Works instantly

# Check your mappings
pseudo-url list
```

**See [SERVICE.md](SERVICE.md) for complete documentation.**

## Usage

### Add a Domain Mapping

Map a custom domain to a localhost port:

```bash
# Interactive mode
pseudo-url add

# With arguments
pseudo-url add myapp.local 3000
pseudo-url add api.local 8080
pseudo-url add admin.local 4000
```

### List All Mappings

View all configured domain mappings:

```bash
pseudo-url list
# or
pseudo-url ls
```

### Remove a Mapping

Remove a specific domain mapping:

```bash
# Interactive mode
pseudo-url remove

# With argument
pseudo-url remove myapp.local
# or
pseudo-url rm myapp.local
```

### Clear All Mappings

Remove all configured mappings:

```bash
pseudo-url clear
# Skip confirmation
pseudo-url clear -y
```

### Start the Proxy Server

Start the proxy server to route requests:

```bash
# Default port (80)
sudo pseudo-url start

# Custom port (doesn't require sudo for ports >= 1024)
pseudo-url start -p 8080

# Then access your apps at:
# http://myapp.local:8080
```

### Sync Hosts File

Manually synchronize the hosts file with current mappings:

```bash
sudo pseudo-url sync
```

### Set Default Proxy Port

Change the default proxy port:

```bash
pseudo-url port 8080
```

### View Status

Check current configuration and status:

```bash
pseudo-url status
```

### HTTPS / SSL Certificate Management

#### Check Certificate Status

View mkcert installation and certificate status:

```bash
pseudo-url cert-status
```

#### Install mkcert

Get installation instructions for mkcert:

```bash
pseudo-url cert-install
```

#### Regenerate Certificates

Manually regenerate SSL certificates for all configured domains:

```bash
pseudo-url cert-regenerate
```

**Note**: Certificates are automatically generated when you:

- Add a new domain mapping (with sudo)
- Start the proxy server
- Remove a domain mapping (with sudo)

#### Delete Certificates

Remove all generated SSL certificates:

```bash
pseudo-url cert-delete
```

#### Disable HTTPS

Start the proxy with HTTP only:

```bash
sudo pseudo-url start --no-https
```

## How It Works

`pseudo-url-localhost` consists of four main components:

1. **Configuration Management**: Stores your domain-to-port mappings in `~/.pseudo-url/config.json`

2. **Hosts File Integration**: Automatically adds entries to your system's hosts file (requires sudo) to map custom domains to `127.0.0.1`

3. **SSL Certificate Management**: Uses mkcert to generate locally-trusted SSL certificates for all configured domains, stored in `~/.pseudo-url/certs/`

4. **Proxy Server**: Runs both HTTP (port 80) and HTTPS (port 443) proxies that route requests from your custom domains to the appropriate localhost ports

## HTTPS Support

HTTPS support is automatically enabled when mkcert is installed. This allows you to:

- Use Chrome's HTTP-only features (geolocation, camera, microphone, service workers, etc.)
- Test HTTPS-specific functionality in your applications
- Avoid browser security warnings for modern web features
- Match production environments more closely

### Why mkcert?

[mkcert](https://github.com/FiloSottile/mkcert) is a simple tool for making locally-trusted development certificates. It automatically creates and installs a local Certificate Authority (CA) in your system trust store, so the certificates it generates are trusted by your browser without any manual configuration.

### HTTPS Features Enabled

With HTTPS support, you can now use Chrome features that require a secure context:

- 📍 Geolocation API
- 📷 Camera & Microphone access (getUserMedia)
- 🔔 Push Notifications
- 🔄 Service Workers & Progressive Web Apps (PWAs)
- 🗄️ Storage APIs (IndexedDB, LocalStorage with some restrictions)
- 🔐 Crypto API
- 📡 WebRTC
- 🌐 HTTP/2 and HTTP/3

## Example Workflow

Let's say you're developing multiple applications:

```bash
# Add mappings
pseudo-url add frontend.local 3000
pseudo-url add backend.local 8000
pseudo-url add database-admin.local 5432

# Sync hosts file (one time)
sudo pseudo-url sync

# Start proxy server
sudo pseudo-url start
```

Now you can access:

- `http://frontend.local` → `http://localhost:3000`
- `http://backend.local` → `http://localhost:8000`
- `http://database-admin.local` → `http://localhost:5432`

## Serverless Development

`pseudo-url-localhost` is perfect for running serverless architectures locally with proper domain routing. Map your serverless functions to custom domains just like production.

### AWS SAM / Serverless Framework

```bash
# Start your serverless app locally (default port 3000)
serverless offline start

# Map it to a custom domain
pseudo-url add api.serverless.local 3000
sudo pseudo-url sync
sudo pseudo-url start

# Access at http://api.serverless.local/function-name
```

### AWS Lambda with LocalStack

```bash
# Start LocalStack (default port 4566)
localstack start

# Map Lambda endpoints
pseudo-url add lambda.local 4566
sudo pseudo-url sync
sudo pseudo-url start

# Access Lambda functions at http://lambda.local
```

### Netlify Dev

```bash
# Start Netlify Dev (default port 8888)
netlify dev

# Map to custom domain
pseudo-url add myapp.netlify.local 8888
sudo pseudo-url sync
sudo pseudo-url start

# Access at http://myapp.netlify.local
```

### Vercel Dev

```bash
# Start Vercel dev server (default port 3000)
vercel dev

# Map to custom domain
pseudo-url add myapp.vercel.local 3000
sudo pseudo-url sync
sudo pseudo-url start

# Access at http://myapp.vercel.local
```

### Azure Functions

```bash
# Start Azure Functions locally (default port 7071)
func start

# Map to custom domain
pseudo-url add functions.azure.local 7071
sudo pseudo-url sync
sudo pseudo-url start

# Access at http://functions.azure.local/api/function-name
```

### Multi-Service Serverless Architecture

```bash
# Map multiple serverless services
pseudo-url add auth.local 3001      # Auth service
pseudo-url add api.local 3002       # API Gateway
pseudo-url add webhooks.local 3003  # Webhook handlers
pseudo-url add admin.local 3004     # Admin functions

sudo pseudo-url sync
sudo pseudo-url start

# Now your microservices architecture works with proper domains
# http://auth.local
# http://api.local
# http://webhooks.local
# http://admin.local
```

### Benefits for Serverless Development

- **Production-like URLs**: Test with real domain names instead of `localhost:port`
- **CORS Testing**: Properly test cross-origin requests between services
- **Webhook Development**: Provide clean URLs for webhook testing
- **API Gateway Simulation**: Mimic cloud provider routing locally
- **Microservices**: Manage multiple serverless functions with distinct domains
- **Environment Parity**: Closer to production configuration during development
- **Context Switching**: Dramatically improves developer convenience when switching between multiple serverless projects - memorable domain names (like `auth.local`, `api.local`) are much easier to remember and access than port numbers (`localhost:3001`, `localhost:3002`), reducing cognitive load and speeding up development workflow

## Port Requirements

- **Port 80** (default): Requires `sudo` to run the proxy server
- **Ports >= 1024**: Can run without `sudo` (e.g., `pseudo-url start -p 8080`)
- You'll need to access your apps with the port number: `http://myapp.local:8080`

## Permissions

### Hosts File Modification

Modifying the hosts file requires elevated permissions (sudo). The hosts file locations:

- **macOS/Linux**: `/etc/hosts`
- **Windows**: `C:\Windows\System32\drivers\etc\hosts`

### Backup

The tool automatically backs up your hosts file to `~/.pseudo-url/hosts.backup` before making changes.

## Configuration

Configuration is stored in: `~/.pseudo-url/config.json`

Example configuration:

```json
{
  "mappings": {
    "myapp.local": 3000,
    "api.local": 8080
  },
  "proxyPort": 80
}
```

## Troubleshooting

### Permission Errors

If you get permission errors:

- Run with `sudo` for operations that modify the hosts file or use port 80
- Or use a port >= 1024: `pseudo-url start -p 8080`

### Port Already in Use

If port 80 is already in use:

- Stop the conflicting service, or
- Use a different port: `pseudo-url port 8080`

### Domain Not Resolving

1. Make sure you've run `sudo pseudo-url sync`
2. Check that the entry exists in your hosts file: `cat /etc/hosts | grep pseudo-url`
3. Try flushing your DNS cache:
   - macOS: `sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder`
   - Linux: `sudo systemd-resolve --flush-caches`
   - Windows: `ipconfig /flushdns`

### Proxy Not Working

1. Make sure the proxy server is running: `sudo pseudo-url start`
2. Check that your development server is running on the mapped port
3. View status: `pseudo-url status`

## Development Mode

If you're contributing to pseudo-url itself, use development mode:

```bash
cd pseudo-url-localhost
sudo pseudo-url dev
```

This will:

- Stop the system service temporarily
- Run the proxy with auto-reload (nodemon)
- Automatically restart the service when you exit

Perfect for developing and testing changes. When you're done, run `sudo pseudo-url service reinstall` to install your changes to the system service.

## Security Notes

### System Service Security

When running as a system service, pseudo-url:

- **Runs as root** (required for ports 80/443)
- **Only listens on localhost** (127.0.0.1) - not exposed to network
- **Validates configuration** for malicious domains/ports
- **Rate limits** requests (1000/min per domain)
- **Auto-checks** file permissions and warns if insecure

### Best Practices

1. **Keep dependencies updated**: `npm update -g pseudo-url-localhost`
2. **Monitor logs**: `pseudo-url service logs` for unusual activity
3. **Review mappings**: `pseudo-url list` regularly
4. **Use HTTPS**: Install mkcert for secure local development
5. **Restrict config access**: Ensure `~/.pseudo-url/config.json` is not world-writable

See [SERVICE.md](SERVICE.md#security-considerations) for detailed security information.

## Cleanup

To completely remove all pseudo-url configurations:

```bash
# Uninstall service (if installed)
sudo pseudo-url service uninstall

# Clear all mappings and sync
pseudo-url clear
sudo pseudo-url sync

# Manually remove config directory
rm -rf ~/.pseudo-url
```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

If you encounter any issues or have questions, please file an issue on the GitHub repository.

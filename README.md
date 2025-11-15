# pseudo-url-localhost

Map custom pseudo-URLs to your localhost development servers with ease! Never type `localhost:3000` again.

## Features

- 🚀 Map custom domains (like `myapp.local`) to localhost ports
- 🔄 Built-in proxy server to route requests
- 📝 Automatic hosts file management
- 💻 Simple CLI interface
- 🎯 Works with any local development server
- 🛠️ Easy configuration management

## Installation

```bash
npm install -g pseudo-url-localhost
```

## Quick Start

1. **Add a mapping** (map a domain to a port):

```bash
pseudo-url add myapp.local 3000
```

2. **Sync the hosts file** (requires sudo):

```bash
sudo pseudo-url sync
```

3. **Start the proxy server** (requires sudo for port 80):

```bash
sudo pseudo-url start
```

4. **Access your app** at `http://myapp.local`

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

## How It Works

`pseudo-url-localhost` consists of three main components:

1. **Configuration Management**: Stores your domain-to-port mappings in `~/.pseudo-url/config.json`

2. **Hosts File Integration**: Automatically adds entries to your system's hosts file (requires sudo) to map custom domains to `127.0.0.1`

3. **Proxy Server**: Runs a local HTTP proxy that routes requests from your custom domains to the appropriate localhost ports

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

## Cleanup

To completely remove all pseudo-url configurations:

```bash
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


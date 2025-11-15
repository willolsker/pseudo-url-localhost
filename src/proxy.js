const http = require('http');
const httpProxy = require('http-proxy');
const { getAllMappings } = require('./config');

/**
 * Create and start the proxy server
 */
function startProxyServer(port = 80) {
  const proxy = httpProxy.createProxyServer({});
  
  // Handle proxy errors
  proxy.on('error', (err, req, res) => {
    console.error('Proxy error:', err.message);
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'text/html' });
      res.end(`
        <html>
          <head><title>502 Bad Gateway</title></head>
          <body>
            <h1>502 Bad Gateway</h1>
            <p>Cannot connect to target server: ${err.message}</p>
            <p>Make sure your development server is running on the correct port.</p>
          </body>
        </html>
      `);
    }
  });
  
  const server = http.createServer((req, res) => {
    const hostname = req.headers.host ? req.headers.host.split(':')[0] : '';
    const mappings = getAllMappings();
    
    if (hostname && mappings[hostname]) {
      const targetPort = mappings[hostname];
      const target = `http://127.0.0.1:${targetPort}`;
      
      console.log(`[${new Date().toISOString()}] ${req.method} ${hostname} -> localhost:${targetPort} ${req.url}`);
      
      proxy.web(req, res, { 
        target,
        changeOrigin: true,
        secure: false
      });
    } else {
      res.writeHead(404, { 'Content-Type': 'text/html' });
      res.end(`
        <html>
          <head><title>404 Not Found</title></head>
          <body>
            <h1>404 Not Found</h1>
            <p>No mapping found for domain: <strong>${hostname || 'unknown'}</strong></p>
            <hr>
            <h2>Configured Mappings:</h2>
            <ul>
              ${Object.entries(mappings).map(([domain, port]) => 
                `<li><strong>${domain}</strong> → localhost:${port}</li>`
              ).join('')}
            </ul>
            <p>Use <code>pseudo-url add</code> to add new mappings.</p>
          </body>
        </html>
      `);
    }
  });
  
  return new Promise((resolve, reject) => {
    server.on('error', (err) => {
      if (err.code === 'EACCES') {
        reject(new Error(`Permission denied to bind to port ${port}. Try running with sudo or use a port >= 1024.`));
      } else if (err.code === 'EADDRINUSE') {
        reject(new Error(`Port ${port} is already in use. Stop the other service or choose a different port.`));
      } else {
        reject(err);
      }
    });
    
    server.listen(port, '127.0.0.1', () => {
      console.log(`\n✓ Proxy server running on port ${port}`);
      console.log(`✓ Monitoring ${Object.keys(getAllMappings()).length} domain(s)\n`);
      
      const mappings = getAllMappings();
      if (Object.keys(mappings).length > 0) {
        console.log('Active mappings:');
        Object.entries(mappings).forEach(([domain, port]) => {
          console.log(`  • http://${domain} → http://localhost:${port}`);
        });
        console.log('');
      }
      
      resolve(server);
    });
  });
}

module.exports = {
  startProxyServer
};


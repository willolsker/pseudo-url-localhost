const http = require('http');
const https = require('https');
const httpProxy = require('http-proxy');
const { getAllMappings } = require('./config');
const { loadCertificates } = require('./certificates');

/**
 * Create request handler for both HTTP and HTTPS servers
 */
function createRequestHandler(proxy, protocol) {
  return (req, res) => {
    const hostname = req.headers.host ? req.headers.host.split(':')[0] : '';
    const mappings = getAllMappings();
    
    if (hostname && mappings[hostname]) {
      const targetPort = mappings[hostname];
      const target = `http://127.0.0.1:${targetPort}`;
      
      console.log(`[${new Date().toISOString()}] ${protocol} ${req.method} ${hostname} -> localhost:${targetPort} ${req.url}`);
      
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
  };
}

/**
 * Create and start the proxy servers (HTTP and HTTPS)
 */
function startProxyServer(httpPort = 80, httpsPort = 443, options = {}) {
  const { enableHttps = true } = options;
  
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
  
  const servers = [];
  const promises = [];
  
  // Create HTTP server
  const httpServer = http.createServer(createRequestHandler(proxy, 'HTTP'));
  
  const httpPromise = new Promise((resolve, reject) => {
    httpServer.on('error', (err) => {
      if (err.code === 'EACCES') {
        reject(new Error(`Permission denied to bind to port ${httpPort}. Try running with sudo or use a port >= 1024.`));
      } else if (err.code === 'EADDRINUSE') {
        reject(new Error(`Port ${httpPort} is already in use. Stop the other service or choose a different port.`));
      } else {
        reject(err);
      }
    });
    
    httpServer.listen(httpPort, '127.0.0.1', () => {
      console.log(`✓ HTTP proxy server running on port ${httpPort}`);
      resolve(httpServer);
    });
  });
  
  promises.push(httpPromise);
  servers.push(httpServer);
  
  // Create HTTPS server if enabled and certificates are available
  if (enableHttps) {
    const certs = loadCertificates();
    
    if (certs) {
      try {
        const httpsServer = https.createServer(
          {
            key: certs.key,
            cert: certs.cert
          },
          createRequestHandler(proxy, 'HTTPS')
        );
        
        const httpsPromise = new Promise((resolve, reject) => {
          httpsServer.on('error', (err) => {
            if (err.code === 'EACCES') {
              reject(new Error(`Permission denied to bind to port ${httpsPort}. Try running with sudo.`));
            } else if (err.code === 'EADDRINUSE') {
              reject(new Error(`Port ${httpsPort} is already in use. Stop the other service or choose a different port.`));
            } else {
              reject(err);
            }
          });
          
          httpsServer.listen(httpsPort, '127.0.0.1', () => {
            console.log(`✓ HTTPS proxy server running on port ${httpsPort}`);
            resolve(httpsServer);
          });
        });
        
        promises.push(httpsPromise);
        servers.push(httpsServer);
      } catch (error) {
        console.error('Warning: Failed to start HTTPS server:', error.message);
      }
    }
  }
  
  return Promise.all(promises).then(() => {
    console.log(`✓ Monitoring ${Object.keys(getAllMappings()).length} domain(s)\n`);
    
    const mappings = getAllMappings();
    if (Object.keys(mappings).length > 0) {
      console.log('Active mappings:');
      Object.entries(mappings).forEach(([domain, port]) => {
        const protocols = [];
        if (servers.length >= 1) protocols.push(`http://${domain}`);
        if (servers.length >= 2) protocols.push(`https://${domain}`);
        console.log(`  • ${protocols.join(' | ')} → http://localhost:${port}`);
      });
      console.log('');
    }
    
    return servers;
  });
}

module.exports = {
  startProxyServer
};


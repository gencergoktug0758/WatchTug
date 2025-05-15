// Redirect all API requests to socket-server.js
const socketServer = require('./socket-server');

module.exports = (req, res) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
    res.status(200).end();
    return;
  }
  
  // Check if it's a socket.io request
  if (req.url.startsWith('/socket.io/')) {
    return socketServer(req, res);
  }
  
  // For other API endpoints
  if (req.url === '/status') {
    res.json({ status: 'Server is running' });
    return;
  }
  
  // Default handler
  return socketServer(req, res);
}; 
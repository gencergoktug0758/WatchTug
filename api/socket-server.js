// This file is used by Vercel's API routes to handle Socket.IO connections
const app = require('../server');
const server = app.server;
const io = app.io;

// Handle Vercel serverless function request
module.exports = (req, res) => {
  if (!res.socket.server) {
    // Initial setup
    console.log('Setting up Socket.IO server...');
    
    // Save the server instance on the response socket
    res.socket.server = server;
    
    // Start Socket.IO server
    server.listen();
  }
  
  // Return a 200 response to acknowledge the setup
  res.end('Socket.IO server is running');
}; 
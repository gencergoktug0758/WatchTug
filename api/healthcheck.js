// Simple health check endpoint for Vercel
module.exports = (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    socketServer: 'active',
    service: 'WatchTugV2',
    message: 'Socket server is running'
  });
}; 
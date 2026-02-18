const WebSocket = require('ws');
const http = require('http');
const url = require('url');

// Create HTTP server
const server = http.createServer();

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Store connected clients
const clients = new Map();

// Ping interval to keep connections alive
setInterval(() => {
  clients.forEach((client, clientId) => {
    if (client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.ping();
      } catch (error) {
        console.log(`Failed to ping client ${clientId}:`, error.message);
        clients.delete(clientId);
      }
    } else {
      clients.delete(clientId);
    }
  });
}, 30000); // Ping every 30 seconds

// Handle WebSocket connections
wss.on('connection', (ws, req) => {
  const query = url.parse(req.url, true).query;
  const clientType = query.type; // 'laptop' or 'bigscreen'
  const clientId = Date.now().toString();
  
  console.log(`New ${clientType} client connected: ${clientId}`);
  
  // Store client info
  clients.set(clientId, {
    ws,
    type: clientType,
    id: clientId
  });
  
  // Send welcome message
  ws.send(JSON.stringify({
    type: 'connected',
    clientId,
    message: `Connected as ${clientType}`
  }));
  
  // Handle messages
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      console.log(`Received from ${clientType}:`, message);
      
      if (message.type === 'present_abstract') {
        // Forward to big screen clients
        broadcastToBigScreens(message);
      } else if (message.type === 'close_presentation') {
        // Forward close command to big screen clients
        broadcastToBigScreens(message);
      }
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  });
  
  // Handle disconnection
  ws.on('close', (code, reason) => {
    console.log(`${clientType} client disconnected: ${clientId} (Code: ${code}, Reason: ${reason})`);
    clients.delete(clientId);
  });
  
  // Handle errors
  ws.on('error', (error) => {
    console.error(`WebSocket error for ${clientType} (${clientId}):`, error.message || error);
    clients.delete(clientId);
  });
});

// Broadcast message to all big screen clients
function broadcastToBigScreens(message) {
  clients.forEach((client) => {
    if (client.type === 'bigscreen' && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
    }
  });
}

// Start server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`WebSocket server running on port ${PORT}`);
  console.log(`Connect laptop clients to: ws://localhost:${PORT}?type=laptop`);
  console.log(`Connect big screen clients to: ws://localhost:${PORT}?type=bigscreen`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down WebSocket server...');
  wss.close(() => {
    server.close(() => {
      process.exit(0);
    });
  });
});

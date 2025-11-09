const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');
const PrinterManager = require('./printer-manager');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Serve model files
app.use('/models', express.static(path.join(__dirname, '../models')));

// Initialize printer manager
const printerManager = new PrinterManager(io);

// API Routes
app.get('/api/printers', (req, res) => {
  res.json(printerManager.getAllStates());
});

app.get('/api/models', (req, res) => {
  const modelsPath = path.join(__dirname, '../config/models.json');
  const models = require(modelsPath);
  res.json(models);
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('Client connected');

  // Send current printer states to newly connected client
  socket.emit('initial-state', printerManager.getAllStates());

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });

  socket.on('request-refresh', () => {
    printerManager.mqttClients.forEach(client => client.requestStatus());
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`\n===========================================`);
  console.log(`  Bambu Lab Printer Monitor`);
  console.log(`===========================================`);
  console.log(`Server running on port ${PORT}`);
  console.log(`Web interface: http://localhost:${PORT}`);
  console.log(`\nConnecting to printers...`);
  console.log(`===========================================\n`);

  // Connect to all printers
  printerManager.connectAll();
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  printerManager.disconnectAll();
  server.close(() => {
    console.log('Server stopped');
    process.exit(0);
  });
});

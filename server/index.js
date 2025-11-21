const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const multer = require('multer');
const PrinterManager = require('./printer-manager');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));
app.use('/models', express.static(path.join(__dirname, '../models')));

// Multer Setup for Uploads
const upload = multer({ dest: path.join(__dirname, '../temp_uploads/') });

// Ensure temp directory exists
if (!fs.existsSync(path.join(__dirname, '../temp_uploads/'))) {
  fs.mkdirSync(path.join(__dirname, '../temp_uploads/'));
}

// Ensure gcode_files directory exists
const gcodeDir = path.join(__dirname, '../gcode_files/');
if (!fs.existsSync(gcodeDir)) {
  fs.mkdirSync(gcodeDir);
}

// Initialize Printer Manager
const printerManager = new PrinterManager(io);

// API Routes
app.get('/api/printers', (req, res) => {
  res.json(printerManager.getAllStates());
});

app.get('/api/models', (req, res) => {
  res.json(printerManager.modelsConfig);
});

// List Local Files
app.get('/api/files', (req, res) => {
  fs.readdir(gcodeDir, (err, files) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to list files' });
    }
    const validFiles = files.filter(file =>
      file.toLowerCase().endsWith('.gcode') ||
      file.toLowerCase().endsWith('.3mf')
    );
    res.json(validFiles);
  });
});

io.on('connection', (socket) => {
  console.log('Client connected');
  // Send initial state
  socket.emit('initial-state', printerManager.getAllStates());

  socket.on('request-refresh', () => {
    console.log('Client requested refresh');
    printerManager.mqttClients.forEach(client => client.requestStatus());
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// Start Server
const PORT = process.env.PORT || 3000;
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

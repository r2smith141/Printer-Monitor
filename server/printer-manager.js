const fs = require('fs');
const path = require('path');
const BambuMQTTClient = require('./mqtt-client');

class PrinterManager {
  constructor(io) {
    this.io = io;
    this.printers = new Map();
    this.printerStates = new Map();
    this.mqttClients = new Map();
    this.modelsConfig = {};
    this.loadConfigs();
  }

  loadConfigs() {
    // Load printer configurations
    const printersPath = path.join(__dirname, '../config/printers.json');
    const printersData = JSON.parse(fs.readFileSync(printersPath, 'utf8'));

    printersData.forEach(printer => {
      this.printers.set(printer.id, printer);
      this.printerStates.set(printer.id, {
        id: printer.id,
        name: printer.name,
        status: 'disconnected',
        progress: 0,
        currentFile: '',
        state: 'IDLE',
        remainingTime: 0,
        layer: 0,
        totalLayers: 0,
        nozzleTemp: 0,
        bedTemp: 0,
        lastUpdate: null
      });
    });

    // Load models configuration
    const modelsPath = path.join(__dirname, '../config/models.json');
    this.modelsConfig = JSON.parse(fs.readFileSync(modelsPath, 'utf8'));
  }

  connectAll() {
    this.printers.forEach((printer, id) => {
      const client = new BambuMQTTClient(
        printer,
        (printerId, data) => this.handlePrinterMessage(printerId, data),
        (printerId, status) => this.handleStatusChange(printerId, status)
      );
      client.connect();
      this.mqttClients.set(id, client);
    });

    // Refresh status every 30 seconds
    setInterval(() => {
      this.mqttClients.forEach(client => client.requestStatus());
    }, 30000);
  }

  handleStatusChange(printerId, status) {
    const state = this.printerStates.get(printerId);
    if (!state) return;

    state.status = status;
    this.printerStates.set(printerId, state);

    // Emit update to all connected clients
    this.io.emit('printer-update', state);
  }

  handlePrinterMessage(printerId, data) {
    const state = this.printerStates.get(printerId);
    if (!state) return;

    // Extract relevant data from the print message
    const print = data.print;
    if (print) {
      state.state = print.gcode_state || state.state;
      state.progress = print.mc_percent || 0;
      state.currentFile = print.gcode_file || '';
      state.remainingTime = print.mc_remaining_time || 0;
      state.layer = print.layer_num || 0;
      state.totalLayers = print.total_layer_num || 0;
      state.nozzleTemp = print.nozzle_temper || 0;
      state.bedTemp = print.bed_temper || 0;
      state.lastUpdate = new Date();

      // Find matching model
      state.modelFile = this.getModelForFile(state.currentFile);

      this.printerStates.set(printerId, state);

      // Emit update to all connected clients
      this.io.emit('printer-update', state);
    }
  }

  getModelForFile(filename) {
    if (!filename) return null;

    // Check exact match
    if (this.modelsConfig[filename]) {
      return this.modelsConfig[filename];
    }

    // Check partial match (case insensitive)
    const filenameLower = filename.toLowerCase();
    for (const [key, value] of Object.entries(this.modelsConfig)) {
      if (filenameLower.includes(key.toLowerCase()) || key.toLowerCase().includes(filenameLower)) {
        return value;
      }
    }

    return null;
  }

  getAllStates() {
    return Array.from(this.printerStates.values());
  }

  disconnectAll() {
    this.mqttClients.forEach(client => client.disconnect());
  }
}

module.exports = PrinterManager;

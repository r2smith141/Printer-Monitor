const fs = require('fs');
const path = require('path');
const ftp = require('basic-ftp');
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
        lastUpdate: null,
        error: null,
        ams: [] // Add AMS data storage
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
    if (!state) {
      console.log(`WARNING: No state found for printer ${printerId}`);
      return;
    }

    // Extract relevant data from the print message
    const print = data.print;
    if (print) {
      // console.log(`\n>>> Processing data for ${state.name}`); // Reduce log noise

      state.state = print.gcode_state || state.state;
      state.progress = print.mc_percent || 0;
      state.currentFile = print.gcode_file || '';
      state.remainingTime = print.mc_remaining_time || 0;
      state.layer = print.layer_num || 0;
      state.totalLayers = print.total_layer_num || 0;
      state.nozzleTemp = print.nozzle_temper || 0;
      state.bedTemp = print.bed_temper || 0;
      state.lastUpdate = new Date();

      // Update AMS Data if available
      if (print.ams && print.ams.ams) {
        state.ams = this.parseAMSData(print.ams.ams);
      }

      // Find matching model
      state.modelFile = this.getModelForFile(state.currentFile);

      // Detect errors from printer data
      state.error = this.detectError(print);

      this.printerStates.set(printerId, state);

      // Emit update to all connected clients
      this.io.emit('printer-update', state);
    }
  }

  parseAMSData(amsData) {
    const slots = [];
    if (!Array.isArray(amsData)) return slots;

    amsData.forEach(ams => {
      if (ams.tray) {
        ams.tray.forEach((tray, index) => {
          slots.push({
            id: index, // Simplified ID
            type: tray.tray_type || 'Unknown',
            color: `#${tray.tray_color}` || '#ffffff',
            remain: tray.remain
          });
        });
      }
    });
    return slots;
  }

  detectError(print) {
    // Check for various error conditions in the printer data

    // HMS (Hardware Management System) errors
    if (print.hms && Array.isArray(print.hms) && print.hms.length > 0) {
      const errorCodes = print.hms.map(hms => hms.attr).join(', ');
      const errorMsg = print.hms[0].text || 'Hardware error detected';
      return {
        code: errorCodes,
        message: errorMsg
      };
    }

    // Print error state
    if (print.print_error && print.print_error !== 0) {
      return {
        code: `PRINT_ERROR_${print.print_error}`,
        message: this.getErrorMessage(print.print_error, print)
      };
    }

    // Filament runout
    if (print.ams && print.ams.ams && Array.isArray(print.ams.ams)) {
      for (const ams of print.ams.ams) {
        if (ams.tray && Array.isArray(ams.tray)) {
          for (let i = 0; i < ams.tray.length; i++) {
            const tray = ams.tray[i];
            if (tray.remain !== undefined && tray.remain <= 0 && print.gcode_state === 'PAUSE') {
              return {
                code: 'FILAMENT_RUNOUT',
                message: `Filament runout detected in AMS ${ams.id + 1}, Tray ${i + 1}`
              };
            }
          }
        }
      }
    }

    // Nozzle clog detection (temperature anomaly)
    if (print.nozzle_temper && print.nozzle_target_temper) {
      const tempDiff = Math.abs(print.nozzle_temper - print.nozzle_target_temper);
      if (tempDiff > 15 && print.gcode_state === 'RUNNING') {
        return {
          code: 'TEMP_ANOMALY',
          message: `Nozzle temperature anomaly: ${Math.round(print.nozzle_temper)}°C (target: ${Math.round(print.nozzle_target_temper)}°C)`
        };
      }
    }

    // No error detected
    return null;
  }

  getErrorMessage(errorCode, print) {
    const errorMessages = {
      1: 'Print stopped due to user intervention',
      2: 'Filament runout detected',
      3: 'Nozzle temperature error',
      4: 'Bed temperature error',
      5: 'Heatbed abnormal',
      6: 'Front cover fallen',
      7: 'Nozzle clog detected',
      8: 'External spool runout',
      9: 'AMS filament runout',
      10: 'Build plate error'
    };

    return errorMessages[errorCode] || `Print error (code: ${errorCode})`;
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

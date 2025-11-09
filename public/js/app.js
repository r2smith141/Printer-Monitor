class PrinterMonitorApp {
  constructor() {
    this.socket = null;
    this.printers = new Map();
    this.modelViewers = new Map();
    this.init();
  }

  init() {
    this.setupSocketConnection();
    this.setupEventListeners();
    this.setupLogo();
  }

  setupLogo() {
    const logo = document.getElementById('header-logo');
    logo.addEventListener('load', () => {
      logo.classList.add('loaded');
    });
    logo.addEventListener('error', () => {
      // Logo failed to load, keep it hidden
      logo.style.display = 'none';
    });
  }

  setupSocketConnection() {
    this.socket = io();

    this.socket.on('connect', () => {
      console.log('Connected to server');
      this.updateConnectionStatus(true);
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from server');
      this.updateConnectionStatus(false);
    });

    this.socket.on('initial-state', (printers) => {
      console.log('Received initial state:', printers);
      this.initializePrinters(printers);
    });

    this.socket.on('printer-update', (printerData) => {
      this.updatePrinter(printerData);
    });
  }

  setupEventListeners() {
    const refreshBtn = document.getElementById('refresh-btn');
    refreshBtn.addEventListener('click', () => {
      this.socket.emit('request-refresh');
    });
  }

  initializePrinters(printers) {
    const list = document.getElementById('printers-list');
    list.innerHTML = '';

    printers.forEach(printer => {
      const row = this.createPrinterRow(printer);
      list.appendChild(row);
      this.printers.set(printer.id, printer);
      this.updatePrinterRow(printer);
    });
  }

  createPrinterRow(printer) {
    const template = document.getElementById('printer-row-template');
    const row = template.content.cloneNode(true);

    const containerElement = row.querySelector('.printer-row-container');
    containerElement.dataset.printerId = printer.id;

    const canvas = row.querySelector('.model-canvas');
    const viewer = new ModelViewer(canvas);
    this.modelViewers.set(printer.id, viewer);

    return row;
  }

  updatePrinter(printerData) {
    this.printers.set(printerData.id, printerData);
    this.updatePrinterRow(printerData);
  }

  updatePrinterRow(printer) {
    const container = document.querySelector(`[data-printer-id="${printer.id}"]`);
    if (!container) return;

    // Update name
    container.querySelector('.printer-name').textContent = printer.name;

    // Update status - FIX: Use actual connection state
    const statusBadge = container.querySelector('.printer-status');
    statusBadge.textContent = printer.status;
    statusBadge.className = `printer-status ${printer.status}`;

    // Update file name
    container.querySelector('.file-name').textContent = printer.currentFile || '--';

    // Update state
    const stateElement = container.querySelector('.printer-state');
    stateElement.textContent = printer.state;
    stateElement.className = `printer-state ${printer.state}`;

    // Update layer info
    container.querySelector('.layer-info').textContent = `${printer.layer} / ${printer.totalLayers}`;

    // Update time remaining
    container.querySelector('.time-remaining').textContent = this.formatTime(printer.remainingTime);

    // Update temperatures
    container.querySelector('.nozzle-temp').textContent = Math.round(printer.nozzleTemp);
    container.querySelector('.bed-temp').textContent = Math.round(printer.bedTemp);

    // Update progress
    const progressText = container.querySelector('.progress-text');
    const progressFill = container.querySelector('.progress-fill');
    progressText.textContent = `${Math.round(printer.progress)}%`;
    progressFill.style.width = `${printer.progress}%`;

    // Handle errors
    this.updateErrorDisplay(container, printer);

    // Update 3D model
    this.update3DModel(printer);
  }

  updateErrorDisplay(container, printer) {
    const errorPanel = container.querySelector('.error-panel');
    const errorMessage = container.querySelector('.error-message');

    if (printer.error && printer.error.message) {
      // Show error
      container.classList.add('has-error');
      errorPanel.style.display = 'flex';
      errorMessage.textContent = printer.error.message;
    } else {
      // Hide error
      container.classList.remove('has-error');
      errorPanel.style.display = 'none';
      errorMessage.textContent = '';
    }
  }

  update3DModel(printer) {
    const viewer = this.modelViewers.get(printer.id);
    if (!viewer) return;

    const container = document.querySelector(`[data-printer-id="${printer.id}"]`);
    const noModelMessage = container.querySelector('.no-model-message');
    const canvas = container.querySelector('.model-canvas');

    if (printer.modelFile && printer.modelFile.modelFile) {
      // Load the 3D model
      const modelPath = `/models/${printer.modelFile.modelFile}`;
      viewer.loadModel(modelPath);
      noModelMessage.style.display = 'none';
      canvas.style.display = 'block';
    } else {
      // No model to display
      viewer.clearModel();
      noModelMessage.style.display = 'block';
      canvas.style.display = 'none';
    }
  }

  updateConnectionStatus(connected) {
    const statusBadge = document.getElementById('connection-status');
    if (connected) {
      statusBadge.textContent = 'Connected';
      statusBadge.className = 'status-badge connected';
    } else {
      statusBadge.textContent = 'Disconnected';
      statusBadge.className = 'status-badge disconnected';
    }
  }

  formatTime(minutes) {
    if (!minutes || minutes <= 0) return '--';

    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);

    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new PrinterMonitorApp();
});

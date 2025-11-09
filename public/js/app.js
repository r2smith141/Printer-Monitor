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
    const grid = document.getElementById('printers-grid');
    grid.innerHTML = '';

    printers.forEach(printer => {
      const card = this.createPrinterCard(printer);
      grid.appendChild(card);
      this.printers.set(printer.id, printer);
      this.updatePrinterCard(printer);
    });
  }

  createPrinterCard(printer) {
    const template = document.getElementById('printer-card-template');
    const card = template.content.cloneNode(true);

    const cardElement = card.querySelector('.printer-card');
    cardElement.dataset.printerId = printer.id;

    const canvas = card.querySelector('.model-canvas');
    const viewer = new ModelViewer(canvas);
    this.modelViewers.set(printer.id, viewer);

    return card;
  }

  updatePrinter(printerData) {
    this.printers.set(printerData.id, printerData);
    this.updatePrinterCard(printerData);
  }

  updatePrinterCard(printer) {
    const card = document.querySelector(`[data-printer-id="${printer.id}"]`);
    if (!card) return;

    // Update header
    card.querySelector('.printer-name').textContent = printer.name;

    const statusBadge = card.querySelector('.printer-status');
    statusBadge.textContent = printer.status;
    statusBadge.className = `printer-status ${printer.status}`;

    // Update info
    card.querySelector('.file-name').textContent = printer.currentFile || '--';

    const stateElement = card.querySelector('.printer-state');
    stateElement.textContent = printer.state;
    stateElement.className = `info-value printer-state ${printer.state}`;

    card.querySelector('.layer-info').textContent = `${printer.layer} / ${printer.totalLayers}`;
    card.querySelector('.time-remaining').textContent = this.formatTime(printer.remainingTime);
    card.querySelector('.temps').textContent = `Nozzle: ${Math.round(printer.nozzleTemp)}°C | Bed: ${Math.round(printer.bedTemp)}°C`;

    // Update progress
    card.querySelector('.progress-percentage').textContent = `${Math.round(printer.progress)}%`;
    card.querySelector('.progress-fill').style.width = `${printer.progress}%`;

    // Update 3D model
    this.update3DModel(printer);
  }

  update3DModel(printer) {
    const viewer = this.modelViewers.get(printer.id);
    if (!viewer) return;

    const card = document.querySelector(`[data-printer-id="${printer.id}"]`);
    const noModelMessage = card.querySelector('.no-model-message');
    const canvas = card.querySelector('.model-canvas');

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

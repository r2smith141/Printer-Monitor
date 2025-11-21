class PrinterMonitorApp {
  constructor() {
    this.socket = null;
    this.printers = new Map();
    this.modelViewers = new Map();
    this.localFiles = [];
    this.init();
  }

  init() {
    this.setupSocketConnection();
    this.setupEventListeners();
    this.setupLogo();
    this.setupTabs();
    this.setupPrintJobForm();
  }

  setupLogo() {
    const logo = document.getElementById('header-logo');
    logo.addEventListener('error', () => {
      logo.style.display = 'none';
    });
  }

  setupTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        // Remove active class from all tabs and contents
        document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

        // Add active class to clicked tab and target content
        tab.classList.add('active');
        const targetId = tab.dataset.tab + '-tab';
        document.getElementById(targetId).classList.add('active');
      });
    });
  }

  setupSocketConnection() {
    this.socket = io();

    this.socket.on('connect', () => {
      console.log('Connected to server');
      // this.updateConnectionStatus(true); // Removed global status
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from server');
      // this.updateConnectionStatus(false); // Removed global status
    });

    this.socket.on('initial-state', (printers) => {
      console.log('Received initial state:', printers);
      this.initializePrinters(printers);
      this.updatePrinterSelect(printers);
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

    // File Source Toggle
    const fileSourceRadios = document.getElementsByName('file-source');
    fileSourceRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        const isLocal = e.target.value === 'local';
        document.getElementById('local-file-group').style.display = isLocal ? 'block' : 'none';
        document.getElementById('upload-file-group').style.display = isLocal ? 'none' : 'block';

        if (isLocal && this.localFiles.length === 0) {
          this.fetchLocalFiles();
        }
      });
    });

    // Printer Select Change
    const printerSelect = document.getElementById('printer-select');
    printerSelect.addEventListener('change', () => {
      this.handlePrinterSelection();
    });

    // Initial fetch of local files
    this.fetchLocalFiles();
  }

  async fetchLocalFiles() {
    try {
      const response = await fetch('/api/files');
      if (response.ok) {
        this.localFiles = await response.json();
        this.updateLocalFileSelect();
      }
    } catch (error) {
      console.error('Error fetching local files:', error);
    }
  }

  updateLocalFileSelect() {
    const select = document.getElementById('local-file-select');
    select.innerHTML = '<option value="">-- Select a File --</option>';
    this.localFiles.forEach(file => {
      const option = document.createElement('option');
      option.value = file;
      option.textContent = file;
      select.appendChild(option);
    });
  }

});

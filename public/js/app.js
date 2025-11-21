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



  setupPrintJobForm() {
    const form = document.getElementById('print-job-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handlePrintJobSubmit();
    });

    document.getElementById('add-filament-btn').addEventListener('click', () => {
      this.addFilamentMappingRow();
    });

    document.getElementById('remove-filament-btn').addEventListener('click', () => {
      this.removeFilamentMappingRow();
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

  updatePrinterSelect(printers) {
    const select = document.getElementById('printer-select');
    // Keep the first option
    const firstOption = select.options[0];
    select.innerHTML = '';
    select.appendChild(firstOption);

    printers.forEach(printer => {
      const option = document.createElement('option');
      option.value = printer.id;
      option.textContent = printer.name;
      select.appendChild(option);
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

    // Update print job form if this printer is selected
    const printerSelect = document.getElementById('printer-select');
    if (printerSelect.value === printerData.id) {
      this.handlePrinterSelection();
    }
  }

  updatePrinterRow(printer) {
    const container = document.querySelector(`[data-printer-id="${printer.id}"]`);
    if (!container) return;

    // Update name
    container.querySelector('.printer-name').textContent = printer.name;

    // Update connection icon
    const connIcon = container.querySelector('.connection-icon');
    if (printer.status === 'connected') {
      connIcon.classList.remove('disconnected');
      connIcon.classList.add('connected');
      connIcon.title = 'Connected';
    } else {
      connIcon.classList.remove('connected');
      connIcon.classList.add('disconnected');
      connIcon.title = 'Disconnected';
    }

    // Update status text (State)
    const statusBadge = container.querySelector('.printer-status');
    const stateText = printer.state || 'OFFLINE';
    statusBadge.textContent = stateText;
    statusBadge.className = `printer-status ${stateText}`;

    // Update file name with state indicator
    const fileName = printer.currentFile || '--';
    container.querySelector('.file-name').textContent = fileName;

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
      container.classList.add('has-error');
      errorPanel.style.display = 'flex';
      errorMessage.textContent = printer.error.message;
    } else {
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
      const modelPath = `/models/${printer.modelFile.modelFile}`;
      viewer.loadModel(modelPath);
      noModelMessage.style.display = 'none';
      canvas.style.display = 'block';
    } else {
      viewer.clearModel();
      noModelMessage.style.display = 'block';
      canvas.style.display = 'none';
    }
  }

  formatTime(minutes) {
    if (!minutes || minutes <= 0) return '--';
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  }

  handlePrinterSelection() {
    const printerId = document.getElementById('printer-select').value;
    const mappingsContainer = document.getElementById('filament-mappings-container');
    const statusMsg = document.getElementById('printer-status-msg');
    const startBtn = document.getElementById('start-print-btn');

    if (!printerId) {
      mappingsContainer.innerHTML = '<div class="ams-placeholder" style="text-align: center; color: #666; padding: 20px;">Select a printer to view AMS slots</div>';
      statusMsg.textContent = '';
      startBtn.disabled = true;
      return;
    }

    const printer = this.printers.get(printerId);
    if (!printer) return;

    // Safety Check - Allow FINISH state
    const allowedStates = ['IDLE', 'COMPLETED', 'READY', 'FINISH'];
    const isIdle = allowedStates.includes(printer.state);

    if (!isIdle) {
      statusMsg.textContent = `Printer is currently ${printer.state}. Cannot start new job.`;
      statusMsg.style.color = 'var(--warning-color)';
      startBtn.disabled = true;
    } else {
      if (printer.state === 'FINISH') {
        statusMsg.textContent = 'Printer finished previous job. Ready for new print.';
        statusMsg.style.color = 'var(--warning-color)'; // Orange to indicate attention needed (clear bed)
      } else {
        statusMsg.textContent = 'Printer is ready.';
        statusMsg.style.color = 'var(--success-color)';
      }
      startBtn.disabled = false;
    }

    // Reset and Render Initial Filament Mapping
    mappingsContainer.innerHTML = '';
    this.addFilamentMappingRow(printer);
  }

  addFilamentMappingRow(printer = null) {
    if (!printer) {
      const printerId = document.getElementById('printer-select').value;
      printer = this.printers.get(printerId);
    }
    if (!printer) return;

    const container = document.getElementById('filament-mappings-container');
    const index = container.children.length + 1;

    const row = document.createElement('div');
    row.className = 'filament-mapping-row';
    row.dataset.index = index;

    const label = document.createElement('span');
    label.className = 'filament-label';
    label.textContent = `Print Filament #${index}`;
    row.appendChild(label);

    const grid = document.createElement('div');
    grid.className = 'ams-grid';
    this.renderAMSSlots(printer, grid, index);
    row.appendChild(grid);

    container.appendChild(row);
    this.updateMappingButtons();
  }

  removeFilamentMappingRow() {
    const container = document.getElementById('filament-mappings-container');
    if (container.children.length > 1) {
      container.removeChild(container.lastChild);
      this.updateMappingButtons();
    }
  }

  updateMappingButtons() {
    const count = document.getElementById('filament-mappings-container').children.length;
    document.getElementById('remove-filament-btn').style.display = count > 1 ? 'inline-block' : 'none';
  }

  renderAMSSlots(printer, container, rowIndex) {
    container.innerHTML = '';

    const amsData = printer.ams && printer.ams.length > 0 ? printer.ams : this.getMockAMS();

    amsData.forEach((slot, index) => {
      const slotEl = document.createElement('div');
      slotEl.className = 'ams-slot';
      // Unique group for radio-like behavior within this row
      slotEl.dataset.row = rowIndex;
      slotEl.dataset.amsId = slot.id !== undefined ? slot.id : index;

      slotEl.onclick = () => {
        // Deselect others in this row
        container.querySelectorAll('.ams-slot').forEach(s => s.classList.remove('selected'));
        slotEl.classList.add('selected');
      };

      const colorEl = document.createElement('div');
      colorEl.className = 'filament-color';
      colorEl.style.backgroundColor = slot.color || '#fff';

      const typeEl = document.createElement('span');
      typeEl.className = 'filament-type';
      typeEl.textContent = slot.type || 'Unknown';

      slotEl.appendChild(colorEl);
      slotEl.appendChild(typeEl);

      container.appendChild(slotEl);
    });
  }

  getMockAMS() {
    return [
      { id: 0, color: '#000000', type: 'PLA' },
      { id: 1, color: '#ffffff', type: 'PLA' },
      { id: 2, color: '#ff0000', type: 'PETG' },
      { id: 3, color: '#0000ff', type: 'ABS' }
    ];
  }

  async handlePrintJobSubmit() {
    const printerId = document.getElementById('printer-select').value;
    const fileSource = document.querySelector('input[name="file-source"]:checked').value;

    if (!printerId) {
      alert('Please select a printer.');
      return;
    }

    // Collect AMS Mappings
    const mappingRows = document.querySelectorAll('.filament-mapping-row');
    const amsMapping = [];
    let missingSelection = false;

    mappingRows.forEach(row => {
      const selected = row.querySelector('.ams-slot.selected');
      if (selected) {
        amsMapping.push(parseInt(selected.dataset.amsId));
      } else {
        missingSelection = true;
      }
    });

    if (missingSelection) {
      alert('Please select an AMS slot for all filament rows.');
      return;
    }

    const formData = new FormData();
    formData.append('printerId', printerId);
    formData.append('amsMapping', JSON.stringify(amsMapping)); // Send as JSON string
    formData.append('source', fileSource);

    if (fileSource === 'local') {
      const filename = document.getElementById('local-file-select').value;
      if (!filename) {
        alert('Please select a file.');
        return;
      }
      formData.append('filename', filename);
    } else {
      const fileInput = document.getElementById('file-upload');
      if (fileInput.files.length === 0) {
        alert('Please upload a file.');
        return;
      }
      formData.append('file', fileInput.files[0]);
    }

    const startBtn = document.getElementById('start-print-btn');
    startBtn.disabled = true;
    startBtn.textContent = 'Sending...';

    try {
      const response = await fetch('/api/print', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (response.ok) {
        alert('Print job started successfully!');
        document.querySelector('[data-tab="monitor"]').click();
      } else {
        alert(`Error: ${result.error || 'Failed to start print'}`);
      }
    } catch (error) {
      console.error('Print job error:', error);
      alert('An error occurred while starting the print job.');
    } finally {
      startBtn.disabled = false;
      startBtn.textContent = 'Start Print';
    }
  }

document.addEventListener('DOMContentLoaded', () => {
  window.app = new PrinterMonitorApp();
});

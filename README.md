# Bambu Lab Printer Monitor

A real-time web-based monitoring dashboard for multiple Bambu Lab X-1 Carbon 3D printers. Built specifically for Raspberry Pi 3B.

## Features

- Real-time monitoring of up to 7 Bambu Lab X-1 Carbon printers
- Live progress bars for each printer
- Status display (IDLE, PRINTING, PAUSE, etc.)
- 3D model visualization of current print jobs
- Temperature monitoring (nozzle and bed)
- Layer progress tracking
- Estimated time remaining
- Responsive web interface
- Auto-reconnection on network issues

## Tech Stack

- **Backend**: Node.js + Express + Socket.io
- **Frontend**: HTML5 + CSS3 + JavaScript
- **3D Rendering**: Three.js
- **Protocol**: MQTT over TLS
- **Real-time Updates**: WebSocket (Socket.io)

## Prerequisites

- Raspberry Pi 3B (or any Linux system with Node.js)
- Node.js v14 or higher
- npm v6 or higher
- Network access to all Bambu Lab printers
- Printer access codes

## Installation

### 1. Install Node.js on Raspberry Pi

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 2. Clone or download this project

```bash
cd ~
git clone <repository-url> Printer-Monitor
cd Printer-Monitor
```

### 3. Install dependencies

```bash
npm install
```

## Configuration

### 1. Configure Your Printers

Edit `config/printers.json` with your printer details:

```json
[
  {
    "id": "printer1",
    "name": "Front Left Printer",
    "ip": "192.168.1.101",
    "accessCode": "12345678",
    "serialNumber": "00M00A000000001"
  }
]
```

**How to get printer information:**
- **IP Address**: Check your router's DHCP client list or printer's network settings
- **Access Code**: On printer touchscreen: Settings → Network → Access Code
- **Serial Number**: On printer touchscreen: Settings → Device → Serial Number

### 2. Configure 3D Model Mappings

Edit `config/models.json` to map print file names to 3D model files:

```json
{
  "benchy.3mf": {
    "modelFile": "benchy.stl",
    "displayName": "3D Benchy"
  },
  "test_cube.gcode": {
    "modelFile": "cube.stl",
    "displayName": "Test Cube"
  }
}
```

### 3. Add Your 3D Models

Place your STL files in the `models/` directory:

```bash
cp /path/to/your/model.stl models/
```

The application supports STL format. You can export STL files from most 3D modeling software or slicers.

## Running the Application

### Development Mode (with auto-restart)

```bash
npm run dev
```

### Production Mode

```bash
npm start
```

### Run on Boot (Raspberry Pi)

Create a systemd service:

```bash
sudo nano /etc/systemd/system/printer-monitor.service
```

Add the following content (adjust paths as needed):

```ini
[Unit]
Description=Bambu Lab Printer Monitor
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/Printer-Monitor
ExecStart=/usr/bin/node server/index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start the service:

```bash
sudo systemctl enable printer-monitor
sudo systemctl start printer-monitor
```

Check status:

```bash
sudo systemctl status printer-monitor
```

## Usage

1. Start the server (see above)
2. Open a web browser on any device on the same network
3. Navigate to: `http://<raspberry-pi-ip>:3000`
4. The dashboard will automatically connect and display all configured printers

### Default Port

The server runs on port 3000 by default. To change it:

```bash
PORT=8080 npm start
```

## Dashboard Features

### Printer Cards

Each printer displays:
- **Name**: Configured printer name
- **Status**: Connection status (connected/disconnected)
- **3D Model Viewer**: Real-time rotating preview of current print
- **File Name**: Name of the file being printed
- **State**: Current printer state (IDLE, PRINTING, PAUSE, FAILED, etc.)
- **Layer Progress**: Current layer / Total layers
- **Time Remaining**: Estimated time to completion
- **Temperatures**: Current nozzle and bed temperatures
- **Progress Bar**: Visual progress indicator with percentage

### Auto-Refresh

- The server requests status updates from all printers every 30 seconds
- Printers also push status changes in real-time via MQTT
- Use the "Refresh All" button to manually request immediate updates

## Troubleshooting

### Cannot connect to printer

1. Verify printer IP address is correct
2. Ensure printer and Raspberry Pi are on the same network
3. Check access code is correct
4. Verify printer's MQTT is not disabled
5. Check firewall settings (port 8883 must be accessible)

### 3D model not showing

1. Ensure the model file exists in the `models/` directory
2. Check that `config/models.json` has correct mapping
3. Verify the file name matches what the printer reports
4. Check browser console for loading errors

### High CPU usage on Raspberry Pi

- The 3D model viewers can be CPU intensive
- Consider reducing the number of active model viewers
- Ensure models are reasonably sized (< 10MB STL files)
- Use lower polygon count models when possible

### Server won't start

```bash
# Check Node.js version
node --version  # Should be v14 or higher

# Check for port conflicts
sudo lsof -i :3000

# Check logs
npm start
```

## Network Requirements

- Raspberry Pi must be on the same local network as the printers
- Port 3000 must be available on the Raspberry Pi
- Printers must have MQTT enabled (default on X-1 Carbon)
- No special router configuration needed for local network use

## Performance Tips for Raspberry Pi 3B

1. **Disable Model Viewers**: If CPU usage is too high, comment out the 3D viewer initialization in `public/js/app.js`
2. **Increase Status Update Interval**: Edit line in `server/printer-manager.js` to change from 30000ms to 60000ms
3. **Use Ethernet**: WiFi can be less reliable on Pi 3B
4. **Overclock (Advanced)**: Consider overclocking your Pi for better performance

## File Structure

```
Printer-Monitor/
├── config/
│   ├── printers.json      # Printer configurations
│   └── models.json         # Model mappings
├── models/                 # STL model files
├── server/
│   ├── index.js           # Main server
│   ├── mqtt-client.js     # MQTT connection handler
│   └── printer-manager.js # Printer state manager
├── public/
│   ├── index.html         # Main dashboard
│   ├── css/style.css      # Styling
│   └── js/
│       ├── app.js         # Frontend application
│       └── model-viewer.js # 3D viewer component
├── package.json
└── README.md
```

## API Endpoints

### GET /api/printers

Returns current state of all printers.

```bash
curl http://localhost:3000/api/printers
```

### GET /api/models

Returns model configuration.

```bash
curl http://localhost:3000/api/models
```

## WebSocket Events

### Client → Server

- `request-refresh`: Request immediate status update from all printers

### Server → Client

- `initial-state`: Initial state of all printers on connection
- `printer-update`: Real-time printer state update

## Contributing

Feel free to submit issues and enhancement requests!

## License

MIT License - feel free to use this project for personal or commercial purposes.

## Acknowledgments

- Bambu Lab for their excellent 3D printers
- OpenBambuAPI project for MQTT protocol documentation
- Three.js for 3D rendering capabilities

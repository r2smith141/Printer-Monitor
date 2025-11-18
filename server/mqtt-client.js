const mqtt = require('mqtt');
const fs = require('fs');

class BambuMQTTClient {
  constructor(printerConfig, onMessage, onStatusChange) {
    this.config = printerConfig;
    this.onMessage = onMessage;
    this.onStatusChange = onStatusChange || (() => {});
    this.client = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.messageReceived = false;
    this.messageCheckTimer = null;
  }

  connect() {
    const options = {
      clientId: `printer-monitor-${this.config.id}`,
      username: 'bblp',
      password: this.config.accessCode,
      protocol: 'mqtts',
      port: 8883,
      rejectUnauthorized: false, // Self-signed cert on printer
      reconnectPeriod: 5000,
    };

    const brokerUrl = `mqtts://${this.config.ip}:8883`;

    console.log(`Connecting to ${this.config.name} at ${this.config.ip}...`);

    this.client = mqtt.connect(brokerUrl, options);

    this.client.on('connect', () => {
      console.log(`✓ Connected to ${this.config.name}`);
      this.reconnectAttempts = 0;

      // Notify that printer is connected
      this.onStatusChange(this.config.id, 'connected');

      // Subscribe to printer reports - try multiple topic patterns
      const topics = [
        `device/${this.config.serialNumber}/report`,  // Standard report topic
        `device/${this.config.serialNumber}/#`,       // All subtopics for this device
        `device/#`,                                     // All device topics (debug)
        `#`                                             // EVERYTHING (debug)
      ];

      console.log(`Subscribing ${this.config.name} to topics:`);
      topics.forEach(t => console.log(`  - ${t}`));

      this.client.subscribe(topics, { qos: 0 }, (err) => {
        if (err) {
          console.error(`Failed to subscribe to ${this.config.name}:`, err);
        } else {
          console.log(`✓ Subscribed to ${this.config.name} successfully`);

          // Request full status
          this.requestStatus();

          // Set a timer to check if we receive any messages
          this.messageCheckTimer = setTimeout(() => {
            if (!this.messageReceived) {
              console.log(`⚠️  WARNING: ${this.config.name} - No messages received after 15 seconds`);
              console.log(`   This likely means:`);
              console.log(`   1. Serial number mismatch (check printer's actual serial)`);
              console.log(`   2. Printer not configured to send MQTT updates`);
              console.log(`   3. Different topic structure than expected`);
            }
          }, 15000);
        }
      });
    });

    this.client.on('message', (topic, message) => {
      // Mark that we've received at least one message
      if (!this.messageReceived) {
        this.messageReceived = true;
        console.log(`✓ First message received from ${this.config.name}!`);
        if (this.messageCheckTimer) {
          clearTimeout(this.messageCheckTimer);
          this.messageCheckTimer = null;
        }
      }

      console.log(`\n📨 Message received from ${this.config.name} on topic: ${topic}`);
      console.log(`   Message length: ${message.length} bytes`);

      try {
        const data = JSON.parse(message.toString());

        // Debug: Log received data structure
        console.log(`=== Parsed Message from ${this.config.name} ===`);
        console.log('Topic:', topic);
        console.log('Data keys:', Object.keys(data));
        if (data.print) {
          console.log('Print data keys:', Object.keys(data.print));
          console.log('Print state:', data.print.gcode_state);
          console.log('Progress:', data.print.mc_percent);
          console.log('File:', data.print.gcode_file);
        }
        console.log('=================\n');

        this.onMessage(this.config.id, data);
      } catch (err) {
        console.error(`❌ Error parsing message from ${this.config.name}:`, err);
        console.error('Raw message (first 200 chars):', message.toString().substring(0, 200));
      }
    });

    this.client.on('error', (err) => {
      console.error(`MQTT Error for ${this.config.name}:`, err.message);
    });

    this.client.on('offline', () => {
      console.log(`${this.config.name} went offline`);
      this.onStatusChange(this.config.id, 'disconnected');
    });

    this.client.on('reconnect', () => {
      this.reconnectAttempts++;
      if (this.reconnectAttempts <= this.maxReconnectAttempts) {
        console.log(`Reconnecting to ${this.config.name} (attempt ${this.reconnectAttempts})...`);
      }
    });
  }

  requestStatus() {
    if (!this.client || !this.client.connected) {
      console.log(`Cannot request status for ${this.config.name} - not connected`);
      return;
    }

    const requestTopic = `device/${this.config.serialNumber}/request`;
    // Simplified payload format - try minimal version first
    const payload = {
      pushing: {
        sequence_id: '0',
        command: 'pushall'
      }
    };

    console.log(`>>> Requesting status from ${this.config.name}`);
    console.log(`    Serial Number: ${this.config.serialNumber}`);
    console.log(`    Topic: ${requestTopic}`);
    console.log(`    Payload:`, JSON.stringify(payload));

    this.client.publish(requestTopic, JSON.stringify(payload), { qos: 0 }, (err) => {
      if (err) {
        console.error(`Failed to publish status request to ${this.config.name}:`, err);
      } else {
        console.log(`    ✓ Status request sent to ${this.config.name}`);
      }
    });
  }

  disconnect() {
    if (this.messageCheckTimer) {
      clearTimeout(this.messageCheckTimer);
      this.messageCheckTimer = null;
    }
    if (this.client) {
      this.client.end();
    }
  }
}

module.exports = BambuMQTTClient;

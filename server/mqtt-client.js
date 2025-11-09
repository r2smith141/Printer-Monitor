const mqtt = require('mqtt');
const fs = require('fs');

class BambuMQTTClient {
  constructor(printerConfig, onMessage) {
    this.config = printerConfig;
    this.onMessage = onMessage;
    this.client = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
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

      // Subscribe to printer reports
      const reportTopic = `device/${this.config.serialNumber}/report`;
      this.client.subscribe(reportTopic, (err) => {
        if (err) {
          console.error(`Failed to subscribe to ${this.config.name}:`, err);
        } else {
          console.log(`Subscribed to ${this.config.name} reports`);
          // Request full status
          this.requestStatus();
        }
      });
    });

    this.client.on('message', (topic, message) => {
      try {
        const data = JSON.parse(message.toString());
        this.onMessage(this.config.id, data);
      } catch (err) {
        console.error(`Error parsing message from ${this.config.name}:`, err);
      }
    });

    this.client.on('error', (err) => {
      console.error(`MQTT Error for ${this.config.name}:`, err.message);
    });

    this.client.on('offline', () => {
      console.log(`${this.config.name} went offline`);
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
      return;
    }

    const requestTopic = `device/${this.config.serialNumber}/request`;
    const payload = {
      pushing: {
        sequence_id: '0',
        command: 'pushall',
        version: 1,
        push_target: 1
      }
    };

    this.client.publish(requestTopic, JSON.stringify(payload));
  }

  disconnect() {
    if (this.client) {
      this.client.end();
    }
  }
}

module.exports = BambuMQTTClient;

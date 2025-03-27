/**
 * ArusdataJS Client Library
 * Versi: 0.1.0
 */
class ArusdataClient {
  constructor(options = {}) {
    this.options = {
      endpoint: options.endpoint || 'ws://localhost:8080/arusdata',
      reconnectInterval: options.reconnectInterval || 3000,
      autoReconnect: options.autoReconnect !== false,
      ...options
    };

    this.socket = null;
    this.channels = {};
    this.connected = false;
    this.reconnectTimer = null;
    this.socketId = null;
    this.connectionCallbacks = [];
    this.disconnectionCallbacks = [];

    if (options.autoConnect !== false) {
      this.connect();
    }
  }

  connect() {
    try {
      this.socket = new WebSocket(this.options.endpoint);

      this.socket.onopen = () => {
        console.log('[ArusdataJS] Koneksi terbuka');
      };

      this.socket.onclose = () => {
        this.connected = false;
        console.log('[ArusdataJS] Koneksi tertutup');

        this._triggerCallbacks(this.disconnectionCallbacks);

        // Reconnect jika diperlukan
        if (this.options.autoReconnect) {
          this.reconnectTimer = setTimeout(() => {
            this.connect();
          }, this.options.reconnectInterval);
        }
      };

      this.socket.onerror = (error) => {
        console.error('[ArusdataJS] Error', error);
      };

      this.socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          // Handle connection established
          if (message.event === 'connection_established') {
            this.connected = true;
            this.socketId = message.data.socket_id;

            // Subscribe ulang ke semua channel
            Object.keys(this.channels).forEach(channelName => {
              this._sendSubscription(channelName);
            });

            this._triggerCallbacks(this.connectionCallbacks, this.socketId);
          }

          // Handle channel events
          else if (message.channel) {
            const channel = this.channels[message.channel];

            if (channel) {
              if (message.event === 'subscription_succeeded') {
                channel.subscribed = true;
                if (channel.subscriptionCallbacks) {
                  channel.subscriptionCallbacks.forEach(callback => callback(message.data));
                }
              } else {
                const callbacks = channel.callbacks[message.event];

                if (callbacks && callbacks.length > 0) {
                  callbacks.forEach(callback => {
                    callback(message.data);
                  });
                }
              }
            }
          }
        } catch (e) {
          console.error('[ArusdataJS] Error parsing message', e);
        }
      };
    } catch (error) {
      console.error('[ArusdataJS] Connection error', error);

      // Reconnect jika diperlukan
      if (this.options.autoReconnect) {
        this.reconnectTimer = setTimeout(() => {
          this.connect();
        }, this.options.reconnectInterval);
      }
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.close();
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.connected = false;
  }

  subscribe(channelName) {
    if (!this.channels[channelName]) {
      this.channels[channelName] = {
        name: channelName,
        subscribed: false,
        callbacks: {},
        subscriptionCallbacks: []
      };

      if (this.connected) {
        this._sendSubscription(channelName);
      }
    }

    const channel = {
      bind: (eventName, callback) => {
        if (!this.channels[channelName].callbacks[eventName]) {
          this.channels[channelName].callbacks[eventName] = [];
        }

        this.channels[channelName].callbacks[eventName].push(callback);
        return channel;
      },

      unbind: (eventName, callback) => {
        if (this.channels[channelName].callbacks[eventName]) {
          this.channels[channelName].callbacks[eventName] =
            this.channels[channelName].callbacks[eventName].filter(cb => cb !== callback);
        }
        return channel;
      },

      trigger: (eventName, data) => {
        this._publishEvent(channelName, eventName, data);
        return channel;
      },

      onSubscription: (callback) => {
        this.channels[channelName].subscriptionCallbacks.push(callback);
        return channel;
      }
    };

    return channel;
  }

  unsubscribe(channelName) {
    if (this.channels[channelName]) {
      if (this.connected) {
        this._sendUnsubscription(channelName);
      }

      delete this.channels[channelName];
    }
  }

  publish(channelName, eventName, data) {
    return this._publishEvent(channelName, eventName, data);
  }

  _publishEvent(channelName, eventName, data) {
    if (!this.connected) {
      console.error('[ArusdataJS] Cannot publish: not connected');
      return false;
    }

    if (!this.channels[channelName] || !this.channels[channelName].subscribed) {
      console.error('[ArusdataJS] Cannot publish: not subscribed to channel', channelName);
      return false;
    }

    const message = {
      type: 'publish',
      channel: channelName,
      event: eventName,
      data: data
    };

    this.socket.send(JSON.stringify(message));
    return true;
  }

  _sendSubscription(channelName) {
    const message = {
      type: 'subscribe',
      channel: channelName
    };

    // Add auth token if private channel
    if (channelName.startsWith('private-') && this.channels[channelName].auth) {
      message.auth = this.channels[channelName].auth;
    }

    this.socket.send(JSON.stringify(message));
  }

  _sendUnsubscription(channelName) {
    this.socket.send(JSON.stringify({
      type: 'unsubscribe',
      channel: channelName
    }));
  }

  _triggerCallbacks(callbacks, ...args) {
    if (callbacks && callbacks.length > 0) {
      callbacks.forEach(callback => {
        try {
          callback(...args);
        } catch (e) {
          console.error('[ArusdataJS] Error in callback', e);
        }
      });
    }
  }

  onConnection(callback) {
    this.connectionCallbacks.push(callback);

    // Trigger immediately if already connected
    if (this.connected && this.socketId) {
      callback(this.socketId);
    }

    return this;
  }

  onDisconnection(callback) {
    this.disconnectionCallbacks.push(callback);
    return this;
  }

  getSocketId() {
    return this.socketId;
  }

  isConnected() {
    return this.connected;
  }
}

// Expose to window for browser usage
if (typeof window !== 'undefined') {
  window.ArusdataClient = ArusdataClient;
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ArusdataClient;
}
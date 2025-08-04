/**
 * NETPIE Flow Channel MQTT Client Library
*/

const mqtt = require('mqtt');
const PROCESS_START_TIME = Date.now();

class FlowChannelMQTT {
    constructor(options = {}) {
        let that = this;

        this.flowchannelkey = options.flowchannelkey || ':';
        this.client = null;
        this.connected = false;
        this.subscriptions = new Map(); // Track subscriptions by topic
        this.messageCache = new Map(); // Cache recent messages to prevent duplicates
        this.eventListeners = new Map(); // Custom event listener storage

        this.mqtthost = options.mqtthost;
        let a = options.flowchannelkey.split(':');
        this.clientid = `${a[0]}-${PROCESS_START_TIME}`;    // Use consistent client ID to avoid multiple sessions
        this.username = a[0];
        this.password = a[1];
        this.debug = options.debug || false;
    }

    async connect() {
        this.log('Initialize connection...');

        if (this.client) {
            this.log('Existing connection found, disconnecting first');
            await this.disconnect();
            setTimeout(() => {
                this.createConnection();
                return this;
            }, 250);
        }
        else {
            this.createConnection();
            return this;
        }
    }

    createConnection() {
        let that = this;

        this.log(`Connecting with client ID: ${this.clientid}`);
        this.client = mqtt.connect(this.mqtthost, {
            clientId: this.clientid,
            username: this.username,
            password: this.password,
            clean: true,
            keepalive: 15,
            reconnectPeriod: 5000,
            connectTimeout: 5000,
            // queueQoSZero: false
        });

        this.client.on('connect', () => {
            this.connected = true;
            this.log('Connected to NETPIE FlowChannel Broker');
            this.emit('connect');
            this.client.subscribe('@private/#');
        });

        this.client.on('close', () => {
            this.connected = false;
            this.log('Closed from NETPIE FlowChannel Broker');
            this.emit('disconnect');
        });

        this.client.on('error', (error) => {
            this.log('MQTT Error:', error);
            this.emit('error', error);
        });

        this.client.on('message', (topic, payload) => {
            this.handleIncomingMessage(topic, payload);
        });

        // setInterval(() => {
        //     console.log(that.client.connected);
        // },1000);
    }

    disconnect() {
        return new Promise((resolve) => {
            if (this.client) {
                this.connected = false;
                this.log('Starting disconnect process...');
                this.client.removeAllListeners();

                if (this.client.connected || this.client.reconnecting) {
                    this.client.end(true, () => {
                        this.client = null;
                        this.subscriptions.clear();
                        this.messageCache.clear();
                        this.log('Disconnected and cleaned up completely');
                        resolve();
                    });
                } else {
                    this.client = null;
                    this.subscriptions.clear();
                    this.messageCache.clear();
                    this.log('Client was not connected, cleanup complete');
                    resolve();
                }
            } else {
                this.log('No client to disconnect');
                resolve();
            }
        });
    }

    async destroy() {
        this.log("Destroying MQTT connection...");
        await this.disconnect();
        this.removeAllListeners();
        this.log("MQTT connection destroyed cleanly");
    }

    handleIncomingMessage(topic, payload) {
        try {
            let data;
            // console.log('topic -->', topic)
            // console.log('payload -->', payload.toString())
            try {
                data = JSON.parse(payload.toString());
            } catch (e) {
                data = payload;
            }

            // Use high-resolution timestamp for deduplication within short time window
            const now = process.hrtime.bigint();

            // Check for duplicates within a very short time window (100ms)
            const shortTimeWindow = 100n * 1000000n;
            let isDuplicate = false;

            for (const [, info] of this.messageCache) {
                if (info.topic === topic &&
                    info.payload === JSON.stringify(data) &&
                    (now - info.timestamp) < shortTimeWindow) {
                    isDuplicate = true;
                    break;
                }
            }

            if (isDuplicate) {
                return;
            }

            const messageKey = `${topic}:${JSON.stringify(data)}:${now}`;
            const messageHash = this.hashMessage(messageKey);
            this.messageCache.set(messageHash, {
                topic: topic,
                payload: JSON.stringify(data),
                timestamp: now,
                createdAt: Date.now()
            });
            this.cleanupMessageCache();

            const deviceid = data && data.deviceid ? data.deviceid : 'unknown';

            if (topic.startsWith('@shadow/data/updated')) {
                this.emit(`shadow/data/updated:${deviceid}`, data);
                this.emit('shadow/data/updated', data);
            }
            else if (topic.startsWith('@device/status/changed')) {
                this.emit(`device/status/changed:${deviceid}`, data);
                this.emit('device/status/changed', data);
            }
            else if (topic.startsWith('@private/shadow/data/get/response')) {
                this.emit(`shadow/data/response:${deviceid}`, data);
                this.emit('shadow/data/response', data);
            }
            else if (topic.startsWith('@private/device/status/get/response')) {
                this.emit(`device/status/response:${deviceid}`, data);
                this.emit('device/status/response', data);
            }
            else if (topic.startsWith('@msg/')) {
                // Extract deviceid from topic path for message events
                // Topic format: @msg/projectid/groupid/topic...
                const topicParts = topic.split('/');
                const msgGroupId = topicParts.length > 2 ? topicParts[2] : 'unknown';

                // Remove projectid/groupid from topic - keep only @msg/topic...
                let cleanTopic = '@msg';
                if (topicParts.length > 3) {
                    cleanTopic += '/' + topicParts.slice(3).join('/');
                }

                this.emit(`message:${msgGroupId}`, { topic: cleanTopic, payload: data });
                this.emit('message', { topic: cleanTopic, payload: data });
            }
            else if (topic.startsWith('@feed/data/updated')) {
                this.emit(`feed/data/updated:${deviceid}`, data);
                this.emit('feed/data/updated', data);
            }
            else {
                this.emit('raw:message', { topic, payload: data });
            }
        } catch (error) {
            this.log('Error handling message:', error);
            this.emit('error', error);
        }
    }

    getDeviceInfo(deviceid, devicetoken) {
        const topic = `@tap/device/get/${deviceid}:${devicetoken}`;
        this.publish(topic, '');
    }

    getShadow(deviceid, devicetoken) {
        const topic = `@tap/shadow/get/${deviceid}:${devicetoken}`;
        this.publish(topic, '');
    }

    updateShadow(deviceid, devicetoken, data) {
        const topic = `@tap/shadow/update/${deviceid}:${devicetoken}`;
        const payload = typeof data === 'object' ? JSON.stringify(data) : data.toString();
        this.publish(topic, payload);
    }

    publishMessage(deviceid, devicetoken, messageTopic, data) {
        const topic = `@tap/msg/topic/${deviceid}:${devicetoken}/${messageTopic}`;
        const payload = typeof data === 'object' ? JSON.stringify(data) : data.toString();
        this.publish(topic, payload);
    }

    publishPrivate(deviceid, devicetoken, privateTopic, data) {
        const topic = `@tap/private/topic/${deviceid}:${devicetoken}/${privateTopic}`;
        const payload = typeof data === 'object' ? JSON.stringify(data) : data.toString();
        this.publish(topic, payload);
    }

    subscribeDevice(deviceid, devicetoken) {
        const topics = [
            `@tap/shadow/updated/${deviceid}:${devicetoken}`,
            `@tap/device/changed/${deviceid}:${devicetoken}`,
            `@tap/feed/updated/${deviceid}:${devicetoken}`
        ];

        topics.forEach(topic => {
            this.subscribe(topic);
        });
    }

    subscribeMessage(deviceid, devicetoken, messageTopic) {
        const topic = `@tap/msg/topic/${deviceid}:${devicetoken}/${messageTopic}`;
        this.subscribe(topic);
    }

    unsubscribeDevice(deviceid, devicetoken) {
        const topics = [
            `@tap/shadow/updated/${deviceid}:${devicetoken}`,
            `@tap/device/changed/${deviceid}:${devicetoken}`,
            `@tap/feed/updated/${deviceid}:${devicetoken}`
        ];

        topics.forEach(topic => {
            this.unsubscribe(topic);
        });
    }

    unsubscribeMessage(deviceid, devicetoken, messageTopic) {
        const topic = `@tap/msg/topic/${deviceid}:${devicetoken}/${messageTopic}`;
        this.unsubscribe(topic);
    }

    subscribe(topic) {
        if (!this.connected || !this.client) {
            return false;
        }

        if (this.subscriptions.has(topic)) {
            this.subscriptions.set(topic, this.subscriptions.get(topic) + 1);
            return true;
        }

        this.client.subscribe(topic, (err) => {
            if (err) {
                this.emit('error', err);
            } else {
                this.subscriptions.set(topic, 1);
            }
        });

        return true;
    }

    unsubscribe(topic) {
        if (!this.connected || !this.client) {
            return false;
        }

        if (!this.subscriptions.has(topic)) {
            return true;
        }

        const count = this.subscriptions.get(topic);
        if (count > 1) {
            this.subscriptions.set(topic, count - 1);
            return true;
        }

        this.client.unsubscribe(topic, (err) => {
            if (err) {
                this.emit('error', err);
            } else {
                this.subscriptions.delete(topic);
            }
        });

        return true;
    }

    publish(topic, payload) {
        if (!this.connected || !this.client) {
            return false;
        }

        this.client.publish(topic, payload, (err) => {
            if (err) {
                this.log('Publish error:', err);
                this.emit('error', err);
            }
        });

        return true;
    }

    isConnected() {
        return this.connected;
    }

    getSubscriptions() {
        return Array.from(this.subscriptions.keys());
    }

    hashMessage(messageKey) {
        let hash = 0;
        for (let i = 0; i < messageKey.length; i++) {
            const char = messageKey.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString();
    }

    cleanupMessageCache() {
        const now = Date.now();
        const maxAge = 60 * 1000;

        for (const [hash, info] of this.messageCache) {
            if (now - info.createdAt > maxAge) {
                this.messageCache.delete(hash);
            }
        }
    }

    on(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, new Set());
        }

        const listeners = this.eventListeners.get(event);

        for (const existingCallback of listeners) {
            if (existingCallback === callback) {
                this.log(`Duplicate callback function object detected for event '${event}', skipping registration`);
                return this;
            }
        }

        listeners.add(callback);
        return this;
    }

    off(event, callback) {
        if (!this.eventListeners.has(event)) {
            return this;
        }

        const listeners = this.eventListeners.get(event);
        listeners.delete(callback);

        if (listeners.size === 0) {
            this.eventListeners.delete(event);
        }

        this.log(`Removed callback for event '${event}'`);
        return this;
    }

    once(event, callback) {
        const onceWrapper = (...args) => {
            callback(...args);
            this.off(event, onceWrapper);
        };
        return this.on(event, onceWrapper);
    }

    emit(event, ...args) {
        if (!this.eventListeners.has(event)) {
            return false;
        }

        const listeners = this.eventListeners.get(event);
        let eventHandled = false;

        for (const callback of listeners) {
            try {
                callback(...args);
                eventHandled = true;
            } catch (error) {
                this.log(`Error in event listener for '${event}':`, error);
            }
        }

        return eventHandled;
    }

    removeAllListeners(event) {
        if (event) {
            this.eventListeners.delete(event);
            this.log(`Removed all listeners for event '${event}'`);
        } else {
            this.eventListeners.clear();
            this.log('Removed all event listeners');
        }
        return this;
    }

    eventNames() {
        return Array.from(this.eventListeners.keys());
    }

    listenerCount(event) {
        if (!this.eventListeners.has(event)) {
            return 0;
        }
        return this.eventListeners.get(event).size;
    }

    log(...args) {
        if (this.debug) {
            console.log('[FlowChannelMQTT]', ...args);
        }
    }
}

function create(options = {}) {
    return new FlowChannelMQTT(options);
}

module.exports = {
    FlowChannelMQTT,
    create
};

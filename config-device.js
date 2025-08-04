module.exports = function(RED) {
    const CONFIG = require('./config');

    function deviceconfig(n){
        let that = this;

        RED.nodes.createNode(this, n);
        this.deviceid = n.deviceid;
        this.devicetoken = n.devicetoken;

        // Get reference to flowchannel node
        this.flowchannel  = RED.nodes.getNode(n.flowchannel);

        if (this.flowchannel) {
            this.flowchannelmqtt = this.flowchannel.flowchannelmqtt;

            this.flowchannel.on('connect', function() {
                that.subscribeDevice();
            });
        }

        // Create wrapper functions that inject deviceid and devicetoken
        this.getDeviceInfo = () => {
            if (that.flowchannelmqtt) {
                return that.flowchannelmqtt.getDeviceInfo(that.deviceid, that.devicetoken);
            }
            throw new Error('FlowChannel MQTT client not available');
        };

        this.getShadow = () => {
            if (that.flowchannelmqtt) {
                return that.flowchannelmqtt.getShadow(that.deviceid, that.devicetoken);
            }
            throw new Error('FlowChannel MQTT client not available');
        };

        this.updateShadow = (data) => {
            if (that.flowchannelmqtt) {
                return that.flowchannelmqtt.updateShadow(that.deviceid, that.devicetoken, data);
            }
            throw new Error('FlowChannel MQTT client not available');
        };

        this.publishMessage = (topic, data) => {
            if (that.flowchannelmqtt) {
                return that.flowchannelmqtt.publishMessage(that.deviceid, that.devicetoken, topic, data);
            }
            throw new Error('FlowChannel MQTT client not available');
        };

        this.publishPrivate = (topic, data) => {
            if (that.flowchannelmqtt) {
                return that.flowchannelmqtt.publishPrivate(that.deviceid, that.devicetoken, topic, data);
            }
            throw new Error('FlowChannel MQTT client not available');
        };

        this.subscribeDevice = () => {
            if (that.flowchannelmqtt) {
                return that.flowchannelmqtt.subscribeDevice(that.deviceid, that.devicetoken);
            }
            // throw new Error('FlowChannel MQTT client not available');
        };

        this.unsubscribeDevice = () => {
            if (that.flowchannelmqtt) {
                return that.flowchannelmqtt.unsubscribeDevice(that.deviceid, that.devicetoken);
            }
            throw new Error('FlowChannel MQTT client not available');
        };

        this.subscribeMessage = (topic) => {
            if (that.flowchannelmqtt) {
                return that.flowchannelmqtt.subscribeMessage(that.deviceid, that.devicetoken, topic);
            }
            throw new Error('FlowChannel MQTT client not available');
        };

        this.unsubscribeMessage = (topic) => {
            if (that.flowchannelmqtt) {
                return that.flowchannelmqtt.unsubscribeMessage(that.deviceid, that.devicetoken, topic);
            }
            throw new Error('FlowChannel MQTT client not available');
        };

        // Event handling wrapper
        this.on = (event, handler) => {
            if (that.flowchannelmqtt) {
                return that.flowchannelmqtt.on(event, handler);
            }
            // throw new Error('FlowChannel MQTT client not available');
        };

        this.isConnected = () => {
            if (that.flowchannelmqtt) {
                return that.flowchannelmqtt.isConnected();
            }
            return false;
        };

        // Get the underlying MQTT client (for direct access if needed)
        this.getMQTTClient = () => {
            if (that.flowchannelmqtt) {
                return that.flowchannelmqtt;
            }
            return null;
        };
    }

    RED.nodes.registerType("deviceconfig", deviceconfig);
}

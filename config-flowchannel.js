module.exports = function(RED) {
    const CONFIG = require('./config');
    const FlowChannelMQTT = require('./flowchannelmqtt').create;
    function flowchannel(n){
        let that = this;

        RED.nodes.createNode(this, n);

        this.mqtthost = CONFIG.NETPIE.mqtthost;
        this.apihost = CONFIG.NETPIE.apihost;
        this.dshost = CONFIG.NETPIE.dshost;

        this.flowchannelkey = n.flowchannelkey;

        if (this.flowchannelkey) {
            const initConnection = async () => {
                if (that.flowchannelmqtt) {
                    await that.flowchannelmqtt.destroy();
                }
                that.flowchannelmqtt = new FlowChannelMQTT({
                    flowchannelkey: that.flowchannelkey,
                    mqtthost: this.mqtthost,
                    debug: true // Enable debug logging
                });
                await that.flowchannelmqtt.connect();
            };

            initConnection().catch(err => {
                console.error('FlowChannel connection error:', err);
            });
        }

        this.on = function(event, handler) {
            return that.flowchannelmqtt.on(event, handler);
        };

        this.once = function(event, handler) {
            return that.flowchannelmqtt.once(event, handler);
        };

        this.off = function(event, handler) {
            return that.flowchannelmqtt.off(event, handler);
        };

        this.emit = function(event, ...args) {
            return that.flowchannelmqtt.emit(event, ...args);
        };


        this.on('disconnect', async function(a,b,c) {
           that.log('Disconnect Flowchannel ...');
            if (that.flowchannelmqtt) {
                await that.flowchannelmqtt.destroy();
                that.flowchannelmqtt = null;
            }
        });
    }
    RED.nodes.registerType("flowchannel", flowchannel);
}

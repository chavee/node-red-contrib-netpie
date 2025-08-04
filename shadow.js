module.exports = function(RED) {
    const axios = require('axios');
    const CONFIG = require('./config');
    const merge = require('deepmerge');

    function Shadow(config) {
        RED.nodes.createNode(this, config);
        let node = this;
        let current = {};
        let last_local_get_request = 0;

        let deviceConfigNode = RED.nodes.getNode(config.deviceconfig);
        let flowchannelmqtt = deviceConfigNode.flowchannelmqtt;

        let eventlist = {};
        function addListener(obj, event, callback) {
            if (eventlist[event]) return;
            eventlist[event] = 1;
            obj.on(event, callback)
        }

        if (!deviceConfigNode) {
            node.error("Device configuration node not found.");
            return;
        }

        config.deviceid = deviceConfigNode.deviceid;
        config.devicetoken = deviceConfigNode.devicetoken;

        if (!config.deviceid || !config.devicetoken) {
            node.error("deviceid and devicetoken are required.");
            return;
        }

        config.api_endpoint = CONFIG.NETPIE.apihost;
        current.tosub_shadow = config.subshadow;

        function updateNodeStatus(current) {
            let color, shape, text;

            if (current.clientstatus) {
                shape = 'dot';

                if (current.connection) {
                    color = 'green';
                }
                else {
                    color = 'grey';
                }

                if (!current.tosub_shadow) {
                    text = 'connected';
                }
                else if (config.labelmode == 'all') {
                    if (current.deviceshadow) {
                        text = JSON.stringify(current.deviceshadow.data);
                    }
                    else {
                        text = 'connected';
                    }
                }
                else if (config.labelmode == 'updated') {
                    if (current.deviceshadowupdated) {
                        text = JSON.stringify(current.deviceshadowupdated.data);
                    }
                    else {
                        text = 'connected';
                    }
                }
                else if (!current.tosub_device) {
                    text = 'connected';
                }
                else {
                    text = 'synchronized';
                }
            }
            else {
                color = 'grey';
                text = '';
                shape = 'ring';
            }
            node.status({fill: color, shape: shape, text: text})
        }

        if (config.active) {
            node.status({});

            const mqttClient = deviceConfigNode.getMQTTClient();
            if (mqttClient) {
                addListener(deviceConfigNode, `connect`, function () {
                    node.log('shadow connected');
                    deviceConfigNode.subscribeDevice();
                    setTimeout(() => {
                        deviceConfigNode.getShadow();
                    }, 500);

                    current.clientstatus = 1;
                    current.connection = 1;
                    updateNodeStatus(current);
                });

                mqttClient.on('disconnect', function() {
                    current.clientstatus = 0;
                    node.log('shadow disconnected');

                    current.connection = 0;
                    updateNodeStatus(current);
                });

                addListener(deviceConfigNode, `shadow/data/response:${config.deviceid}`, function(shadowdata) {
                    if (Date.now() - last_local_get_request < 5000) {
                        last_local_get_request = 0;

                        let msg = {
                            topic: `@shadow/data/response`
                        };

                        current.deviceshadowupdated = shadowdata;
                        current.deviceshadow = merge(current.deviceshadow, shadowdata);
                        updateNodeStatus(current);

                        if (config.outputmode == 'updated') {
                            msg.topic = '@shadow/data/updated'
                            msg.payload = shadowdata;
                        }
                        else if (config.outputmode == 'all') {
                            msg.topic = '@shadow/data/updated'
                            msg.payload = shadowdata;
                        }
                        node.send(msg);
                    }
                });

                addListener(deviceConfigNode, `shadow/data/updated:${config.deviceid}`, function(shadowdata) {
                    if (config.subshadow) {
                        let msg = {
                            topic: '@shadow/data/updated',
                            payload: shadowdata
                        };
                        node.send([msg, null]);

                        current.deviceshadowupdated = shadowdata;
                        // current.deviceshadow = { ...current.deviceshadow, ...shadowdata };
                        current.deviceshadow = merge(current.deviceshadow, shadowdata);

                        merge(current.deviceshadow, shadowdata);
                        updateNodeStatus(current);
                    }
                });


                deviceConfigNode.on('error', function(error) {
                    node.error(error);
                });
            }
        }
        else {
            node.status({fill: null, shape: null, text: ''});
        }

        node.on('close', function(done) {
            console.log('shadow ' + config.name + ' closed..');

            if (deviceConfigNode && deviceConfigNode.isConnected()) {
                deviceConfigNode.unsubscribeDevice();
            }

            setTimeout(() => {
                done();
            }, 800);
        });

        node.on('input', function(msg) {
            if (config.active) {
                if (deviceConfigNode && deviceConfigNode.isConnected()) {  // if mqtt
                    // if button pressed
                    if (!msg.hasOwnProperty('topic') && !msg.hasOwnProperty('payload')) {
                        last_local_get_request = Date.now();
                        deviceConfigNode.getShadow();
                        return;
                    }
                    if (msg.topic) {
                        if (msg.topic == '@shadow/data/get') {
                            last_local_get_request = Date.now();
                            deviceConfigNode.getShadow();
                        }
                        else if (msg.topic == '@shadow/data/update') {
                            deviceConfigNode.updateShadow(msg.payload);
                        }
                    }
                }
                else {
                    // REST API fallback
                    if (msg.topic == '@shadow/data/update') {
                        axios({
                            method: 'put',
                            url: `${config.api_endpoint}/device/shadow/data`,
                            data: msg.payload,
                            responseType: 'json',
                            headers: {'Authorization': `Device ${config.deviceid}:${config.devicetoken}`}
                        }).then((response) => { });
                    }

                    if (msg.topic == '@shadow/data/get' || (!msg.hasOwnProperty('topic') && !msg.hasOwnProperty('payload')) ) {
                        axios({
                            method: 'get',
                            url: `${config.api_endpoint}/device/shadow/data`,
                            responseType: 'json',
                            headers: {'Authorization': `Device ${config.deviceid}:${config.devicetoken}`}
                        }).then((response) => {
                            msg.topic = '@device/shadow/get';
                            msg.payload = {
                                deviceid: response.data.deviceid,
                                data: response.data.data,
                                rev: response.data.rev,
                                timestamp: response.data.timestamp,
                                modified: response.data.modified,
                            }
                            node.send([msg, null]);
                        });
                    }


                }
            }
        });
    }

    RED.nodes.registerType("shadow", Shadow);
};

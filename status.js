module.exports = function(RED) {
    const axios = require('axios');
    const CONFIG = require('./config');

    function DeviceStatus(config) {
        RED.nodes.createNode(this, config);
        let node = this;
        let current = {};
        let last_local_get_request = 0;

        let eventlist = {};
        function addListener(obj, event, callback) {
            if (eventlist[event]) return;
            eventlist[event] = 1;
            obj.on(event, callback)
        }

        const deviceConfigNode = RED.nodes.getNode(config.deviceconfig);
        if (!deviceConfigNode) {
            node.error("Device configuration node not found.");
            return;
        }

        config.deviceid = deviceConfigNode.deviceid;
        config.devicetoken = deviceConfigNode.devicetoken;
        config.api_endpoint = CONFIG.NETPIE.apihost;

        if (!config.deviceid || !config.devicetoken) {
            node.error("deviceid and devicetoken are required.");
            return;
        }

        const useFlowChannel = deviceConfigNode.flowchannelmqtt;
        function updateNodeStatus(current) {
            let color, shape, text;

            if (current.clientstatus) {
                shape = 'dot';
                color = 'green';
                text = 'online';
            }
            else {
                color = 'grey';
                text = 'offline';
                shape = 'ring';
            }

            if (useFlowChannel) {
                node.status({fill: color, shape: shape, text: text});
            }
            else {
                node.status({fill: null, shape: null, text: ''});
            }
        }

        if (config.active && useFlowChannel) {
            node.status({});

            function initializeMessage() {
                node.log('message connected');
                current.clientstatus = 1;
                deviceConfigNode.getDeviceInfo();
                updateNodeStatus(current);
            }

            if (deviceConfigNode.isConnected()) {
                initializeMessage();
            } else {
                addListener(deviceConfigNode, `connect`, initializeMessage);
            }

            addListener(deviceConfigNode, `disconnect`, function() {
                current.clientstatus = 0;
                node.log('message disconnected');
                updateNodeStatus(current);
            });

            addListener(deviceConfigNode, `device/status/changed:${config.deviceid}`, function(payload) {
                if (payload) {
                    current.clientstatus = payload.status;
                    updateNodeStatus(current);

                    let msg = {
                        topic: '@device/status/changed',
                        payload : {
                            deviceid : payload.deviceid,
                            groupid : payload.groupid,
                            projectid : payload.projectid,
                            status : payload.status,
                            enabled : payload.enabled
                        }
                    }
                    node.send(msg);
                }
            });

            addListener(deviceConfigNode, `device/status/response:${config.deviceid}`, function(payload) {
                if (payload) {
                    if (Date.now() - last_local_get_request < 5000) {
                        last_local_get_request = 0;
                        current.clientstatus = payload.status;
                        updateNodeStatus(current);
                        let msg = {
                            topic: '@device/status/response',
                            payload : {
                                deviceid : payload.deviceid,
                                groupid : payload.groupid,
                                projectid : payload.projectid,
                                status : payload.status,
                                enabled : payload.enabled
                            }
                        }
                        node.send(msg);
                    }
                }
            });

            addListener(deviceConfigNode, `error`, function(error) {
                node.error(error);
            });
        }
        else {
            updateNodeStatus(current);
        }

        node.on('close', function(done) {
            node.log('message ' + config.name + ' closed..');
            current.clientstatus = 0;
            updateNodeStatus(current);

            if (useFlowChannel && node.groupid && node.projectid) {
                for (let i in topiclist) {
                    if (topiclist[i] != undefined) {
                        topiclist[i] = topiclist[i].trim();
                        if (topiclist[i] != '' && topiclist[i].startsWith('@msg')) {
                            let subtopic = topiclist[i].substr(5);
                            deviceConfigNode.unsubscribeMessage(subtopic);
                        }
                    }
                }
            }

            setTimeout(() => {
                done();
            }, 800);
        });

        node.on('input', function(msg) {
            if (config.active) {
                if (useFlowChannel && deviceConfigNode && deviceConfigNode.isConnected()) {
                    // if button pressed
                    if (!msg.hasOwnProperty('topic') && !msg.hasOwnProperty('payload')) {
                        last_local_get_request = Date.now();
                        deviceConfigNode.getDeviceInfo('@device/status/get');
                        return;
                    }

                    if (msg.topic) {
                        last_local_get_request = Date.now();
                        if (msg.topic.startsWith('@device/status/get')) {
                            deviceConfigNode.getDeviceInfo('@device/status/get');
                        }
                    }
                }
                else {
                    // REST API fallback
                    if ((!msg.hasOwnProperty('topic') && !msg.hasOwnProperty('payload'))  || msg.topic.startsWith('@device/status/get')  ) {
                        axios({
                            method: 'get',
                            url: `${config.api_endpoint}/device/status`,
                            responseType: 'json',
                            headers: {'Authorization': `Device ${config.deviceid}:${config.devicetoken}`}
                        }).then((response) => {
                            msg.topic = '@device/shadow/get';
                            msg.payload = {
                                deviceid : response.data.deviceid,
                                groupid : response.data.groupid,
                                projectid : response.data.projectid,
                                status : response.data.status,
                                enabled : response.data.enabled
                            }
                            node.send(msg);
                        });
                    }
                }
            }
        });
    }
    RED.nodes.registerType("devicestatus", DeviceStatus);
};

module.exports = function(RED) {
    const axios = require('axios');
    const CONFIG = require('./config');

    function Message(config) {
        RED.nodes.createNode(this, config);
        let node = this;
        let current = {};
        let getcounter = {};
        let topiclist = config.topics.trim().split('\n');
        
        // Store output type setting
        node.outputType = config.outputType || "String";

        let eventlist = {};
        function addListener(obj, event, callback) {
            if (eventlist[event]) return;
            eventlist[event] = 1;
            obj.on(event, callback)
        }

        // Get device config node
        const deviceConfigNode = RED.nodes.getNode(config.deviceconfig);
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

        // Check if we should use MQTT via flowchannel
        const useFlowChannel = deviceConfigNode.flowchannelmqtt;

        function updateNodeStatus(current) {
            let color, shape, text;

            if (current.clientstatus) {
                shape = 'dot';
                color = 'green';
                text = 'listening';
            }
            else {
                color = 'grey';
                text = '';
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
                current.clientstatus = 1;
                getcounter = {
                    device: 0
                }
                node.log('message connected');
                deviceConfigNode.getDeviceInfo();
                getcounter.device++;

                updateNodeStatus(current);
            }

            if (deviceConfigNode.isConnected()) {
                initializeMessage();
            } else {
                addListener(deviceConfigNode, 'connect', initializeMessage);
            }

            addListener(deviceConfigNode, `disconnect`, function() {
                current.clientstatus = 0;
                node.log('message disconnected');
                updateNodeStatus(current);
            });

            addListener(deviceConfigNode, `device/status/response:${config.deviceid}`, function(payload) {
                if (payload) {
                    node.groupid = payload.groupid || null;
                    node.projectid = payload.projectid || null;

                    if (node.groupid && node.projectid) {
                        subscribeToTopics();
                    }

                    addListener(deviceConfigNode, `message:${node.groupid}`, function(packet) {
                        if (packet && packet.topic) {
                            handleIncomingMessage(packet);
                        }
                    });
                }
            });

            function subscribeToTopics() {
                for (let i in topiclist) {
                    if (topiclist[i] != undefined) {
                        topiclist[i] = topiclist[i].trim();
                        if (topiclist[i] != '') {
                            let subtopic;
                            if (topiclist[i].startsWith('@msg')) {
                                subtopic = topiclist[i].substr(5); // Remove @msg/ prefix
                                deviceConfigNode.subscribeMessage(subtopic);
                            }
                        }
                    }
                }
            }

            function handleIncomingMessage(data) {
                function isMatched(filter, topic) {
                    const filterArray = filter.split('/');
                    const length = filterArray.length;
                    const topicArray = topic.split('/');

                    for (var i = 0; i < length; ++i) {
                        var left = filterArray[i];
                        var right = topicArray[i];
                        if (left === '#') return topicArray.length >= length - 1;
                        if (left !== '+' && left !== right) return false;
                    }
                    return length === topicArray.length;
                }

                let cleanTopic = data.topic;

                // Match against subscribed topics
                for (let i = 0; i < topiclist.length; i++) {
                    if (isMatched(topiclist[i], cleanTopic)) {
                        let payload = data.payload;
                        
                        // Convert payload based on outputType setting
                        if (node.outputType === "Buffer") {
                            if (typeof payload === 'string') {
                                payload = Buffer.from(payload, 'utf8');
                            } else if (Buffer.isBuffer(payload)) {
                                // Already a buffer, keep as is
                                payload = payload;
                            } else if (typeof payload === 'object') {
                                payload = Buffer.from(JSON.stringify(payload), 'utf8');
                            } else {
                                payload = Buffer.from(String(payload), 'utf8');
                            }
                        } else if (node.outputType === "JSON") {
                            // Try to parse as JSON, return null if parsing fails
                            try {
                                if (Buffer.isBuffer(payload)) {
                                    payload = JSON.parse(payload.toString('utf8'));
                                } else if (typeof payload === 'string') {
                                    payload = JSON.parse(payload);
                                } else if (typeof payload === 'object') {
                                    // Already an object, keep as is
                                    payload = payload;
                                } else {
                                    payload = JSON.parse(String(payload));
                                }
                            } catch (e) {
                                payload = null;
                            }
                        } else {
                            // Default to String - convert everything to string
                            if (Buffer.isBuffer(payload)) {
                                payload = payload.toString('utf8');
                            } else if (typeof payload === 'object') {
                                payload = JSON.stringify(payload);
                            } else {
                                payload = String(payload);
                            }
                        }

                        let msg = {
                            topic: cleanTopic,
                            payload: payload
                        };
                        node.send(msg);
                        break;
                    }
                }
            }

            addListener(deviceConfigNode, `error`, function(error) {
                node.error(error);
            });
        }
        else {
            updateNodeStatus(current);
        }

        node.on('close', function(done) {
            console.log('message ' + config.name + ' closed..');

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
                if (useFlowChannel && deviceConfigNode && deviceConfigNode.isConnected()) {  // if mqtt via flowchannel
                    if (msg.topic) {
                        if (msg.topic.startsWith('@msg/')) {
                            let messageTopic = msg.topic.substr(5);
                            deviceConfigNode.publishMessage(messageTopic, msg.payload);
                        }
                        else if (msg.topic.startsWith('@private/')) {
                            let privateTopic = msg.topic.substr(9);
                            deviceConfigNode.publishPrivate(privateTopic, msg.payload);
                        }
                    }
                }
                else {
                    // REST API fallback
                    if (msg.topic.startsWith('@msg/')) {
                        let part = msg.topic.split('/').splice(1).join('/');
                        axios({
                            method: 'put',
                            url: `${config.api_endpoint}/device/message?topic=${part}`,
                            responseType: 'json',
                            data: msg.payload,
                            headers: {'Authorization': `Device ${config.deviceid}:${config.devicetoken}`}
                        }).then((response) => { });
                    }
                    else if (msg.topic.startsWith('@private/')) {
                        let part = msg.topic.split('/').splice(1).join('/');
                        axios({
                            method: 'put',
                            url: `${config.api_endpoint}/device/private?topic=${part}`,
                            data: msg.payload,
                            responseType: 'json',
                            headers: {'Authorization': `Device ${config.deviceid}:${config.devicetoken}`}
                        }).then((response) => { });
                    }
                }
            }
        });
    }

    RED.nodes.registerType("message", Message);
};

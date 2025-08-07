require('dotenv').config();

module.exports = function(RED) {
	const MQTT = require("mqtt");
    const URL = require('url');
    const CONFIG = require('./config');
    const jsonic = require('jsonic');

    function Device(n) {
        RED.nodes.createNode(this,n);
        var node = this;

        delete node.mqttclient;
        let remote_mqtt_endpoint = null;
        node.outputType = n.outputType || "String";

        const deviceConfigNode = RED.nodes.getNode(n.deviceconfig);
        if (!deviceConfigNode) {
            node.error(`Device config node not found: ${n.deviceconfig}`);
            return;
        }

        n.deviceid = deviceConfigNode.deviceid;
        n.devicetoken = deviceConfigNode.devicetoken;

        if (!n.deviceid || !n.devicetoken) {
            node.error("deviceid and devicetoken are required.");
            return;
        }

        n.mqtthost = CONFIG.NETPIE.mqtthost;

        let url = URL.parse(n.mqtthost);

        if ((url.protocol=='fwag:' || url.protocol=='fwags:') && url.hostname ) {
            remote_mqtt_endpoint = (url.protocol=='fwags:'?'mqtts://':'mqtt://') + url.hostname + ':' + (url.port?url.port: (url.protocol=='fwags:'?8883:1883));
        }
        else if ((url.protocol=='mqtt:' || url.protocol=='mqtts:') && url.hostname ) {
            remote_mqtt_endpoint = url.protocol + '//' + url.hostname + ':' + (url.port?url.port: (url.protocol=='mqtts:'?8883:1883));
        }

        if (n.active && remote_mqtt_endpoint) {
            node.mqttclient = MQTT.connect(remote_mqtt_endpoint , {
                clientId    : n.deviceid,
                username : n.devicetoken,
                password  : n.devicesecret || ''
            });

            node.mqttclient.on('connect', function() {
                try {
                    node.log('device connected');

                    if (n.subshadow) {
                        if (node.mqttclient) node.mqttclient.subscribe('@shadow/data/updated');
                    }
                    if (n.subprivate) {
                        if (node.mqttclient) node.mqttclient.subscribe('@private/#');
                    }

                    var tarr = n.topics.split(/[,\n]/);
                    for (var i=0; i<tarr.length; i++) {
                        tarr[i] = tarr[i].trim();
                        if (tarr[i]) {
                            node.log('subscribe to topic: ' + tarr[i]);
                            if (node.mqttclient) {
                                node.mqttclient.subscribe(tarr[i]);
                            }
                        }
                    }

                    if (n.initshadow) {
                        setTimeout(()=>{
                            try {
                                if (node.mqttclient) node.mqttclient.publish('@shadow/data/get');
                            }
                            catch(e) {
                            }
                        },500);
                    }
                }
                catch(e) {
                }
                node.status({fill: 'green', shape: 'dot', text: 'connected'});
            });

            node.mqttclient.on('message', function(topic,payload) {
                let payloaddata;

                try {
                    payloaddata = jsonic(payload.toString());
                }
                catch(e) {
                    payloaddata = payload.toString();
                }

                // Apply output type conversion for @msg topics only
                if (topic.startsWith('@msg/')) {
                    if (node.outputType === "Buffer") {
                        if (typeof payloaddata === 'string') {
                            payloaddata = Buffer.from(payloaddata, 'utf8');
                        } else if (Buffer.isBuffer(payloaddata)) {
                            // Already a buffer, keep as is
                            payloaddata = payloaddata;
                        } else if (typeof payloaddata === 'object') {
                            payloaddata = Buffer.from(JSON.stringify(payloaddata), 'utf8');
                        } else {
                            payloaddata = Buffer.from(String(payloaddata), 'utf8');
                        }
                    } else if (node.outputType === "JSON") {
                        // Try to parse as JSON, return null if parsing fails
                        try {
                            if (Buffer.isBuffer(payloaddata)) {
                                payloaddata = JSON.parse(payloaddata.toString('utf8'));
                            } else if (typeof payloaddata === 'string') {
                                payloaddata = JSON.parse(payloaddata);
                            } else if (typeof payloaddata === 'object') {
                                // Already an object, keep as is
                                payloaddata = payloaddata;
                            } else {
                                payloaddata = JSON.parse(String(payloaddata));
                            }
                        } catch (e) {
                            payloaddata = null;
                        }
                    } else {
                        // Default to String - convert everything to string
                        if (Buffer.isBuffer(payloaddata)) {
                            payloaddata = payloaddata.toString('utf8');
                        } else if (typeof payloaddata === 'object') {
                            payloaddata = JSON.stringify(payloaddata);
                        } else {
                            payloaddata = String(payloaddata);
                        }
                    }
                }

                var msg = {
                    topic : topic,
                    payload : payloaddata,
                    raw_payload: payload
                };

                node.send(msg);
            });

            node.mqttclient.on('error', function(msg) {
                 node.error(msg);
            });
        }
        else {
            node.mqttclient = null;
            node.status({fill: 'grey', shape: 'ring', text: 'inactive'});
        }

        node.on('input', function(msg) {
            if (node.mqttclient && msg.topic) {
                let topic = msg.topic.trim();

                if (topic == '@device/status/get') {  // device can send status out immediately
                    node.send({
                        topic: `${n.deviceid}/device/get`,
                        payload: {
                            status: node.mqttclient.connected? 1 : 0
                        }
                    });
                }
                else if (topic == '@shadow/data/get') {
                    topic = '@shadow/data/get';
                    if (typeof(msg.payload)=='object') {
                        node.mqttclient.publish(topic, JSON.stringify(msg.payload));
                    }
                    else {
                        node.mqttclient.publish(topic, msg.payload);
                    }
                }
                else if (topic == '@shadow/data/update') {
                    topic = '@shadow/data/update';
                    if (typeof(msg.payload)=='object') {
                        node.mqttclient.publish(topic, JSON.stringify(msg.payload));
                    }
                    else {
                        node.mqttclient.publish(topic, msg.payload);
                    }
                }
                else if (topic == '@push') {
                    topic = '@push';
                    if (typeof(msg.payload)=='object') {
                        node.mqttclient.publish(topic, JSON.stringify({
                            title: msg.payload.title,
                            subtitle : msg.payload.subtitle,
                            body: msg.payload.body
                        }));
                    }
                    else {
                        node.mqttclient.publish(topic, msg.payload);
                    }
                }
                else if (msg.topic.startsWith('@msg/')) {
                    if (typeof(msg.payload)=='object') {
                        node.mqttclient.publish(topic, JSON.stringify(msg.payload));
                    }
                    else {
                        node.mqttclient.publish(topic, msg.payload);
                    }
                }
                else if (msg.topic.startsWith('@private/')) {
                    if (typeof(msg.payload)=='object') {
                        node.mqttclient.publish(topic, JSON.stringify(msg.payload));
                    }
                    else {
                        node.mqttclient.publish(topic, msg.payload);
                    }
                }
            }
        });

        node.on('close', function(removed, done) {
            if (node.mqttclient) {
                node.mqttclient.end();
                delete node.mqttclient;
                node.status({fill: 'red', shape: 'ring', text: 'disconnected'});
                node.log('device disconnected');
                done();
            }
            else {
                done();
            }
	    });

    }
    RED.nodes.registerType("device",Device);
}

module.exports = function(RED) {
    "use strict";

    const objectPath = require("object-path");
    const jsonic = require('jsonic');

    function evaluatePublishInput(msg, config) {
        let buff = {};

        if (config.topicpropertyType == 'msg') {
            buff.topic = msg[config.topicproperty || 'topic'];
        }
        else if (config.topicpropertyType == '@msg') {
            buff.topic = `@msg/${config.topicproperty}`;
        }
        else if (config.topicpropertyType == '@private') {
            buff.topic = `@private/${config.topicproperty}`;
        }
        else if (config.topicpropertyType == 'str') {
            buff.topic = String(config.topicproperty);
        }

        if (config.payloadpropertyType == 'msg') {
            buff.payload = msg[config.payloadproperty || 'topic'];
        }
        else if (config.payloadpropertyType == 'json') {
            try {
                buff.payload = JSON.parse(String(config.payloadproperty));
            }
            catch(e) {
                buff.payload = undefined;
            }
        }
        else if (config.payloadpropertyType == 'str') {
            buff.payload = String(config.payloadproperty);
        }

        return buff;
    }

    function evaluateShadowInput(msg, config, node) {
        let payload = undefined;
        let key = undefined;
        let value = undefined;

        if (config.inputformat == 'json') {
            let buff;
            if (config.shadowpropertyType == 'msg') {
                buff = msg[config.shadowproperty || 'payload'];
            }
            else if (config.shadowpropertyType == 'json') {
                try {
                    buff = JSON.parse(config.shadowproperty);
                } catch(e) {
                    node.status({fill:"red", shape:"ring", text:"Invalid JSON data"});
                    return null;
                }
            }
            else {
                buff = config.shadowproperty;
            }

            let parsedData;
            try {
                if (typeof buff === 'string') {
                    parsedData = JSON.parse(buff);
                } else if (typeof buff === 'object' && buff !== null) {
                    parsedData = buff;
                } else {
                    throw new Error('Invalid data type');
                }
            } catch(e) {
                node.status({fill:"red", shape:"ring", text:"Input is not valid JSON"});
                return null;
            }

            // Handle format mode
            const formatMode = config.shadowformatmode || 'auto';

            if (formatMode === 'manual') {
                // Manual mode: use data as-is without wrapping
                payload = parsedData;
            } else {
                // Auto mode: check if already wrapped under {data: {...}}
                if (parsedData && typeof parsedData === 'object' && parsedData.hasOwnProperty('data')) {
                    // Already wrapped, use as-is
                    payload = parsedData;
                } else {
                    // Not wrapped, wrap it
                    payload = { data: parsedData };
                }
            }
        }
        else if (config.inputformat == 'field') {
            if (config.fieldkeypropertyType == 'msg') {
                key = msg[config.fieldkeyproperty || 'key'];
            }
            else {
                key = config.fieldkeyproperty;
            }

            if (config.fieldvaluepropertyType == 'msg') {
                value = msg[config.fieldvalueproperty || 'value'];
            }
            else if (config.fieldvaluepropertyType == 'json') {
                try {
                    value = JSON.parse(config.fieldvalueproperty);
                } catch(e) {
                    node.status({fill:"red", shape:"ring", text:"Invalid JSON in field value"});
                    return null;
                }
            }
            else {
                value = config.fieldvalueproperty;
            }

            payload = {};
            if (key && value !== undefined) {
                objectPath.set(payload, key, value);
            }

            // For field mode, always wrap in {data: {...}}
            payload = { data: payload };
        }

        return payload;
    }

    function evaluateGetShadowInput(msg, config) {
        let buff;
        if (config.commandpropertyType == 'msg') {
            buff = msg[config.commandproperty || 'payload'];
        }
        else {
            buff = config.commandproperty;
        }
        return buff;
    }

    function evaluatePushInput(msg, config) {
        let pushData = {};

        // Evaluate title
        if (config.pushtitleType == 'msg') {
            pushData.title = msg[config.pushtitle || 'title'];
        } else if (config.pushtitleType == 'str') {
            pushData.title = String(config.pushtitle || '');
        }

        // Evaluate subtitle
        if (config.pushsubtitleType == 'msg') {
            pushData.subtitle = msg[config.pushsubtitle || 'subtitle'];
        } else if (config.pushsubtitleType == 'str') {
            pushData.subtitle = String(config.pushsubtitle || '');
        }

        // Evaluate body
        if (config.pushbodyType == 'msg') {
            pushData.body = msg[config.pushbody || 'body'];
        } else if (config.pushbodyType == 'str') {
            pushData.body = String(config.pushbody || '');
        }

        return pushData;
    }

    function Command(config) {
        RED.nodes.createNode(this, config);

        let node = this;

        this.on("input", function(msg) {
            let outMsg = {};

            switch (config.commandtype) {
                case 'publish':
                    let publishData = evaluatePublishInput(msg, config);
                    outMsg = {
                        topic: publishData.topic,
                        payload: publishData.payload
                    };
                    break;

                case 'writeshadow':
                    let shadowData = evaluateShadowInput(msg, config, node);

                    if (shadowData === null) {
                        // Error occurred, don't send output
                        return;
                    }

                    outMsg = {
                        topic: '@shadow/data/update',
                        payload: shadowData
                    };
                    break;

                case 'getshadow':
                    let commandData = evaluateGetShadowInput(msg, config);
                    outMsg = {
                        topic: '@shadow/data/get',
                        payload: commandData
                    };
                    break;

                case 'getstatus':
                        outMsg = {
                            topic: '@device/status/get',
                            payload: ''
                        };
                        break;

                case 'push':
                    let pushData = evaluatePushInput(msg, config);
                    outMsg = {
                        topic: '@push',
                        payload: {
                            title: pushData.title,
                            subtitle: pushData.subtitle,
                            body: pushData.body
                        }
                    };
                    break;

                default:
                    node.error("Unknown command type: " + config.commandtype, msg);
                    return;
            }
            node.status({});
            node.send(outMsg);
        });

        this.on("close", function() {

        });
    }

    RED.nodes.registerType("command", Command);
}

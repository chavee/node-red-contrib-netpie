module.exports = function(RED) {
    const axios = require('axios');
    const feedtime = require('feedtime');
    const CONFIG = require('./config');

    function convert_feed_data(resobj, type) {
        let out = {
            series: [],
            data: [],
            labels: []
        }

        if (type == 'node-red-dashboard') {
            let slist = resobj.queries[0].results;
            for (let s of slist) {
                if (s.tags && s.tags.attr) {
                    out.series.push(s.tags.attr[0]);
                    out.data.push( s.values.map(item => {
                        return {
                            x: item[0],
                            y:item[1]
                        }
                    }));
                }
            }
        }
        return [out];
    }

    function Feed(config) {
        RED.nodes.createNode(this, config);
        let node = this;
        let current = {};

        let eventlist = {};
        function addListener(obj, event, callback) {
            if (eventlist[event]) return;
            eventlist[event] = 1;
            obj.on(event, callback)
        }

        const deviceConfigNode = RED.nodes.getNode(config.deviceconfig);
        let flowchannelmqtt = deviceConfigNode.flowchannelmqtt;

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
        config.ds_endpoint = CONFIG.NETPIE.dshost;

        const useFlowChannel = deviceConfigNode.flowchannelmqtt ;
        current.towatch = config.subfeedupdated && useFlowChannel;

        function updateNodeStatus(current) {
            let color, shape, text;
            if (current.towatch) {
                if (current.clientstatus) {
                    shape = 'dot';
                    color = 'green';
                    text = 'watching';
                }
                else {
                    color = 'grey';
                    text = '';
                    shape = 'ring';
                }
            }
            else {
                color = 'white';
                text = '';
                shape = null;
            }
            node.status({fill: color, shape: shape, text: text})
        }

        if (config.active && config.subfeedupdated && useFlowChannel) {
            function initializeFeed() {
                current.clientstatus = 1;
                node.log('feed connected');
                updateNodeStatus(current);
            }

            if (deviceConfigNode.isConnected()) {
                initializeFeed();
            } else {
                addListener(deviceConfigNode, `connect`, initializeFeed);
            }

            addListener(deviceConfigNode, `disconnect`, function() {
                current.clientstatus = 0;
                node.log('feed disconnected');
                updateNodeStatus(current);
            });

            addListener(deviceConfigNode, `feed/data/updated:${config.deviceid}`, function(payload) {

                if (payload && payload.newdata) {
                    for (let key in payload.newdata) {
                        let msg = {
                            topic: key,
                            payload: payload.newdata[key],
                            timestamp: payload.timestamp
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

        node.on('close', function(done){
            console.log('feed ' + config.name + ' closed..');

            current.clientstatus = 0;
            updateNodeStatus(current);

            setTimeout(() => {
                done();
            }, 800);
        });

        node.on('input', function(msg) {
            let begints, endts;

            // Parse begin timestamp
            if (config.beginabsolutedatepropertyType == 'msg' && config.beginabsolutedateproperty !== undefined) {
                let field = 'from';
                begints = feedtime.parse(msg[field]);
            }
            else if (config.beginabsolutedatepropertyType == 'datetime' && config.beginabsolutedateproperty !== undefined ) {
                begints = feedtime.parse(config.beginabsolutedateproperty);
            }
            else if (config.beginabsolutedatepropertyType == 'str' && config.beginabsolutedateproperty !== undefined) {
                begints = feedtime.parse(config.beginabsolutedateproperty);
            }
            if (!begints) {
                begints = {
                    value: Number(config.beginrelativevalue) || 0,
                    unit: config.beginrelativeunit
                }
            }

            // Parse end timestamp
            if (config.endabsolutedatepropertyType == 'msg' && config.endabsolutedateproperty !== undefined) {
                let field = 'to';
                endts = feedtime.parse(msg[field]);
            }
            else if (config.endabsolutedatepropertyType == 'datetime' && config.endabsolutedateproperty !== undefined) {
                endts = feedtime.parse(config.endabsolutedateproperty);
            }
            else if (config.endabsolutedatepropertyType == 'str' && config.endabsolutedateproperty !== undefined) {
                endts = feedtime.parse(config.endabsolutedateproperty);
            }

            if (!endts) {
                endts = {
                    value: Number(config.endrelativevalue) || 0,
                    unit: config.endrelativeunit
                }
                if (endts.value == 0) {
                    endts = Date.now();
                }
            }

            // Build query object
            let cmdobj = {
                metrics: [
                    {
                        name: config.deviceid,
                        group_by: [
                            { name: "tag", tags: [ "attr" ] }
                        ],
                        aggregators : [
                            {
                                name: 'avg',
                                sampling: {
                                    value: config.samplingvalue,
                                    unit: config.samplingunit
                                }
                            }
                        ]
                    }
                ]
            }

            // Set time ranges
            if (typeof(begints) == 'number') {
                cmdobj.start_absolute = begints || Date.now();
            }
            else if (typeof(begints) == 'object') {
                cmdobj.start_relative = begints;
            }

            if (typeof(endts) == 'number') {
                cmdobj.end_absolute = endts || Date.now();
            }
            else if (typeof(endts) == 'object') {
                cmdobj.end_relative = endts;
            }

            // Execute query via REST API
            let axiosobj = {
                method: 'post',
                url: `${config.ds_endpoint}/feed/api/v1/datapoints/query`,
                data: cmdobj,
                responseType: 'json',
                headers: {'Authorization': `Device ${config.deviceid}:${config.devicetoken}`}
            }

            axios(axiosobj).then((response) => {
                msg.payload = convert_feed_data(response.data, 'node-red-dashboard');
                node.send(msg);
            }).catch((error) => {
                node.error('Feed query error: ' + error.message);
            });
        });
    }

    RED.nodes.registerType("feed", Feed);
};

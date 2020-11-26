// Process app http api to send action or config to a device, and send to the correct SNS topic
var aws  = require('aws-sdk');

var sns = require('sns');
var ddb_device = require('ddb_device');

var DL_TOPIC = "arn:aws:sns:eu-west-1:581930022841:iot-dl-decoded";
exports.handler = async (event) => {
    console.log("rx: "+JSON.stringify(event));
    var res=undefined;
    // process POST with json body
    if (event.httpMethod=='POST') {
        var postdata = JSON.parse(event.body);
        if (postdata!==undefined) {
            var device = await ddb_device.findDevice(postdata.to);
            if (device!==undefined) {
                var device_protocol=device.msgProtocol;
                // Allow override by caller
                if (postdata.msgProtocol!==undefined) {
                    device_protocol = postdata.msgProtocol;
                }
                // Send 'generic' json message for dplinks
                var dlmsg = { 
                    to : postdata.to,
                    type : getComm(postdata.to, 'lora'),        // sets the outbound communication protocol from the device id given
                    msgProtocol: device_protocol,
                    payload: {}
                };
                if (event.resource.indexOf('action')>0) {
                    if (postdata.actions!==undefined) {
                        dlmsg.payload.actions = postdata.actions;
                    } else {
                        // badness
                        res='Must supply actions object';
                    }
                }
                if (event.resource.indexOf('config')>0) {
                    if (postdata.config!==undefined) {
                        dlmsg.payload.config = postdata.config;
                    } else {
                        res='Must supply config array';
                    }
                }
                if (event.resource.indexOf('raw')>0) {
                    // Option to pass directly your hex (but must not pass also actions or config)
                    if (postdata.rawhex!==undefined) {
                        dlmsg.payload.rawhex = postdata.rawhex;
                    } else {
                        res='Must supply rawhex';
                    }
                }
                if (dlmsg.to===undefined) {
                    res='Must provide destination in to element';
                }
            } else {
                res='Cannot find device ['+postdata.to+']';
            }
            if (res===undefined) {      // ie no errors
                console.log("sns DL msg:"+JSON.stringify(dlmsg));
                // Send to SNS topic - add 'tag' with protocol so correct listener decodes it (MessageAttribute)
                return sns.publish(DL_TOPIC, dlmsg, { msgProtocol: { DataType: 'String', StringValue:device_protocol}} );
            }
        } else {
            console.log("missing json body");
            res='Missing json body';
        }
    } else {
        // Nothing for other methods
            res='method:'+event.httpMethod+":notused";
    }
    // always say ok if no error
    const response = {
        statusCode: 200,
        body: JSON.stringify('{ "result":"'+res+'"} '),
    };
    return response;
};

function getComm(did, dv) {
    var di = did.indexOf('-');
    if (di<0) {
        return dv;
    }
    return did.substring(0,di);
}

function isHex(str) {
  return /^[A-Fa-f0-9]+$/i.test(str);
}

function base64ToHex(b64) {
    let buff = Buffer.from(b64, 'base64');
    return buff.toString('hex');
}
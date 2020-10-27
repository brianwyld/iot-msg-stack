// Process app http api to send action or config to a device, and send to the correct SNS topic
var aws  = require('aws-sdk');

var DL_TOPIC = "arn:aws:sns:eu-west-1:581930022841:iot-dl-decoded";
exports.handler = async (event) => {
    console.log("rx: "+JSON.stringify(event));
    var res=undefined;
    // process POST with json body
    if (event.httpMethod=='POST') {
        var postdata = JSON.parse(event.body);
        if (postdata!==undefined) {
            var device_protocol='app-core';        // TODO determine the protocol used by the device somehow
            if (postdata.msgProtocol!==undefined) {
                device_protocol = postdata.msgProtocol;
            }
            // Send 'generic' json message for dplinks
            var dlmsg = { 
                to : postdata.to,
                type : 'lora',
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
            if (res===undefined) {      // ie no errors
                console.log("sns DL msg:"+JSON.stringify(dlmsg));
                // Send to SNS topic - add 'tag' with protocol so correct listener decodes it (MessageAttribute)
                return sns_publish(DL_TOPIC, dlmsg, { msgProtocol: { DataType: 'String', StringValue:device_protocol}} );
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

// Returns a promise
function sns_publish(topic, msg, tags={}) {
    var sns = new aws.SNS({"accessKeyId ":"mykey"});
    var params = {
        Message: JSON.stringify(msg), /* required */
        MessageStructure: 'String',     /* because its not json with different message per endpoint... */
        MessageAttributes: tags,
        TopicArn: topic
    };
    const promise = new Promise(function(resolve, reject) {
        sns.publish(params, function(err, data) {
            if (err) {
                console.log('SNS error occured:'+err, err.stack); // an error occurred
                reject(Error(err));
            } else {
                console.log('SNS data sent ok:'+JSON.stringify(data));           // successful response
                const response = {
                  statusCode: 200,
                    body: JSON.stringify('{ "result":"Sent"} '),
                };
                resolve(response);
            }
        });
    });
    return promise;
}

function isHex(str) {
  return /^[A-Fa-f0-9]+$/i.test(str);
}

function base64ToHex(b64) {
    let buff = Buffer.from(b64, 'base64');
    return buff.toString('hex');
}
// Process WMC http uplink data and send to an SNS topic
var aws  = require('aws-sdk');

var UL_TOPIC = "arn:aws:sns:eu-west-1:581930022841:iot-ul-raw";
exports.handler = async (event) => {
    console.log("rx: "+JSON.stringify(event));
    var res='oops';
    // process POST with url param "action=dataUp"
    if (event.httpMethod=='POST') {
        if (event.body!==undefined) {
            var postdata = JSON.parse(event.body);
            var device_protocol='app-core';        
            // TODO determine the protocol used by the device somehow
            // Lookup iot to find device "lora-<deveui>" and get its attribute 'msgProtocol'
            // Send 'generic' json message for uplinks
            var ulmsg = { 
                gwInfo : postdata.gwInfo,
                from : postdata.endDevice.devEui,
                type : 'lora',
                msgProtocol: device_protocol,
                connector : 'KLK-WMC-V3-HTTP',
                rxTime : postdata.recvTime,
                payload: { fPort: postdata.fPort, fCntUp:postdata.fCntUp, fCntDown:postdata.fCntDown }
            };
            // payload may be hex string or base64 (depends on client configuring their cluster...)
            // detect if other then hex digits, and decode base64 to hex digits if so
            if (postdata.payload!==undefined) {
                if (isHex(postdata.payload)==false) {
                    ulmsg.payload.rawhex = base64ToHex(postdata.payload);
                } else {
                    ulmsg.payload.rawhex = postdata.payload;
                }
            }
            console.log("sns UL msg:"+JSON.stringify(ulmsg));
            // Send to SNS topic - add 'tag' with protocol so correct listener decodes it (MessageAttribute)
            return sns_publish(UL_TOPIC, ulmsg, { msgProtocol: { DataType: 'String', StringValue:device_protocol}} );
        } else {
            console.log("missing body");
            res='Missing body';
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
// Process TTN http uplink data and send to an SNS topic
var aws  = require('aws-sdk');

var ddb_device = require('ddb_device');
var sns = require('sns');

var UL_TOPIC = "arn:aws:sns:eu-west-1:581930022841:iot-ul-raw";
exports.handler = async (event) => {
    console.log("rx: "+JSON.stringify(event));
    var res='oops';
    // process POST 
    if (event.httpMethod==='POST') {
        if (event.body!==undefined) {
            var postdata = JSON.parse(event.body);
            var device_protocol='app-core';        
            // device unique id is <comm type>-<addr>
            var did = 'lora-'+postdata.hardware_serial;
            // Lookup iot to find device "lora-<deveui>" and get its attribute 'msgProtocol', 'sk-appTag'
            var device = await ddb_device.findDevice(did);
            if (device===undefined) {
                device = await ddb_device.createDevice({ 'id':did, 'msgProtocol': 'app-core', 'appTag':'generic' });
            }
            await ddb_device.updateDevice(did, { 'lastRSSI': '-50'});
            
            // Note the device object is a DynamoDB Item, so has attribute typing ie access as device.<attr>.S
            // Send 'generic' json message for uplinks
            var ulmsg = { 
                gwInfo : postdata.metadata,
                from : did,
                type : 'lora',
                msgProtocol: device.msgProtocol.S,
                appTag : device.appTag.S,
                connector : 'TTN-HTTP',
                rxTime : postdata.recvTime,
                payload: { fPort: postdata.port, fCntUp:postdata.counter }
            };
            // payload may be hex string or base64 (depends on client configuring their cluster...)
            // detect if other then hex digits, and decode base64 to hex digits if so
            if (postdata.payload_raw!==undefined) {
                ulmsg.payload.rawhex = base64ToHex(postdata.payload);
            }
            console.log("sns UL msg:"+JSON.stringify(ulmsg));
            // Send to SNS topic - add 'tag' with protocol so correct listener decodes it (MessageAttribute)
            return sns.publish(UL_TOPIC, ulmsg, { msgProtocol: { DataType: 'String', StringValue:device.msgProtocol.S}, appTag : { DataType: 'String', StringValue:device.appTag.S}} );
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


function isHex(str) {
  return /^[A-Fa-f0-9]+$/i.test(str);
}

function base64ToHex(b64) {
    let buff = Buffer.from(b64, 'base64');
    return buff.toString('hex');
}
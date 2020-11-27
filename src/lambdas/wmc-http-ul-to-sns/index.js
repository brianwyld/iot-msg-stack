// Process WMC http uplink data and send to an SNS topic
var aws  = require('aws-sdk');

var ddb_device = require('ddb_device');
var sns = require('sns');

var UL_TOPIC = "arn:aws:sns:eu-west-1:581930022841:iot-ul-raw";
exports.handler = async (event) => {
    console.log("rx: "+JSON.stringify(event));
    var res='oops';
    // process POST with url param "action=dataUp"
    if (event.httpMethod=='POST') {
        if (event.body!==undefined) {
            var postdata = JSON.parse(event.body);
            // device unique id is <comm type>-<addr>
            var did = 'lora-'+postdata.endDevice.devEui;
            // Lookup iot to find device "lora-<deveui>" and get its attribute 'msgProtocol', 'appTag'
            var device = await ddb_device.findDevice(did, ['msgProtocol', 'appTag']);
            if (device===undefined) {
                device = await ddb_device.createDevice({ 'id':did, 'msgProtocol': 'app-core', 'appTag':'generic' });
            }
            if (await ddb_device.updateDevice(did, { 'lastRSSI': -50}, 'netinfo')===null) {
                console.log("failed to update device with rssi");
            }
            
            // Send 'generic' json message for uplinks
            var ulmsg = { 
                gwInfo : postdata.gwInfo,
                from : did,
                type : 'lora',
                msgProtocol: device.msgProtocol,
                appTag : device.appTag,
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
            return sns.publish(UL_TOPIC, ulmsg, { msgProtocol: { DataType: 'String', StringValue:device.msgProtocol}, appTag : { DataType: 'String', StringValue:device.appTag}} );
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

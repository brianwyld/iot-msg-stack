// Receive messages (DL) and send to DB for logging
var aws  = require('aws-sdk');

var ddb_device = require('ddb_device');
var ddb_msgs = require('ddb_msgs');

exports.handler = async (event) => {
    // Check device type is ok. Note message MUST be json
    console.log("rx msg:"+JSON.stringify(event));
    var msg = JSON.parse(event.Records[0].Sns.Message);
    console.log("rx decoded:"+JSON.stringify(msg));
    if (msg!==undefined && msg.to!==undefined) {
        var now = new Date();
        await ddb_device.updateDevice(msg.to, { 'lastDLTime': now.toISOString()});

        return ddb_msgs.addMsgToTable(msg.to, 'DL', msg)
            .then(function(data) {
                console.log('ADDED DL msg from ['+msg.to+'] as '+JSON.stringify(data));
            })
            .catch(function(err) {
                console.log('FAILED TO ADD DL msg from ['+msg.to+'] ['+JSON.stringify(msg)+'] as '+err);
            });
    } else {
        console.log("ignore received message which can't find content or has no dest address?:"+JSON.stringify(event));
        throw new Error('bad content : '+msg);
    }

};

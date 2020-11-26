var aws  = require('aws-sdk');

var ddb_device = require('ddb_device');
var ddb_msgs = require('ddb_msgs');

exports.handler = async (event) => {
    // Check device type is ok. Note message MUST be json
    console.log("rx msg:"+JSON.stringify(event));
    var msg = JSON.parse(event.Records[0].Sns.Message);
    console.log("rx decoded:"+JSON.stringify(msg));
    if (msg!==undefined && msg.from!==undefined) {
        // Update generic decoded values as attributes of the device
        if (msg.payload.generic!==undefined) {
            await ddb_device.updateDevice(msg.from, msg.payload.generic);
        }
        return ddb_msgs.addMsgToTable(msg.from, 'UL', msg)
            .then(function(data) {
                console.log('ADDED UL msg from ['+msg.from+'] as '+JSON.stringify(data));
            })
            .catch(function(err) {
                console.log('FAILED TO ADD UL msg from ['+msg.from+'] ['+JSON.stringify(msg)+'] as '+err);
            });
    } else {
        console.log("ignore received message which can't find content or has no sender address?:"+JSON.stringify(event));
        throw new Error('bad content : '+msg);
    }

};

// Get messages from iot-dl-decoded SNS topic, which are JSON generic messages destined for an app-core device
// This lambda should have a filter on the SNS topic where MessageAttributes.msgProtocol=='app-core'
var aws  = require('aws-sdk');

var DL_RAW_TOPIC = "arn:aws:sns:eu-west-1:581930022841:iot-dl-raw";
/*
 msgProtocol:app-core
 payload:{ 
    config:[ { cfgkey:<key as 4 digits hex>, cfgval:0x<hex array} || <int>}, ...],
    actions: { <action>:<params>, ... }
 }
*/
exports.handler = async (event) => {
        // Check device type is ok. Note message MUST be json
    console.log("rx DL msg:"+JSON.stringify(event));
    var res='oops';
    var msg = JSON.parse(event.Records[0].Sns.Message);
    if (msg.msgProtocol==='app-core') {
        // Encode payload as rawhex string
        // Can't send both actions and config at same time
        if (msg.payload.config!==undefined) {
            msg.payload.rawhex = encodeConfig(msg.payload.config, msg.dlid);
        } else if (msg.payload.actions!==undefined) {
            msg.payload.rawhex = encodeActions(msg.payload.actions, msg.dlid);
        } else {
            // Nothing to do here? May not matter if hex already defined... 
            res='no DL elements?';
        }
        if (msg.payload.rawhex!==undefined) {
            // And send it on to be sent to device
            console.log("tx encoded:"+JSON.stringify(msg));
            return sns_publish(DL_RAW_TOPIC, msg);
        }
    } else {
        console.log("badness, received non-app-core message");
        res='not app-core protocol : '+msg.msgProtocol;
    }
    const response = {
        statusCode: 200,
        body: JSON.stringify(res),
    };
    return response;
};

function toHexString(v, sz) {
    // Note the >>> to deal with negative numbers
    return ('00000000'+((Number(v))>>>0).toString(16)).slice(-sz);
}
function printHexShortLE(v) {
    return toHexString(v, 4);
}
function printHexIntLE(v) {
    return toHexString(v, 8);
}
function printHexByte(v) {
    return toHexString(v, 2);
}
// Encode the given array of actions, each with a name and a params object, return a string of hex chars
function encodeActions(tlv, dlid) {
    if (dlid===undefined) {
        dlid =0;
    }
    var hexstr = '';
    var nActions = 0;
    for(let ti in tlv) {
        console.log("got action : "+tlv[ti].action);
        // Each action has specific params to encode
        switch (tlv[ti].action) {
            case 'reboot': 
                hexstr+=printHexByte(1)+printHexByte(0);      // no params
                nActions++;
                break;
            case 'fixgps':
                // no params
                hexstr+=printHexByte(11)+printHexByte(0);      // no params
                nActions++;
                break;
            case 'appack':
                var id =0;
                if (tlv[ti].params.ackId!=undefined) {
                    id = tlv[ti].params.ackId;
                }
                hexstr+=printHexByte(28) + printHexByte(1)+printHexByte(id);
                nActions++;
                break;
            default:
                // Action name must of form "T<action key in hex>"
                if (tlv[ti].action.startsWith('T') && tlv[ti].action.length==3 && isHex(tlv[ti].action.substr(1))) {
                    // TODO check its hex
                    // May have no param
                    if (tlv[ti].params===undefined) {
                        hexstr+=tlv[ti].action.substr(1) + printHexByte(0);
                    } else {
                        hexstr+=tlv[ti].action.substr(1) + printHexByte(tlv[ti].params.length/2)+tlv[ti].params;
                    }
                    nActions++;
                    console.log("added generic action ["+tlv[ti].action+"] with params ["+tlv[ti].params+"]");
                } else {
                    console.log("ignore unknown action ["+tlv[ti].action+"] with params ["+tlv[ti].params+"]");
                }
                break;
        } 
    }
    // Return with header : byte 0 (msg type 6 + version 0 + parity), byte 1 is number of actions + id for this DL
    return printHexByte(evenParity(0x06+0x00))+printHexByte(nActions+dlid*0x10)+hexstr;
}

function isHex(str) {
  return /^[A-Fa-f0-9]+$/i.test(str);
}

function encodeConfig(cfg, dlid) {
    if (dlid===undefined) {
        dlid =0;
    }
    // value is array of config elements, encode each as specific 'setconfig' action
    // Returns a hex string which is the message
    var hexstr = '';
    var nActions = 0;
    for (let key in cfg) {
        console.log(key, cfg[key]);
        if (key!==undefined && key.length===4 && cfg[key]!==undefined) { 
            var cv=null;
            if (cfg[key].startsWith('0x')) {
                cv = cfg[key].substr(2);
            } else {
                var cvi = parseInt(cfg[key]);
                if (cvi>255) {
                    if (cvi>0xFFFF) {
                        // 4 bytes
                        cv = printHexIntLE(cvi);
                    } else {
                        // 2 bytes
                        cv = printHexShortLE(cvi);
                    }
                } else {
                    // 1 byte
                    cv = printHexByte(cvi);
                }
            }
            // <action tag = 2 (setconfig)><length of action params = key+value length)><2 bytes cfgkey><n bytes cfg value>
            hexstr+=printHexByte(2)+printHexByte(key.length+cv.length)+key+cv;
            nActions++;
        } else {
            console.log('failed to process cfg key:'+key);
        }
    }
    // Return with header : byte 0 (msg type 6 + version 0 + parity), byte 1 is number of actions + id for this DL
    return printHexByte(evenParity(0x06+0x00))+printHexByte(nActions+dlid*0x10)+hexstr;
}

function count1s(bin) {
    var cnt = 0;
    for(var i=0;i<bin.length;i++) {
        if (bin[i]=='1') {
            cnt++;
        }
    }
    console.log('nb of 1s in ['+bin+' is '+cnt);
    return cnt;
}

// make header byte even parity 
function evenParity(b) {
    if ((count1s(Number(b).toString(2))%2)===1) {
        return b+0x80;
    }
    return b;
}


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
                    body: JSON.stringify('Sent'),
                };
                resolve(response);
            }
        });
    });
    return promise;
}


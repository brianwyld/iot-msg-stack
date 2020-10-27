// Process WMC http downlink events data and send to an SNS topic
var aws  = require('aws-sdk');

var DL_STATUS_TOPIC = "arn:aws:sns:eu-west-1:581930022841:iot-dl-status";
exports.handler = async (event) => {
    console.log("rx: "+JSON.stringify(event));
    var res=undefined;
    // process POST with dl event
    if (event.httpMethod=='POST') {
        if (event.body!==undefined) {
            var postdata = JSON.parse(event.body);
            var dlackmsg = {
                "to":postdata.endDevice.devEui,
                "status":postdata.status,
                "id": postdata.dataDownId
            };
            console.log("sns DL status msg:"+JSON.stringify(dlackmsg));
            // Send to SNS topic
            return sns_publish(DL_STATUS_TOPIC, dlackmsg);
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
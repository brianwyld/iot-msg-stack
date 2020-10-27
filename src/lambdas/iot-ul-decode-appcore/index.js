// Process raw IOT UL events to decode the payload into generic json and send on to next SNS topic
// this decoder is for app-core standard UL messages
var aws  = require('aws-sdk');

var UL_TOPIC = "arn:aws:sns:eu-west-1:581930022841:iot-ul-decoded";
exports.handler = async (event) => {
    // Check device type is ok. Note message MUST be json
    console.log("rx msg:"+JSON.stringify(event));
    var res='oops';
    var msg = JSON.parse(event.Records[0].Sns.Message);
    if (msg.msgProtocol==='app-core') {
        // Decode payload as rawhex string
        msg.payload.rawtlv = decodeTLV(msg.payload.rawhex.substr(4));
        // build generic json from the known tlvs
        msg.payload.generic = mapTLVs(msg.payload.rawtlv);
        // And send it on
        console.log("tx decoded:"+JSON.stringify(msg));
        return sns_publish(UL_TOPIC, msg);
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

// Decode a TLV block in the given data string of hex chars
function decodeTLV(data) {
		var decodedPayload = {};
		var i = 0;

		while (i < data.length) {
			var tVal=0.0;
			var lVal = 0.0;
			var valVal = "";
			tVal = (data[i] + data[i + 1] + "").toUpperCase();
			i+=2;
			lVal = parseInt("0x" + data[i] + data[i + 1]);
			i+=2;
			for (var j = 0; j < lVal; j++) {
				valVal += "" + data[i] + data[i + 1];
				i+=2;
			}
			decodedPayload["T"+tVal] = valVal;
		}
		return decodedPayload;
}
function parseIntLE16(s) {
	var hexS = ""+s.substr(2,2)+s.substr(0,2);
	return parseInt(hexS,16);
}
function parseIntByte(s, o=0) {
	return parseInt(s.substr(o,o+2),16);
}
function mapTLVs(tlv) {
    var ret = {};
	if (tlv.T00!==undefined) ret.fwVersion = { major:parseIntByte(tlv.T00), minor:parseIntByte(tlv.T00, 2), build:parseIntByte(tlv.T00,4), id:parseIntByte(tlv.T00,6)};
	if (tlv.T03!==undefined) ret.temperature = parseIntLE16(tlv.T03);
	if (tlv.T04!==undefined) ret.pressure = parseIntLE16(tlv.T04);
	if (tlv.T05!==undefined) ret.humidity = parseIntByte(tlv.T05);
	if (tlv.T06!==undefined) ret.light = parseIntByte(tlv.T06);
    if (tlv.T07!==undefined) ret.battery = parseIntLE16(tlv.T07)/1000;
    if (tlv.T08!==undefined) ret.adc1 = parseIntLE16(tlv.T08);
	if (tlv.T09!==undefined) ret.adc2 = parseIntLE16(tlv.T09);
	// TODO proper structured decodes
	if (tlv.T0A!==undefined) ret.noise = tlv.T0A;
	if (tlv.T0B!==undefined) ret.button = tlv.T0B;
	if (tlv.T0C!==undefined) ret.move = tlv.T0C;
	if (tlv.T0D!==undefined) ret.fall = tlv.T0D;
	if (tlv.T0E!==undefined) ret.shock = tlv.T0E;
	if (tlv.T0F!==undefined) ret.orient = tlv.T0F;
	if (tlv.T10!==undefined) ret.rebootReasons = tlv.T10;
	if (tlv.T11!==undefined) ret.lastAssert = tlv.T11;

	// One appdata if present
	if (tlv.TF0!==undefined) ret.appdata = tlv.TF0;
	return ret;
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
                console.log('SNS data sent ok:'+data);           // successful response
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

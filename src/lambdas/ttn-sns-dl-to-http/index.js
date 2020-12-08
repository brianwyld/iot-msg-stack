// Receive DL messages with the raw hex data from the SNS topic and push them to TTN

var aws  = require('aws-sdk');
var httpclient = require('https');

let TTN_APPID = process.env.TTN_APPID;          // name of application in ttn console
let TTN_PROCESSID = process.env.TTN_PROCESSID;  // also?
let TTN_KEY = process.env.TTN_KEY;              // access key created in ttn console with 'messages' access
let TTN_SERVER = process.env.TTN_SERVER;        // including region eg "https://integrations.thethingsnetwork.org/ttn-eu"

let URL_SEND_DL =   TTN_SERVER+'/api/v2/down/'+TTN_APPID+'/'+TTN_PROCESSID+'?key='+TTN_KEY;
let CONTENT_TYPE = 'application/json;charset=UTF-8';
let CONNECTOR = 'TTN-HTTP';

exports.handler = async (event) => {
    console.log("rx DL msg:"+JSON.stringify(event));
    var res = undefined;
    var reqbody = { ttl:60, port:3, confirmed:false };
    var msg = JSON.parse(event.Records[0].Sns.Message);
    if (msg.connector===CONNECTOR) {
        if (msg.payload!==undefined) {
            reqbody.dev_id = getAddr(msg.to);
            if (msg.payload.ttl!==undefined) {
                reqbody.ttl = msg.payload.ttl;
            }
            if (msg.payload.fPort!==undefined) {
                reqbody.port = msg.payload.fPort;
            }
            if (msg.payload.rawhex!==undefined) {
                reqbody.payload_raw = base64ToHex(msg.payload.rawhex);
            } else {
                res = "missing payload hex, cannot DL to "+getAddr(msg.to);
            }
        } else {
            res = 'missing payload, cannot DL';
        }
    } else {
        res = 'connector ['+msg.connector+'] is not us';
    }
    if (res===undefined) {
        console.log('ttn http post with body:'+JSON.stringify(reqbody));
            return push_dl(reqbody)
//            .then(function(httpResp) {
//                return parseDLResponse(httpResp);
//            })
            .catch(function(err) {
                console.log('failed to send DL:'+err);
                return 'FAIL';
            });
    } else {
        console.log('failed to create ttn dl request:'+res);
    }
    const response = {
        statusCode: 200,
        body: JSON.stringify(res),
    };
    return response;
};

// return device address from a device id format <comm>-<addr>
function getAddr(did) {
    var di = did.indexOf('-');
    if (di<0) {
        return did;
    }
    return did.substr(di+1);
}

function base64ToHex(h) {
    let buff = Buffer.from(h, 'hex');
    return buff.toString('base64');
}

// Returns promise 
async function push_dl(body) {
    var hdrs = { 'Content-Type':CONTENT_TYPE, Authorization: 'Bearer '+TTN_KEY };
    var res = await https_post(URL_SEND_DL, JSON.stringify(body), hdrs);
    return parseDLResponse(res);
}

async function parseDLResponse(res) {
    const promise = new Promise(function(resolve, reject) {
//        res.setEncoding('utf8');
        if (res.statusCode>=200 && res.statusCode<=299) {   // Should be uncessary, post code has already filtered
            res.on('data', (chunk) => {
                console.log(`BODY: ${chunk}`);
                var retbody = JSON.parse(chunk);
                if (retbody.requestId!==undefined) {
                    resolve(retbody.requestId);
                } else {
                    resolve('noId');
                }
            });
            res.on('end', (e) => {
                console.log('end of body');
                resolve('noId');
            });
            res.resume();
            // return while waiting for an on to finish
        } else {
            reject('dl req : ret not 200 :'+res.statusCode);
        }
    });
    return promise;
}
async function https_post(url, body, hdrs={}) {
    const options = {
      method: 'POST',
      headers: hdrs
    };  
    options.headers['Content-Length'] = Buffer.byteLength(body);

    const promise = new Promise(function(resolve, reject) {
        console.log('POST to '+url+' with body ['+body+'] and headers ['+JSON.stringify(hdrs)+']')
        const req = httpclient.request(url, options, function(res) {
            console.log(`STATUS: ${res.statusCode}`);
//            console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
            if (res.statusCode>=200 && res.statusCode<=299) {
                resolve(res);
            } else {
                reject(Error('bad POST response from  ['+url+'] :'+res.statusCode));
            }
        });
    
        req.on('error', (e) => {
            console.error(`problem with request: ${e.message}`);
            reject(Error(e));
        });
    
        // Write data to request body
        req.write(body);
        req.end();
        return req;
    });
    return promise;
}
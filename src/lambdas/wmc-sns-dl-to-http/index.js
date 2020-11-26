// Receive DL messages with the raw hex data from the SNS topic and push them to WMC
// TODO how do we know to route to WMC?
// TODO config of the WMC url etc ?

var aws  = require('aws-sdk');
var httpclient = require('https');

let WMC_USER = 'wyld-things-app';       // MOVE TO ENV VARS
let WMC_PASS = 'wyld-things01';
let WMC_SERVER = 'https://wmc-poc.wanesy.com';

let WMC_URL_SEND_DL =   WMC_SERVER+'/gms/application/dataDown';
let WMC_URL_GET_TOKEN = WMC_SERVER+'/gms/application/login';
let KLK_CONTENT_TYPE = 'application/vnd.kerlink.iot-v1+json;charset=UTF-8';

exports.handler = async (event) => {
    console.log("rx DL msg:"+JSON.stringify(event));
    var res = undefined;
    var reqbody = { ttl:60, fPort:3, confirmed:false, contentType:"HEXA" };
    var msg = JSON.parse(event.Records[0].Sns.Message);
    if (msg.payload!==undefined) {
        reqbody.endDevice = { devEui: getAddr(msg.to) };
        if (msg.payload.ttl!==undefined) {
            reqbody.ttl = msg.payload.ttl;
        }
        if (msg.payload.fPort!==undefined) {
            reqbody.fPort = msg.payload.fPort;
        }
        if (msg.payload.rawhex!==undefined) {
            reqbody.payload = msg.payload.rawhex;
        } else {
            res = "missing payload hex, cannot DL to "+getAddr(msg.to);
        }
    } else {
        res = 'missing payload, cannot DL';
    }
    if (res===undefined) {
        console.log('wmc http post with body:'+JSON.stringify(reqbody));
        // Must get token first as these have a limited lifetime
        return reqToken()
//            .then(function(httpResp) {
//                return parseTokenResponse(httpResp);
//            })
            .then(function (token) { 
                return wmc_push_dl(token,reqbody); 
            })
//            .then(function(httpResp) {
//                return parseDLResponse(httpResp);
//            })
            .catch(function(err) {
                console.log('failed to send DL:'+err);
                return 'FAIL';
            });
    } else {
        console.log('failed to create wmc dl request:'+res);
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
    return did.substr(di);
}

// execute token get, returns promise to execute
async function reqToken() {
    var body = { login:WMC_USER, password:WMC_PASS};
    var hdrs = { 'Content-Type':KLK_CONTENT_TYPE};
    var res = await https_post(WMC_URL_GET_TOKEN, JSON.stringify(body), hdrs);
    return parseTokenResponse(res);
}

async function parseTokenResponse(res) {
    const promise = new Promise(function(resolve, reject) {
//        res.setEncoding('utf8');
        if (res.statusCode>=200 && res.statusCode<=299) {   // Should be uncessary, post code has already filtered
            res.on('data', (chunk) => {
                console.log(`BODY: ${chunk}`);
                var retbody = JSON.parse(chunk);
                var bearer = "Bearer";
                if (retbody.tokenType!==undefined) {
                    bearer = retbody.tokenType;
                }
                resolve(bearer+' '+retbody.token);
            });
            res.on('end', (e) => {
                console.log('end of body');
                reject('no body processed');
            });
            res.resume();
            // return while waiting for an on to finish
        } else {
            reject('getToken : ret not 200 :'+res.statusCode);
        }
    });
    return promise;
}
// Returns promise 
async function wmc_push_dl(token, body) {
    var hdrs = { 'Content-Type':KLK_CONTENT_TYPE, Authorization:token };
    var res = await https_post(WMC_URL_SEND_DL, JSON.stringify(body), hdrs);
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
                reject('no body processed for dl req');
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
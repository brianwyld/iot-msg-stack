var aws  = require('aws-sdk');


exports.handler = async (event) => {
    // Check device type is ok. Note message MUST be json
    console.log("rx msg:"+JSON.stringify(event));
    var res='oops';
    var msg = JSON.parse(event.Records[0].Sns.Message);
    if (msg!==undefined) {
        // Device names is 'comm protocol'-'comm network address'
        var did = msg.type+'-'+msg.from;
        console.log('updating DS for ['+did+']');
        // update config
        return updateThingEnv(did, msg.payload.generic)
//            .then(function(data) { 
//                return updateThingConfig(did, msg.payload.rawtlv);
//            })
            .catch(function(err) {
                console.log('failed to update DS['+did+'] :'+err);
                return 'FAIL';
            });
        // update env
    }
    const response = {
        statusCode: 200,
        body: res,
    };
    return response;
};

async function updateThingEnv(did, ulgeneric) {
    var envs = {};
    for(var gek in ulgeneric) {
        envs[gek] = JSON.stringify(ulgeneric[gek]);
    }
    envs['lastRx']  = new Date().toISOString();
    var params = {
        thingName: did,
        attributePayload: {
            attributes: envs,
//      '<AttributeName>': 'STRING_VALUE',
            merge: true
        },
//        expectedVersion: 'NUMBER_VALUE',
//        removeThingType: true || false,
//        thingTypeName: 'STRING_VALUE'
    };
    let iot = new aws.Iot();
    return new Promise(function (result, reject) {
        iot.updateThing(params, function(err, data) {
          if (err) {
              console.log(err, err.stack); // an error occurred
              reject(err);
         } else {
             console.log('updated ['+did+'] with '+JSON.stringify(params));           // successful response
             result(data);
         }
        });
    });
}
async function updateThingConfig(did, ultlv) {
    // Find any config elements in the rawtlv to create config updates
    // TODO
    var cfg = {};
    var params = {
        thingName: did,
        payload: JSON.stringify({
            reported: cfg,
            merge: true
        }),
    };
    // TODO can't find the good api to update the 'reported' state
    let iot = new aws.IotData({endpoint: 'https://www.wyres.io'});
    return new Promise(function (result, reject) {
        iot.updateThingShadow(params, function(err, data) {
          if (err) {
              console.log(err, err.stack); // an error occurred
              reject(err);
         } else {
             console.log('new device shadow:'+JSON.stringify(data));           // successful response
             result(data);
         }
        });
    });
}

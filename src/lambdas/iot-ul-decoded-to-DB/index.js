var aws  = require('aws-sdk');

let MSG_TABLE='IOT-MSGS';
// Seconds for expiry time (5 days for testing)
let MSG_EXPIRATION_DURATION = (5*24*60*60);

var _dynoDB= new aws.DynamoDB({apiVersion: 'latest'});

exports.handler = async (event) => {
    // Check device type is ok. Note message MUST be json
    console.log("rx msg:"+JSON.stringify(event));
    var msg = JSON.parse(event.Records[0].Sns.Message);
    console.log("rx decoded:"+JSON.stringify(msg));
    if (msg!==undefined && msg.from!==undefined) {
        return addMsgToTable(msg)
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

// Return value 'v' if not undefined, else default 'd'
function VoD(v, d) {
    if (v!==undefined) {
        return v;
    }
    return d;
}

// Returns promise or throws error
async function addMsgToTable(msg) {
    if (await checkOrCreateTable()) {
        // add to table
        var now = new Date();
        // Build update expression (note don't use AttributeUpdate as docs recommend using UpdateExpression (no reason given...))
        var attrvals = {
                ':d':{ 'S':'UL'},
                ':mp':{ 'S':VoD(msg.msgProtocol,'unknown')},
                ':t':{ 'S':VoD(msg.type, 'lora')},
                ':c':{ 'S':VoD(msg.connector,'UNKNOWN')},
                ':et': { 'N': ''+(now.getTime() + MSG_EXPIRATION_DURATION) }
        };
        var updateExpression ='SET dir=:d, msgProtocol=:mp, nettype=:t, connector=:c, expiryTime=:et';
        if (msg.gwInfo!==undefined) {
            // Todo generic parse of gwinfo (non-lora specific) to get explicit attributes eg rssi? 
            attrvals[':ni'] =  { 'S':JSON.stringify(msg.gwInfo)},
            updateExpression += ', netinfo=:ni';
        }
        if (msg.payload.rawhex!==undefined) {
           attrvals[':rh'] = { 'S':msg.payload.rawhex };
           updateExpression += ', payload_rawhex=:rh';
        }
        if (msg.payload.rawtlv!==undefined) {
            attrvals[':rt'] = { 'S':JSON.stringify(msg.payload.rawtlv) };
            updateExpression += ', payload_rawtlv=:rt';
        }
        if (msg.payload.generic!==undefined) {
            attrvals[':g'] = { 'S':JSON.stringify(msg.payload.generic) };
            updateExpression += ', payload_decoded=:g';
        }
            
        var params = {
            TableName:MSG_TABLE,
            Key: { 
                'DevName': {'S':VoD(msg.type, 'lora')+'-'+msg.from}, 
                'Timestamp':{'S':now.toISOString() }, 
            },
            ExpressionAttributeValues : attrvals,
            UpdateExpression : updateExpression
        };
        console.log('updating with:'+JSON.stringify(params));
        return new Promise(function(resolve, reject) {
            _dynoDB.updateItem(params, function(err, data) {
                if (err) {
                    console.log('failed to insert message'+err);
                    reject(err);
                } else {
                    resolve(data);
                }
            })    
        });
    }        
    throw new Error('failed to access table');
}

async function checkOrCreateTable() {
    var tdesc = await new Promise(function(resolve, reject) { 
        _dynoDB.describeTable({ 'TableName':MSG_TABLE}, function(err, data) {
            if (err) {
                console.log('failed to find table:'+err);
                resolve(null);
            } else resolve(data);
        });
    });
    if (tdesc===null) {
        // Create table structure on the fly
        // TODO how to enable TTL on the 'expiryTime' attribute
        var params = {
            TableName : MSG_TABLE,
            KeySchema: [
                { AttributeName: "DevName", KeyType: "HASH"},
                { AttributeName: "Timestamp", KeyType: "RANGE" }
            ],
            AttributeDefinitions: [
                { AttributeName: "DevName", AttributeType: "S" },
                { AttributeName: "Timestamp", AttributeType: "S" }
            ],
            ProvisionedThroughput: {
                ReadCapacityUnits: 5,
                WriteCapacityUnits: 5
            }
        };

        var tcreated = await new Promise(function(resolve, reject) { 
            _dynoDB.createTable(params, function(err, data) {
                if (err) {
                    console.log('missing table ['+MSG_TABLE+'], creating failed:'+err);
                    resolve(false);
                } else {
                    resolve(true);
                }
            });
        });
        return tcreated;
    }
    return true;        // everything is ok
}

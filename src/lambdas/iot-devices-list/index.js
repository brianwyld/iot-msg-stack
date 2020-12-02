// device list accessor
var aws  = require('aws-sdk');

var ddb_device = require('ddb_device');

exports.handler = async (event) => {
    console.log("rx: "+JSON.stringify(event));
    var res=undefined;
    if (event.httpMethod==='GET') {
        console.log("GET:"+JSON.stringify(event));
        var entity = event.pathParameters.entity;
        var filter = undefined;
        // little hack to get everyone
        if (entity!='all') {
            filter = {'entity':entity};
        }
        // Find all devices with correct entity
        var tlist = await ddb_device.listDevices(filter);
        const response = {
            statusCode: 200,
            body: JSON.stringify({"result":"true", "metadata":{ "numObjects": tlist.length, "limit":"-1", "offset":"0" }, "data":{ "objList" : tlist } }),
        };
        return response;
    } else {
        console.log("not handling anything except GET:"+JSON.stringify(event));
        res='http action not supported';
    }
    // always say ok if no error
    const response = {
        statusCode: 200,
        body: JSON.stringify('{ "result":"'+res+'"} '),
    };
    return response;

};


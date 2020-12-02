// api device accessor for CRUD actions
var aws  = require('aws-sdk');

var ddb_device = require('ddb_device');
var ddb_msgs = require('ddb_msgs');

exports.handler = async (event) => {
    console.log("rx: "+JSON.stringify(event));
    var res=undefined;
    var resCode = 200;
    var tagid = event.pathParameters.id;
    var entity = event.pathParameters.entity;
    if (event.httpMethod==='GET') {
        console.log("GET:"+JSON.stringify(event));
        // find the tag, all attributes to be returned
        var tag = await ddb_device.findDevice(tagid);
        if (tag!==null) {
            // Check correct entity
            // TODO
            const response = {
                statusCode: 200,
                body: JSON.stringify(tag),
            };
            return response;
        }
        resCode= 404;
        res ='notFound';
    } else if (event.httpMethod==='POST') {
        console.log("POST:"+JSON.stringify(event));
        var postdata = JSON.parse(event.body);
        var updateinfo = postdata.data;
        if (updateinfo!==undefined) {
            // Check correct entity
            // TODO
            // find the tag
            var tag = await ddb_device.updateDevice(tagid, updateinfo);
            if (tag!==null) {        
                const response = {
                    statusCode: 200,
                    body: JSON.stringify(tag),
                };
                return response;
            }
            resCode= 404;
            res ='notFound';
        }
        res = 401;
        res="no update info found";
    } else if (event.httpMethod==='PUT') {
        console.log("POST:"+JSON.stringify(event));
        var postdata = JSON.parse(event.body);
        var createinfo = postdata.data;
        if (createinfo!==undefined) {
            // Check doesn't currently exist
            var tag = await ddb_device.findDevice(tagid);
            if (tag===null) {
                // Force entity and id
                createinfo.entity = entity;
                createinfo.id = tagid;
                // create the device
                var tag = await ddb_device.createDevice(createinfo);
                if (tag!==null) {        
                    const response = {
                        statusCode: 200,
                        body: JSON.stringify(tag),
                    };
                    return response;
                }
                // failed to create
                resCode= 500;
                res = 'createFailed';
            } else {
                resCode = 200;
                res = 'device already exists';
            }
        } else {
            resCode = 401;
            res="no create info found";
        }
    } else if (event.httpMethod==='DELETE') {
        console.log("DELETE:"+JSON.stringify(event));
        // find the tag so can return its contents before deletion
        var tag = await ddb_device.findDevice(tagid);
        if (tag!==null) {        
            // Check correct entity
            if (tag.entity===entity) {
                // TODO
                await ddb_device.deleteDevice(tagid);
                const response = {
                    statusCode: 200,
                    body: JSON.stringify(tag),
                };
                return response;
            } else {
                resCode = 403;
                res='incorrect entity';
            }
        } else {
            resCode = 404;
            res='notFound';
        }
    } else {
        console.log("not handling "+event.httpMethod+" : "+JSON.stringify(event));
        resCode = 401;
        res='http action not supported';
    }
    // always say ok if no error
    const response = {
        statusCode: resCode,
        body: JSON.stringify('{ "result":"'+res+'"} '),
    };
    return response;

};

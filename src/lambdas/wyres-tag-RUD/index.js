// emulate Wyres GLM tag accessor for RUD actions
var aws  = require('aws-sdk');

var ddb_device = require('ddb_device');
var ddb_msgs = require('ddb_msgs');

exports.handler = async (event) => {
    console.log("rx: "+JSON.stringify(event));
    var res=undefined;
    if (event.httpMethod==='GET') {
        console.log("GET:"+JSON.stringify(event));
        var tagid = event.pathParameters.tagid;
        var entity = event.pathParameters.entity;
        // find the tag, all attributes to be returned
        var tag = await ddb_device.findDevice(tagid);
        
        if (tag!==null) {        
            const response = {
                statusCode: 200,
                body: JSON.stringify(tag),
            };
            return response;
        }
        const response = {
            statusCode: 404,
            body: JSON.stringify({ 'result':'notFound'}),
        };
        return response;
    } else if (event.httpMethod==='POST') {
        console.log("POST:"+JSON.stringify(event));
        var tagid = event.tagid;
        var postdata = JSON.parse(event.body);
        var updateinfo = postdata.update;
        if (updateinfo!==undefined) {
            // find the tag
            var tag = await ddb_device.updateDevice(tagid, updateinfo);
            if (tag!==null) {        
                const response = {
                    statusCode: 200,
                    body: JSON.stringify(tag),
                };
                return response;
            }
            const response = {
                statusCode: 404,
                body: JSON.stringify({ 'result':'notFound'}),
            };
            return response;
        }
        res="no update info found";
    } else if (event.httpMethod==='DELETE') {
        console.log("DELETE:"+JSON.stringify(event));
        var tagid = event.tagid;
        // find the tag so can return its contents before deletion
        var tag = await ddb_device.findDevice(tagid);
        if (tag!==null) {        
            await ddb_device.deleteDevice(tagid);
            const response = {
                statusCode: 200,
                body: JSON.stringify(tag),
            };
            return response;
        }
        const response = {
            statusCode: 404,
            body: JSON.stringify({ 'result':'notFound'}),
        };
        return response;
    } else {
        console.log("not handling "+event.httpMethod+" : "+JSON.stringify(event));
        res='http action not supported';
    }
    // always say ok if no error
    const response = {
        statusCode: 200,
        body: JSON.stringify('{ "result":"'+res+'"} '),
    };
    return response;

};

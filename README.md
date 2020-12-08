# IOT Processing Serverless Stack 

This project contains source code and supporting files for the serverless IOT message processing demo application.

It includes the following files and folders:

- src/lambdas - Code for the application's Lambda functions.
- \_\_tests__ - Unit tests for the application code.
- template.yml - A SAM template that defines the application's AWS resources.
- buildspec.yml -  A build specification file that tells AWS CodeBuild how to create a deployment package for the function.

# Functionality
The project provides a IOT message processing stack, which takes in 'uplink' messages from specific connectors (Kerlink WMC, TTN APIs are currently impletemented)
and decodes them for application use. Decoded attributes are pushed to an Item in a DynamoDB Table per device (named as \<protocol\>-\<device address\> eg 'lora-38B8EBE000000DA5'), created automatically at first view. 

The same functionality is provided in reverse for output 'downlink' messages (encoding, sending to connector).
All uplink and downlink messages are pushed to a DynamoDB table (with a TTL of 5 days) for debug.

A REST API allows to list Device Items in the DDB table, and CRUD each one.

# Status
The individual resource configurations and lambda code included in this application has been tested via the AWS console.

The application currently builds (sam build) but has not been deployed/tested as an "application', and is likely to need rework for the whole permissions side of things.
Currently the roles defined and attached to the lambdas are NOT suitable for a 'real' stack as they are too permissive.

# TODO
- test deployment of packaged application
- update security aspects
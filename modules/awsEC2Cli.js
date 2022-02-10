const EC2Client = require('aws-sdk/clients/ec2');
require('aws-sdk');
// Set the AWS Region
const REGION = 'us-west-2';
// Create an Amazon S3 service client object.
const ec2Client = new EC2Client({ region: REGION });
module.exports = ec2Client;

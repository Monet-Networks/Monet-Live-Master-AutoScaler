const { log } = require('console');
const ec2Client = require('./awsEC2Cli');
require('dotenv').config();

class AWS {
  constructor(AmiId, key) {
    this.init(AmiId, key);
  }

  init = () => {
    this.instances = [];
    this.state = 'create';
    this.prevInstanceName = 'previousName';
    if (this.currentInstanceName === this.prevInstanceName) this.state = 'same';
    this.client = ec2Client;
  };

  /**
   * @description Create an instance or multiple instances
   * @returns error || instance data
   */
  async createInstance(name) {
    if (name) {
      this.currentInstanceName = name;
      this.instanceParams = {
        ImageId: ' ami-0d550428459cce5c9', // 'ami-0fa6ff071cc2dea05', // 'ami-0abcf2a8b7709cc05', // 'ami-04befcb360b89e1ea', // 'ami-041f6bd9492f1e09d', // 'ami-06aaa3165c59ecdb7', // 'ami-0e891a0d9bd041cb8', // 'ami-0850e7d5dd3fda878', // 'ami-0c1c02750a1158a9b', //AMI_ID
        InstanceType: 't4g.micro',
        KeyName: 'gurgaon', //KEY_PAIR_NAME
        MinCount: 1,
        MaxCount: 1,
        SecurityGroupIds: ['sg-063905d4148d18403', 'sg-04061dff07fe82e78'],
        SubnetId: 'subnet-706aed07', // us-west-2a
        TagSpecifications: [
          {
            ResourceType: 'instance',
            Tags: [
              {
                Key: 'Purpose',
                Value: 'test',
              },
              {
                Key: 'Name',
                Value: name,
              },
            ],
          },
        ],
      };
    } else return log('No name provided for this instance');
    if (this.currentInstanceName !== 'NaN')
      return new Promise((resolve, reject) =>
        this.client.runInstances(this.instanceParams, (error, data) => {
          if (error) reject(error);
          if (data) {
            this.instances.push({ instanceId: data.Instances[0].InstanceId, data: data.Instances[0] });
            resolve(data.Instances[0]);
          }
        })
      );
  }

  /**
   * @description Delete an instance or multiple instances
   * @param {string | [string]} instanceId
   */
  async deleteInstance(instanceId) {
    if (!instanceId) return new Error('params missing');
    const params = { InstanceIds: typeof instanceId === 'string' ? [instanceId] : instanceId };
    return new Promise((resolve, reject) =>
      this.client.terminateInstances(params, (err, data) => {
        if (err) {
          reject(err);
        }
        this.instances.forEach((instance, index) => {
          if (instance.instanceId === instanceId) {
            this.instances.splice(index, 1);
            resolve(instance);
          }
        });
        resolve(data);
      })
    );
  }
}

module.exports = AWS;

const { log } = require('console');
const ec2Client = require('./awsEC2Cli');
require('dotenv').config();

class AWS {
  constructor(IName, AmiId, key) {
    this.init(IName, AmiId, key);
  }

  init = (IName, AmiId, key) => {
    this.instances = [];
    this.state = 'create';
    this.prevInstanceName = 'previousName';
    this.currentInstanceName = IName;
    if (this.currentInstanceName === this.prevInstanceName) this.state = 'same';
    this.instanceParams = {
      ImageId: AmiId || 'ami-0c1c02750a1158a9b', //AMI_ID
      InstanceType: 't4g.micro',
      KeyName: key || 'gurgaon', //KEY_PAIR_NAME
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
              Value: this.currentInstanceName,
            },
          ],
        },
      ],
    };
    this.client = ec2Client;
  };

  /**
   * @description Create an instance or multiple instances
   * @returns error || instance data
   */
  async createInstance() {
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

const AWS = require('aws-sdk');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const { error } = require('console');

class SThree {
  #Config;
  #Bucket;
  #SThreeCli;
  #LocalFolderPath;
  #BucketFolderPath;
  constructor() {
    this.#LocalFolderPath = path.join(__dirname, '..', 'data/');
    this.#BucketFolderPath = 'monet-live/';
    this.#Bucket = 'monet-rekognition';
    this.#Config = new AWS.Config({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION,
    });
    this.#SThreeCli = new AWS.S3({ apiVersion: '2006-03-01' });
  }

  push = ({ name, image }, CB) => {
    const fileName = `${name}.jpg`;
    const imgData = image.split(',')[1]; // .replace(/^data:image\/png;base64,/, '');
    fs.writeFileSync(this.#LocalFolderPath + fileName, imgData, 'base64', (err) => {
      if (err) console.log('Error saving file : ', err);
    });
    if (fs.existsSync(this.#LocalFolderPath + fileName)) {
      const readFromFile = fs.createReadStream(this.#LocalFolderPath + fileName);
      const params = { Bucket: this.#Bucket, Key: this.#BucketFolderPath + fileName, Body: readFromFile };
      this.#SThreeCli.upload(params, function (err, data) {
        if (err) return CB(err);
        return CB(null, data);
      });
    } else {
      error('No file with such name exists in data folder.');
    }
  };

  pull = ({ name }, CB) => {
    const fileName = `${name}.jpg`;
    const writeToData = fs.createWriteStream(this.#LocalFolderPath + fileName);
    const params = {
      Bucket: this.#Bucket,
      Key: this.#BucketFolderPath + fileName,
    };
    this.#SThreeCli
      .getObject(params)
      .createReadStream()
      .on('error', (err) => {
        exec(`rm ${this.#LocalFolderPath}${fileName}`);
        if (err) return CB(err);
      })
      .on('end', () => {
        return CB(null, { success: `File ${fileName} downloaded.` });
      })
      .pipe(writeToData);
  };
}

module.exports = SThree;

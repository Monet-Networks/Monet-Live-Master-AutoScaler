const { log, error } = require('console');
const AWS = require('aws-sdk');
const { writeFileSync, existsSync, readFileSync } = require('fs');
const path = require('path');
const { cp } = require('fs/promises');
require('dotenv').config();

class Rekognition {
  #RekClient;
  #Bucket;
  #Config;
  #RekCollection = 'monet-live-users';
  #RekARN = 'arn:aws:rekognition:us-west-2:619065725320:collection/monet-live-users';
  constructor() {
    this.FolderPath = 'monet-live/';
    this.LocalFolderPath = path.join(__dirname, '..', 'data/');
    this.#Bucket = 'monet-rekognition';
    this.#Config = new AWS.Config({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION,
    });
    this.#RekClient = new AWS.Rekognition();
    // this.#CreateCollection();
    // this.#DeleteCollection();
    // this.#ListCollections();
  }

  recognize = (source, target, CB) => {
    const photo_source = this.FolderPath + source;
    const photo_target = this.FolderPath + target;
    const params = {
      SourceImage: {
        S3Object: {
          Bucket: this.#Bucket,
          Name: photo_source,
        },
      },
      TargetImage: {
        S3Object: {
          Bucket: this.#Bucket,
          Name: photo_target,
        },
      },
      SimilarityThreshold: 70,
    };
    this.#RekClient.compareFaces(params, function (err, response) {
      if (err) {
        log(err, err.stack); // an error occurred
        CB(err);
      } else {
        response.FaceMatches.forEach((data) => {
          let position = data.Face.BoundingBox;
          let similarity = data.Similarity;
          log(`The face at: ${position.Left}, ${position.Top} matches with ${similarity} % confidence`);
        });
        CB(null, response);
      }
    });
  };

  #CreateCollection = () => {
    const params = {
      CollectionId: this.#RekCollection,
    };
    this.#RekClient.createCollection(params, (err, data) => {
      if (err) log(err, err.stack); // an error occurred
      else log(data); // successful response
      /*
   data = {
    CollectionArn: "aws:rekognition:us-west-2:123456789012:collection/myphotos",
    StatusCode: 200
   }
   */
    });
  };

  ListCollections = () => {
    const params = {};
    this.#RekClient.listCollections(params, (err, data) => {
      if (err) log(err, err.stack); // an error occurred
      else log(data); // successful response
      /*
   data = {
    CollectionIds: [
       "myphotos"
    ]
   }
   */
    });
  };

  #DeleteCollection = (name = 'myphotos') => {
    const params = {
      CollectionId: name,
    };
    this.#RekClient.deleteCollection(params, (err, data) => {
      if (err) log(err, err.stack); // an error occurred
      else log(data); // successful response
      /*
   data = {
    StatusCode: 200
   }
   */
    });
  };

  LegacyAddToCollection = (name, collection = this.#RekCollection) => {
    if (!name) return error('No name specified. Please call with valid parameters.');
    const monet_photo = this.FolderPath + `${name}.jpg`;
    const params = {
      CollectionId: collection,
      DetectionAttributes: [],
      ExternalImageId: name,
      Image: {
        S3Object: {
          Bucket: this.#Bucket,
          Name: monet_photo,
        },
      },
    };
    this.#RekClient.indexFaces(params, (err, data) => {
      if (err) return log(err, err.stack); // an error occurred
      log(data); // successful response
      this.store(name, data);
    });
  };

  AddFace = (name, CB, collection = this.#RekCollection) => {
    if (!name) return error('No name specified. Please call with valid parameters.');
    const monet_photo = this.FolderPath + `${name}.jpg`;
    const params = {
      CollectionId: collection,
      DetectionAttributes: [],
      ExternalImageId: name,
      Image: {
        S3Object: {
          Bucket: this.#Bucket,
          Name: monet_photo,
        },
      },
    };
    this.#RekClient.indexFaces(params, (err, data) => {
      if (err) {
        log(err, err.stack);
        return CB(err);
      }
      return CB(null, data);
    });
  };

  RemoveFace = (Ids, CB, collection = this.#RekCollection) => {
    const params = {
      CollectionId: collection,
      FaceIds: Ids, // ['ff43d742-0c13-5d16-a3e8-03d3f58e980b'],
    };
    this.#RekClient.deleteFaces(params, function (err, data) {
      if (err) return CB(err); // an error occurred
      else return CB(null, data); // successful response
      /*
   data = {
    DeletedFaces: [
       "ff43d742-0c13-5d16-a3e8-03d3f58e980b"
    ]
   }
   */
    });
  };

  DescribeCollection = (collection = this.#RekCollection) => {
    const params = {
      CollectionId: collection /* required */,
    };
    this.#RekClient.describeCollection(params, (err, data) => {
      if (err) log(err, err.stack); // an error occurred
      else log(data); // successful response
      this.store(collection, data);
    });
  };

  ListTag = (arn = this.#RekARN) => {
    const params = {
      ResourceArn: arn /* required */,
    };
    this.#RekClient.listTagsForResource(params, (err, data) => {
      if (err) return log(err, err.stack); // an error occurred
      log(data); // successful response
    });
  };

  DescribeCollection = (collection = this.#RekCollection) => {
    const params = {
      CollectionId: collection /* required */,
    };
    this.#RekClient.describeCollection(params, (err, data) => {
      if (err) return log(err, err.stack); // an error occurred
      log(data); // successful response
      this.store(collection, data);
    });
  };

  ListFaces = (CB, collection = this.#RekCollection) => {
    const params = {
      CollectionId: collection /* required */,
    };
    this.#RekClient.listFaces(params, (err, data) => {
      if (err) {
        return log(err, err.stack);
      } // an error occurred
      CB(null, data);
      // this.store(collection, data);
    });
  };

  LegacySearchFaceCollection = (name, collection = this.#RekCollection) => {
    if (!name) return error('No name provided. Please provide valid parameter.');
    if (typeof name !== 'string')
      return error(`Name of wrong type : ${typeof name}. Please provide valid
    parameter.`);
    const monet_photo = this.FolderPath + `${name}.jpg`;
    const params = {
      CollectionId: collection,
      FaceMatchThreshold: 95,
      Image: {
        S3Object: {
          Bucket: this.#Bucket,
          Name: monet_photo,
        },
      },
      MaxFaces: 5,
    };
    this.#RekClient.searchFacesByImage(params, (err, data) => {
      if (err) console.log(err, err.stack); // an error occurred
      else console.log(data); // successful response
      this.store(name, data);
    });
  };

  SearchFace = (name, CB, collection = this.#RekCollection) => {
    if (!name) return error('No name provided. Please provide valid parameter.');
    if (typeof name !== 'string')
      return error(`Name of wrong type : ${typeof name}. Please provide valid
    parameter.`);
    const monet_photo = this.FolderPath + `${name}.jpg`;
    const params = {
      CollectionId: collection,
      FaceMatchThreshold: 95,
      Image: {
        S3Object: {
          Bucket: this.#Bucket,
          Name: monet_photo,
        },
      },
      MaxFaces: 5,
    };
    this.#RekClient.searchFacesByImage(params, (err, data) => {
      if (err) {
        return CB(err);
      }
      return CB(null, data);
    });
  };

  store = (name, data) => {
    const filepath = `${this.LocalFolderPath}${name}.json`;
    if (existsSync(filepath)) {
      let readFromFile = JSON.parse(readFileSync(filepath));
      readFromFile = { ...readFromFile, ...data };
      writeFileSync(filepath, JSON.stringify(readFromFile));
    } else writeFileSync(filepath, JSON.stringify(data));
  };
}

module.exports = Rekognition;

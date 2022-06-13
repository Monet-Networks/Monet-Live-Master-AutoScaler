const { Router } = require('express');
const FaceRouter = Router();
const AutoToken = require('@modules/AutoToken');
const Recognition = require('@modules/Rekognition');
const SThree = require('@modules/S3');
const hyperReq = require('https');
const UserController = require('@controllers/user.controller');

const autoToken = new AutoToken();
const Rekognition = new Recognition();
const S3Client = new SThree();

const rekognize = async (req, res) => {
  const { faceid, name, image } = req.body;
  const metaData = await getImgMetaData(image.split(',')[1]);
  const { NumberOfFaces } = metaData;
  if (NumberOfFaces === 1) {
    S3Client.push({ name: faceid, image }, async (s3Err, s3Res) => {
      if (s3Err)
        return res.json({
          code: 403,
          error: true,
          response: 'error uploading image',
          message: s3Err,
        });
      // console.log('Stored image successfully : ', s3Res);
      Rekognition.SearchFace(faceid, async (rekErr, rekRes) => {
        if (rekErr)
          return res.json({
            code: 403,
            error: true,
            response: 'error analyzing image',
            message: rekErr,
          });
        if (rekRes.FaceMatches.length > 0) {
          // Get user details from DB
          const { ExternalImageId, FaceId, ImageId } = rekRes.FaceMatches[0].Face;
          let User = await UserController.GetUser({ ID: FaceId });
          if (!User)
            User = await UserController.SaveUser({
              ID: FaceId,
              ImageId,
              MyImageId: ExternalImageId,
              name,
            });
          return res.json({
            code: 200,
            error: false,
            response: 'rekognized!',
            message: {
              User,
              res: rekRes,
            },
          });
        } else {
          Rekognition.AddFace(faceid, async (addErr, addRes) => {
            if (addErr)
              return res.json({
                code: 403,
                error: true,
                response: 'Error adding face to collection',
                message: addErr,
              });
            // Put user details to DB
            const { ImageId, FaceId, ExternalImageId } = addRes.FaceRecords[0].Face;
            const User = await UserController.SaveUser({
              ID: FaceId,
              ImageId,
              MyImageId: ExternalImageId,
              name,
            });
            return res.json({
              code: 200,
              error: false,
              response: 'Added your face to collection!',
              message: {
                User,
                res: addRes,
              },
            });
          });
        }
      });
    });
  } else if (NumberOfFaces > 1)
    return res.json({
      code: 402,
      error: true,
      message: 'Too many face detected. Please isolate yourself',
      response: {
        NumberOfFaces,
      },
    });
  else if (NumberOfFaces === 0)
    return res.json({
      code: 402,
      error: true,
      message: 'No face detected. Please make your face clearly visible on camera with proper lighting.',
      response: {
        NumberOfFaces,
      },
    });
  else console.error('Unknown Number of faces detected');
};

const getImgMetaData = async (image) => {
  const PostData = JSON.stringify({
    myImage: image,
    data: 'BASIC',
    sessionInfo: 'extras',
  });
  const options = {
    hostname: 'metrics.monetanalytics.com',
    path: '/FaceReaderPOSTv8/api/facereaderservice/PostImage',
    method: 'POST',
    headers: {
      Authorization: `Bearer ${autoToken.token}`,
      'Content-Type': 'application/json',
    },
  };
  return new Promise((resolve, reject) => {
    const req = hyperReq.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      res.on('error', (error) => {
        console.log('Face-analytics frame response error : ', error);
        reject('reason : ', error);
      });
      res.on('end', () => {
        if (responseData.includes('{FaceAnalyzed:false, Invalid Token! }')) return;
        resolve(JSON.parse(responseData));
      });
    });
    req.write(PostData);
    req.end();
  });
};

FaceRouter.post('/', rekognize);

module.exports = FaceRouter;

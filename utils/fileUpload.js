const crypto = require('crypto');
const multer = require('multer');
const sanitize = require('sanitize-filename');
const util = require('util');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, '/mnt/efs/fs1/files'); // public/upload
  },
  filename: async (req, file, cb) => {
    file.originalname = (() => {
      const sanitizedName = sanitize(file.originalname).trim();
      return sanitizedName.replace(/\s+/g, ' ');
    })();
    const newFilename = `${crypto.randomInt(10000, 9999999)}-${file.originalname.toString().replace(/ /g, '-')}`;
    cb(null, newFilename);
  },
});

const uploader = multer({ storage, limits: { fileSize: 100 * 1000000 } }).array('files', 5);

module.exports = util.promisify(uploader);

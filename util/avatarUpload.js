const multer = require('multer');
const sanitize = require('sanitize-filename');
const util = require('util');
const path = require('path');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, '/mnt/efs/fs1/data/avatars'); // public/upload
  },
  filename: async (req, file, cb) => {
    file.originalname = (() => {
      const sanitizedName = sanitize(file.originalname).trim();
      return sanitizedName.replace(/\s+/g, ' ');
    })();
    const newFilename = `${file.originalname.toString().replace(/ /g, '-')}`;
    cb(null, newFilename);
  },
});

const avatar = multer({ storage }).single('avatar');

module.exports = util.promisify(avatar);

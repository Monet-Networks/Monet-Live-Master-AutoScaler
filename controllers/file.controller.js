const path = require('path');
const uploader = require('../utils/fileUpload');

exports.fileUpload = async function(req, res) {
    try {
        await uploader(req, res);
        if (req.files.length < 1) {
            return new Error('Files not found. At least one file is required.');
        };
        return res.json({
            error: false,
            message: 'File uploaded successfully.',
            files: req.files.map(({filename}) => ({ filename })),
        });
    } catch (err) {
        if (err.code === 'NO_FILE_PRESENT') {
            return res.json({ error: true, status: 400, message: err.message });
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
            return res.json({
                error: true,
                status: 400,
                message: 'Too many files to upload. You cannot upload more than 5 files.',
            });
        }
        return res.send(`Error when trying upload many files: ${err}`);
    }
};

exports.fileDownload = async function(req, res) {
    const file = req.params.file; // /:file/:folder/:userid
    const fileLocation = path.resolve(path.join('/mnt/efs/fs1/files', file));
    res.download(fileLocation, file);
};

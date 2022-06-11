const Reports = require('@models/reports.model');
const genPdf = require('../utils/genPdf');

exports.reportPdf = async (req, res, redis) => {
  const { roomid, creator_ID } = req.query;
  const report = await Reports.findOne({ roomid });
  if (report && report.pdf) {
    return res.json({
      code: 200,
      error: false,
      message: 'PDF data already exists',
      report: report.pdf,
    });
  }
  const pdf = await genPdf(roomid, creator_ID, redis);
  if (!pdf) {
    return res.json({
      code: 500,
      error: true,
      message: `Could not generate PDF data for roomid: ${roomid}. Please check`,
    });
  } else {
    Reports.findOneAndUpdate({ roomid }, { pdf });
    return res.json({
      code: 200,
      error: false,
      message: 'Report PDF data generated successfully',
      data: pdf,
    });
  }
};

const { Router } = require('express');
const ReportRouter = Router();
const RepEngine = require('../modules/Report');
const fdModel = require('../models/faceData.model');

const repCollection = {};

ReportRouter.get('/:id', (req, res) => {
  const roomid = req.params.id;
  if (!repCollection[roomid]) repCollection[roomid] = new RepEngine(roomid);
  res.json(repCollection[roomid].report);
});

ReportRouter.get('/db/dump/:id', async (req, res) => {
  const roomid = req.params.id;
  const roomDump = await fdModel.find({ roomid });
  if (roomDump.length)
    res.json({
      code: 200,
      error: false,
      response: 'Dump found',
      data: roomDump,
    });
  else
    res.json({
      code: 200,
      error: false,
      response: 'No Dump data found',
      data: roomDump,
    });
});

module.exports = ReportRouter;

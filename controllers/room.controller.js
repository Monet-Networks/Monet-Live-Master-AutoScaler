const Rooms = require('@models/room.model');
const fs = require('fs');
const paginate = require('@utils/paginate');
const sendMail = require('@utils/sendMail');
exports.getRoom = async (roomId) => Rooms.findOne({ roomid: roomId });

exports.getAllRooms = async function (req, res) {
  try {
    const { page, limit } = req.query;
    const { email } = req.body;
    const [start, end] = [req.body.start || '', req.body.end || ''];
    let rooms;
    if (email) {
      if (page && limit) {
        rooms = await paginate(
          page,
          limit,
          Rooms,
          start
            ? {
                creator_ID: email,
                'start.dateTime': {
                  $gte: new Date(start),
                  $lte: new Date(end),
                },
              }
            : { creator_ID: email },
          { _id: -1 }
        );
      } else {
        rooms = await Rooms.find({ creator_ID: email });
        if (!rooms?.length)
          return res.json({
            code: 404,
            error: true,
            message: 'No rooms found',
          });
      }
    }
    if (!rooms)
      return res.json({
        code: 404,
        error: true,
        message: 'No rooms found',
      });
    return res.json({
      code: 200,
      error: false,
      message: 'The room exists',
      response: rooms,
    });
  } catch (error) {
    return res.json({
      code: 400,
      error: true,
      message: 'Unable to find rooms',
      response: error.message,
    });
  }
};

exports.delete = async function (req, res) {
  const result = await Rooms.deleteOne({ sourceId: req.params.id });
  if (result.deletedCount === 1)
    return res.json({
      code: 200,
      error: true,
      message: 'room deleted',
    });
  else
    res.json({
      code: 400,
      error: true,
      message: 'unable to delete room',
    });
};

exports.getAdminRecordings = async (req, res) => {
  const creator_ID = req.body.admin_id;
  // use secret to authenticate the admin
  // const admin_secret = req.body.admin_secret;
  const admin_rooms = await Rooms.find({ creator_ID });
  if (admin_rooms.length !== 0) {
    const basePath = '/mnt/efs/fs1/data/';
    const adminRecordings = [];
    for (let room_record of admin_rooms) {
      if (fs.existsSync(`${basePath}${room_record.room}-final-mosaic.mp4`))
        adminRecordings.push({
          room: room_record.room,
          link: `https://concall.monetrewards.com/data/${room_record.room}-final-mosaic.mp4`,
        });
      if (fs.existsSync(`${basePath}${room_record.room}-mosaic.mp4`))
        adminRecordings.push({
          room: room_record.room,
          link: `https://concall.monetrewards.com/data/${room_record.room}-mosaic.mp4`,
        });
    }
    if (adminRecordings.length !== 0) {
      return res.json({
        code: 200,
        error: false,
        message: 'recordings success',
        response: adminRecordings,
      });
    } else {
      return res.json({
        code: 404,
        error: true,
        message: 'No recordings found',
        response: [],
      });
    }
  } else {
    return res.json({
      code: 404,
      error: true,
      message: 'no records found for the id ' + creator_ID,
    });
  }
};
exports.verifyObserver = async (req, res) => {
  const { roomid } = req.query;
  const room = await Rooms.findOne({ roomid });
  if (room.observing) {
    return res.json({
      code: 400,
      error: true,
      message: 'Someone is already observing this room',
    });
  }
  room.observing = true;
  room.save();
  res.json({ code: 200, error: false, message: 'You can observe this room' });
};
exports.saveRoom = function (req, res) {
  if (!req.body.roomid) return res.json({ code: 400, error: true, message: 'Roomid not found' });
  const { roomid, summary, start, observerEmail, observerLink, scheduled } = req.body;
  if(!roomid || !summary || !start || !observerEmail || !observerLink || !scheduled) {
    res.json({
      code: 404,
      error: true,
      message: "Missing mandatory attribute(s)"
    })
    return;
  }
  /* Handling object in attendees key of the body */
  if (scheduled)
    req.body.attendees = req.body.attendees.map((e) => {
      if (e) return e.email;
    });
  Rooms.updateOne({ roomid }, req.body, async (error, success) => {
    if (error) {
      console.log('Room Error : ', error);
      return res.json({
        message: 'Room could not be updated or does not exist!',
        code: 400,
        error: true,
      });
    } else if (success) {
      if (observerEmail && observerEmail.includes('@')) {
        await sendMail(
          '../views/observerInvite.handlebars',
          observerEmail,
          `[Monet Live] You are invited to observe meeting named: ${summary}`,
          { Name: summary, Link: observerLink, Time: new Date(start.dateTime).toGMTString() }
        );
        return res.json({
          code: 201,
          error: false,
          message: 'Room updated and Observer has been invited via email',
          response: success,
        });
      }
      return res.json({
        code: 201,
        error: false,
        message: 'Room updated!',
        response: success,
      });
    }
  });
};
exports.V2getAllRooms = async function (req, res) {
  try {
    const { page, limit } = req.query;
    const { email } = req.body;
    const [start, end] = [req.body.start || '', req.body.end || ''];
    let rooms;
    if (email) {
      if (page && limit) {
        rooms = await paginate(
          page,
          limit,
          Rooms,
          start
            ? {
                creator_ID: email,
                'start.dateTime': {
                  $gte: new Date(start),
                  $lte: new Date(end),
                },
              }
            : { creator_ID: email },
          { _id: -1 }
        );
      } else {
        rooms = await Rooms.find({ creator_ID: email });
        if (!rooms?.length)
          return res.json({
            code: 404,
            error: true,
            message: 'No rooms found',
          });
      }
    }
    if (!rooms)
      return res.json({
        code: 404,
        error: true,
        message: 'No rooms found',
      });
    if (rooms) {
      const rawData = [];
      rooms.results.forEach((rooms) => {
        const data = {
          summary: rooms.summary,
          mosaic: rooms.mosaic,
          roomid: rooms.roomid,
          start: rooms.start.dateTime,
          end: rooms.end.dateTime,
          attendees: rooms.attendees,
          scheduled: rooms.scheduled,
          callDuration: (new Date(rooms.end.dateTime) - new Date(rooms.start.dateTime)) / 1000,
        };

        rawData.push(data);
      });

      res.json({
        code: 200,
        error: false,
        message: 'The room exists',
        response: rawData,
      });
    }
  } catch (error) {
    return res.json({
      code: 400,
      error: true,
      message: 'Unable to find rooms',
      response: error.message,
    });
  }
};

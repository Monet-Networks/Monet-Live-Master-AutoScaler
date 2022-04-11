const Rooms = require("@models/room.model");
const fs = require("fs");
const paginate = require("@utils/paginate");
exports.getRoom = (roomId) => Rooms.findOne({ roomid: roomId });

exports.getAllRooms = async function (req, res) {
  try {
    const { page, limit } = req.query;
    const { email } = req.body;
    const [start, end] = [req.body.start || "", req.body.end || ""];
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
                "start.dateTime": {
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
            message: "No rooms found",
          });
      }
    }
    if (!rooms)
      return res.json({
        code: 404,
        error: true,
        message: "No rooms found",
      });
    return res.json({
      code: 200,
      error: false,
      message: "The room exists",
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
exports.getAdminRecordings = async (req, res) => {
  const creator_ID = req.body.admin_id;
  // use secret to authenticate the admin
  // const admin_secret = req.body.admin_secret;
  const admin_rooms = await Rooms.find({ creator_ID });
  if (admin_rooms.length !== 0) {
    const basePath = "/mnt/efs/fs1/data/";
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
        message: "recordings success",
        response: adminRecordings,
      });
    } else {
      return res.json({
        code: 404,
        error: true,
        message: "No recordings found",
        response: [],
      });
    }
  } else {
    return res.json({
      code: 404,
      error: true,
      message: "no records found for the id " + creator_ID,
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
      message: "Someone is already observing this room",
    });
  }
  room.observing = true;
  room.save();
  res.json({ code: 200, error: false, message: "You can observe this room" });
};

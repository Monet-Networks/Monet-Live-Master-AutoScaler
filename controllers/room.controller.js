const Rooms = require("../models/room.model");

exports.getRoom = (roomId) => Rooms.findOne({ roomid: roomId });

exports.getAllRooms = async function (req, res) {
  try {
    let email = req.query.email;
    let rooms;
    if (email) {
      rooms = await Rooms.find({ creator_ID: email });
    } else {
      rooms = await Rooms.find({});
    }
    return res.json({
      code: 201,
      error: false,
      message: "The room exists",
      response: rooms,
    });
  } catch (error) {
    return res.json({
      code: 400,
      error: true,
      message: "Unable to find rooms",
    });
  }
};

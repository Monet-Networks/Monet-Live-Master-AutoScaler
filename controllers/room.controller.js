const Rooms = require('../models/room.model');

exports.getRoom = (roomId) => Rooms.findOne({ roomid: roomId });
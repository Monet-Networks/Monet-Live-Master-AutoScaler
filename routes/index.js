const { googleAuth, login } = require("../controllers/user.controller");
const {
  getInstances,
  createOneInstance,
  getInstance,
  freeAllInstances,
  deleteInstance,
  updateImageId,
} = require("../controllers/instance.controller");
const { getRoom } = require("../controllers/room.controller");
const sessionController = require("../controllers/sessions.controller");
const roomController = require("../controllers/room.controller");
const ErrorHandler = require("../util/ErrorHandler");
const Report = require("../util/Report");
const userController = require("../controllers/user.controller");
const { genReport } = require("../util/GenReport");
const planController = require("../controllers/plans.controller");
const stripeController = require("../controllers/stripe.controller");
const planGroupsController = require("../controllers/planGroups.controller");
const Reports = require("../models/reports.model");
const Rooms = require("../models/room.model");
const CreateConfiguration = require("../modules/createConfig");
const { Router } = require("express");
const admin = Router();

admin.get("/reset-engine-state", (req, res) => {
  if (req.query.secret === "monet@43324") {
    engine.resetState();
    res.json({
      message: "success",
    });
  } else {
    res.json({
      message: "please don't use this api",
    });
  }
});

admin.post("/auth/google", googleAuth);

admin.get("/configure-instances", async (req, res) => {
  log("configure instance call.");
  const ips = await getInstances();
  new CreateConfiguration(ips);
  return new SuccessHandler(res, 200, "IPs configured", ips);
});

admin.post("/login", login);

admin.get("/getRoomIp", async (req, res) => {
  const { roomid } = req.query;
  const room = await getRoom(roomid);
  if (!room)
    return res.json({ code: 404, error: true, message: "Room not found" });
  res.json({ code: 200, error: false, message: "Room found", room });
});

admin.get("/get-link", getInstance);

admin.get("/free-all-instances", freeAllInstances);

admin.get("/getInviteRoom", async (req, res) => {
  let room;
  const roomid = req.query.roomid;
  if (roomid) room = await getRoom();
  if (room)
    return res.json({
      code: 201,
      error: false,
      message: "The room exists",
      response: room,
    });
  else
    return res.json({
      code: 404,
      error: true,
      message: "The room does not exists",
    });
});

admin.post("/getAllInviteRooms", function (req, res) {
  roomController.getAllRooms(req, res).then(() => {
    /* don't do anything */
  });
});

admin.get("/getReportData", async (req, res) => {
  const { roomid } = req.query;
  const report = redis.get(`report:${roomid}`);
  if (report === "1") {
    return res.json({
      code: 202,
      error: false,
      message: "Report is generating",
    });
  } else {
    try {
      const report = await Reports.findOne({ roomid });
      if (!report) {
        return res.json({
          code: 404,
          error: true,
          message: "Report data not found",
        });
      } else {
        res.json({
          code: 200,
          error: false,
          message: "Report data found",
          report,
        });
      }
    } catch (error) {
      console.log("getReportData error", error);
      res.json({ code: 400, error: true, message: error });
    }
  }
});

admin.post("/addFinalReport", async (req, res) => {
  if (!req.body.roomid || !req.body.report)
    return new ErrorHandler(res, 404, "Missing parameters in body");
  const { roomid, report } = req.body;
  const Report = await Reports.findOneAndUpdate(
    { roomid },
    { report },
    { new: true }
  );
  if (!Report) {
    res.json({
      code: 404,
      error: true,
      message: "Invalid roomId data not found",
    });
  }
  res.json({
    code: 200,
    error: false,
    message: "Report added",
    report: Report,
  });
});

admin.get("/report", async (req, res) => {
  const user = await sessionController.getUser({ uuid: req.query.id });
  if (user && user.name) {
    const report = await Report(user);
    if (report) {
      res.json({
        code: 200,
        error: false,
        message: "user report",
        response: report,
      });
    } else {
      res.json({
        code: 400,
        error: true,
        message: "Error generating report",
        response: "The report has not been generated",
      });
    }
  }
});

admin.post("/generateReport", async (req, res) => {
  const { roomid, creator_ID } = req.body;
  const reportExists = await Reports.findOne({ roomid });
  if (reportExists) {
    return res.json({
      code: 200,
      error: false,
      message: "Report already exists",
      report: reportExists,
    });
  }
  const report = await genReport(roomid, creator_ID, redis);
  if (!report) {
    return res.json({
      code: 404,
      error: true,
      message: `Could not generate report for roomid: ${roomid} & creator_ID: ${creator_ID}. Please check`,
    });
  } else
    return res.json({
      code: 200,
      error: false,
      message: "Report generated successfully",
      report,
    });
});

admin.get("/my-meetings", async (req, res) => {
  const { creator_ID, timeline } = req.query;
  const [start, end] =
    timeline === "day"
      ? [
          new Date(new Date().setHours(0, 0, 0, 0)),
          new Date(new Date().setHours(23, 59, 59, 999)),
        ]
      : timeline === "week"
      ? [
          new Date(
            new Date().setHours(0, 0, 0, 0).valueOf() - 6 * 24 * 60 * 60 * 1000
          ),
          new Date(new Date().setHours(23, 59, 59, 999)),
        ]
      : [
          new Date(
            new Date().setHours(0, 0, 0, 0).valueOf() - 29 * 24 * 60 * 60 * 1000
          ),
          new Date(new Date().setHours(23, 59, 59, 999)),
        ];
  const reportsData = Reports.find({ creator_ID });
  const userRoomsData = Rooms.find({
    creator_ID,
    "start.dateTime": { $gte: new Date(start) },
    "end.dateTime": { $lte: new Date(end) },
  });
  const [reports, userRooms] = await Promise.all([reportsData, userRoomsData]);
  const meetings = userRooms.length;
  let duration = 0;
  userRooms.forEach((room) => {
    duration += durationCalculator(room.start.dateTime, room.end.dateTime);
  });
  let overallEngagement = 0;
  let overallMood = 0;
  reports.forEach(({ report }) => {
    if (report) {
      overallEngagement += report.averageEngagement;
      overallMood += report.averageMood;
    }
  });
  let overallAverageEngagement = overallEngagement / reports.length;
  let overallAverageMood = overallMood / reports.length;
  res.json({
    code: 200,
    error: false,
    message: "Details fetched for the user",
    data: { meetings, duration, overallAverageEngagement, overallAverageMood },
  });
});
admin.post("/create-payment-intent", stripeController.createPaymentIntent);

admin.get("/userStatus", stripeController.userStatus);

admin.post("/addPaymentMethod", stripeController.paymentMethod);

admin.post("/webhooks", stripeController.handleWebhook);

admin.put("/selectPlan", userController.selectPlan);

admin.post("/getRecordings", roomController.getAdminRecordings);

admin.get("/getPlan", planController.getPlan);

admin.get("/getAllPlans", planController.getAllPlans);

admin.post("/createPlan", planController.createPlan);

admin.put("/updatePlan", planController.updatePlan);

admin.delete("/deletePlan", planController.deletePlan);

admin.put("/assignPlan", planController.assignPlan);

admin.put("/updateMeetingHours", planGroupsController.updateMeetingHours);

admin.put("/updateSetting", userController.userSettings);

admin.get("/getPlanGroupDetails", planGroupsController.getPlanGroupDetails);

const durationCalculator = (start, end) => {
  return (new Date(end) - new Date(start)) / 1000;
};

module.exports = admin;

const PlanGroup = require("../models/planGroups.model");

exports.getPlanGroupDetails = async (req, res) => {
  const { uid } = req.query;
  const planGroup = await PlanGroup.findOne({ uid });
  if (!planGroup) {
    return res.json({
      code: 404,
      error: true,
      message: "Plan group not found",
    });
  }
  res.json({ code: 200, error: false, message: "Plan group found", planGroup });
};

exports.updateMeetingHours = (req, res) => {
  const { user, hours } = req.body;
  if (!user || !hours) {
    return res.json({
      code: 400,
      error: true,
      message: "User and hours are required",
    });
  }
  const log = {
    who: { id: user._id, name: user.name, email: user.email },
    hours,
    timestamp: new Date(),
  };
  PlanGroup.findOneAndUpdate(
    { uid: user.plan.groupUid },
    { $inc: { usedHours: hours, leftHours: -hours }, $push: { logs: log } },
    (err) => {
      if (err) {
        return res.json({ code: 400, error: true, message: err.message });
      }
      res.json({
        code: 200,
        error: false,
        message: "Data logged successfully",
      });
    }
  );
};

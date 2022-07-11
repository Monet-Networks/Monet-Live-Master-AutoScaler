const Plans = require("@models/plans.model");
const PlanGroups = require("@models/planGroups.model");
const Users = require("@models/user.model");
const { genToken } = require("@utils/token");
const sendMail = require("@utils/sendMail");

exports.getPlan = async (req, res) => {
  const plan = await Plans.findById(req.query.planId);
  if (!plan) {
    return res.json({ code: 404, error: true, message: "Plan not found" });
  }
  res.json({ code: 200, error: false, message: "Plan found", plan });
};

exports.getAllPlans = async (req, res) => {
  const plans = await Plans.find({});
  if (!plans.length) {
    return res.json({ code: 404, error: false, message: "There are no plans" });
  }
  res.json({ code: 200, error: false, message: "All plans fetched", plans });
};

exports.createPlan = async (req, res) => {
  const plan = await Plans.create(req.body);
  res.json({
    code: 200,
    error: false,
    message: "Plan created successfully",
    plan,
  });
};

exports.updatePlan = async (req, res) => {
  const plan = await Plans.findByIdAndUpdate(req.body.id, req.body, {
    new: true,
  });
  res.json({
    code: 200,
    error: false,
    message: "Plan updated successfully",
    plan,
  });
};

exports.deletePlan = async (req, res) => {
  await Plans.findByIdAndDelete(req.body.id);
  res.json({ code: 200, error: false, message: "Plan deleted successfully" });
};

exports.assignPlan = async (req, res) => {
  const { userEmail, assigneeEmail, planId } = req.body;
  if (!userEmail || !assigneeEmail || !planId) {
    return res.json({
      code: 400,
      error: true,
      message:
        "Please provide valid details userEmail, assigneeEmail and planId is required",
    });
  }
  if (userEmail === assigneeEmail) {
    return res.json({
      code: 400,
      error: true,
      message: "You cannot assign license to yourself",
    });
  }
  const userPromise = Users.find({
    email: { $in: [userEmail, assigneeEmail] },
  });
  const planPromise = Plans.findById(planId);
  const [users, planObj] = await Promise.all([userPromise, planPromise]);
  const [assignor, assignee] = [
    users.find((user) => user.email === userEmail),
    users.find((user) => user.email === assigneeEmail),
  ];
  if (!assignor) {
    return res.json({
      code: 404,
      error: true,
      message: `User not found with email ${userEmail}`,
    });
  }
  if (planObj.name === "Free Tier") {
    return res.json({
      status: 400,
      error: true,
      message: "Free Tier cannot be assigned",
    });
  }
  const userPlan = await Plans.findById(assignor.plan.id);
  if (assignor.plan.type === "assigned") {
    return res.json({
      code: 400,
      error: true,
      message: `You cannot assign licenses because you have not purchased the license and assigned by ${
        assignor.plan.assignedBy || "someone"
      }. First purchase a new license and then try again.`,
    });
  } else if (userPlan.licenseCount <= 1) {
    return res.json({
      code: 400,
      error: true,
      message: `As per your ${assignor.plan.name} plan you do not have any licenses to assign other than yours. Upgrade your license to higher plan to do so`,
    });
  }
  if (assignor.plan.id != planId) {
    return res.json({
      code: 400,
      error: true,
      message: `You can only assign ${assignor.plan.name} plan to other user`,
    });
  }
  if (!planObj) {
    return res.json({
      code: 404,
      error: true,
      message: "Plan you intend to assign is not valid and does not exist",
    });
  }
  if (assignor.plan.assigned >= userPlan.licenseCount - 1) {
    return res.json({
      code: 400,
      error: true,
      message: "You have already assigned all your available licenses",
    });
  }
  if (!assignee) {
    const payload = { planId: planObj.id, userId: assignor.id, assigneeEmail };
    const token = genToken(payload, { expiresIn: "24h" });
    const assigneeObject = {
      email: assigneeEmail,
      token,
      status: "invited",
      expiresAt: new Date(new Date(Date.now()).getTime() + 60 * 60 * 24 * 1000)
        .getTime()
        .toString(),
    };
    assignor.plan.assigned += 1;
    assignor.plan.assignees.push(assigneeObject);
    assignor.save();
    const info = await sendMail(
      "../views/newUserLicense.handlebars",
      assigneeEmail,
      `[Monet Live] You have been invited & assigned ${planObj.name} plan on Monet Live`,
      {
        Name: assignor.name,
        Email: `<${assignor.email}>`,
        Plan: planObj.name,
        Link: `https://www.monetlive.com/auth/authentication?licenseToken=${token}`,
      },
      "anand@monetnetworks.com"
    );
    return res.json({
      code: 200,
      error: false,
      message: "Invitation sent to the user with license assigned",
      user: assignor,
      mailResponse: info,
    });
  }
  if (assignee.plan.type === "purchased") {
    if (assignee.plan.planUid >= assignor.plan.planUid) {
      return res.json({
        code: 400,
        error: true,
        message: `You cannot assign licenses to ${assigneeEmail} because they are already on ${assignee.plan.name} plan`,
      });
    }
  } else if (assignee.plan.type === "assigned") {
    if (assignee.plan.planUid >= assignor.plan.planUid) {
      return res.json({
        code: 400,
        error: true,
        message: `You cannot assign license to ${assigneeEmail} because they have already been assigned ${assignee.plan.name} plan by someone else`,
      });
    }
  }
  if (
    assignor.plan.assignees.some(
      (user) => user.email === assigneeEmail && user.status !== "expired"
    )
  ) {
    return res.json({
      code: 400,
      error: true,
      message: "You have already assigned license to this user",
    });
  }
  const assigneeObject = {
    email: assigneeEmail,
    token: "",
    status: "assigned",
    expiresAt: "",
  };
  assignor.plan.assigned += 1;
  assignor.plan.assignees.push(assigneeObject);
  assignor.save();
  assignee.plan = {
    id: planObj.id,
    name: planObj.name,
    planUid: planObj.planUid,
    groupUid: assignor.plan.groupUid,
    type: "assigned",
    assignedBy: assignor.email,
    licenseCount: 0,
    assigned: 0,
    assignees: [],
    expiresAt: new Date(assignor.plan.expiresAt),
  };
  assignee.settings = {
    waitingRoom: planObj.waitingRoom,
    screenShare: true,
    chat: true,
    limit: planObj.participantCapacity,
  };
  assignee.save();
  const assignedUser = {
    id: assignee.id,
    name: assignee.name,
    email: assignee.email,
  };
  PlanGroups.findOneAndUpdate(
    { uid: assignor.plan.groupUid },
    { $push: { users: assignedUser } },
    (err) => {
      if (err) {
        console.log("Plan Group error assign license", err);
      }
    }
  );
  res.json({
    code: 200,
    error: false,
    message: "License assigned successfully to the user",
    user: assignor,
  });
};

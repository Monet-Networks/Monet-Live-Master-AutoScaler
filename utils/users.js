const PlanGroups = require('@models/planGroups.model');

exports.addRemainingHours = async (user) => {
  if (user.plan && user.plan.groupUid) {
    const planGroup = await PlanGroups.findOne({ uid: user.plan.groupUid });
    if (planGroup) {
      return { ...JSON.parse(JSON.stringify(user)), remainingHours: planGroup.leftHours.toFixed(2) };
    } else return user;
  } else return user;
};

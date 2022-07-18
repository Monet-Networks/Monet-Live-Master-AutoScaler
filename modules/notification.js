const user = require('@models/user.model');
const plangrp = require('@models/planGroups.model');
const notification = require('@models/notification.model');

exports.notify = async function (email, socket) {
  const reportsData = await user.findOne({ email: email }, { plan: 1 }).lean();
  if (reportsData) {
    const usergroup = await plangrp.findOne({ uid: reportsData.plan.groupUid }).lean();

    const expireDate = new Date(reportsData.plan.expiresAt);
    const currentDate = new Date(Date.now());
    const days = Math.round((expireDate.getTime() - currentDate.getTime()) / (1000 * 3600 * 24));
    let data = [];
    if (days < 4 || usergroup.leftHours <= 1) {
      switch (true) {
        case usergroup.leftHours <= 1 && usergroup.leftHours > 0:
          data.push(`Total remaining hours: ${usergroup.leftHours}hr. Please upgrade your plan`);
          break;
        case usergroup.leftHours <= 0:
          data.push(`You consumed your Total ${usergroup.totalHours} hours. Please upgrade your plan`);
          break;
      }
      switch (true) {
        case days < 4 && days > 0:
          data.push(`Your plan will expire in ${days} days. Please upgrade your plan`);
          break;
        case days <= 0:
          data.push(`You plan expired. Please upgrade your plan`);
      }
      const message = await Promise.all(data);

      const checkNotifications = await notification.find({ email: email, read: false }).lean();

      if (!checkNotifications.length) {
        await notification.create({
          email: email,
          message: message,
        });
      }
      const checkNotificationsDb = await notification
        .find({ email: email, read: false }, { message: 1, _id: 0, read: 1 })
        .lean();
      socket.emit('message', checkNotificationsDb);
    } else {
      socket.emit('message', 'no message');
    }
  }
};

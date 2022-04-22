// Load required packages
const UserModel = require('@models/user.model.js');
const PlansModel = require('@models/plans.model');
const PlanGroups = require('@models/planGroups.model');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const avatarUpload = require('@utils/avatarUpload.js');
const { OAuth2Client } = require('google-auth-library');
const { ErrorHandler } = require('@utils/eventHandlers');
const axios = require('axios');
const { authenticate, generateToken } = require('@utils/auth');
const sendMail = require('@utils/sendMail.js');
const { verifyToken, decodeToken } = require('@utils/token');

const addRemainingHours = async (user) => {
  if (user.plan && user.plan.groupUid) {
    const planGroup = await PlanGroups.findOne({ uid: user.plan.groupUid });
    if (planGroup) {
      // user = { ...JSON.parse(JSON.stringify(user)), remainingHours: planGroup.leftHours.toFixed(2) };
      user.remainingHours = planGroup.leftHours.toFixed(2)
    }
  }
};

exports.registerUser = async (req, res) => {
  if (!req.body.ID || !req.body.name || !req.body.email || !req.body.password) {
    return res.status(412).json({
      code: 401,
      error: true,
      message: 'Please provide valid parameters.',
      response: 'error',
    });
  }
  const { ID, name, email, password } = req.body;
  if (password.length > 8 && password.length < 25) {
    let user;
    const hashedPassword = await bcrypt.hash(password, 10);
    if (await checkExistence(email)) {
      user = await UserModel.findOneAndUpdate({ email }, { password: hashedPassword }, { new: true });
    } else {
      user = await UserModel.create({ ID, name, email, password: hashedPassword });
    }
    user.token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRE,
    });
    user.save();
    return res.json({
      code: 200,
      error: false,
      message: 'User Registered Successfully.',
      user,
    });
  } else {
    return res
      .status(400)
      .json({ code: 400, error: true, message: 'Password length must be between 8 and 16 characters.' });
  }
};

exports.registerInvitedUser = async (req, res) => {
  const { context, licenseToken } = req.body;
  if (!context || !licenseToken) {
    return res.status(412).json({
      code: 401,
      error: true,
      message: 'Please provide valid parameters.',
      response: 'error',
    });
  }
  const payload = await verifyToken(licenseToken);
  if (!payload) {
    const decodedPayload = await decodeToken(licenseToken, { json: true });
    const { userId, assigneeEmail } = decodedPayload;
    if (userId && assigneeEmail) {
      const assignor = await UserModel.findById(userId);
      if (assignor) {
        assignor.plan.assignees.forEach((user, index) => {
          if (user.email === assigneeEmail && user.status !== 'expired') {
            assignor.plan.assigned -= 1;
            assignor.plan.assignees.splice(index, 1);
          }
        });
        assignor.save();
      }
    }
    return res.json({ code: 401, error: true, message: 'Invalid token or token expired' });
  }
  const { planId, userId, assigneeEmail } = payload;
  const [planPromise, assignorPromise] = [PlansModel.findById(planId), UserModel.findById(userId)];
  const [plan, assignor] = await Promise.all([planPromise, assignorPromise]);
  const userDetails = {
    plan: {
      id: plan.id,
      name: plan.name,
      planUid: plan.planUid,
      groupUid: assignor.plan.groupUid,
      type: 'assigned',
      assignedBy: assignor.email,
      licenseCount: 0,
      assigned: 0,
      assignees: [],
      expiresAt: new Date(assignor.plan.expiresAt),
    },
    settings: {
      waitingRoom: plan.waitingRoom,
      screenShare: true,
      chat: true,
      limit: plan.participantCapacity,
    },
  };
  let user;
  switch (context) {
    case 'monet':
      const { ID, name, email, password } = req.body;
      if (!ID || !name || !email || !password || !licenseToken) {
        return res.status(412).json({
          code: 401,
          error: true,
          message: 'Please provide valid parameters.',
          response: 'error',
        });
      }
      if (email !== assigneeEmail) {
        return res.json({ code: 401, error: true, message: `This license is assigned to ${assigneeEmail}` });
      }
      if (password.length > 8 && password.length < 25) {
        const newUser = { ID, name, email, ...userDetails };
        newUser.password = await bcrypt.hash(password, 10);
        user = await UserModel.create(newUser);
        user.token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
          expiresIn: process.env.JWT_EXPIRE,
        });
        break;
      } else {
        return res
          .status(400)
          .json({ code: 400, error: true, message: 'Password length must be between 8 and 16 characters.' });
      }
    case 'google':
      user = await google(req, res, assigneeEmail, userDetails);
      break;
    case 'microsoft':
      user = await microsoft(req, res, assigneeEmail, userDetails);
      break;
    default:
      return res.json({ code: 400, error: true, message: 'Invalid request' });
  }
  const assignedUser = [{ id: user.id, name: user.name, email: user.email }];
  PlanGroups.findOneAndUpdate({ uuid: assignor.plan.groupUid }, { $push: { users: assignedUser } });
  assignor.plan.assignees.forEach((user) => {
    if (user.email === assigneeEmail) {
      user.status = 'assigned';
    }
  });
  assignor.save();
  addRemainingHours(user);
  return res.json({
    code: 200,
    error: false,
    message: 'User Registered Successfully.',
    user,
  });
};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  let existingUser = await UserModel.findOne({ email });
  if (!existingUser)
    return res.json({
      code: 401,
      error: true,
      message: 'The user has not been registered. Please register.',
      response: 'error',
    });
  if (!existingUser.password)
    return res.json({
      code: 204,
      error: true,
      message: 'The user has not been registered via Monet. Please register.',
      response: 'no password in DB',
    });
  const passCheck = await bcrypt.compare(password, existingUser.password);
  if (!passCheck)
    return res.json({
      code: 401,
      error: true,
      message: "The email or password doesn't match.",
      response: 'error',
    });
  existingUser.token = jwt.sign({ id: existingUser._id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE,
  });
  if (existingUser.plan.expiresAt && new Date(existingUser.plan.expiresAt) >= Date.now()) {
    existingUser.plan.type = 'expired';
  }
  existingUser.plan.assignees.forEach((user) => {
    if (user.expiresAt && new Date(user.expiresAt) <= Date.now()) {
      user.status = 'expired';
      existingUser.plan.assigned -= 1;
    }
  });
  existingUser.save();
  addRemainingHours(existingUser);
  return res.json({
    code: 200,
    error: false,
    message: 'User Login Successful.',
    user: existingUser,
  });
};

exports.forgetPassword = async (req, res) => {
  const { email } = req.body;
  const user = await UserModel.findOne({ email });
  if (user) {
    const resetPasswordToken = jwt.sign({ userID: user._id }, process.env.PASSWORD_RESET_TOKEN, { expiresIn: '10m' });
    await UserModel.findByIdAndUpdate(user._id, { resetPasswordToken });
    const info = await sendMail('../views/resetPassword.handlebars', email, '[Monet Live] Account password reset', {
      Name: user.name,
      Link: `https://www.monetlive.com/auth/authentication?token=${resetPasswordToken}`,
    });
    res.json({
      code: 200,
      error: false,
      message: 'Password Reset link is sent on your mail. Please check and follow further process.',
      response: info.response,
    });
  } else {
    res.status(404).json({ code: 404, error: true, message: 'You are not registered' });
  }
};

exports.resetPassword = (req, res) => {
  jwt.verify(req.params.token, process.env.PASSWORD_RESET_TOKEN, async (err) => {
    if (err) {
      return res
        .status(401)
        .json({ code: 401, error: true, message: 'Authentication error. Invalid token or token expired' });
    }
    const user = await UserModel.findOne({
      resetPasswordToken: req.params.token,
    });
    if (user) {
      const { newPassword, confirmNewPassword } = req.body;
      if (newPassword === confirmNewPassword) {
        const passCheck = await bcrypt.compare(newPassword, user.password);
        if (passCheck) {
          return res
            .status(400)
            .json({ code: 400, error: true, message: 'You can not use old password as your new password.' });
        }
        if (newPassword.length > 8 && newPassword.length < 16) {
          user.password = await bcrypt.hash(newPassword, 10);
          user.resetPasswordToken = '';
          await user.save();
          res.json({ code: 200, error: false, message: 'Password reset successful' });
        } else {
          res
            .status(400)
            .json({ code: 400, error: true, message: 'Password length must be between 8 and 16 characters.' });
        }
      } else {
        res
          .status(400)
          .json({ code: 400, error: true, message: 'New password and confirm new password does not match' });
      }
    } else {
      res.status(404).json({ code: 404, error: true, message: 'No user found with this token' });
    }
  });
};

exports.user_list = (req, res) => {
  const { id } = req.query;
  UserModel.findOne({ roomid: id, proctor: 'teacher' }).then((teacher) => {
    if (!teacher) {
      return res.json({
        code: 200,
        error: false,
        message: 'The moderator has not joined.',
        response: [],
      });
    }
    UserModel.find({ roomid: id }).then((users) => {
      if (!users) {
        return res.json({
          code: 404,
          error: true,
          message: 'No users in the room',
          response: 'error',
        });
      }
      const responses = [];
      const info = {
        id: req.query.id,
        students: [],
      };
      for (let s of users) {
        let examData = {
          active: s.active,
          std_id: s.uuid,
          roomid: s.roomid,
          name: s.name,
          proctor: s.proctor,
          raiseHand: s.janus.raiseHand,
          webcam: s.janus.webcam,
          screen: s.janus.screen,
          audio: s.janus.audio,
          video: s.janus.video,
          time: s.time,
          serverIP: s.serverIP,
        };
        info.students.push(examData);
      }
      responses.push(info);
      if (responses.length !== 0)
        res.json({
          code: 200,
          error: false,
          message: 'user list',
          response: info.students,
        });
      else console.log('There is no student detail in the array');
    });
  });
};

exports.saveUsers = async (Object) => {
  // noinspection UnnecessaryLocalVariableJS
  const User = await UserModel.create(Object);
  return User;
};

exports.checkUser = async function (info) {
  let { uuid } = info;
  let user = await UserModel.findOneAndUpdate({ uuid }, { active: true }, function (error) {
    if (error) {
      console.log('checkUser Error : ', error);
    }
  });
  if (user) {
    return new Promise((resolve) => {
      resolve(!!Object.keys(user).length);
    });
  } else {
    return new Promise((resolve) => {
      resolve(false);
    });
  }
};

exports.getUsersByRoom = function (data) {
  // return Userss.find({$and:[
  //   { roomid: data.roomid },
  //   { active : true },
  // ]});
  return UserModel.find({ roomid: data.roomid });
};

exports.setSocket = async function ({ uuid, sid }) {
  await UserModel.updateOne({ uuid }, { sid }, function (err) {
    if (err) {
      console.error('setSocket error : ', err);
    }
  });
};

exports.updateUser = async (req, res) => {
  try {
    await avatarUpload(req, res);
    if (req.file) {
      req.body.avatar = 'https://www.monetlive.com/data/avatars/' + req.file.filename;
    }
    let { ID } = req.body;
    let user = await UserModel.findOneAndUpdate({ ID }, req.body, { new: true });
    if (user) {
      addRemainingHours(user);
      res.json({ code: 200, error: false, message: 'User details updated', data: user });
    } else if (!user) {
      res.json({ code: 404, error: true, message: 'User not found' });
    }
  } catch (error) {
    console.error(`user controller update user error : ${error}`);
  }
};

exports.userSettings = async (req, res) => {
  const { creator_ID: email, settings } = req.body;
  const { waitingRoom, limit } = settings;
  const user = await UserModel.findOne({ email });
  if (!user) {
    return res.json({ code: 404, error: true, message: 'User not found' });
  }
  const userPlan = await PlansModel.findById(user.plan.id);
  if (user.plan.uid === 1 && waitingRoom) {
    return res.json({ code: 400, error: true, message: 'Your plan does not provide waiting room feature', user });
  }
  if (limit > userPlan.participantCapacity) {
    return res.json({
      code: 400,
      error: true,
      message: "Participant limit cannot exceed your plan's specified limit",
      user,
    });
  }
  user.settings = settings;
  user.save();
  res.json({ code: 200, error: false, message: 'User settings Updated', user });
};

exports.updateOne = async (uuid, value) => {
  // noinspection UnnecessaryLocalVariableJS
  const updatedUser = await UserModel.findOneAndUpdate({ uuid }, value, { new: true });
  return updatedUser;
};

exports.updateRole = async (req, res) => {
  const { email, userType } = req.body;
  UserModel.findOneAndUpdate({ email }, { userType }, { new: true }, (err, doc) => {
    if (err)
      return res.json({
        code: 400,
        error: true,
        message: 'error updating user',
        response: err,
      });
    return res.json({
      code: 200,
      error: false,
      message: 'role updated',
      user: doc,
    });
  });
};

exports.getUsers = async function (response) {
  // noinspection UnnecessaryLocalVariableJS
  const userssResult = await UserModel.find({ uuid: response.uuid });
  return userssResult;
};

exports.getUser = async (response) => {
  // noinspection UnnecessaryLocalVariableJS
  let result = await UserModel.findOne({ uuid: response.uuid });
  return result;
};

exports.isEmpty = async (roomId) => {
  const count = await UserModel.where({ roomid: roomId }).countDocuments();
  // noinspection JSIncompatibleTypesComparison
  return count === 0;
};

exports.isActive = async (roomId) => {
  const count = await UserModel.where({ roomid: roomId }).where({ active: true }).countDocuments();
  // noinspection JSIncompatibleTypesComparison
  return count === 0;
};

exports.getUsersBySid = async function (data) {
  let user = await UserModel.findOne({ sid: data.sid });
  if (user) {
    return user;
  } else {
    return 'n/a';
  }
};

exports.getUsersbyany = async function (req) {
  // noinspection UnnecessaryLocalVariableJS
  const userssResult = await UserModel.find(req);
  return userssResult;
};

exports.userdelete = function (req, res) {
  console.log('delete model'); // + req
  UserModel.deleteMany(req, function (err) {
    if (err)
      return res.json({
        code: 400,
        error: true,
        response: err,
      });
    // deleted at most one tank document
  });
};

exports.useraggregate = async function () {
  const aggregatorOpts = [
    {
      $group: {
        _id: '$roomid',
        count: { $sum: 1 },
      },
    },
  ];

  // noinspection UnnecessaryLocalVariableJS
  const users = await UserModel.aggregate(aggregatorOpts);

  return users;
};

exports.active = async (data) => {
  let { uuid, flag } = data;
  const doc = await UserModel.findOneAndUpdate({ uuid });
  if (doc) {
    doc.active = flag;
    await doc.save();
    return true;
  } else {
    console.error("Couldn't set property active of undefined, please look into this.");
    return false;
  }
};

exports.liveUsers = function (roomid) {
  return UserModel.find({ roomid, active: true });
};

const google = async (req, res, assigneeEmail = '', additionalFields = {}) => {
  if (!req.body.token) return new ErrorHandler(res, 'No token provided.');
  const { token } = req.body;
  const client = new OAuth2Client({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  });
  const ticket = await client.verifyIdToken({
    idToken: token,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  const {
    name,
    email,
    picture = `https://ui-avatars.com/api/?name=${name.replace(' ', '+')}&size=160&background=random&bold=true`,
    sub,
  } = ticket.getPayload();
  if (assigneeEmail && email !== assigneeEmail) {
    return res.json({ code: 401, error: true, message: `This license is assigned to ${assigneeEmail}` });
  }
  const isUser = await checkExistence(email);
  let user;
  if (isUser) {
    user = await UserModel.findOneAndUpdate(
      { email },
      { avatar: isUser.avatar ? isUser.avatar : picture, ID: sub, source: 'google', ...additionalFields },
      { upsert: true, new: true }
    ).lean();
  } else {
    user = await UserModel.create({ email, name, avatar: picture, ID: sub, source: 'google', ...additionalFields });
  }
  if (!(await authenticate(user.token))) {
    const token = generateToken(user._id);
    await UserModel.findByIdAndUpdate(user._id, { token });
    user.token = token;
  }
  return user;
};

/* Google's Authentication Controller */
exports.googleAuth = async (req, res) => {
  let user = await google(req, res);
  addRemainingHours(user);
  res.json({
    error: false,
    message: 'Authentication successful',
    user,
  });
};

const microsoft = async (req, res, assigneeEmail = '', additionalFields = {}) => {
  if (!req.body.token) return new ErrorHandler(res, 'No token provided.');
  const { token } = req.body;
  const response = await axios.get('https://graph.microsoft.com/v1.0/me', {
    headers: { Authorization: 'Bearer ' + token },
  });
  const {
    id: microsoftId,
    displayName: name,
    userPrincipalName: email,
    avatar = `https://ui-avatars.com/api/?name=${name.replace(' ', '+')}&size=160&background=random&bold=true`,
  } = response.data;
  if (assigneeEmail && email !== assigneeEmail) {
    return res.json({ code: 401, error: true, message: `This license is assigned to ${assigneeEmail}` });
  }
  const isUser = await checkExistence(email);
  let user;
  if (isUser) {
    user = await UserModel.findOneAndUpdate(
      { email },
      {
        ID: microsoftId,
        name,
        email,
        avatar: isUser.avatar ? isUser.avatar : avatar,
        source: 'microsoft',
        ...additionalFields,
      },
      { upsert: true, new: true }
    ).lean();
  } else {
    user = await UserModel.create({ email, name, avatar, ID: microsoftId, source: 'microsoft', ...additionalFields });
  }
  if (!(await authenticate(user.token))) {
    const token = generateToken(user._id);
    await UserModel.findByIdAndUpdate(user._id, { token });
    user.token = token;
  }
  return user;
};

/* Microsoft's Authentication Controller */
exports.microsoftAuth = async (req, res) => {
  let user = await microsoft(req, res);
  addRemainingHours(user);
  res.json({
    error: false,
    message: 'Authentication successful',
    user,
  });
};

exports.selectPlan = async (req, res) => {
  const plan = await PlansModel.findById(req.body.planId);
  if (!plan) {
    return res.json({ code: 400, error: true, message: 'Plan not found' });
  }
  const user = await UserModel.findByIdAndUpdate(
    req.body.userId,
    { plan: { id: req.body.planId, name: plan.name } },
    { new: true }
  );
  if (!user) {
    return res.json({ code: 404, error: true, message: 'User not found' });
  }
  res.json({ code: 200, error: false, message: 'User plan updated successfully', user });
};

const checkExistence = async (email) => {
  const user = await UserModel.findOne({ email });
  if (!user) {
    return false;
  }
  return user;
};

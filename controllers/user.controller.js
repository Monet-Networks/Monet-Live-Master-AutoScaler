const { OAuth2Client } = require('google-auth-library');
const ErrorHandler = require('../util/ErrorHandler');
const SuccessHandler = require('../util/SuccessHandler');
const UserModel = require('../models/user.model');
const { authenticate, generateToken } = require('../util/auth');

/* Google's Authentication Controller */
exports.googleAuth = async (req, res) => {
  console.log('>>>>>>>>>> Google request body : ', req);
  if (!req.body) return new ErrorHandler(res, 'No body provided.', req.body);
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
    hd,
  } = ticket.getPayload();
  const allowedDomains = ['monetnetworks.com', 'ashmar.in'];
  if (allowedDomains.findIndex((domain) => domain === hd) === -1) {
    return res.json({
      error: true,
      status: 401,
      message: 'This domain is not allowed. Only @ashmar.in and @monetnetworks.com are allowed to sign in with google.',
    });
  }
  await checkExistence(email, sub, name);
  const user = await UserModel.findOneAndUpdate({ email }, { avatar: picture, googleId: sub }, { new: true }).lean();
  if (!(await authenticate(user.token))) {
    const token = generateToken(user._id);
    await UserModel.findByIdAndUpdate(user._id, { token });
    user.token = token;
  }
  // return new SuccessHandler(res, 200, 'Authentication successful', user);
  return res.json({
    error: false,
    message: 'Authentication successful',
    user,
  });
};

/* Microsoft's Authentication Controller */
exports.microsoftAuth = async (req, res) => {
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
  await checkExistence(email, microsoftId, name);
  const user = await UserModel.findOneAndUpdate(
    { email },
    {
      ID: microsoftId,
      name,
      email,
      avatar,
    },
    { new: true, upsert: true }
  ).lean();

  if (!(await authenticate(user.token))) {
    const token = generateToken(user._id);
    await UserModel.findByIdAndUpdate(user._id, { token });
    user.token = token;
  }

  res.json({
    error: false,
    message: 'Authentication successful',
    user,
  });
};

/* Monet's Authentication Controller */
exports.login = async (req, res) => {
  const { email, password } = req.body;
  const existingUser = await UserModel.findOne({ email }).lean();
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
  return res.json({
    code: 200,
    error: false,
    message: 'User Login Successful.',
    user: existingUser,
  });
};

/* Forget password controller */
exports.forgetPassword = async (req, res) => {
  const { email } = req.body;
  const user = await UserModel.findOne({ email });
  if (user) {
    const resetPasswordToken = jwt.sign({ userID: user._id }, process.env.PASSWORD_RESET_TOKEN, { expiresIn: '10m' });
    await UserModel.findByIdAndUpdate(user._id, { resetPasswordToken });
    const info = await sendMail('../views/resetPassword.handlebars', email, '[Monet Live] Account password reset', {
      Name: user.name,
      Link: `https://www.monetlive.com/#/auth/authentication?token=${resetPasswordToken}`,
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

/* Reset password controller */
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

/* Checks whether a user exists and creates one if not */
const checkExistence = async (email, ID, name) => {
  const user = await UserModel.findOne({ email });
  if (!user) {
    await UserModel.create({ ID, name, email });
    return false;
  }
  return true;
};

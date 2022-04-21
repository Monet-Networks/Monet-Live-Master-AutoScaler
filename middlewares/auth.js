const { verifyToken } = require('@utils/token');

exports.isLoggedIn = async (req, res, next) => {
  if (req.url.includes('/auth') || req.url.includes('/engine')) return next();
  const token = req.headers.authorization ? req.headers.authorization.split(' ')[1] : null;
  if (!token) {
    return res.status(400).json({ code: 400, error: true, message: 'Token not provided' });
  }
  const decoded = await verifyToken(token);
  if (!decoded) {
    return res.status(403).json({ code: 403, error: true, message: 'Invalid token' });
  }
  const user = await UserModel.findById(decoded.id).lean();
  if (!user) {
    return res
      .status(403)
      .json({ code: 403, error: true, message: 'You are not authorized please login/register to proceed' });
  }
  req.user = user;
  next();
};

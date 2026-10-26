const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'bunkwell_prod_jwt_secret_key_2024';

module.exports = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token provided' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    if (decoded.role === 'admin') {
      req.user = {
        _id: '000000000000000000000001',
        username: decoded.username || 'adwaith.admin',
        name: decoded.name || 'Adwaith Sudheer (Master Admin)',
        role: 'admin',
        toSafeObject: () => ({
          _id: '000000000000000000000001',
          username: decoded.username || 'adwaith.admin',
          name: decoded.name || 'Adwaith Sudheer (Master Admin)',
          role: 'admin'
        })
      };
      req.isAdmin = true;
      return next();
    }

    const user = await User.findById(decoded.userId);
    if (!user) return res.status(401).json({ message: 'User not found' });
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

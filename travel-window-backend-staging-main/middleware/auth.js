const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    console.log({
      path: req.originalUrl,
      query: req.query,
      hasAuthorizationHeader: Boolean(req.header('Authorization')),
      userAgent: req.header('user-agent')
    });
    
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'No token, authorization denied' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key_here');
    const user = await User.findById(decoded.userId).select('-password');
    
    console.log({
      decodedUserId: decoded.userId,
      userExists: Boolean(user),
      isUserActive: Boolean(user && user.isActive)
    });
    
    if (!user || !user.isActive) {
      console.log('JWT Verification Failed: user not found or inactive');
      return res.status(401).json({ message: 'Token is not valid' });
    }
    
    req.user = user;
    next();
  } catch (error) {
    console.log('JWT Verification Failed:', error.name, error.message);
    res.status(401).json({ message: 'Token is not valid' });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied. Insufficient permissions.' });
    }
    
    next();
  };
};

module.exports = { auth, authorize };

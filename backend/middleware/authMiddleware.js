const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer')) {
      return res.status(401).json({ message: 'Not authorized, no token' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }
    if (!user.isActive) {
      return res.status(403).json({ message: 'Account deactivated' });
    }

    req.user = user;
    return next();   // ← return added: prevents double-execution bug
  } catch (error) {
    return res.status(401).json({ message: 'Not authorized, token failed' });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user && (req.user.role === 'admin' || req.user.role === 'super_admin')) {
    return next();
  }
  return res.status(403).json({ message: 'Access denied: Admins only' });
};

const superAdminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'super_admin') {
    return next();
  }
  return res.status(403).json({ message: 'Access denied: Super Admins only' });
};

// Staff, admin, or super_admin — i.e. anyone except a self-registered
// 'customer' account. Used on shop-internal routes (sale/customer records)
// that a customer should never be able to list or browse.
const staffOnly = (req, res, next) => {
  if (req.user && req.user.role !== 'customer') {
    return next();
  }
  return res.status(403).json({ message: 'Access denied: Staff only' });
};

const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer')) {
      return next(); // Proceed without auth
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');

    if (user && user.isActive) {
      req.user = user;
    }
  } catch (error) {
    // Ignore error and proceed without user
  }
  return next();
};

// Socket.IO connection middleware — mirrors optionalAuth above: attaches
// socket.user when a valid token is present, but never rejects the
// connection outright. The public storefront listens for stock_updated
// while fully anonymous, so the connection itself has to stay open; role-
// sensitive events (e.g. new_web_order) are instead scoped to a 'staff'
// room based on socket.user, rather than gating the handshake.
const socketAuth = async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');
      if (user && user.isActive) {
        socket.user = user;
      }
    }
  } catch (error) {
    // Ignore an invalid/expired token and proceed as anonymous, same as optionalAuth
  }
  return next();
};

module.exports = { protect, adminOnly, superAdminOnly, staffOnly, optionalAuth, socketAuth };

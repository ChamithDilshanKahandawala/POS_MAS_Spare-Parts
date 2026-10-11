const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const User   = require('../models/User');
const { OAuth2Client } = require('google-auth-library');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID || 'dummy-client-id');

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });

// POST /api/auth/register
const register = async (req, res) => {
  try {
    const { name, email, password, shop, role } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: 'All fields required' });

    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) return res.status(400).json({ message: 'Email already registered' });

    const hashed = await bcrypt.hash(password, 10);
    const userRole = role === 'customer' ? 'customer' : 'staff';
    const user = await User.create({
      name,
      email,
      password: hashed,
      role:     userRole,
      shop:     shop || 'Main Branch',
    });

    if (userRole === 'customer') {
      const token = generateToken(user._id);
      res.status(201).json({
        message: 'Registration successful!',
        token,
        user: { _id: user._id, name: user.name, email: user.email, role: user.role }
      });
    } else {
      res.status(201).json({
        message: 'Registration submitted! Waiting for admin approval.',
        status:  'pending',
      });
    }
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// POST /api/auth/login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: email?.toLowerCase() });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    // --- 🔐 NEW SECURITY LOGIC ---
    // User admin nemei nam vitharak me status check karanna
    if (user.role !== 'admin' && user.role !== 'super_admin') {
      const statusClean = user.status?.trim(); // Space thibbath trim karanawa safety ekata

      if (statusClean === 'pending') {
        return res.status(403).json({ message: 'Account pending admin approval. Please wait.' });
      }
      if (statusClean === 'rejected') {
        return res.status(403).json({ message: 'Account rejected. Contact admin.' });
      }
      if (!user.isActive) {
        return res.status(403).json({ message: 'Account deactivated.' });
      }
    }
    // Admin nam kelinma check eka pass wenawa
    // ----------------------------

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ message: 'Invalid credentials' });

    res.json({
      _id:    user._id,
      name:   user.name,
      email:  user.email,
      role:   user.role,
      status: user.status,
      shop:   user.shop,
      token:  generateToken(user._id),
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// POST /api/auth/google
const googleLogin = async (req, res) => {
  try {
    const { token } = req.body;
    const clientIdConfigured = !!process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_ID !== 'dummy-client-id';
    let payload;

    if (clientIdConfigured) {
      // Real client ID present — always verify the signature and audience
      // with Google, in every environment, and require a verified email.
      const ticket = await googleClient.verifyIdToken({
          idToken: token,
          audience: process.env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
      if (!payload || payload.email_verified !== true) {
        return res.status(400).json({ message: 'Invalid Google Token' });
      }
    } else if (process.env.NODE_ENV === 'development') {
      // No client ID configured, but we're explicitly in local dev — decode
      // without verifying the signature, for testing without real Google
      // credentials. Gated on the literal string 'development' (not just
      // "not production") so an unset/misconfigured NODE_ENV anywhere else
      // can't fall through to this branch.
      payload = jwt.decode(token);
    } else {
      // No client ID and not known-safe local dev — refuse outright rather
      // than trust an unverified token. Previously this silently decoded
      // any caller-supplied token with no signature check, so anyone could
      // forge one with an existing user's email (including an admin's) and
      // receive a valid session for that account.
      return res.status(503).json({ message: 'Google sign-in not configured' });
    }

    if (!payload || !payload.email) return res.status(400).json({ message: 'Invalid Google Token' });

    const { email, name } = payload;
    let user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      const randomPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8);
      const hashed = await bcrypt.hash(randomPassword, 10);
      user = await User.create({
        name,
        email: email.toLowerCase(),
        password: hashed,
        role: 'customer',
        status: 'active',
      });
    }

    // Google sign-in is customer-only, unconditionally — staff/admin/
    // super_admin must always use email+password, even for an account that
    // already exists under this email. Without this, a forged (or a real,
    // differently-owned) Google token for an admin's email address could
    // log into the POS as that admin.
    if (user.role !== 'customer') {
      return res.status(403).json({ message: 'Staff/Admin accounts must sign in with email and password.' });
    }

    const statusClean = user.status?.trim();
    if (statusClean === 'pending') {
      return res.status(403).json({ message: 'Account pending admin approval. Please wait.' });
    }
    if (statusClean === 'rejected') {
      return res.status(403).json({ message: 'Account rejected. Contact admin.' });
    }
    if (!user.isActive) {
      return res.status(403).json({ message: 'Account deactivated.' });
    }

    res.json({
      _id:    user._id,
      name:   user.name,
      email:  user.email,
      role:   user.role,
      status: user.status,
      shop:   user.shop,
      token:  generateToken(user._id),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getMe = async (req, res) => { res.json(req.user); };

module.exports = { register, login, googleLogin, getMe };
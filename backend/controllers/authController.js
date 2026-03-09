const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const User   = require('../models/User');

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });

// POST /api/auth/register
const register = async (req, res) => {
  try {
    const { name, email, password, shop } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: 'All fields required' });

    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) return res.status(400).json({ message: 'Email already registered' });

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email,
      password: hashed,
      role:     'staff',
      status:   'pending',
      isActive: false,
      shop:     shop || 'Main Branch',
    });

    res.status(201).json({
      message: 'Registration submitted! Waiting for admin approval.',
      status:  'pending',
    });
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
    if (user.role !== 'admin') {
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

const getMe = async (req, res) => { res.json(req.user); };

module.exports = { register, login, getMe };
const User    = require('../models/User');
const bcrypt  = require('bcryptjs');

// GET /api/users  — list all users (admin only)
const getUsers = async (req, res) => {
  try {
    const users = await User.find({ role: { $ne: 'customer' } }, '-password').sort({ createdAt: -1 });
    res.json({ users, total: users.length });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// GET /api/users/customers — list only e-commerce customers
const getEcommerceCustomers = async (req, res) => {
  try {
    const users = await User.find({ role: 'customer' }, '-password').sort({ createdAt: -1 });
    res.json({ users, total: users.length });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// PUT /api/users/:id/approve  — Approve pending user
const approveUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { status: 'active', isActive: true },
      { new: true, select: '-password' }
    );
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ message: `${user.name} approved!`, user });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// PUT /api/users/:id/reject  — Reject pending user
const rejectUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { status: 'rejected', isActive: false },
      { new: true, select: '-password' }
    );
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ message: `${user.name} rejected`, user });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// PUT /api/users/:id/promote  — Toggle admin/staff role
const promoteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    // Prevent self-demotion
    if (user._id.toString() === req.user._id.toString())
      return res.status(400).json({ message: 'Cannot change your own role' });

    user.role = user.role === 'admin' ? 'staff' : 'admin';
    await user.save();
    res.json({ message: `${user.name} is now ${user.role}`, user: { ...user._doc, password: undefined } });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// PUT /api/users/:id/toggle  — Activate / Deactivate account
const toggleUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'Not found' });
    if (user._id.toString() === req.user._id.toString())
      return res.status(400).json({ message: 'Cannot deactivate your own account' });

    user.isActive = !user.isActive;
    user.status   = user.isActive ? 'active' : 'rejected';
    await user.save();
    res.json({ message: `Account ${user.isActive ? 'activated' : 'deactivated'}`, user });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// DELETE /api/users/:id
const deleteUser = async (req, res) => {
  try {
    if (req.params.id === req.user._id.toString())
      return res.status(400).json({ message: 'Cannot delete your own account' });
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

module.exports = { getUsers, getEcommerceCustomers, approveUser, rejectUser, promoteUser, toggleUser, deleteUser };

const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
require('dotenv').config();
mongoose.connect(process.env.MONGO_URI).then(async () => {
  const User = require('./models/User');
  const user = await User.findOne({ role: 'admin' }) || await User.findOne({ role: 'super_admin' });
  if (!user) { console.log('No admin found'); process.exit(1); }
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
  console.log(token);
  process.exit(0);
});

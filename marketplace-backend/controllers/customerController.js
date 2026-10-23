// Milestone 5 Part C — self-service account management for ANY
// authenticated User (there's no separate Customer collection — see
// models/User.js). Every route here is scoped to req.user._id alone;
// nothing ever takes a user id from the client, so one account can never
// read or change another's profile/addresses/vehicles.
const User = require('../models/User');

const MAX_ADDRESSES = 10;

// GET /api/customer/profile
const getProfile = async (req, res) => {
  const user = await User.findById(req.user._id).select('name email phone preferredLanguage').lean();
  res.json({ profile: user });
};

// PATCH /api/customer/profile
const updateProfile = async (req, res) => {
  const { name, phone, preferredLanguage } = req.body;
  const user = await User.findById(req.user._id);

  if (name !== undefined) user.name = name;
  if (phone !== undefined) user.phone = phone;
  if (preferredLanguage !== undefined) user.preferredLanguage = preferredLanguage;
  await user.save();

  res.json({ profile: { name: user.name, email: user.email, phone: user.phone, preferredLanguage: user.preferredLanguage } });
};

// GET /api/customer/addresses
const listAddresses = async (req, res) => {
  const user = await User.findById(req.user._id).select('addresses').lean();
  res.json({ addresses: user.addresses });
};

// Clears isDefault on every OTHER address when one is being set as the
// new default — at most one address is ever the default at a time.
function applyDefault(user, addressId) {
  for (const addr of user.addresses) {
    addr.isDefault = String(addr._id) === String(addressId);
  }
}

// POST /api/customer/addresses
const createAddress = async (req, res) => {
  const user = await User.findById(req.user._id);
  if (user.addresses.length >= MAX_ADDRESSES) {
    return res.status(400).json({ message: `You can save at most ${MAX_ADDRESSES} addresses` });
  }

  user.addresses.push(req.body);
  const created = user.addresses[user.addresses.length - 1];
  // The very first address, or one explicitly marked default, becomes
  // THE default — never leaves a customer with zero default addresses
  // once they've added at least one.
  if (req.body.isDefault || user.addresses.length === 1) applyDefault(user, created._id);

  await user.save();
  res.status(201).json({ addresses: user.addresses });
};

// PATCH /api/customer/addresses/:addressId
const updateAddress = async (req, res) => {
  const user = await User.findById(req.user._id);
  const address = user.addresses.id(req.params.addressId);
  if (!address) return res.status(404).json({ message: 'Address not found' });

  const { label, line1, line2, city, district, landmark, phone, isDefault } = req.body;
  if (label !== undefined) address.label = label;
  if (line1 !== undefined) address.line1 = line1;
  if (line2 !== undefined) address.line2 = line2;
  if (city !== undefined) address.city = city;
  if (district !== undefined) address.district = district;
  if (landmark !== undefined) address.landmark = landmark;
  if (phone !== undefined) address.phone = phone;
  if (isDefault) applyDefault(user, address._id);

  await user.save();
  res.json({ addresses: user.addresses });
};

// DELETE /api/customer/addresses/:addressId
const deleteAddress = async (req, res) => {
  const user = await User.findById(req.user._id);
  const address = user.addresses.id(req.params.addressId);
  if (!address) return res.status(404).json({ message: 'Address not found' });

  const wasDefault = address.isDefault;
  address.deleteOne();
  // If the default address was just removed, the next remaining one
  // (if any) becomes the new default — same "never zero defaults with
  // at least one address" guarantee as createAddress above.
  if (wasDefault && user.addresses.length > 0) applyDefault(user, user.addresses[0]._id);

  await user.save();
  res.json({ addresses: user.addresses });
};

// GET /api/customer/vehicles
const listVehicles = async (req, res) => {
  const user = await User.findById(req.user._id).select('vehicles').populate('vehicles.makeId', 'name type').lean();
  res.json({ vehicles: user.vehicles });
};

// POST /api/customer/vehicles
const createVehicle = async (req, res) => {
  const user = await User.findById(req.user._id);
  user.vehicles.push(req.body);
  await user.save();
  await user.populate('vehicles.makeId', 'name type');
  res.status(201).json({ vehicles: user.vehicles });
};

// DELETE /api/customer/vehicles/:vehicleId
const deleteVehicle = async (req, res) => {
  const user = await User.findById(req.user._id);
  const vehicle = user.vehicles.id(req.params.vehicleId);
  if (!vehicle) return res.status(404).json({ message: 'Vehicle not found' });
  vehicle.deleteOne();
  await user.save();
  res.json({ vehicles: user.vehicles });
};

module.exports = {
  getProfile, updateProfile,
  listAddresses, createAddress, updateAddress, deleteAddress,
  listVehicles, createVehicle, deleteVehicle,
};

const express = require('express');
const router = express.Router();

// Middlewares import karaganna
const { protect, adminOnly, superAdminOnly } = require('../middleware/authMiddleware');

// Controllers import karaganna (Oya hadapu userController eka)
const {
  getUsers,
  getEcommerceCustomers,
  approveUser,
  rejectUser,
  promoteUser,
  toggleUser,
  deleteUser
} = require('../controllers/userController');

/**
 * 🔐 Security Layer:
 * Meeta pahalin thiyena hema route ekakatama 'protect' (Login check) 
 * saha 'adminOnly' (Role check) kiyana middlewares deka apply wenna ona.
 */
router.use(protect);
router.use(adminOnly);

// --- Admin Dashboard Routes ---

// 1. Okkoma staff userslawa list karanna
router.get('/', getUsers);

// ecommerce customers list
router.get('/customers', getEcommerceCustomers);

// 2. Pending account ekak approve karanna
router.put('/:id/approve', approveUser);

// 3. Pending account ekak reject karanna
router.put('/:id/reject', rejectUser);

// 4. Role eka (Admin <-> Staff) wenas karanna
router.put('/:id/promote', promoteUser);

// 5. Account ekak deactivate/activate (toggle) karanna
router.put('/:id/toggle', toggleUser);

// 6. Account ekak permanently delete karanna
router.delete('/:id', superAdminOnly, deleteUser);

module.exports = router;
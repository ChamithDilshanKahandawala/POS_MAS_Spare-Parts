# 👑 Super Admin Implementation Guide

To create a **Super Admin** role (the most powerful user who can manage regular admins), we need to update your Backend verification rules and adjust how the Frontend conditionally renders data. 

Here is a step-by-step walkthrough of what needs to be changed across your workspace.

---

### Step 1: Update the User Model (Backend)
First, we must tell MongoDB that `super_admin` is a valid role. 

**File:** `backend/models/User.js`
```javascript
// Change this line:
role: { type: String, enum: ['admin', 'staff', 'customer'], default: 'customer' },

// To this:
role: { type: String, enum: ['super_admin', 'admin', 'staff', 'customer'], default: 'customer' },
```

---

### Step 2: Establish Middleware Permissions (Backend)
We need to update our JWT protection logic so that a `super_admin` is inherently allowed to do everything an `admin` can do, plus introduce a new restriction *only* for the Super Admin.

**File:** `backend/middleware/authMiddleware.js`
```javascript
// 1. Update the existing adminOnly middleware:
const adminOnly = (req, res, next) => {
  if (req.user && (req.user.role === 'admin' || req.user.role === 'super_admin')) {
    return next();
  }
  return res.status(403).json({ message: 'Access denied: Admins only' });
};

// 2. Add the new strict superAdminOnly middleware:
const superAdminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'super_admin') {
    return next();
  }
  return res.status(403).json({ message: 'Access denied: Super Admins only' });
};

module.exports = { protect, adminOnly, superAdminOnly, optionalAuth };
```

---

### Step 3: Secure the API Routes (Backend)
Now you can restrict the highest-level operations to the Super Admin. For example, if you have a route to delete users or assign roles:

**File:** `backend/routes/userRoutes.js`
```javascript
const { protect, adminOnly, superAdminOnly } = require('../middleware/authMiddleware');

// Regular admins can get users, but ONLY Super Admins can promote/delete users
router.get('/', protect, adminOnly, getUsers);
router.delete('/:id', protect, superAdminOnly, deleteUser);
```

---

### Step 4: Adjust Frontend Rendering (React POS System)
Currently, your frontend checks for the admin role like this: `user?.role === 'admin'`. We need to update these checks in your React components so the UI doesn't break for the Super Admin.

**Files to search and update:** 
`frontend/src/App.jsx`, `Sidebar.jsx`, `DashboardPage.jsx`, `AnalyticsPage.jsx`, `UsersPage.jsx`.

**Example Change:**
```jsx
// Instead of this:
{user?.role === 'admin' && <AnalyticsPage />}

// Change to this:
{['admin', 'super_admin'].includes(user?.role) && <AnalyticsPage />}

// Or, for features exclusive to Super Admin:
{user?.role === 'super_admin' && <button>Delete Branch</button>}
```

---

### Step 5: Seeding the First Super Admin
Since no one can promote a Super Admin (except a Super Admin), you need to inject the first one directly into the database. You can do this by running a small script or modifying your existing seed script:

**File:** `backend/seedUsers.js`
```javascript
// Create the God Mode account
const superAdminUser = new User({
  name: 'Master Control',
  email: 'superadmin@mas.com',
  password: 'hashed_password_here',
  role: 'super_admin',
  isActive: true,
});
await superAdminUser.save();
```

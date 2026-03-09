# 🚗 Mudiyanse Auto Solutions — Advanced POS Phase 2 & Security Update

## 1. Project Scope Expansion
Enhancing system security through Role-Based Access Control (RBAC), a moderated registration workflow, and financial data privacy.

---

## 2. Business Requirements (Functional)

### A. User Roles & Permissions
* **Admin (Owner):** * Full access to the system.
    * View Total Revenue, Total Cost, and **Net Profit**.
    * Manage (Approve/Reject/Delete) staff accounts.
    * Promote a Staff member to an Admin role.
* **Staff (Employees):**
    * Access to POS (Billing) and Inventory search.
    * **Strictly Blocked:** Profit calculations, buying prices, and financial reports.
    * Can view current stock levels but not the "Cost" of the items.

### B. Moderated Registration Workflow
1. **Self-Registration:** Staff members can sign up via a registration form.
2. **Pending State:** Newly registered accounts are "Inactive" by default and cannot log in.
3. **Admin Approval:** Admin receives a notification/list of pending users and must "Approve" to activate the account.
4. **Account Management:** Admin has the authority to delete any staff account or revoke access at any time.

### C. Financial Privacy (Data Masking)
* Hide `buying_price` from all Staff-facing UI components.
* Analytics Dashboard should only show "Sales Count" and "Revenue" for staff, while "Profit" remains Admin-only.

---

## 3. Technical Requirements

### A. Database Schema Updates (MongoDB)
* **User Model:**
    ```js
    {
      name: String,
      email: String,
      password: (hashed),
      role: { type: String, enum: ['admin', 'staff'], default: 'staff' },
      status: { type: String, enum: ['pending', 'active', 'rejected'], default: 'pending' },
      createdAt: Date
    }
    ```

### B. Backend Logic (Node.js/Express)
* **Auth Middleware:** Update `authMiddleware.js` to check `req.user.role` and `req.user.status`.
* **Access Control:** Create a `checkAdmin` middleware to protect sensitive routes (e.g., Delete User, View Profit).
* **Login Logic:** Block login attempts if `status === 'pending'`.

### C. Frontend Enhancements (React + Tailwind)
* **Conditional Rendering:** Use React state to show/hide components based on `user.role`.
* **Admin Dashboard:** A new "User Management" page to:
    * List all users.
    * Toggle "Approve/Reject".
    * Delete user button.
    * "Make Admin" toggle button.

---

## 4. Advanced Features (From Previous Requirements)

* **Excel Import/Export:** Items 500+ bulk management.
* **Barcode Integration:** Fast checkout via hardware scanners.
* **Customer/Supplier CRM:** Manage credit (Naya) and supplier payments.
* **PWA Support:** Installable app for MacBook/Mobile.

---

## 5. Security Architecture (RBAC)



| Feature | Admin Access | Staff Access |
| :--- | :--- | :--- |
| Create Invoice | ✅ Yes | ✅ Yes |
| View Buying Price | ✅ Yes | ❌ No |
| View Daily Profit | ✅ Yes | ❌ No |
| Manage Users | ✅ Yes | ❌ No |
| Edit Stock | ✅ Yes | ✅ Yes (Optional) |

---

## 6. Development Roadmap

1.  **Step 1:** Update User Model & Registration Logic (Add `status` and `role`).
2.  **Step 2:** Create Admin-only User Management UI.
3.  **Step 3:** Implement conditional rendering in Frontend to hide Profit.
4.  **Step 4:** Integrate Barcode & Excel Import/Export features.
5.  **Step 5:** PWA conversion and Final Hosting.

---
**Updated: March 2026** | *Lead: Chamith Dilshan*
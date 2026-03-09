# 🛠️ Professional Spare Parts POS & Inventory Management System

## 1. Project Vision
Transitioning a manual spare parts business into a high-performance digital ecosystem. The system aims to automate sales, track stock precisely across multiple vehicle categories, and provide real-time financial insights (Profit/Loss).

---

## 2. Business Requirements (Functional)

### A. Inventory & Catalog Management
* **Item Profiles:** Support for 500+ items with fields for Name, SKU/Part Number, and Description.
* **Vehicle Categorization:** Structured filtering by:
    * Three-Wheel
    * Bike
    * Car
    * SUV
    * Off-Road
* **Pricing Architecture:**
    * `Buying Price`: The cost at which the item was acquired (Essential for profit calculation).
    * `Selling Price`: The retail price for the customer.
* **Stock Control:** * Real-time quantity tracking (auto-deduct on sale).
    * **Low Stock Alerts:** Visual indicators when items fall below a defined threshold (e.g., < 5 units).

### B. Point of Sale (POS) Interface
* **Smart Search:** Fast search by item name or category.
* **Digital Cart:** Add/Remove items, adjust quantities, and apply discounts.
* **Transaction Processing:** * Generate digital invoices/receipts.
    * Support for "Cash" and "Credit/Card" payment types.

### C. Financial Intelligence (The "Profit" Engine)
* **Automated Calculations:** System must calculate profit per item: `(Selling Price - Buying Price) * Quantity`.
* **Reporting Dashboards:**
    * **Daily:** Total Revenue, Total Profit, and Top Selling items for today.
    * **Weekly/Monthly:** Trend analysis and performance comparison.
* **Sales History:** A detailed log of all historical invoices with the ability to "Void" or "Refund".

---

## 3. Technical Requirements (System Architecture)

### A. The Tech Stack (MERN)
* **Frontend:** React.js (Vite) with **Tailwind CSS** for a modern, responsive UI.
* **State Management:** React Context API or Redux Toolkit for cart handling.
* **Backend:** Node.js & Express.js (REST API).
* **Database:** **MongoDB** (NoSQL) for flexible item attributes.
* **Auth:** JWT (JSON Web Tokens) for secure admin login.

### B. Database Schema Design (Conceptual)
* **Products Collection:** `name`, `category`, `buyingPrice`, `sellingPrice`, `quantity`, `lowStockLimit`.
* **Sales Collection:** `orderId`, `items[]`, `totalCost`, `totalRevenue`, `totalProfit`, `paymentMethod`, `createdAt`.

### C. Non-Functional Requirements
* **Performance:** UI should handle 500+ items without lag (Implementation of Pagination or Infinite Scroll).
* **Device Compatibility:** Optimized for **MacBook Air** and mobile-responsive for quick stock checks.
* **Security:** Role-based access (Admin can see profits; Staff can only sell).
* **Scalability:** Multi-tenant architecture (Ready to support "Shop 02" in the future).

---

## 4. UI/UX Modules
1.  **Dashboard:** High-level charts (Sales vs. Profit).
2.  **POS Screen:** Minimalist, high-speed checkout interface.
3.  **Inventory Manager:** Table view with "Edit/Add/Delete" and Stock status.
4.  **Reports Center:** Filterable tables to export data to Excel or PDF.

---

## 5. Development Roadmap
* **Phase 1:** Backend API & MongoDB Schema setup.
* **Phase 2:** Inventory Management UI (CRUD operations).
* **Phase 3:** POS Logic (Cart + Checkout + Stock Deduction).
* **Phase 4:** Profit Analytics Engine & Reporting Charts.
* **Phase 5:** Testing, Deployment & Data migration from manual books.
# 🚗 Mudiyanse Auto Solutions — Advanced POS Phase 2 Requirements

## 1. Project Scope Update

Existing POS system eka thawa duraṭath "Pro-level" kirima saha automation features (Excel, Barcode, CRM, PWA) athulath kirima.

---

## 2. New Business Requirements (Functional)

### A. Advanced Inventory Control (Feature 1)

- **Bulk Data Management:** Items 500+ thiyena nisa, Excel (.xlsx) ho CSV file ekakin stock ekata items bulk upload kirime hakiyaawa.
- **Inventory Export:** Current stock levels, buying/selling prices PDF ho Excel widiyat download kirima (For auditing).
- **Barcode Integration:** Item SKU codes barcode widiyata scan kara cart ekata add kirima.

### B. Smart Sales & Returns (Feature 2)

- **Sales Returns:** Customer kenek badu apahu dunnoth eka "Sales Return" ekak widiyata record kara, stock eka auto-increment kirima.
- **Unit of Measure (UOM):** Parts (Units), Oil (Liters), Grease (Packets) wage categories wenama manage kirima.
- **Dynamic Discounts:** Specific customer groups walata percentage (%) ho fixed amount discounts laba dima.

### C. Customer & Supplier Management - CRM (Feature 3)

- **Customer Credit (Naya):** Vishwasawantha customerslata naya pahasukam laba dima saha unge "Due Balance" track kirima.
- **Supplier Portal:** Supplier details, unge pending payments saha re-order points manage kirima.
- **Service History:** Specific vehicle ekakata (Plate No) karapu past repairs saha gaththa parts track kirima.

### D. Accessibility & Reliability (Feature 4)

- **PWA (Progressive Web App):** App eka MacBook/Mobile wala "Install" kara gatha haki wiya yuthuya.
- **Offline Resilience:** Internet nathi welawaka basic billing wada kireema saha pasuwa sync weema.

---

## 3. Technical Requirements (Updated Tech Stack)

### A. Frontend Enhancements

- **Libraries:** \* `xlsx` / `exceljs` (For Excel parsing/export).
  - `react-barcode-reader` (For hardware scanner integration).
  - `vite-plugin-pwa` (For PWA service workers).
- **State Management:** React Context API (Zippy state) update kirima for Credit Sales.

### B. Backend & Database Updates

- **New Collections (MongoDB):**
  - `Customers`: `name`, `phone`, `credit_limit`, `balance_due`.
  - `Suppliers`: `company_name`, `contact`, `outstanding_payment`.
  - `Returns`: `sale_id`, `reason`, `refund_amount`.
- **File Uploads:** `multer` middleware use kirima (Excel upload sathi).

### C. Security & Logs

- **Audit Trail:** Item price ekak wenas kaloth "Who, When, Old Price, New Price" record weema.
- **Role Based Access:** Staff memeberslata profit margins penima seema kirima.

---

## 4. Feature-Specific Logic (Logic Highlights)

### 1. Barcode Logic

- Scanner eka "Keyboard Input" ekak widiyata system eken haduna ganeema.
- Scan kala saniyin Product ID eka search kara `cart` array ekata push kirima.

### 2. Profit Calculation with Returns

- Net Profit = `(Total Sales - Total Cost) - (Returns + Discounts)`.

### 3. PWA Configuration

- `manifest.json` file eka loka/company branding ekata anuwa setup kirima.
- Service workers haraha static assets (Logo, CSS) cache kirima.

---

## 5. Development Roadmap (Next Steps)

1.  **Week 1:** Excel Import/Export logic & Barcode scanner integration.
2.  **Week 2:** Customer/Supplier database models & Credit sales UI.
3.  **Week 3:** Sales Return logic & Analytics dashboard update.
4.  **Week 4:** PWA setup & Final deployment testing.

---

**March 2026 Update** _Lead Developer: Chamith Dilshan_

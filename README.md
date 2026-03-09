# 🚗 SparePOS - Vehicle Spare Parts Management System

A full-stack POS and Inventory Management System for vehicle spare parts businesses.

## 🛠 Tech Stack

- **Frontend:** React + Vite + Tailwind CSS v4
- **Backend:** Node.js + Express.js
- **Database:** MongoDB (local or Atlas)
- **Auth:** JWT + bcrypt

## 📁 Project Structure

```
IN 2/
├── backend/          # Node.js + Express API
│   ├── config/       # DB connection
│   ├── models/       # Mongoose schemas
│   ├── controllers/  # Business logic
│   ├── routes/       # API routes
│   ├── middleware/   # JWT auth
│   ├── server.js     # Entry point
│   ├── seed.js       # DB seeder
│   └── .env          # Environment variables
└── frontend/         # React + Vite app
    └── src/
        ├── api/      # Axios services
        ├── context/  # Auth context
        ├── pages/    # All pages
        └── components/
```

## 🚀 Getting Started

### 1. MongoDB Setup

**Option A: Local**

```bash
mongod --dbpath ~/data/db
```

**Option B: MongoDB Atlas** (Recommended)

1. Create free cluster at https://cloud.mongodb.com
2. Get connection string
3. Update `backend/.env`: `MONGO_URI=mongodb+srv://...`

### 2. Seed the Database

```bash
cd backend && node seed.js
```

### 3. Start Backend

```bash
cd backend && npm run dev
```

Runs on: http://localhost:5000

### 4. Start Frontend

```bash
cd frontend && npm run dev
```

Runs on: http://localhost:5173

## 🔑 Default Login

- **Email:** admin@spareparts.lk
- **Password:** admin123

## ✨ Features

- 🛒 **POS Billing** — Cart with per-item & bill discounts, Cash/Card/Online checkout
- 📦 **Inventory** — 500+ parts support, 5 vehicle categories, SKU codes
- 📊 **Analytics** — Revenue, profit, charts (daily/weekly/monthly)
- 🔔 **Low Stock Alerts** — Threshold-based notifications
- 📋 **Sales History** — Searchable invoice log with detail view
- 🔐 **Auth** — JWT, Admin/Cashier roles

# 🎓 Bunkwell – Smart Attendance Tracker

A modern, mobile-first web app that helps students track attendance, get smart bunk suggestions, and stay above 80% with ease.

## Features

- 🔐 **Secure Auth** – Username/password + Student ID verification
- 📅 **Timetable Builder** – Mon–Sat schedule with default + custom time slots
- ✅ **Smart Attendance Marking** – Present / Absent / Cancelled / Substitute Faculty / Lab
- 📊 **Analytics Dashboard** – Per-subject graphs, radar chart, weekly trends
- 💡 **Bunk Suggestions** – Daily smart recommendations to bunk while staying at 80%+
- 🔔 **Push Notifications** – Morning check, period-end prompts, evening summary
- 📱 **PWA** – Installable on mobile, works like a native app

## Quick Start

### Prerequisites
- Node.js 18+
- MongoDB (running locally or MongoDB Atlas)

### Backend

```bash
cd backend
npm install
# Edit .env with your MongoDB URI (already has VAPID keys generated)
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

## Environment Variables

### Backend (`.env`)
```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/bunkwell
JWT_SECRET=your_secret_key
VAPID_PUBLIC_KEY=...  (auto-generated)
VAPID_PRIVATE_KEY=... (auto-generated)
VAPID_EMAIL=mailto:admin@bunkwell.app
CLIENT_URL=http://localhost:5173
```

### Frontend (`.env`)
```
VITE_API_URL=http://localhost:5000/api
```

## How Notifications Work

| Time | Notification |
|------|-------------|
| **7:00 AM** Mon–Sat | "Do you have classes today? Yes/No" |
| End of each period | "Did Period X get taken?" → Mark status |
| **6:00 PM** Mon–Sat | Evening summary + bunk suggestions |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + Vite + TailwindCSS v4 |
| Charts | Recharts |
| Backend | Node.js + Express |
| Database | MongoDB + Mongoose |
| Auth | JWT (bcrypt) |
| Notifications | Web Push (VAPID) |
| Scheduler | node-cron (IST timezone) |

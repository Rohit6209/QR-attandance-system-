# SmartSeat — QR Attendance System

## Files
```
smartseat/
├── server.js          ← Express backend (API server)
├── package.json
├── .gitignore
└── public/
    ├── admin.html     ← Admin dashboard
    └── student.html   ← Student QR scanner
```

## API Endpoints (all hardcoded to render URL)

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/state | Full state (seats + attendance) |
| GET | /api/seats | All seats |
| POST | /api/seats | Regenerate seats `{count, prefix}` |
| GET | /api/attendance | All attendance records |
| POST | /api/checkin | Check in `{seatId, name}` |
| POST | /api/checkout | Check out `{seatId}` |
| DELETE | /api/attendance/:seatId | Delete one record |
| DELETE | /api/attendance | Clear all records |
| POST | /api/reset | Hard reset everything |
| GET | /api/health | Health check |

## Deploy to Render

1. Push this folder to a GitHub repo
2. Go to https://render.com → New Web Service
3. Connect your GitHub repo
4. Settings:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Environment:** Node
5. Deploy → your URL will be `https://qr-attandance-system-1.onrender.com`

## URLs after deploy
- Admin Panel: `https://qr-attandance-system-1.onrender.com/admin`
- Student Page: `https://qr-attandance-system-1.onrender.com/student`

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'data.json');

// ── MIDDLEWARE ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── SIMPLE FILE-BASED DATABASE ───────────────────────────────────────────────
function readDB() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      const init = { seats: buildDefaultSeats(20, 'S'), attendance: {} };
      fs.writeFileSync(DB_FILE, JSON.stringify(init, null, 2));
      return init;
    }
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch (e) {
    return { seats: buildDefaultSeats(20, 'S'), attendance: {} };
  }
}

function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

function buildDefaultSeats(n, prefix) {
  return Array.from({ length: n }, (_, i) => ({
    id: `${prefix}${String(i + 1).padStart(2, '0')}`
  }));
}

function getTime() {
  return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

// ── ROUTES ────────────────────────────────────────────────────────────────────

// GET /api/state — full state (seats + attendance)
app.get('/api/state', (req, res) => {
  const db = readDB();
  res.json({ seats: db.seats, attendance: db.attendance });
});

// GET /api/seats — all seats
app.get('/api/seats', (req, res) => {
  const db = readDB();
  res.json(db.seats);
});

// POST /api/seats — regenerate seats
app.post('/api/seats', (req, res) => {
  const { count = 20, prefix = 'S' } = req.body;
  const n = Math.min(parseInt(count) || 20, 200);
  const db = readDB();
  db.seats = buildDefaultSeats(n, prefix.trim() || 'S');
  writeDB(db);
  res.json({ ok: true, seats: db.seats });
});

// GET /api/attendance — all attendance records
app.get('/api/attendance', (req, res) => {
  const db = readDB();
  res.json(db.attendance);
});

// POST /api/checkin — check in a student
app.post('/api/checkin', (req, res) => {
  const { seatId, name } = req.body;
  if (!seatId || !name) return res.status(400).json({ error: 'seatId and name required' });
  const db = readDB();
  if (db.attendance[seatId]) {
    return res.status(409).json({ error: `Seat ${seatId} is already occupied`, occupied: true });
  }
  db.attendance[seatId] = { name: name.trim(), checkinTime: getTime(), checkinTs: Date.now() };
  writeDB(db);
  res.json({ ok: true, seatId, record: db.attendance[seatId] });
});

// POST /api/checkout — check out a student
app.post('/api/checkout', (req, res) => {
  const { seatId } = req.body;
  if (!seatId) return res.status(400).json({ error: 'seatId required' });
  const db = readDB();
  if (!db.attendance[seatId]) {
    return res.status(404).json({ error: `Seat ${seatId} is not occupied`, empty: true });
  }
  const record = db.attendance[seatId];
  delete db.attendance[seatId];
  writeDB(db);
  res.json({ ok: true, seatId, record });
});

// DELETE /api/attendance/:seatId — delete a single record
app.delete('/api/attendance/:seatId', (req, res) => {
  const { seatId } = req.params;
  const db = readDB();
  if (!db.attendance[seatId]) return res.status(404).json({ error: 'Record not found' });
  delete db.attendance[seatId];
  writeDB(db);
  res.json({ ok: true });
});

// DELETE /api/attendance — clear all records
app.delete('/api/attendance', (req, res) => {
  const db = readDB();
  db.attendance = {};
  writeDB(db);
  res.json({ ok: true });
});

// POST /api/reset — hard reset everything
app.post('/api/reset', (req, res) => {
  const fresh = { seats: buildDefaultSeats(20, 'S'), attendance: {} };
  writeDB(fresh);
  res.json({ ok: true });
});

// Health check
app.get('/api/health', (req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

// Serve HTML pages
app.get('/student', (req, res) => res.sendFile(path.join(__dirname, 'public', 'student.html')));
app.get('/admin',   (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/', (req, res) => res.redirect('/admin'));

// ── START ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`SmartSeat server running on port ${PORT}`);
  console.log(`Admin:   http://localhost:${PORT}/admin`);
  console.log(`Student: http://localhost:${PORT}/student`);
});

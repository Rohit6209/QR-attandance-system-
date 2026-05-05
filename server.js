const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ── JSONBIN CONFIG ────────────────────────────────────────────────────────────
const BIN_ID  = '69f9aa5e36566621a8285cfd';
const API_KEY = process.env.JSONBIN_KEY;
const BIN_URL = `https://api.jsonbin.io/v3/b/${BIN_ID}`;

// ── MIDDLEWARE ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── JSONBIN HELPERS ───────────────────────────────────────────────────────────
async function readDB() {
  const res = await fetch(`${BIN_URL}/latest`, {
    headers: { 'X-Master-Key': API_KEY }
  });
  if (!res.ok) throw new Error('JSONBin read failed: ' + res.status);
  const json = await res.json();
  return json.record;
}

async function writeDB(data) {
  const res = await fetch(BIN_URL, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Master-Key': API_KEY
    },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('JSONBin write failed: ' + res.status);
  return res.json();
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

// GET /api/state
app.get('/api/state', async (req, res) => {
  try {
    const db = await readDB();
    res.json({ seats: db.seats, attendance: db.attendance });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/seats
app.get('/api/seats', async (req, res) => {
  try {
    const db = await readDB();
    res.json(db.seats);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/seats — regenerate seats
app.post('/api/seats', async (req, res) => {
  try {
    const { count = 20, prefix = 'S' } = req.body;
    const n = Math.min(parseInt(count) || 20, 200);
    const db = await readDB();
    db.seats = buildDefaultSeats(n, prefix.trim() || 'S');
    await writeDB(db);
    res.json({ ok: true, seats: db.seats });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/attendance
app.get('/api/attendance', async (req, res) => {
  try {
    const db = await readDB();
    res.json(db.attendance);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/checkin
app.post('/api/checkin', async (req, res) => {
  try {
    const { seatId, name } = req.body;
    if (!seatId || !name) return res.status(400).json({ error: 'seatId and name required' });
    const db = await readDB();
    if (db.attendance[seatId]) {
      return res.status(409).json({ error: `Seat ${seatId} is already occupied`, occupied: true });
    }
    db.attendance[seatId] = { name: name.trim(), checkinTime: getTime(), checkinTs: Date.now() };
    await writeDB(db);
    res.json({ ok: true, seatId, record: db.attendance[seatId] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/checkout
app.post('/api/checkout', async (req, res) => {
  try {
    const { seatId } = req.body;
    if (!seatId) return res.status(400).json({ error: 'seatId required' });
    const db = await readDB();
    if (!db.attendance[seatId]) {
      return res.status(404).json({ error: `Seat ${seatId} is not occupied`, empty: true });
    }
    const record = db.attendance[seatId];
    delete db.attendance[seatId];
    await writeDB(db);
    res.json({ ok: true, seatId, record });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/attendance/:seatId
app.delete('/api/attendance/:seatId', async (req, res) => {
  try {
    const { seatId } = req.params;
    const db = await readDB();
    if (!db.attendance[seatId]) return res.status(404).json({ error: 'Record not found' });
    delete db.attendance[seatId];
    await writeDB(db);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/attendance
app.delete('/api/attendance', async (req, res) => {
  try {
    const db = await readDB();
    db.attendance = {};
    await writeDB(db);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/reset
app.post('/api/reset', async (req, res) => {
  try {
    const fresh = { seats: buildDefaultSeats(79, 'S'), attendance: {} };
    await writeDB(fresh);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
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

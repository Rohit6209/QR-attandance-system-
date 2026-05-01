const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const QRCode = require('qrcode');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// In-memory store
let attendanceRecords = []; // { name, rollNo, time, date }
let currentQR = null;
let currentQRData = null;
let lastResetDate = new Date().toDateString();

// Auto-reset at midnight
function checkAndReset() {
  const today = new Date().toDateString();
  if (today !== lastResetDate) {
    console.log(`[AUTO-RESET] Date changed. Clearing attendance for ${lastResetDate}`);
    attendanceRecords = [];
    lastResetDate = today;
    io.emit('attendance_cleared', { date: today });
  }
}

setInterval(checkAndReset, 60 * 1000); // Check every minute

// Generate QR
app.post('/api/generate-qr', async (req, res) => {
  try {
    const sessionId = `ARLIBRARY_${Date.now()}`;
    const qrDataUrl = await QRCode.toDataURL(sessionId, {
      width: 400,
      margin: 2,
      color: { dark: '#0a1628', light: '#ffffff' }
    });
    currentQR = qrDataUrl;
    currentQRData = sessionId;
    io.emit('qr_updated', { qr: currentQR, sessionId: currentQRData });
    res.json({ success: true, qr: currentQR, sessionId: currentQRData });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get current QR
app.get('/api/current-qr', (req, res) => {
  res.json({ qr: currentQR, sessionId: currentQRData });
});

// Mark attendance
app.post('/api/mark-attendance', (req, res) => {
  checkAndReset();
  const { name, fatherName, sessionId } = req.body;
  if (!name || !fatherName || !sessionId) {
    return res.status(400).json({ success: false, error: 'Missing fields' });
  }
  if (sessionId !== currentQRData) {
    return res.status(400).json({ success: false, error: 'Invalid or expired QR code' });
  }
  const today = new Date().toDateString();
  const alreadyMarked = attendanceRecords.find(
    r => r.name.toLowerCase() === name.toLowerCase() && r.fatherName.toLowerCase() === fatherName.toLowerCase() && r.date === today
  );
  if (alreadyMarked) {
    return res.status(400).json({ success: false, error: 'Attendance already marked today' });
  }
  const now = new Date();
  const record = {
    name,
    fatherName,
    time: now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
    date: today,
    timestamp: now.toISOString()
  };
  attendanceRecords.push(record);
  io.emit('new_attendance', record);
  console.log(`[ATTENDANCE] ${name} s/o ${fatherName} marked at ${record.time}`);
  res.json({ success: true, record });
});

// Get all attendance
app.get('/api/attendance', (req, res) => {
  checkAndReset();
  res.json({ records: attendanceRecords, date: new Date().toDateString() });
});

// Manual clear
app.post('/api/clear-attendance', (req, res) => {
  attendanceRecords = [];
  lastResetDate = new Date().toDateString();
  io.emit('attendance_cleared', { date: lastResetDate });
  res.json({ success: true });
});

// Socket.IO
io.on('connection', (socket) => {
  console.log('[SOCKET] Client connected:', socket.id);
  // Send current state to new connections
  socket.emit('init', {
    records: attendanceRecords,
    qr: currentQR,
    sessionId: currentQRData,
    date: new Date().toDateString()
  });
  socket.on('disconnect', () => {
    console.log('[SOCKET] Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`AR Library Attendance Server running on port ${PORT}`);
});

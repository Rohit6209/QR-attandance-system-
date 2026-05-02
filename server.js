const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());

// In-memory storage (use MongoDB/PostgreSQL for production)
let students = {};       // { mobile: { name, fatherName, mobile, registeredAt } }
let attendance = [];     // [{ studentMobile, name, fatherName, mobile, timestamp, qrSession }]
let currentQRSession = generateSession();
let qrRefreshInterval = null;

function generateSession() {
  return crypto.randomBytes(16).toString('hex');
}

// ─── STUDENT ROUTES ───────────────────────────────────────────

// Student Login / Register
app.post('/api/student/login', (req, res) => {
  const { name, fatherName, mobile } = req.body;
  if (!name || !fatherName || !mobile) {
    return res.status(400).json({ success: false, message: 'Sab fields bharein' });
  }
  const key = mobile.trim();
  if (!students[key]) {
    students[key] = { name: name.trim(), fatherName: fatherName.trim(), mobile: key, registeredAt: new Date().toISOString() };
  }
  return res.json({ success: true, student: students[key] });
});

// Mark Attendance via QR scan
app.post('/api/attendance/mark', (req, res) => {
  const { mobile, qrSession } = req.body;
  if (!mobile || !qrSession) {
    return res.status(400).json({ success: false, message: 'Invalid request' });
  }
  if (qrSession !== currentQRSession) {
    return res.status(403).json({ success: false, message: 'QR expired hai! Nayi QR scan karein' });
  }
  const student = students[mobile];
  if (!student) {
    return res.status(404).json({ success: false, message: 'Student registered nahi hai' });
  }
  // Check duplicate attendance today
  const today = new Date().toDateString();
  const alreadyMarked = attendance.find(a =>
    a.mobile === mobile && new Date(a.timestamp).toDateString() === today
  );
  if (alreadyMarked) {
    return res.json({ success: false, message: 'Aaj ki attendance pehle se mark ho gayi hai!', alreadyMarked: true });
  }
  const record = {
    id: crypto.randomBytes(8).toString('hex'),
    name: student.name,
    fatherName: student.fatherName,
    mobile: student.mobile,
    timestamp: new Date().toISOString(),
    qrSession
  };
  attendance.push(record);
  return res.json({ success: true, message: 'Attendance mark ho gayi!', record });
});

// ─── ADMIN ROUTES ─────────────────────────────────────────────

// Get current QR session token
app.get('/api/admin/qr-session', (req, res) => {
  res.json({ session: currentQRSession, generatedAt: new Date().toISOString() });
});

// Refresh QR session manually
app.post('/api/admin/refresh-qr', (req, res) => {
  currentQRSession = generateSession();
  res.json({ success: true, session: currentQRSession, generatedAt: new Date().toISOString() });
});

// Get all attendance records
app.get('/api/admin/attendance', (req, res) => {
  const { date } = req.query;
  let records = [...attendance];
  if (date) {
    records = records.filter(a => new Date(a.timestamp).toDateString() === new Date(date).toDateString());
  }
  records.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  res.json({ success: true, records, total: records.length });
});

// Get all students
app.get('/api/admin/students', (req, res) => {
  res.json({ success: true, students: Object.values(students), total: Object.values(students).length });
});

// Stats
app.get('/api/admin/stats', (req, res) => {
  const today = new Date().toDateString();
  const todayCount = attendance.filter(a => new Date(a.timestamp).toDateString() === today).length;
  res.json({
    totalStudents: Object.keys(students).length,
    totalAttendance: attendance.length,
    todayAttendance: todayCount
  });
});

// Health check
app.get('/', (req, res) => res.json({ status: 'QR Attendance Server Running ✅', time: new Date() }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

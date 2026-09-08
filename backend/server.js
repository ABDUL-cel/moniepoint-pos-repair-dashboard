require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');

const User = require('./models/User');
const Log = require('./models/Log');

const app = express();

// Middleware
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// Database Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB Connected Successfully'))
  .catch(err => console.error('MongoDB Connection Error:', err));

// JWT Authentication Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Access Token Required' });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid Token' });
    req.user = user;
    next();
  });
};

// Helper: Get YYYY-MM-DD date string
const getFormattedDate = (d = new Date()) => d.toISOString().split('T')[0];

// Helper: Get start of current week (Monday)
const getStartOfWeek = () => {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  const monday = new Date(d.setDate(diff));
  return getFormattedDate(monday);
};

/* --- AUTH ROUTES --- */

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, agentId, password } = req.body;
    
    const existingUser = await User.findOne({ agentId });
    if (existingUser) return res.status(400).json({ message: 'Agent ID already registered' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ name, agentId, password: hashedPassword });
    await newUser.save();

    res.status(201).json({ message: 'Agent registered successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error during registration', error: error.message });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { agentId, password } = req.body;
    
    const user = await User.findOne({ agentId });
    if (!user) return res.status(400).json({ message: 'Invalid Agent ID or password' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid Agent ID or password' });

    const token = jwt.sign({ id: user._id, agentId: user.agentId, name: user.name }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { name: user.name, agentId: user.agentId } });
  } catch (error) {
    res.status(500).json({ message: 'Server error during login', error: error.message });
  }
});

/* --- DASHBOARD DATA ROUTES --- */

// Fetch Today's Log & Weekly Summary
app.get('/api/dashboard', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const today = getFormattedDate();
    const startOfWeek = getStartOfWeek();

    // 1. Get or create today's log (Resets daily deploy count automatically by starting new day at 0)
    let todayLog = await Log.findOne({ userId, date: today });
    if (!todayLog) {
      todayLog = new Log({ userId, date: today, posCount: 0 });
      await todayLog.save();
    }

    // 2. Aggregate current week's deployments (Monday through Today)
    const weekLogs = await Log.find({
      userId,
      date: { $gte: startOfWeek }
    });

    const weeklyPosCount = weekLogs.reduce((sum, log) => sum + log.posCount, 0);

    // Merge transport days across current week logs
    const weeklyTransportDays = weekLogs.reduce((acc, log) => {
      Object.keys(log.transportDays).forEach(day => {
        if (log.transportDays[day]) acc[day] = true;
      });
      return acc;
    }, { Mon: false, Tue: false, Wed: false, Thu: false, Fri: false });

    res.json({
      todayPos: todayLog.posCount,
      weeklyPos: weeklyPosCount,
      transportDays: todayLog.transportDays
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching dashboard data', error: error.message });
  }
});

// Increment POS Deploy Count for Today
app.post('/api/dashboard/deploy', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const today = getFormattedDate();

    const log = await Log.findOneAndUpdate(
      { userId, date: today },
      { $inc: { posCount: 1 } },
      { new: true, upsert: true }
    );

    res.json({ success: true, todayPos: log.posCount });
  } catch (error) {
    res.status(500).json({ message: 'Error updating deployment count', error: error.message });
  }
});

// Update Transport Days Checkbox State
app.post('/api/dashboard/transport', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const today = getFormattedDate();
    const { transportDays } = req.body;

    const log = await Log.findOneAndUpdate(
      { userId, date: today },
      { $set: { transportDays } },
      { new: true, upsert: true }
    );

    res.json({ success: true, transportDays: log.transportDays });
  } catch (error) {
    res.status(500).json({ message: 'Error updating transport allowance', error: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

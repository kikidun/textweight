const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');

// Load environment variables from .env file if present
try {
  require('dotenv').config();
} catch (e) {
  // dotenv is optional
}

const db = require('./src/services/database');
const twilioService = require('./src/services/twilio');
const scheduler = require('./src/services/scheduler');

// Import routes
const smsRoutes = require('./src/routes/sms');
const authRoutes = require('./src/routes/auth');
const entriesRoutes = require('./src/routes/entries');
const settingsRoutes = require('./src/routes/settings');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize database
db.initSchema();

// Initialize Twilio
twilioService.init();

// Middleware
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Auth middleware for API routes (except auth endpoints and SMS webhook)
function requireAuth(req, res, next) {
  const sessionId = req.cookies?.session;

  if (!sessionId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const session = db.getSession(sessionId);
  if (!session) {
    return res.status(401).json({ error: 'Session expired' });
  }

  next();
}

// API Routes
app.use('/api/sms', smsRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/entries', requireAuth, entriesRoutes);
app.use('/api/settings', requireAuth, settingsRoutes);

// Serve login page for unauthenticated requests to root
app.get('/', (req, res) => {
  const sessionId = req.cookies?.session;
  const session = sessionId ? db.getSession(sessionId) : null;

  if (session) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } else {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
  }
});

// SPA fallback - serve index.html for authenticated routes
app.get('/settings', (req, res) => {
  const sessionId = req.cookies?.session;
  const session = sessionId ? db.getSession(sessionId) : null;

  if (session) {
    res.sendFile(path.join(__dirname, 'public', 'settings.html'));
  } else {
    res.redirect('/');
  }
});

// Consent page (public)
app.get('/consent', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'consent.html'));
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`TextWeight server running on port ${PORT}`);

  // Start the scheduler for pending entries
  scheduler.start();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...');
  scheduler.stop();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down...');
  scheduler.stop();
  process.exit(0);
});

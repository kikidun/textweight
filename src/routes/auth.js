const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../services/database');
const twilioService = require('../services/twilio');

// Rate limiting for auth codes (simple in-memory)
const codeRequests = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX = 3; // max 3 requests per minute

/**
 * Request a magic link code
 */
router.post('/request-code', express.json(), async (req, res) => {
  const { phone } = req.body;

  if (!phone) {
    return res.status(400).json({ error: 'Phone number required' });
  }

  // Normalize phone number
  const normalizedPhone = normalizePhone(phone);

  // Check if this is the registered user
  const registeredPhone = db.getSetting('phone_number');
  if (registeredPhone && normalizePhone(registeredPhone) !== normalizedPhone) {
    // Don't reveal if phone is registered or not
    return res.json({ success: true, message: 'If registered, code sent' });
  }

  // Rate limiting
  const now = Date.now();
  const requests = codeRequests.get(normalizedPhone) || [];
  const recentRequests = requests.filter(t => now - t < RATE_LIMIT_WINDOW);

  if (recentRequests.length >= RATE_LIMIT_MAX) {
    return res.status(429).json({ error: 'Too many requests. Try again later.' });
  }

  recentRequests.push(now);
  codeRequests.set(normalizedPhone, recentRequests);

  // Generate and send code
  const code = twilioService.generateCode();
  db.createAuthCode(normalizedPhone, code);

  const sent = await twilioService.sendSms(normalizedPhone, `Your TextWeight code: ${code}`);

  if (!sent) {
    return res.status(500).json({ error: 'Failed to send code' });
  }

  res.json({ success: true, message: 'Code sent' });
});

/**
 * Verify code and create session
 */
router.post('/verify', express.json(), (req, res) => {
  const { phone, code } = req.body;

  if (!phone || !code) {
    return res.status(400).json({ error: 'Phone and code required' });
  }

  const normalizedPhone = normalizePhone(phone);

  // Temporary bypass code for testing (remove when Twilio is verified)
  const bypassEnabled = process.env.BYPASS_CODE === '111111';
  const isBypass = bypassEnabled && code === '111111';

  // Verify the code
  const valid = isBypass || db.verifyAuthCode(normalizedPhone, code);

  if (!valid) {
    return res.status(401).json({ error: 'Invalid or expired code' });
  }

  // Create session
  const sessionId = uuidv4();
  db.createSession(sessionId, 30); // 30 days

  // Set cookie
  res.cookie('session', sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
  });

  res.json({ success: true });
});

/**
 * Logout - destroy session
 */
router.post('/logout', (req, res) => {
  const sessionId = req.cookies?.session;

  if (sessionId) {
    db.deleteSession(sessionId);
  }

  res.clearCookie('session');
  res.json({ success: true });
});

/**
 * Check authentication status
 */
router.get('/status', (req, res) => {
  const sessionId = req.cookies?.session;

  if (!sessionId) {
    return res.json({ authenticated: false });
  }

  const session = db.getSession(sessionId);
  res.json({ authenticated: !!session });
});

/**
 * Normalize phone number to E.164 format
 */
function normalizePhone(phone) {
  // Remove all non-digit characters
  let digits = phone.replace(/\D/g, '');

  // Add country code if missing (assume US)
  if (digits.length === 10) {
    digits = '1' + digits;
  }

  return '+' + digits;
}

module.exports = router;

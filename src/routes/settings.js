const express = require('express');
const router = express.Router();
const db = require('../services/database');
const twilioService = require('../services/twilio');

// Pending phone verification
let pendingPhoneChange = null;

/**
 * Get current settings
 */
router.get('/', (req, res) => {
  try {
    const settings = db.getAllSettings();
    // Don't expose sensitive data
    res.json({
      phone_number: maskPhone(settings.phone_number),
      timezone: settings.timezone || 'America/Chicago',
      display_unit: settings.display_unit || 'lbs'
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

/**
 * Update settings
 */
router.put('/', express.json(), async (req, res) => {
  const { timezone, display_unit } = req.body;

  try {
    if (timezone) {
      // Validate timezone
      try {
        Intl.DateTimeFormat('en-US', { timeZone: timezone });
        db.setSetting('timezone', timezone);
      } catch (e) {
        return res.status(400).json({ error: 'Invalid timezone' });
      }
    }

    if (display_unit) {
      if (!['lbs', 'kg'].includes(display_unit)) {
        return res.status(400).json({ error: 'Invalid unit. Use lbs or kg' });
      }
      db.setSetting('display_unit', display_unit);
    }

    const settings = db.getAllSettings();
    res.json({
      phone_number: maskPhone(settings.phone_number),
      timezone: settings.timezone || 'America/Chicago',
      display_unit: settings.display_unit || 'lbs'
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

/**
 * Request phone number change - sends verification to new number
 */
router.post('/phone/request-change', express.json(), async (req, res) => {
  const { new_phone } = req.body;

  if (!new_phone) {
    return res.status(400).json({ error: 'New phone number required' });
  }

  const normalizedPhone = normalizePhone(new_phone);

  // Generate verification code
  const code = twilioService.generateCode();

  // Store pending change
  pendingPhoneChange = {
    phone: normalizedPhone,
    code,
    timestamp: Date.now()
  };

  // Send verification to new number
  const sent = await twilioService.sendSms(
    normalizedPhone,
    `Verify your new TextWeight number: ${code}`
  );

  if (!sent) {
    pendingPhoneChange = null;
    return res.status(500).json({ error: 'Failed to send verification code' });
  }

  res.json({ success: true, message: 'Verification code sent to new number' });
});

/**
 * Confirm phone number change
 */
router.post('/phone/confirm-change', express.json(), (req, res) => {
  const { code } = req.body;

  if (!code) {
    return res.status(400).json({ error: 'Verification code required' });
  }

  if (!pendingPhoneChange) {
    return res.status(400).json({ error: 'No pending phone change' });
  }

  // Check if code expired (15 minutes)
  if (Date.now() - pendingPhoneChange.timestamp > 15 * 60 * 1000) {
    pendingPhoneChange = null;
    return res.status(400).json({ error: 'Verification code expired' });
  }

  // Verify code
  if (pendingPhoneChange.code !== code) {
    return res.status(400).json({ error: 'Invalid verification code' });
  }

  // Update phone number
  db.setSetting('phone_number', pendingPhoneChange.phone);
  pendingPhoneChange = null;

  res.json({ success: true, message: 'Phone number updated' });
});

/**
 * Get available timezones
 */
router.get('/timezones', (req, res) => {
  const timezones = [
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'America/Anchorage',
    'Pacific/Honolulu',
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'Asia/Tokyo',
    'Asia/Shanghai',
    'Australia/Sydney'
  ];

  res.json(timezones);
});

/**
 * Normalize phone number to E.164 format
 */
function normalizePhone(phone) {
  let digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    digits = '1' + digits;
  }
  return '+' + digits;
}

/**
 * Mask phone number for display
 */
function maskPhone(phone) {
  if (!phone) return null;
  if (phone.length <= 4) return phone;
  return phone.slice(0, -4).replace(/\d/g, '*') + phone.slice(-4);
}

module.exports = router;

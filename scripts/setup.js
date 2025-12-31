#!/usr/bin/env node

/**
 * TextWeight Setup Script
 *
 * Initializes the database and sets up the initial configuration.
 *
 * Usage:
 *   node scripts/setup.js
 *
 * Environment variables:
 *   USER_PHONE_NUMBER - Your phone number for SMS
 *   DEFAULT_TIMEZONE - Your timezone (default: America/Chicago)
 */

const path = require('path');
const fs = require('fs');

// Ensure data directory exists
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log('Created data directory');
}

// Set database path before requiring database module
process.env.DATABASE_PATH = process.env.DATABASE_PATH || path.join(dataDir, 'textweight.db');

const db = require('../src/services/database');

console.log('Initializing database...');
db.initSchema();
console.log('Database schema created');

// Set initial settings
const phoneNumber = process.env.USER_PHONE_NUMBER;
const timezone = process.env.DEFAULT_TIMEZONE || 'America/Chicago';
const displayUnit = process.env.DEFAULT_UNIT || 'lbs';

if (phoneNumber) {
  // Normalize phone number
  let digits = phoneNumber.replace(/\D/g, '');
  if (digits.length === 10) {
    digits = '1' + digits;
  }
  const normalized = '+' + digits;

  db.setSetting('phone_number', normalized);
  console.log(`Phone number set: ${maskPhone(normalized)}`);
}

db.setSetting('timezone', timezone);
console.log(`Timezone set: ${timezone}`);

db.setSetting('display_unit', displayUnit);
console.log(`Display unit set: ${displayUnit}`);

console.log('\nSetup complete!');
console.log('\nNext steps:');
console.log('1. Set your Twilio credentials in environment variables:');
console.log('   TWILIO_ACCOUNT_SID=your_account_sid');
console.log('   TWILIO_AUTH_TOKEN=your_auth_token');
console.log('   TWILIO_PHONE_NUMBER=your_twilio_number');
console.log('\n2. Configure your Twilio webhook URL:');
console.log('   https://your-domain.com/api/sms/incoming');
console.log('\n3. Start the server:');
console.log('   npm start');

function maskPhone(phone) {
  if (!phone) return null;
  if (phone.length <= 4) return phone;
  return phone.slice(0, -4).replace(/\d/g, '*') + phone.slice(-4);
}

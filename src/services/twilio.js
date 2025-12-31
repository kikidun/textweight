const twilio = require('twilio');

let client = null;
let phoneNumber = null;

function init() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  phoneNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !phoneNumber) {
    console.warn('Twilio credentials not configured. SMS features will be disabled.');
    return false;
  }

  client = twilio(accountSid, authToken);
  return true;
}

/**
 * Send an SMS message
 */
async function sendSms(to, body) {
  if (!client) {
    console.error('Twilio client not initialized');
    return false;
  }

  try {
    await client.messages.create({
      body,
      from: phoneNumber,
      to
    });
    return true;
  } catch (error) {
    console.error('Failed to send SMS:', error.message);
    return false;
  }
}

/**
 * Generate TwiML response
 */
function twimlResponse(message) {
  const twiml = new twilio.twiml.MessagingResponse();
  if (message) {
    twiml.message(message);
  }
  return twiml.toString();
}

/**
 * Validate Twilio webhook signature
 */
function validateRequest(req) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) return true; // Skip validation if not configured

  const signature = req.headers['x-twilio-signature'];
  const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;

  return twilio.validateRequest(authToken, signature, url, req.body);
}

/**
 * Generate a random 6-digit code
 */
function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

module.exports = {
  init,
  sendSms,
  twimlResponse,
  validateRequest,
  generateCode
};

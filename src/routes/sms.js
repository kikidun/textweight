const express = require('express');
const router = express.Router();
const db = require('../services/database');
const twilioService = require('../services/twilio');
const parser = require('../services/parser');
const scheduler = require('../services/scheduler');
const { isOutlier } = require('../utils/validation');
const { formatWithUnit } = require('../utils/units');

/**
 * Handle incoming SMS
 */
router.post('/incoming', express.urlencoded({ extended: false }), (req, res) => {
  // Validate Twilio signature in production
  if (process.env.NODE_ENV === 'production' && !twilioService.validateRequest(req)) {
    return res.status(403).send('Invalid signature');
  }

  const body = req.body.Body || '';
  const from = req.body.From || '';

  console.log(`SMS received from ${from}: ${body}`);

  const parsed = parser.parseMessage(body);
  let response = '';

  try {
    switch (parsed.type) {
      case 'weight':
        response = handleWeight(parsed.value);
        break;
      case 'command':
        response = handleCommand(parsed.value);
        break;
      default:
        response = parser.getUnknownMessage();
    }
  } catch (error) {
    console.error('Error handling SMS:', error);
    response = 'Error saving. Try again.';
  }

  res.type('text/xml');
  res.send(twilioService.twimlResponse(response));
});

/**
 * Handle weight input
 */
function handleWeight(weight) {
  const lastEntry = db.getLastEntry();
  const previousWeight = lastEntry ? lastEntry.weight : null;
  const displayUnit = db.getSetting('display_unit') || 'lbs';

  // Check if this is an outlier
  if (isOutlier(weight, previousWeight)) {
    // Create pending entry
    db.createPendingEntry(weight, previousWeight);
    return `${weight} seems unusual. Logging in 5m. CANCEL to stop.`;
  }

  // Normal entry - log immediately
  const date = scheduler.getCurrentDate();
  db.createOrUpdateEntry(date, weight);
  return `Logged: ${weight}`;
}

/**
 * Handle commands
 */
function handleCommand(command) {
  const displayUnit = db.getSetting('display_unit') || 'lbs';

  switch (command) {
    case 'HELP':
      return parser.getHelpMessage();

    case 'LAST': {
      const lastEntry = db.getLastEntry();
      if (!lastEntry) {
        return 'No entries yet';
      }
      const dateStr = formatDate(lastEntry.date);
      return `Last: ${lastEntry.weight} ${displayUnit} on ${dateStr}`;
    }

    case 'STATUS': {
      const pending = db.getPendingEntry();
      if (!pending) {
        return 'Nothing pending';
      }
      const elapsed = Date.now() - new Date(pending.created_at).getTime();
      const remaining = Math.ceil((scheduler.PENDING_TIMEOUT_MS - elapsed) / 60000);
      return `Pending: ${pending.weight} (logs in ${remaining}m)`;
    }

    case 'CANCEL': {
      const pending = db.getPendingEntry();
      if (!pending) {
        return 'Nothing pending to cancel';
      }
      db.deletePendingEntry();
      return 'Cancelled';
    }

    default:
      return parser.getUnknownMessage();
  }
}

/**
 * Format date for display (e.g., "Dec 30")
 */
function formatDate(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

module.exports = router;

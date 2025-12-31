const db = require('./database');
const twilioService = require('./twilio');

const PENDING_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const CHECK_INTERVAL_MS = 60 * 1000; // 1 minute

let intervalId = null;

/**
 * Get current date in configured timezone
 */
function getCurrentDate() {
  const timezone = db.getSetting('timezone') || 'America/Chicago';
  const now = new Date();

  // Format date in timezone
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  return formatter.format(now);
}

/**
 * Process expired pending entries
 */
async function processPendingEntries() {
  const cutoffTime = new Date(Date.now() - PENDING_TIMEOUT_MS).toISOString();
  const pendingEntries = db.getExpiredPendingEntries(cutoffTime);

  for (const pending of pendingEntries) {
    try {
      const date = getCurrentDate();
      db.createOrUpdateEntry(date, pending.weight);
      db.deletePendingEntry();
      console.log(`Committed pending entry: ${pending.weight} for ${date}`);
    } catch (error) {
      console.error('Failed to commit pending entry:', error);

      // Notify user of failure
      const phone = db.getSetting('phone_number');
      if (phone) {
        await twilioService.sendSms(phone, `Failed to log ${pending.weight}. Please try again.`);
      }
    }
  }
}

/**
 * Cleanup expired auth codes and sessions
 */
function cleanupExpired() {
  try {
    db.cleanupExpiredAuthCodes();
    db.cleanupExpiredSessions();
  } catch (error) {
    console.error('Cleanup error:', error);
  }
}

/**
 * Start the scheduler
 */
function start() {
  if (intervalId) {
    console.log('Scheduler already running');
    return;
  }

  console.log('Starting scheduler...');

  // Run immediately on start
  processPendingEntries();
  cleanupExpired();

  // Then run every minute
  intervalId = setInterval(() => {
    processPendingEntries();
    cleanupExpired();
  }, CHECK_INTERVAL_MS);
}

/**
 * Stop the scheduler
 */
function stop() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('Scheduler stopped');
  }
}

module.exports = {
  start,
  stop,
  processPendingEntries,
  getCurrentDate,
  PENDING_TIMEOUT_MS
};

const { parseWeight } = require('../utils/validation');

// Known commands
const COMMANDS = {
  HELP: 'HELP',
  LAST: 'LAST',
  STATUS: 'STATUS',
  CANCEL: 'CANCEL'
};

/**
 * Parse incoming SMS message
 * Returns: { type: 'weight' | 'command' | 'unknown', value: number | string }
 */
function parseMessage(message) {
  if (typeof message !== 'string') {
    return { type: 'unknown', value: null };
  }

  const trimmed = message.trim().toUpperCase();

  // Check for commands first
  if (trimmed === COMMANDS.HELP) {
    return { type: 'command', value: 'HELP' };
  }
  if (trimmed === COMMANDS.LAST) {
    return { type: 'command', value: 'LAST' };
  }
  if (trimmed === COMMANDS.STATUS) {
    return { type: 'command', value: 'STATUS' };
  }
  if (trimmed === COMMANDS.CANCEL) {
    return { type: 'command', value: 'CANCEL' };
  }

  // Try to parse as weight
  const weight = parseWeight(message);
  if (weight !== null) {
    return { type: 'weight', value: weight };
  }

  return { type: 'unknown', value: null };
}

/**
 * Generate help message
 */
function getHelpMessage() {
  return 'Send weight (185.5), LAST, STATUS, or CANCEL';
}

/**
 * Generate unknown command message
 */
function getUnknownMessage() {
  return 'Unknown. Send weight (185.5) or try HELP, LAST, STATUS';
}

module.exports = {
  parseMessage,
  getHelpMessage,
  getUnknownMessage,
  COMMANDS
};

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../data/textweight.db');
const db = new Database(dbPath);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

// Initialize schema
function initSchema() {
  db.exec(`
    -- Weight entries
    CREATE TABLE IF NOT EXISTS entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      weight REAL NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- Pending entries (outlier confirmation)
    CREATE TABLE IF NOT EXISTS pending_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      weight REAL NOT NULL,
      created_at TEXT NOT NULL,
      previous_weight REAL
    );

    -- Settings
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    -- Magic link codes
    CREATE TABLE IF NOT EXISTS auth_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT NOT NULL,
      code TEXT NOT NULL,
      created_at TEXT NOT NULL,
      used INTEGER DEFAULT 0
    );

    -- Sessions
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );

    -- Create indexes
    CREATE INDEX IF NOT EXISTS idx_entries_date ON entries(date);
    CREATE INDEX IF NOT EXISTS idx_pending_created ON pending_entries(created_at);
    CREATE INDEX IF NOT EXISTS idx_auth_codes_phone ON auth_codes(phone);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
  `);
}

// Settings operations
function getSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : null;
}

function setSetting(key, value) {
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
}

function getAllSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  return rows.reduce((acc, row) => {
    acc[row.key] = row.value;
    return acc;
  }, {});
}

// Entry operations
function getEntries() {
  return db.prepare('SELECT * FROM entries ORDER BY date DESC').all();
}

function getEntryByDate(date) {
  return db.prepare('SELECT * FROM entries WHERE date = ?').get(date);
}

function getEntryById(id) {
  return db.prepare('SELECT * FROM entries WHERE id = ?').get(id);
}

function getLastEntry() {
  return db.prepare('SELECT * FROM entries ORDER BY date DESC LIMIT 1').get();
}

function createOrUpdateEntry(date, weight) {
  const now = new Date().toISOString();
  const existing = getEntryByDate(date);

  if (existing) {
    db.prepare('UPDATE entries SET weight = ?, updated_at = ? WHERE date = ?').run(weight, now, date);
    return getEntryByDate(date);
  } else {
    const result = db.prepare('INSERT INTO entries (date, weight, created_at, updated_at) VALUES (?, ?, ?, ?)').run(date, weight, now, now);
    return getEntryById(result.lastInsertRowid);
  }
}

function updateEntry(id, weight) {
  const now = new Date().toISOString();
  db.prepare('UPDATE entries SET weight = ?, updated_at = ? WHERE id = ?').run(weight, now, id);
  return getEntryById(id);
}

function deleteEntry(id) {
  db.prepare('DELETE FROM entries WHERE id = ?').run(id);
}

// Pending entry operations
function getPendingEntry() {
  return db.prepare('SELECT * FROM pending_entries ORDER BY created_at DESC LIMIT 1').get();
}

function createPendingEntry(weight, previousWeight) {
  const now = new Date().toISOString();
  // Clear any existing pending entries first
  db.prepare('DELETE FROM pending_entries').run();
  const result = db.prepare('INSERT INTO pending_entries (weight, created_at, previous_weight) VALUES (?, ?, ?)').run(weight, now, previousWeight);
  return db.prepare('SELECT * FROM pending_entries WHERE id = ?').get(result.lastInsertRowid);
}

function deletePendingEntry() {
  db.prepare('DELETE FROM pending_entries').run();
}

function getExpiredPendingEntries(cutoffTime) {
  return db.prepare('SELECT * FROM pending_entries WHERE created_at <= ?').all(cutoffTime);
}

// Auth operations
function createAuthCode(phone, code) {
  const now = new Date().toISOString();
  db.prepare('INSERT INTO auth_codes (phone, code, created_at) VALUES (?, ?, ?)').run(phone, code, now);
}

function verifyAuthCode(phone, code, maxAgeMinutes = 15) {
  const cutoff = new Date(Date.now() - maxAgeMinutes * 60 * 1000).toISOString();
  const row = db.prepare(`
    SELECT * FROM auth_codes
    WHERE phone = ? AND code = ? AND used = 0 AND created_at > ?
    ORDER BY created_at DESC LIMIT 1
  `).get(phone, code, cutoff);

  if (row) {
    db.prepare('UPDATE auth_codes SET used = 1 WHERE id = ?').run(row.id);
    return true;
  }
  return false;
}

function cleanupExpiredAuthCodes() {
  const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1 hour
  db.prepare('DELETE FROM auth_codes WHERE created_at < ?').run(cutoff);
}

// Session operations
function createSession(sessionId, daysValid = 30) {
  const now = new Date();
  const expires = new Date(now.getTime() + daysValid * 24 * 60 * 60 * 1000);
  db.prepare('INSERT INTO sessions (id, created_at, expires_at) VALUES (?, ?, ?)').run(sessionId, now.toISOString(), expires.toISOString());
}

function getSession(sessionId) {
  const now = new Date().toISOString();
  return db.prepare('SELECT * FROM sessions WHERE id = ? AND expires_at > ?').get(sessionId, now);
}

function deleteSession(sessionId) {
  db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
}

function cleanupExpiredSessions() {
  const now = new Date().toISOString();
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now);
}

// Bulk import
function bulkImportEntries(entries) {
  const insert = db.prepare(`
    INSERT OR REPLACE INTO entries (date, weight, created_at, updated_at)
    VALUES (?, ?, ?, ?)
  `);

  const now = new Date().toISOString();
  const importMany = db.transaction((entries) => {
    for (const entry of entries) {
      insert.run(entry.date, entry.weight, now, now);
    }
  });

  importMany(entries);
  return entries.length;
}

module.exports = {
  db,
  initSchema,
  getSetting,
  setSetting,
  getAllSettings,
  getEntries,
  getEntryByDate,
  getEntryById,
  getLastEntry,
  createOrUpdateEntry,
  updateEntry,
  deleteEntry,
  getPendingEntry,
  createPendingEntry,
  deletePendingEntry,
  getExpiredPendingEntries,
  createAuthCode,
  verifyAuthCode,
  cleanupExpiredAuthCodes,
  createSession,
  getSession,
  deleteSession,
  cleanupExpiredSessions,
  bulkImportEntries
};

const express = require('express');
const router = express.Router();
const db = require('../services/database');

/**
 * Get all entries
 */
router.get('/', (req, res) => {
  try {
    const entries = db.getEntries();
    res.json(entries);
  } catch (error) {
    console.error('Error fetching entries:', error);
    res.status(500).json({ error: 'Failed to fetch entries' });
  }
});

/**
 * Create or update entry (for backfill)
 */
router.post('/', express.json(), (req, res) => {
  const { date, weight } = req.body;

  if (!date || weight === undefined) {
    return res.status(400).json({ error: 'Date and weight required' });
  }

  // Validate date format (YYYY-MM-DD)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
  }

  // Validate weight
  const weightNum = parseFloat(weight);
  if (isNaN(weightNum) || weightNum <= 0) {
    return res.status(400).json({ error: 'Invalid weight' });
  }

  try {
    const entry = db.createOrUpdateEntry(date, weightNum);
    res.json(entry);
  } catch (error) {
    console.error('Error creating entry:', error);
    res.status(500).json({ error: 'Failed to create entry' });
  }
});

/**
 * Update entry by ID
 */
router.put('/:id', express.json(), (req, res) => {
  const { id } = req.params;
  const { weight } = req.body;

  if (weight === undefined) {
    return res.status(400).json({ error: 'Weight required' });
  }

  const weightNum = parseFloat(weight);
  if (isNaN(weightNum) || weightNum <= 0) {
    return res.status(400).json({ error: 'Invalid weight' });
  }

  try {
    const existing = db.getEntryById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    const entry = db.updateEntry(id, weightNum);
    res.json(entry);
  } catch (error) {
    console.error('Error updating entry:', error);
    res.status(500).json({ error: 'Failed to update entry' });
  }
});

/**
 * Delete entry by ID
 */
router.delete('/:id', (req, res) => {
  const { id } = req.params;

  try {
    const existing = db.getEntryById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    db.deleteEntry(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting entry:', error);
    res.status(500).json({ error: 'Failed to delete entry' });
  }
});

/**
 * Bulk import entries from CSV
 */
router.post('/import', express.json(), (req, res) => {
  const { entries } = req.body;

  if (!Array.isArray(entries) || entries.length === 0) {
    return res.status(400).json({ error: 'Entries array required' });
  }

  // Validate and normalize entries
  const validEntries = [];
  const errors = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    let { date, weight } = entry;

    // Normalize date format
    date = normalizeDate(date);
    if (!date) {
      errors.push(`Row ${i + 1}: Invalid date`);
      continue;
    }

    // Validate weight
    const weightNum = parseFloat(weight);
    if (isNaN(weightNum) || weightNum <= 0) {
      errors.push(`Row ${i + 1}: Invalid weight`);
      continue;
    }

    validEntries.push({ date, weight: weightNum });
  }

  if (validEntries.length === 0) {
    return res.status(400).json({ error: 'No valid entries', details: errors });
  }

  try {
    const count = db.bulkImportEntries(validEntries);
    res.json({
      success: true,
      imported: count,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Error importing entries:', error);
    res.status(500).json({ error: 'Failed to import entries' });
  }
});

/**
 * Export entries as CSV
 */
router.get('/export', (req, res) => {
  try {
    const entries = db.getEntries();

    // Sort by date ascending for export
    entries.sort((a, b) => a.date.localeCompare(b.date));

    // Generate CSV
    let csv = 'date,weight\n';
    for (const entry of entries) {
      csv += `${entry.date},${entry.weight}\n`;
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="textweight-export.csv"');
    res.send(csv);
  } catch (error) {
    console.error('Error exporting entries:', error);
    res.status(500).json({ error: 'Failed to export entries' });
  }
});

/**
 * Export for Apple Health (XML format)
 */
router.get('/export/apple-health', (req, res) => {
  try {
    const entries = db.getEntries();
    const displayUnit = db.getSetting('display_unit') || 'lbs';

    // Sort by date ascending
    entries.sort((a, b) => a.date.localeCompare(b.date));

    // Generate Apple Health compatible XML
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<!DOCTYPE HealthData>\n';
    xml += '<HealthData locale="en_US">\n';
    xml += '  <ExportDate value="' + new Date().toISOString() + '"/>\n';

    for (const entry of entries) {
      // Convert to kg for Apple Health (it uses metric internally)
      const weightKg = displayUnit === 'kg' ? entry.weight : entry.weight * 0.453592;
      const dateTime = entry.date + 'T08:00:00-06:00'; // Default to 8 AM

      xml += '  <Record type="HKQuantityTypeIdentifierBodyMass"';
      xml += ` sourceName="TextWeight"`;
      xml += ` unit="kg"`;
      xml += ` creationDate="${dateTime}"`;
      xml += ` startDate="${dateTime}"`;
      xml += ` endDate="${dateTime}"`;
      xml += ` value="${weightKg.toFixed(2)}"`;
      xml += '/>\n';
    }

    xml += '</HealthData>';

    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', 'attachment; filename="textweight-apple-health.xml"');
    res.send(xml);
  } catch (error) {
    console.error('Error exporting for Apple Health:', error);
    res.status(500).json({ error: 'Failed to export' });
  }
});

/**
 * Get pending entry status
 */
router.get('/pending', (req, res) => {
  try {
    const pending = db.getPendingEntry();
    res.json({ pending: pending || null });
  } catch (error) {
    console.error('Error fetching pending:', error);
    res.status(500).json({ error: 'Failed to fetch pending status' });
  }
});

/**
 * Normalize date to YYYY-MM-DD format
 */
function normalizeDate(dateStr) {
  if (!dateStr) return null;

  // Already in correct format
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }

  // MM/DD/YYYY format
  const mdyMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdyMatch) {
    const month = mdyMatch[1].padStart(2, '0');
    const day = mdyMatch[2].padStart(2, '0');
    return `${mdyMatch[3]}-${month}-${day}`;
  }

  return null;
}

module.exports = router;

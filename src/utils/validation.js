// Weight validation utilities

const OUTLIER_THRESHOLD = 0.15; // 15%

/**
 * Validate weight input format
 * Accepts: 185, 185.5, 185.0
 * Rejects: 185.55, 185 lbs, text
 */
function parseWeight(input) {
  if (typeof input !== 'string') return null;

  const trimmed = input.trim();

  // Must be a number with at most one decimal place
  const match = trimmed.match(/^(\d+)(?:\.(\d))?$/);
  if (!match) return null;

  const weight = parseFloat(trimmed);

  // Sanity check - must be positive
  if (weight <= 0 || isNaN(weight)) return null;

  return weight;
}

/**
 * Check if weight is an outlier compared to previous weight
 * Returns true if weight is more than 15% different from previous
 */
function isOutlier(newWeight, previousWeight) {
  if (previousWeight === null || previousWeight === undefined) {
    return false; // No previous weight to compare
  }

  const percentChange = Math.abs(newWeight - previousWeight) / previousWeight;
  return percentChange > OUTLIER_THRESHOLD;
}

/**
 * Format weight for display
 */
function formatWeight(weight, unit = 'lbs') {
  const value = unit === 'kg' ? weight * 0.453592 : weight;
  return `${value.toFixed(1)} ${unit}`;
}

module.exports = {
  parseWeight,
  isOutlier,
  formatWeight,
  OUTLIER_THRESHOLD
};

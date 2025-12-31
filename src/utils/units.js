// Unit conversion utilities

const LBS_TO_KG = 0.453592;
const KG_TO_LBS = 2.20462;

/**
 * Convert pounds to kilograms
 */
function lbsToKg(lbs) {
  return lbs * LBS_TO_KG;
}

/**
 * Convert kilograms to pounds
 */
function kgToLbs(kg) {
  return kg * KG_TO_LBS;
}

/**
 * Convert weight to display unit
 * Internal storage is always in lbs
 */
function toDisplayUnit(weightLbs, displayUnit) {
  if (displayUnit === 'kg') {
    return lbsToKg(weightLbs);
  }
  return weightLbs;
}

/**
 * Convert from display unit to lbs for storage
 */
function fromDisplayUnit(weight, displayUnit) {
  if (displayUnit === 'kg') {
    return kgToLbs(weight);
  }
  return weight;
}

/**
 * Format weight with unit suffix
 */
function formatWithUnit(weightLbs, displayUnit) {
  const value = toDisplayUnit(weightLbs, displayUnit);
  return `${value.toFixed(1)} ${displayUnit}`;
}

module.exports = {
  lbsToKg,
  kgToLbs,
  toDisplayUnit,
  fromDisplayUnit,
  formatWithUnit,
  LBS_TO_KG,
  KG_TO_LBS
};

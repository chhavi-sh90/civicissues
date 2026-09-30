// src/utils/generateRefId.js
// Generates reference codes like "CC-2026-000123". The numeric part is
// derived from the next auto-increment complaint id, so it's guaranteed
// unique as long as it's generated AFTER the row is inserted (see
// complaintModel.js, which inserts first, then updates reference_code
// in the same transaction).

function generateRefId(complaintId, date = new Date()) {
  const year = date.getFullYear();
  const padded = String(complaintId).padStart(6, '0');
  return `CC-${year}-${padded}`;
}

module.exports = generateRefId;

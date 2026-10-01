// src/services/analyticsService.js
//
// All queries here return ONLY aggregated counts/averages — never a raw
// list of complaints with citizen names/emails — per the project's
// "authorized/aggregated data only" requirement for dashboards.

const { pool } = require('../config/db');
const complaintModel = require('../models/complaintModel');
const categorizationService = require('./categorizationService');

function dateRangeClause(from, to, column = 'c.created_at') {
  const conditions = [];
  const values = [];
  if (from) {
    conditions.push(`${column} >= ?`);
    values.push(from);
  }
  if (to) {
    conditions.push(`${column} <= ?`);
    values.push(to);
  }
  return { clause: conditions.join(' AND '), values };
}

/** Totals + counts by status. Optionally scoped to one department. */
async function getSummary({ from, to, department_id } = {}) {
  const conditions = [];
  const values = [];

  const { clause, values: dateValues } = dateRangeClause(from, to);
  if (clause) conditions.push(clause);
  values.push(...dateValues);

  if (department_id) {
    conditions.push('c.department_id = ?');
    values.push(department_id);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [totalRows] = await pool.query(`SELECT COUNT(*) AS total FROM complaints c ${where}`, values);
  const [statusRows] = await pool.query(
    `SELECT status, COUNT(*) AS count FROM complaints c ${where} GROUP BY status`,
    values
  );

  const byStatus = {
    submitted: 0,
    under_review: 0,
    assigned: 0,
    in_progress: 0,
    resolved: 0,
    rejected: 0,
  };
  statusRows.forEach((row) => {
    byStatus[row.status] = row.count;
  });

  return {
    total: totalRows[0].total,
    pending: byStatus.submitted + byStatus.under_review + byStatus.assigned,
    in_progress: byStatus.in_progress,
    resolved: byStatus.resolved,
    rejected: byStatus.rejected,
    by_status: byStatus,
  };
}

async function getByCategory({ from, to, department_id } = {}) {
  const conditions = [];
  const values = [];
  const { clause, values: dateValues } = dateRangeClause(from, to);
  if (clause) conditions.push(clause);
  values.push(...dateValues);
  if (department_id) {
    conditions.push('c.department_id = ?');
    values.push(department_id);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [rows] = await pool.query(
    `SELECT cat.id AS category_id, cat.name AS category_name, COUNT(*) AS count
     FROM complaints c
     JOIN categories cat ON cat.id = c.category_id
     ${where}
     GROUP BY cat.id, cat.name
     ORDER BY count DESC`,
    values
  );
  return rows;
}

async function getByDepartment({ from, to } = {}) {
  const { clause, values } = dateRangeClause(from, to);
  const where = clause ? `WHERE ${clause}` : '';

  const [rows] = await pool.query(
    `SELECT dep.id AS department_id, dep.name AS department_name, COUNT(*) AS count
     FROM complaints c
     LEFT JOIN departments dep ON dep.id = c.department_id
     ${where}
     GROUP BY dep.id, dep.name
     ORDER BY count DESC`,
    values
  );
  return rows;
}

/** Average resolution time in hours, overall and per category. */
async function getResolutionTime({ from, to, department_id } = {}) {
  const conditions = [`c.status = 'resolved'`, 'c.resolved_at IS NOT NULL'];
  const values = [];

  const { clause, values: dateValues } = dateRangeClause(from, to);
  if (clause) conditions.push(clause);
  values.push(...dateValues);

  if (department_id) {
    conditions.push('c.department_id = ?');
    values.push(department_id);
  }

  const where = `WHERE ${conditions.join(' AND ')}`;

  const [overallRows] = await pool.query(
    `SELECT AVG(TIMESTAMPDIFF(HOUR, c.created_at, c.resolved_at)) AS avg_hours
     FROM complaints c ${where}`,
    values
  );

  const [byCategoryRows] = await pool.query(
    `SELECT cat.name AS category_name,
            AVG(TIMESTAMPDIFF(HOUR, c.created_at, c.resolved_at)) AS avg_hours
     FROM complaints c
     JOIN categories cat ON cat.id = c.category_id
     ${where}
     GROUP BY cat.name
     ORDER BY avg_hours ASC`,
    values
  );

  return {
    overall_avg_hours: overallRows[0].avg_hours !== null ? Number(overallRows[0].avg_hours).toFixed(1) : null,
    by_category: byCategoryRows.map((r) => ({
      category_name: r.category_name,
      avg_hours: r.avg_hours !== null ? Number(r.avg_hours).toFixed(1) : null,
    })),
  };
}

/** Time-series complaint counts, grouped by day/week/month. */
async function getTrends({ from, to, group_by = 'day' } = {}) {
  const { clause, values } = dateRangeClause(from, to);
  const where = clause ? `WHERE ${clause}` : '';

  const formatMap = {
    day: '%Y-%m-%d',
    week: '%x-W%v',
    month: '%Y-%m',
  };
  const format = formatMap[group_by] || formatMap.day;

  const [rows] = await pool.query(
    `SELECT DATE_FORMAT(c.created_at, ?) AS period, COUNT(*) AS count
     FROM complaints c
     ${where}
     GROUP BY period
     ORDER BY period ASC`,
    [format, ...values]
  );
  return rows;
}

/**
 * Recurring-issue "hotspots": groups complaints by coordinates rounded
 * to ~3 decimal places (roughly 100m precision), so multiple reports of
 * the same real-world pothole cluster together without needing external
 * geocoding.
 */
async function getHotspots({ from, to } = {}) {
  const { clause, values } = dateRangeClause(from, to);
  const where = clause ? `WHERE ${clause}` : '';

  const [rows] = await pool.query(
    `SELECT
        ROUND(c.latitude, 3) AS latitude,
        ROUND(c.longitude, 3) AS longitude,
        COUNT(*) AS count,
        GROUP_CONCAT(DISTINCT cat.name) AS categories
     FROM complaints c
     JOIN categories cat ON cat.id = c.category_id
     ${where}
     GROUP BY latitude, longitude
     HAVING count > 1
     ORDER BY count DESC
     LIMIT 50`,
    values
  );
  return rows;
}

/**
 * AI-assisted analysis for one complaint. If an external ML endpoint is
 * configured, its classification is used. Otherwise the response clearly
 * identifies the built-in keyword/risk heuristic as rule-based.
 */
async function analyzeComplaint(complaintId) {
  const complaint = await complaintModel.findById(complaintId);
  if (!complaint) return null;

  const classification = await categorizationService.suggestCategory({
    title: complaint.title,
    description: complaint.description,
  });

  const priorityBase = { low: 30, medium: 50, high: 72, critical: 88 };
  const ageDays = Math.max(
    0,
    Math.floor((Date.now() - new Date(complaint.created_at).getTime()) / (1000 * 60 * 60 * 24))
  );
  const urgentKeywords = ['danger', 'accident', 'emergency', 'blocked', 'overflow', 'fire', 'injury'];
  const normalizedText = `${complaint.title} ${complaint.description}`.toLowerCase();
  const matchedUrgentKeywords = urgentKeywords.filter((keyword) => normalizedText.includes(keyword));
  const priorityScore = Math.min(
    100,
    (priorityBase[complaint.priority] || priorityBase.medium) +
      Math.min(ageDays, 10) +
      matchedUrgentKeywords.length * 5
  );

  const [duplicateRows] = await pool.execute(
    `SELECT COUNT(*) AS duplicate_count
       FROM complaints
      WHERE id <> ?
        AND category_id = ?
        AND ABS(latitude - ?) <= 0.002
        AND ABS(longitude - ?) <= 0.002`,
    [complaint.id, complaint.category_id, complaint.latitude, complaint.longitude]
  );
  const duplicateCount = duplicateRows[0].duplicate_count;
  const riskLevel = priorityScore >= 85 ? 'critical' : priorityScore >= 65 ? 'high' : priorityScore >= 45 ? 'medium' : 'low';

  let recommendation = 'Route through the standard department workflow and monitor citizen updates.';
  if (priorityScore >= 85) {
    recommendation = 'Escalate immediately, dispatch a field team, and provide the citizen with a response timeline.';
  } else if (priorityScore >= 65) {
    recommendation = 'Prioritize departmental review and share an estimated action timeline with the citizen.';
  } else if (duplicateCount > 0) {
    recommendation = 'Review nearby matching reports together and coordinate a single area-level response.';
  }

  return {
    complaint_id: complaint.id,
    reference_code: complaint.reference_code,
    title: complaint.title,
    classification: {
      category_id: classification.category?.id || null,
      category_name: classification.category?.name || 'Unclassified',
      method: classification.method,
      confidence: classification.confidence,
      matched_keywords: classification.matched_keywords,
    },
    priority_score: priorityScore,
    risk_level: riskLevel,
    possible_duplicates: duplicateCount,
    duplicate_radius_meters: 220,
    signals: {
      configured_priority: complaint.priority,
      age_days: ageDays,
      urgent_keywords: matchedUrgentKeywords,
    },
    recommendation,
  };
}

module.exports = {
  getSummary,
  getByCategory,
  getByDepartment,
  getResolutionTime,
  getTrends,
  getHotspots,
  analyzeComplaint,
};

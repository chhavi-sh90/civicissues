// src/services/categorizationService.js
//
// LIMITATION (stated explicitly, per project requirements):
// No trained ML model is included in this project. This service provides
// a RULE-BASED fallback that suggests a category by keyword-matching the
// complaint's title/description against known category names/slugs.
// It is intentionally simple and beginner-readable, not a substitute for
// a real NLP classifier.
//
// If you later train a model, set ML_CATEGORIZATION_ENDPOINT in .env to
// point at an HTTP endpoint that accepts { title, description } and
// returns { category_slug, confidence }. This service will call it first
// and only fall back to rules if the call fails or is unconfigured.

const env = require('../config/env');
const logger = require('../utils/logger');
const categoryModel = require('../models/categoryModel');

// Keyword map: category slug -> array of trigger words/phrases.
// Extend this list as needed; it directly drives suggestCategory().
const KEYWORD_MAP = {
  potholes: ['pothole', 'road damage', 'broken road', 'crater', 'cracked road'],
  garbage: ['garbage', 'trash', 'litter', 'waste', 'dump', 'dumping'],
  streetlights: ['streetlight', 'street light', 'lamp post', 'lamppost', 'light not working'],
  drainage: ['drain', 'drainage', 'sewage', 'sewer', 'overflow', 'clogged'],
  'water-supply': ['water supply', 'water leak', 'no water', 'pipe burst', 'leakage'],
};

function ruleBasedSuggestion(text) {
  const normalized = text.toLowerCase();
  for (const [slug, keywords] of Object.entries(KEYWORD_MAP)) {
    const matchedKeywords = keywords.filter((keyword) => normalized.includes(keyword));
    if (matchedKeywords.length > 0) {
      return {
        slug,
        matchedKeywords,
        confidence: Math.min(0.55 + matchedKeywords.length * 0.1, 0.9),
      };
    }
  }
  return { slug: 'other', matchedKeywords: [], confidence: 0.35 };
}

async function callMlEndpoint(title, description) {
  if (!env.ML_CATEGORIZATION_ENDPOINT) return null;

  try {
    // Node 18+ has global fetch available.
    const res = await fetch(env.ML_CATEGORIZATION_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description }),
      signal: AbortSignal.timeout(3000), // don't hang the request pipeline
    });

    if (!res.ok) throw new Error(`ML endpoint returned status ${res.status}`);
    const data = await res.json();
    if (!data.category_slug) return null;
    return {
      slug: data.category_slug,
      confidence: Number.isFinite(Number(data.confidence)) ? Number(data.confidence) : null,
      matchedKeywords: [],
    };
  } catch (err) {
    logger.warn(`ML categorization endpoint unavailable, falling back to rules: ${err.message}`);
    return null;
  }
}

/**
 * Suggests a category for a complaint. Prefers an ML endpoint if
 * configured and reachable; otherwise uses keyword rules. Always
 * resolves to a REAL category row in the database — if the suggested
 * slug doesn't exist, falls back to "other" (or the first active
 * category if "other" itself hasn't been seeded).
 */
async function suggestCategory({ title, description }) {
  const combinedText = `${title} ${description}`;

  let suggestion = await callMlEndpoint(title, description);
  const usedMl = Boolean(suggestion);

  if (!suggestion) {
    suggestion = ruleBasedSuggestion(combinedText);
  }

  let category = await categoryModel.findBySlug(suggestion.slug);
  if (!category) {
    category = await categoryModel.findBySlug('other');
  }
  if (!category) {
    const all = await categoryModel.listAll({ onlyActive: true });
    category = all[0] || null;
  }

  return {
    category,
    method: usedMl ? 'ml' : 'rule-based',
    confidence: suggestion.confidence,
    matched_keywords: suggestion.matchedKeywords,
  };
}

module.exports = { suggestCategory };

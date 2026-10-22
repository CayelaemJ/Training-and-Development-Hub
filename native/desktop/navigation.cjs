'use strict';

// CABO is deliberately online-first. Release engineers must approve a stable
// production origin here before distributing installers to learners.
const PORTAL_URL = 'https://cabo-learning-hub-pilot.onrender.com/';
const PORTAL_ORIGIN = new URL(PORTAL_URL).origin;
const OIDC_ORIGINS = new Set(['replit.com', 'accounts.google.com']);

function allowsNavigation(raw) {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || url.username || url.password) return false;
    return url.origin === PORTAL_ORIGIN ||
      OIDC_ORIGINS.has(url.hostname) || url.hostname.endsWith('.replit.com');
  } catch {
    return false;
  }
}

module.exports = { PORTAL_URL, allowsNavigation };

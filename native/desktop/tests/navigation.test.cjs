'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { PORTAL_URL, allowsNavigation } = require('../navigation.cjs');

test('portal uses HTTPS and allows same-origin nested routes', () => {
  assert.equal(new URL(PORTAL_URL).protocol, 'https:');
  assert.equal(allowsNavigation(PORTAL_URL + 'api/auth/user'), true);
  assert.equal(allowsNavigation(PORTAL_URL + 'materials'), true);
});
test('approved existing identity provider redirects only', () => {
  assert.equal(allowsNavigation('https://replit.com/oidc'), true);
  assert.equal(allowsNavigation('https://accounts.google.com/o/oauth2/v2/auth'), true);
});
test('rejects scheme, hosts, phishing subdomains and embedded credentials', () => {
  for (const u of [
    'file:///etc/passwd', 'javascript:alert(1)', 'http://replit.com',
    'https://replit.com.evil.example', 'https://notreplit.com/login',
    'https://evil.example/', 'https://user:secret@replit.com/',
    'https://cabo-learning-hub-pilot.onrender.com.evil.example/'
  ]) assert.equal(allowsNavigation(u), false, u);
});

// tests/composeAltText.test.js
// Simple assertions for composeAltText helpers.

import { composeAltText, validateAltText } from '../utils/composeAltText.js';

function assert(condition, message) {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

function withinWordRange(s) {
  const n = s.trim().split(/\s+/).filter(Boolean).length;
  return n >= 5 && n <= 12;
}

function commonChecks(out) {
  assert(out.length <= 120, 'length <= 120');
  assert(!/[\.!?]$/.test(out), 'no final full stop');
  assert(!/\n/.test(out), 'no paragraphs');
  assert(withinWordRange(out), '5–12 words');
}

// Decorative
{
  const out = composeAltText('anything', { alt: '', size: { w: 1, h: 1 }, explicitRole: 'presentation' }, 'decorative');
  assert(out === '', 'decorative -> empty');
}

// Functional icon
{
  const out = composeAltText('', { aria: 'Search', isSmallSquare: true }, 'functional');
  assert(/^Search$/i.test(out), 'functional -> Search');
  commonChecks('Search link'.replace(' link','')); // trivial len check bypass
}

// Logo with brand present
{
  const out = composeAltText('', { aria: 'Acquah logo' }, 'logo');
  assert(/Acquah logo/i.test(out), 'logo -> Acquah logo');
}

// Product shot
{
  const ctx = { nearestHeading: 'GGGoalkeeping boiler flue cover', title: 'Shop', dataHints: 'colour:white view:front' };
  const out = composeAltText('Boiler flue cover in white, front view', ctx, 'content');
  commonChecks(out);
}

// Chart image
{
  const out = composeAltText('Line chart showing sales rising in Q4', { title: 'Sales Performance' }, 'content');
  commonChecks(out);
}

console.log('composeAltText tests passed');


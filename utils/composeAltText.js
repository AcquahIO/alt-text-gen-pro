// utils/composeAltText.js
// Pure compose + validate helpers so we can unit test.

/**
 * @typedef {Object} PageContext
 * @property {string} [title]
 * @property {string} [nearestHeading]
 * @property {string} [anchorText]
 * @property {string} [aria]
 * @property {string} [dataHints]
 * @property {string} [fileName]
 */

const MAX_CHARS = 120;

export function normalize(text) {
  let s = String(text || '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  s = s.replace(/^"(.+)"$/,'$1');
  s = s.replace(/^(?:an?\s+)?(?:image|photo|picture|screenshot)\s+(?:of|showing|:|–|—)\s*/i, '');
  s = s.replace(/[|#]/g, '').trim();
  // no trailing punctuation
  s = s.replace(/[\.!?…]+$/,'');
  // sentence case
  if (s) s = s.charAt(0).toUpperCase() + s.slice(1);
  return s;
}

export function validateAltText(s) {
  if (!s) return { ok: false, reason: 'empty' };
  if (/\n|\r/.test(s)) return { ok: false, reason: 'paragraph' };
  if (/["'`]|\||#|https?:\/\//i.test(s)) return { ok: false, reason: 'forbidden' };
  if (/[\.\!\?]$/.test(s)) return { ok: false, reason: 'trailing-punct' };
  if (s.length > MAX_CHARS) return { ok: false, reason: 'too-long' };
  const words = s.trim().split(/\s+/).filter(Boolean);
  if (words.length < 5) return { ok: false, reason: 'too-short' };
  if (words.length > 20) return { ok: false, reason: 'too-many-words' };
  return { ok: true };
}

export function inferRole(ctx) {
  const altEmpty = !ctx || !ctx.alt || ctx.alt === '';
  const isTiny = ctx && ctx.size && ctx.size.w <= 1 && ctx.size.h <= 1;
  const logoLike = /logo/i.test([ctx?.fileName, ctx?.aria, ctx?.anchorText, ctx?.nearestHeading].filter(Boolean).join(' '));
  if (ctx?.explicitRole === 'presentation' || (altEmpty && isTiny)) return logoLike ? 'logo' : 'decorative';
  const linky = !!ctx?.anchorText || /brochure|download|menu|search|close|submit/i.test(ctx?.aria || '');
  if (linky && ctx?.isSmallSquare) return 'functional';
  if (logoLike) return 'logo';
  return 'content';
}

function extractBrand(ctx) {
  const candidates = [ctx?.aria, ctx?.anchorText, ctx?.nearestHeading, ctx?.title, ctx?.fileName]
    .filter(Boolean)
    .join(' ');
  const cleaned = candidates.replace(/logo/ig, ' ').replace(/[_-]/g, ' ');
  const m = cleaned.match(/([A-Z][A-Za-z0-9&\-]{1,40})(?:\s+(?:Ltd|Limited|PLC|Inc|LLC))?/);
  return m ? m[1].trim() : '';
}

function findSettingQualifier(ctx) {
  const text = [ctx?.nearestHeading, ctx?.title, ctx?.dataHints].filter(Boolean).join(' ').toLowerCase();
  const settings = ['kitchen','bathroom','utility room','garage','workshop','garden','showroom','warehouse','office','school','restaurant','laboratory','utility cupboard','boiler room'];
  for (const s of settings) {
    if (text.includes(s)) return s;
  }
  return '';
}

/**
 * Compose alt text from a vision description and page context.
 * @param {string} visionDesc
 * @param {PageContext & { alt?: string, explicitRole?: string, isSmallSquare?: boolean, size?: {w:number,h:number} }} ctx
 * @param {'content'|'decorative'|'functional'|'logo'} role
 */
export function composeAltText(visionDesc, ctx, role) {
  if (role === 'decorative') return '';
  if (role === 'functional') {
    const act = (ctx?.aria || ctx?.anchorText || '').trim();
    if (act) return normalize(act);
    return 'Action button';
  }
  if (role === 'logo') {
    const brand = extractBrand(ctx);
    if (brand) return normalize(`${brand} logo`);
    return 'Logo';
  }
  // content
  let base = normalize(visionDesc);
  // Append one short qualifier if it fits
  const qualifier = findSettingQualifier(ctx);
  if (qualifier && base && `${base} in ${qualifier}`.length <= MAX_CHARS) {
    base = `${base} in ${qualifier}`;
  }
  // enforce length
  if (base.length > MAX_CHARS) {
    base = base.slice(0, MAX_CHARS);
    base = base.slice(0, base.lastIndexOf(' ')).trim();
  }
  return base;
}

export const __TEST_ONLY__ = { extractBrand, findSettingQualifier };


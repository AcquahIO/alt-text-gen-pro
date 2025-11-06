// utils/aiClient.js
// Provides a generic AI client. If no endpoint configured, falls back to a local heuristic.

export async function generateAltText(input) {
  const { imageUrl, imageBase64, context = {} } = input || {};
  const cfg = await chrome.storage.sync.get({ apiEndpoint: '', apiKey: '', model: '', language: '', provider: 'openai' });
  const endpoint = (cfg.apiEndpoint || '').trim();
  const apiKey = (cfg.apiKey || '').trim();
  const provider = (cfg.provider || 'openai').trim();
  const model = (cfg.model || '').trim();
  const uiLang = chrome?.i18n?.getUILanguage?.() || navigator.language || '';
  const language = (cfg.language || '').trim() || uiLang;

  // Prefer native OpenAI path when selected and apiKey available
  if (provider === 'openai' && apiKey) {
    try {
      const alt = await openaiAlt({ apiKey, model, language, imageUrl, imageBase64, context });
      if (alt && String(alt).trim()) return normalizeAlt(alt);
    } catch (e) {
      // fall through to other options/heuristic
      console.error('OpenAI call failed', e);
    }
  }

  // Generic JSON API if configured
  if (endpoint) {
    // Generic JSON API: { image_url | image_base64, context, model }
    const body = { model: model || 'auto', language, context };
    if (imageUrl) body.image_url = imageUrl;
    if (imageBase64) body.image_base64 = imageBase64;

    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    const res = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(body) });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`API error ${res.status}: ${text || res.statusText}`);
    }
    const data = await res.json();
    // Expected response shape: { alt_text: string } or { choices: [{ text: string }] }
    const alt = data.alt_text || data.description || data.text || data?.choices?.[0]?.text || '';
    if (alt && String(alt).trim()) return normalizeAlt(alt);
  }

  // Fallback: heuristic
  const h = await heuristicAlt({ imageUrl, imageBase64, context });
  return normalizeAlt(h);
}

async function openaiAlt({ apiKey, model, language, imageUrl, imageBase64, context }) {
  const m = model || 'gpt-4o-mini';
  const url = 'https://api.openai.com/v1/chat/completions';

  const instruction = buildPrompt(language, context);
  const systemPrompt = buildSystemPrompt();
  const image = imageUrl || imageBase64; // data URL works as well
  if (!image) return '';

  const body = {
    model: m,
    temperature: 0.1,
    max_tokens: 120,
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: [
          { type: 'text', text: instruction },
          { type: 'image_url', image_url: { url: image } },
        ],
      },
    ],
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`OpenAI error ${res.status}: ${text || res.statusText}`);
  }
  const data = await res.json();
  const alt = data?.choices?.[0]?.message?.content || '';
  return String(alt || '').trim();
}

function buildPrompt(language, context = {}) {
  const { pageTitle, metaDescription, nearbyText, imgAlt, userContext, pageLang, image_role, image_notes } = context || {};
  const langNote = language ? `UK English (${language})` : 'UK English';
  const lines = [];
  const page_context = [pageTitle, metaDescription, nearbyText, userContext].filter(Boolean).map(sanitize).join(' | ');
  if (page_context) lines.push(`page_context: ${page_context}`);
  if (image_role) lines.push(`image_role: ${image_role}`);
  if (image_notes) lines.push(`image_notes: ${sanitize(image_notes)}`);
  if (imgAlt) lines.push(`existing_alt: ${sanitize(imgAlt)}`);
  if (pageLang) lines.push(`page_language: ${pageLang}`);
  lines.push(`output_language: ${langNote}`);
  return lines.join('\n');
}

function buildSystemPrompt() {
  return (
    'You are an alt-text generator for websites. Output ONE concise alt text line only.\n' +
    '\n' +
    'Rules:\n' +
    '- Language: UK English (use spellings like “colour”).\n' +
    '- Length: 5–12 words where possible; never exceed 120 characters.\n' +
    '- Style: sentence case; no full stop at the end.\n' +
    '- Base the description primarily on the visual content of the image; use page_context only to clarify, never to invent details.\n' +
    '- Accessibility first; include a relevant keyword naturally ONLY if it truly fits. No keyword stuffing or marketing fluff.\n' +
    '- Do NOT write paragraphs, captions, file names, or extra commentary.\n' +
    '- Do NOT use quotes, emojis, hashtags, pipes, lists, or prefixes like “Image of”.\n' +
    '- Avoid subjective/sensitive traits (e.g., race, disability, attractiveness) unless explicitly provided.\n' +
    '\n' +
    'Special cases:\n' +
    '- Decorative/spacer images: return an empty string.\n' +
    '- Functional images (icons/buttons/linked images): describe the action or destination (e.g., Search, Download brochure (PDF)).\n' +
    '- Logos: “<Brand> logo”.\n' +
    '- Product images: include brand/model if provided, key attributes (colour/variant/material), and view/angle (e.g., “Nike Air Zoom trainer in blue, side view”).\n' +
    '- People: number of people, activity, clear setting (e.g., “Two chefs preparing pasta in a restaurant kitchen”).\n' +
    '- Places: name, landmark/view/time if relevant (e.g., “Sunrise over Tower Bridge from the south bank”).\n' +
    '- Charts/infographics/text-in-image: summarise the key message in ≤ 80 characters.\n' +
    '\n' +
    'Input you may receive (optional, use if present):\n' +
    '- page_context (e.g., page title, category, target keyword, brand)\n' +
    '- image_role: content | decorative | functional | logo\n' +
    '- image_notes: short description (e.g., colour, variant, angle, setting, action)\n' +
    '\n' +
    'Output:\n' +
    '- Return ONLY the alt text string, nothing else.'
  );
}

// Create a short, single-sentence description when no API or as a final pass
async function heuristicAlt({ imageUrl, imageBase64, context }) {
  const { pageTitle, nearbyText, imgAlt } = context || {};
  // Prefer an existing alt if it's short and descriptive
  const cleanedAlt = normalizeAlt(imgAlt || '');
  if (cleanedAlt && cleanedAlt.split(' ').length >= 3 && cleanedAlt.length <= 140) {
    return cleanedAlt;
  }

  // Extract a concise label from nearby headings/text
  const primary = pickPhrase(nearbyText) || pickPhrase(pageTitle);
  const site = siteFromTitle(pageTitle);
  if (primary && site) return `${primary} at ${site}.`;
  if (primary) return `${primary}.`;

  // As a last resort, use file name hints
  let hint = '';
  try {
    const url = imageUrl || '';
    const name = url.split('/').pop() || '';
    if (name) hint = name.replace(/[\-_]+/g, ' ').replace(/\.[a-z0-9]+(\?.*)?$/i, '').trim();
  } catch {}
  return hint ? `${hint}.` : 'Illustrative photo.';
}

function pickPhrase(text) {
  if (!text) return '';
  const t = String(text).replace(/\s+/g, ' ').trim();
  if (!t) return '';
  // take the first line/sentence-like chunk
  const first = t.split(/(?<=[\.\!\?])\s+|\n|\r/)[0] || t;
  // remove trailing punctuation and overly long parts after dashes/colons
  const cut = first.split(/[–—:\|]/)[0];
  const words = cut.split(' ').slice(0, 12).join(' ');
  // lowercase minor words, keep overall natural casing
  return words.replace(/^\s+|\s+$/g, '');
}

function siteFromTitle(title) {
  if (!title) return '';
  const parts = String(title).split(/[–—\-|•»]/).map((p) => p.trim()).filter(Boolean);
  // common pattern: "Page – Site" or "Site | Page"
  if (parts.length >= 2) return parts[parts.length - 1];
  return parts[0] || '';
}

function normalizeAlt(s) {
  if (!s) return '';
  let out = String(s)
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  // Strip surrounding quotes
  out = out.replace(/^"(.+)"$/,'$1');
  // Remove leading labels like "Image of", "Photo of"
  out = out.replace(/^(?:an?\s+)?(?:image|photo|picture|screenshot)\s+(?:of|showing|:|–|—)\s*/i, '');
  // Keep only the first sentence/line
  const m = out.match(/(.+?)[\.!?](\s|$)/);
  if (m) out = m[1];
  // Remove pipes, emojis, hashtags and extra symbols
  out = out.replace(/[|#]/g, '').trim();
  // Hard limit to 120 chars; try to cut at comma/space
  const max = 120;
  if (out.length > max) {
    const commaCut = out.slice(0, max).lastIndexOf(',');
    const spaceCut = out.slice(0, max).lastIndexOf(' ');
    const cutAt = Math.max(commaCut, spaceCut, 0) || max;
    out = out.slice(0, cutAt).trim();
  }
  // Enforce sentence case-ish: capitalise first letter, keep rest as-is (to preserve brands)
  out = out.charAt(0).toUpperCase() + out.slice(1);
  // No trailing full stop (per spec)
  out = out.replace(/[\.!?…]+$/,'').trim();
  return out;
}

function sanitize(s) {
  return String(s).replace(/[\s\n\r]+/g, ' ').trim();
}

// content.js
// Collects page/image context and renders a lightweight modal for copy/regenerate.

// Utility: find the best-matching <img> for a given srcUrl
function findImageBySrc(srcUrl) {
  const target = new URL(srcUrl, document.baseURI).href;
  let best = null;
  for (const img of document.images) {
    try {
      const href = new URL(img.currentSrc || img.src, document.baseURI).href;
      if (href === target) {
        best = img;
        break;
      }
    } catch (e) {}
  }
  if (!best) {
    // fallback: loose match on pathname
    const u = new URL(target);
    const name = u.pathname.split('/').pop();
    for (const img of document.images) {
      const s = img.currentSrc || img.src || '';
      if (s.includes(name)) return img;
    }
  }
  return best;
}

let lastContextMenuImageCandidate = null;

function absoluteUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^data:/i.test(raw)) return raw;
  try {
    return new URL(raw, document.baseURI).href;
  } catch {
    return '';
  }
}

function parseBestSrcsetUrl(srcset) {
  const raw = String(srcset || '').trim();
  if (!raw) return '';
  const entries = raw.split(',').map((part) => part.trim()).filter(Boolean);
  let bestUrl = '';
  let bestScore = -1;
  for (const entry of entries) {
    const [url, descriptor] = entry.split(/\s+/);
    if (!url) continue;
    let score = 1;
    if (descriptor?.endsWith('w')) {
      score = parseInt(descriptor, 10) || 1;
    } else if (descriptor?.endsWith('x')) {
      score = Math.round((parseFloat(descriptor) || 1) * 1000);
    }
    if (score >= bestScore) {
      bestScore = score;
      bestUrl = url;
    }
  }
  return absoluteUrl(bestUrl);
}

function extractFirstCssUrl(backgroundImage) {
  const value = String(backgroundImage || '');
  const match = /url\((['"]?)(.*?)\1\)/i.exec(value);
  return match?.[2] ? absoluteUrl(match[2]) : '';
}

function isLikelyDecorativeUrl(url) {
  const text = String(url || '').toLowerCase();
  return /sprite|icon|avatar|logo|badge|favicon|placeholder|pixel/.test(text);
}

function getRectAreaScore(el) {
  try {
    const rect = el.getBoundingClientRect();
    const area = Math.max(0, rect.width) * Math.max(0, rect.height);
    return Math.min(140, area / 3500);
  } catch {
    return 0;
  }
}

function addCandidate(candidateMap, url, baseScore) {
  const normalized = absoluteUrl(url);
  if (!normalized) return;
  let score = Number(baseScore) || 0;
  if (normalized.startsWith('data:')) score -= 25;
  if (isLikelyDecorativeUrl(normalized)) score -= 120;

  const existing = candidateMap.get(normalized);
  if (!existing || score > existing.score) {
    candidateMap.set(normalized, { url: normalized, score });
  }
}

function collectFromElement(el, candidateMap, depthPenalty = 0) {
  if (!(el instanceof Element)) return;
  const areaScore = getRectAreaScore(el);

  if (el instanceof HTMLImageElement) {
    addCandidate(candidateMap, el.currentSrc || el.src, 250 + areaScore - depthPenalty);
    addCandidate(candidateMap, parseBestSrcsetUrl(el.srcset), 220 + areaScore - depthPenalty);
  }
  if (el instanceof HTMLVideoElement) {
    addCandidate(candidateMap, el.poster, 120 + areaScore - depthPenalty);
  }
  if (el instanceof HTMLCanvasElement) {
    try {
      addCandidate(candidateMap, el.toDataURL('image/png'), 140 + areaScore - depthPenalty);
    } catch {}
  }

  const style = window.getComputedStyle(el);
  addCandidate(candidateMap, extractFirstCssUrl(style.backgroundImage), 105 + areaScore - depthPenalty);
  addCandidate(candidateMap, extractFirstCssUrl(window.getComputedStyle(el, '::before').backgroundImage), 90 + areaScore - depthPenalty);
  addCandidate(candidateMap, extractFirstCssUrl(window.getComputedStyle(el, '::after').backgroundImage), 90 + areaScore - depthPenalty);

  addCandidate(candidateMap, el.getAttribute('data-src'), 110 + areaScore - depthPenalty);
  addCandidate(candidateMap, el.getAttribute('data-original'), 108 + areaScore - depthPenalty);
  addCandidate(candidateMap, el.getAttribute('data-lazy-src'), 108 + areaScore - depthPenalty);
  addCandidate(candidateMap, el.getAttribute('src'), 95 + areaScore - depthPenalty);
  addCandidate(candidateMap, parseBestSrcsetUrl(el.getAttribute('srcset')), 98 + areaScore - depthPenalty);
  addCandidate(candidateMap, el.getAttribute('poster'), 95 + areaScore - depthPenalty);

  // Nested media inside cards/links.
  const nestedImgs = el.querySelectorAll('img');
  for (let i = 0; i < nestedImgs.length && i < 16; i += 1) {
    const img = nestedImgs[i];
    const nestedScore = 180 + getRectAreaScore(img) - depthPenalty;
    addCandidate(candidateMap, img.currentSrc || img.src, nestedScore);
    addCandidate(candidateMap, parseBestSrcsetUrl(img.srcset), nestedScore - 5);
  }
  const nestedSources = el.querySelectorAll('source[srcset]');
  for (let i = 0; i < nestedSources.length && i < 10; i += 1) {
    addCandidate(candidateMap, parseBestSrcsetUrl(nestedSources[i].getAttribute('srcset')), 150 - depthPenalty);
  }
}

function collectImageCandidatesFromElement(startEl, point = null) {
  if (!(startEl instanceof Element)) return [];
  const candidateMap = new Map();
  const seedSet = new Set();

  // Walk up from clicked target.
  let node = startEl;
  for (let depth = 0; node && depth < 10; depth += 1, node = node.parentElement) {
    if (!(node instanceof Element)) break;
    if (seedSet.has(node)) continue;
    seedSet.add(node);
    collectFromElement(node, candidateMap, depth * 6);
  }

  // Probe stacked elements at click point (helps with overlays/links on top of images).
  if (point && Number.isFinite(point.x) && Number.isFinite(point.y)) {
    const stack = document.elementsFromPoint(point.x, point.y) || [];
    stack.slice(0, 16).forEach((el, index) => {
      if (!(el instanceof Element) || seedSet.has(el)) return;
      seedSet.add(el);
      collectFromElement(el, candidateMap, index * 5);
      const card = el.closest('a,article,section,figure,li,div');
      if (card instanceof Element && !seedSet.has(card)) {
        seedSet.add(card);
        collectFromElement(card, candidateMap, index * 5 + 2);
      }
    });
  }

  // Nearby fallback: check images around click center for card layouts.
  if (point && Number.isFinite(point.x) && Number.isFinite(point.y)) {
    for (const img of document.images) {
      const src = img.currentSrc || img.src;
      if (!src) continue;
      let rect;
      try {
        rect = img.getBoundingClientRect();
      } catch {
        continue;
      }
      if (!rect || rect.width < 20 || rect.height < 20) continue;
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dist = Math.hypot(cx - point.x, cy - point.y);
      if (dist > 340) continue;
      const proximityBonus = Math.max(0, 80 - dist / 5);
      addCandidate(candidateMap, src, 130 + getRectAreaScore(img) + proximityBonus);
      addCandidate(candidateMap, parseBestSrcsetUrl(img.srcset), 120 + getRectAreaScore(img) + proximityBonus);
    }
  }

  return Array.from(candidateMap.values()).sort((a, b) => b.score - a.score);
}

function rememberContextMenuCandidate(event) {
  const target = event.target instanceof Element ? event.target : null;
  if (!target) {
    lastContextMenuImageCandidate = null;
    return;
  }
  const candidates = collectImageCandidatesFromElement(target, {
    x: Number(event.clientX),
    y: Number(event.clientY),
  });
  lastContextMenuImageCandidate = {
    when: Date.now(),
    srcUrl: candidates[0]?.url || '',
    candidates,
  };
}

document.addEventListener('contextmenu', rememberContextMenuCandidate, true);

function guessMimeFromUrl(url) {
  const clean = String(url || '').split('#')[0].split('?')[0].toLowerCase();
  if (clean.endsWith('.png')) return 'image/png';
  if (clean.endsWith('.webp')) return 'image/webp';
  if (clean.endsWith('.gif')) return 'image/gif';
  if (clean.endsWith('.avif')) return 'image/avif';
  if (clean.endsWith('.bmp')) return 'image/bmp';
  if (clean.endsWith('.svg')) return 'image/svg+xml';
  if (clean.endsWith('.jpg') || clean.endsWith('.jpeg')) return 'image/jpeg';
  return 'image/jpeg';
}

function deriveImageName(url, fallbackIndex) {
  try {
    const parsed = new URL(url, document.baseURI);
    const fileName = decodeURIComponent(parsed.pathname.split('/').pop() || '');
    if (fileName) return fileName;
  } catch {}
  return `image-${fallbackIndex + 1}.jpg`;
}

function collectPageImages(limit = 50) {
  const seen = new Set();
  const images = [];
  let idx = 0;

  for (const img of document.images) {
    const raw = img.currentSrc || img.src || '';
    if (!raw) continue;
    let url = '';
    try {
      url = new URL(raw, document.baseURI).href;
    } catch {
      continue;
    }
    if (!url || seen.has(url)) continue;
    seen.add(url);
    images.push({
      url,
      name: deriveImageName(url, idx),
      type: guessMimeFromUrl(url),
    });
    idx += 1;
    if (images.length >= limit) break;
  }

  return images;
}

function getMetaDescription() {
  const el = document.querySelector('meta[name="description"], meta[property="og:description"]');
  return el?.content || '';
}

function collectNearbyText(img) {
  if (!img) return '';
  // 1) Within <figure> -> <figcaption>
  const figure = img.closest('figure');
  if (figure) {
    const cap = figure.querySelector('figcaption');
    if (cap?.innerText?.trim()) return cap.innerText.trim();
  }
  // 2) Siblings / parent paragraph blocks
  const blocks = [];
  const addText = (el) => {
    if (!el) return;
    const t = el.innerText || el.textContent || '';
    if (t && t.trim()) blocks.push(t.trim());
  };
  addText(img.nextElementSibling);
  addText(img.previousElementSibling);
  const parent = img.parentElement;
  if (parent) {
    addText(parent);
    addText(parent.previousElementSibling);
    addText(parent.nextElementSibling);
  }
  // 3) Preceding heading in DOM tree
  let p = img;
  while (p && p !== document.body) {
    p = p.parentElement;
    const h = p?.querySelector?.('h1, h2, h3, h4, h5, h6');
    if (h?.innerText?.trim()) {
      blocks.push(h.innerText.trim());
      break;
    }
  }
  return blocks.filter(Boolean).slice(0, 3).join(' \n ');
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'collectContext') {
    const img = findImageBySrc(message.srcUrl);
    const context = buildDomContext(img, message.srcUrl);
    sendResponse(context);
    return true;
  }
  if (message?.type === 'collectPageImages') {
    sendResponse({ images: collectPageImages(message.limit || 50) });
    return true;
  }
  if (message?.type === 'getContextMenuImageCandidate') {
    const item = lastContextMenuImageCandidate;
    const isFresh = item && Date.now() - Number(item.when || 0) < 30000;
    sendResponse(isFresh ? item : { srcUrl: '', candidates: [] });
    return true;
  }
  if (message?.type === 'showAltTextModal') {
    renderAltTextModal(message.altText || '', message.srcUrl || '', !!message.isError);
    sendResponse({ ok: true });
    return true;
  }
  if (message?.type === 'updateAltTextModal') {
    updateAltTextModal(message.altText || '');
    sendResponse({ ok: true });
    return true;
  }
  return false;
});

let modalRoot = null;

function buildDomContext(img, srcUrl) {
  const ctx = {
    src: srcUrl || img?.currentSrc || img?.src || '',
    title: document.title || '',
    meta: getMetaDescription(),
    nearestHeading: collectNearbyText(img),
    pageLang: document.documentElement?.lang || navigator.language || '',
    alt: img?.alt || '',
    size: { w: img?.naturalWidth || img?.width || 0, h: img?.naturalHeight || img?.height || 0 },
    isSmallSquare: false,
    anchorText: '',
    aria: '',
    dataHints: '',
    explicitRole: '',
  };
  try {
    const link = img?.closest('a,button,[role="button"]');
    ctx.anchorText = link?.innerText || link?.textContent || '';
    ctx.aria = img?.getAttribute('aria-label') || link?.getAttribute('aria-label') || '';
    ctx.explicitRole = img?.getAttribute('role') || '';
    const styles = window.getComputedStyle(img);
    const w = parseFloat(styles.width) || ctx.size.w;
    const h = parseFloat(styles.height) || ctx.size.h;
    ctx.isSmallSquare = Math.abs(w - h) <= 2 && Math.max(w, h) <= 32;
  } catch {}
  // collect data-* hints
  if (img && img.dataset) {
    ctx.dataHints = Object.entries(img.dataset).map(([k,v])=>`${k}:${v}`).join(' ');
  }
  return ctx;
}

function fallbackNearbyText(el) {
  if (!el) return '';
  const blocks = [];
  const addText = (node) => {
    if (!node) return;
    const t = node.innerText || node.textContent || '';
    if (t && t.trim()) blocks.push(t.trim());
  };
  addText(el.closest('figure')?.querySelector('figcaption'));
  addText(el.closest('section,article,div')?.querySelector('h1,h2,h3'));
  addText(el.closest('section,article,div'));
  return blocks.filter(Boolean).slice(0, 2).join(' \n ');
}

function renderAltTextModal(initialText, srcUrl, isError) {
  destroyModal();
  modalRoot = document.createElement('div');
  modalRoot.style.all = 'initial';
  modalRoot.style.position = 'fixed';
  modalRoot.style.inset = '0';
  modalRoot.style.zIndex = '2147483647';
  modalRoot.style.display = 'flex';
  modalRoot.style.alignItems = 'center';
  modalRoot.style.justifyContent = 'center';
  modalRoot.style.background = 'rgba(11,27,68,0.34)';
  modalRoot.style.padding = '20px';

  const card = document.createElement('div');
  card.style.fontFamily = 'Inter, "Segoe UI", Roboto, -apple-system, system-ui, sans-serif';
  card.style.width = 'min(860px, calc(100vw - 40px))';
  card.style.maxHeight = '84vh';
  card.style.overflow = 'auto';
  card.style.background = '#f8fbff';
  card.style.border = '1px solid #dbeafe';
  card.style.borderRadius = '16px';
  card.style.boxShadow = '0 24px 50px rgba(2,8,23,0.25)';
  card.style.padding = '22px';
  card.style.display = 'flex';
  card.style.flexDirection = 'column';
  card.style.gap = '14px';

  const header = document.createElement('div');
  header.style.display = 'flex';
  header.style.alignItems = 'center';
  header.style.gap = '12px';
  header.style.flexWrap = 'wrap';

  const icon = document.createElement('img');
  try {
    icon.src = chrome.runtime.getURL('icons/icon-32.png');
  } catch {}
  icon.onerror = () => {
    icon.onerror = null;
    icon.src = `data:image/svg+xml;utf8,${encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" rx="8" fill="#eff6ff" stroke="#dbeafe"/><text x="16" y="21" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="12" font-weight="700" fill="#0b1b44">AT</text></svg>'
    )}`;
  };
  icon.alt = '';
  icon.style.width = '30px';
  icon.style.height = '30px';
  icon.style.borderRadius = '8px';
  icon.style.border = '1px solid #dbeafe';
  icon.style.background = '#ffffff';
  header.appendChild(icon);

  const headerText = document.createElement('div');
  headerText.style.display = 'flex';
  headerText.style.flexDirection = 'column';
  headerText.style.gap = '2px';
  headerText.style.flex = '1';

  const title = document.createElement('div');
  title.textContent = isError
    ? (chrome.i18n.getMessage('modal_error') || 'Alt Text Error')
    : (chrome.i18n.getMessage('modal_title') || 'Generated Alt Text');
  title.style.fontSize = '30px';
  title.style.fontWeight = '700';
  title.style.lineHeight = '1.12';
  title.style.letterSpacing = '-0.01em';
  title.style.color = '#0b1b44';
  headerText.appendChild(title);

  const subtitle = document.createElement('div');
  subtitle.textContent = isError
    ? 'Could not generate alt text for this selection.'
    : 'Review, edit, copy, or regenerate.';
  subtitle.style.fontSize = '14px';
  subtitle.style.color = '#64748b';
  headerText.appendChild(subtitle);

  header.appendChild(headerText);
  card.appendChild(header);

  const textarea = document.createElement('textarea');
  textarea.value = initialText;
  textarea.style.fontFamily = 'Inter, "Segoe UI", Roboto, -apple-system, system-ui, sans-serif';
  textarea.style.width = '100%';
  textarea.style.minHeight = '190px';
  textarea.style.fontSize = '16px';
  textarea.style.lineHeight = '1.45';
  textarea.style.color = '#0f172a';
  textarea.style.border = `1px solid ${isError ? '#fecaca' : '#dbeafe'}`;
  textarea.style.background = '#ffffff';
  textarea.style.borderRadius = '14px';
  textarea.style.padding = '14px 16px';
  textarea.style.outline = 'none';
  textarea.style.boxSizing = 'border-box';
  textarea.style.resize = 'vertical';
  textarea.id = 'atg-modal-textarea';
  card.appendChild(textarea);

  // Language selector
  const langRow = document.createElement('div');
  langRow.style.display = 'flex';
  langRow.style.gap = '10px';
  langRow.style.alignItems = 'center';
  langRow.style.flexWrap = 'wrap';

  const langLabel = document.createElement('div');
  langLabel.textContent = 'Language';
  langLabel.style.fontSize = '16px';
  langLabel.style.fontWeight = '600';
  langLabel.style.color = '#0b1b44';

  const langSelect = document.createElement('select');
  langSelect.id = 'atg-lang-select';
  langSelect.style.fontFamily = 'Inter, "Segoe UI", Roboto, -apple-system, system-ui, sans-serif';
  langSelect.style.minHeight = '42px';
  langSelect.style.border = '1px solid #dbeafe';
  langSelect.style.borderRadius = '12px';
  langSelect.style.padding = '8px 12px';
  langSelect.style.fontSize = '15px';
  langSelect.style.fontWeight = '500';
  langSelect.style.background = '#ffffff';
  langSelect.style.color = '#0b1b44';
  langSelect.style.outline = 'none';

  const opts = [
    {v:'', t:'Auto'},
    {v:'en', t:'English'},
    {v:'es', t:'Español'},
    {v:'fr', t:'Français'},
    {v:'de', t:'Deutsch'},
    {v:'pt', t:'Português'},
    {v:'it', t:'Italiano'},
    {v:'ja', t:'日本語'},
    {v:'ko', t:'한국어'},
    {v:'zh', t:'中文'},
    {v:'ar', t:'العربية'},
    {v:'hi', t:'हिन्दी'},
  ];
  for (const o of opts) { const el = document.createElement('option'); el.value = o.v; el.textContent = o.t; langSelect.appendChild(el); }
  chrome.storage.sync.get({ preferredLanguage: '' }, (st) => { try { langSelect.value = st.preferredLanguage || ''; } catch {} });
  langSelect.onchange = async () => {
    try { await chrome.storage.sync.set({ preferredLanguage: langSelect.value }); } catch {}
    // trigger a regenerate with the new language if not error state
    if (!isError) {
      chrome.runtime.sendMessage({ type: 'regenerateAltText', srcUrl, context: { pageLang: langSelect.value } });
    }
  };
  langRow.appendChild(langLabel); langRow.appendChild(langSelect);
  card.appendChild(langRow);

  // Simple counter only (no user options)
  const counter = document.createElement('div');
  counter.id = 'atg-modal-counter';
  counter.style.fontSize = '13px';
  counter.style.color = '#64748b';
  counter.style.alignSelf = 'flex-end';
  counter.style.marginTop = '-4px';
  card.appendChild(counter);
  syncCounter(counter, textarea.value || '');
  textarea.addEventListener('input', () => syncCounter(counter, textarea.value || ''));

  const row = document.createElement('div');
  row.style.display = 'flex';
  row.style.gap = '10px';
  row.style.marginTop = '2px';
  row.style.flexWrap = 'wrap';
  row.style.justifyContent = 'flex-end';

  const copyBtn = document.createElement('button');
  copyBtn.textContent = chrome.i18n.getMessage('btn_copy') || 'Copy to Clipboard';
  styleBtn(copyBtn, 'primary');
  copyBtn.onclick = async () => {
    try {
      await navigator.clipboard.writeText(textarea.value);
      copyBtn.textContent = chrome.i18n.getMessage('btn_copied') || 'Copied!';
      setTimeout(() => (copyBtn.textContent = chrome.i18n.getMessage('btn_copy') || 'Copy to Clipboard'), 1200);
    } catch (e) {}
  };
  row.appendChild(copyBtn);

  if (!isError) {
    const regenBtn = document.createElement('button');
    regenBtn.textContent = chrome.i18n.getMessage('btn_regen') || 'Regenerate';
    styleBtn(regenBtn, 'outline');
    regenBtn.onclick = async () => {
      regenBtn.disabled = true;
      regenBtn.style.opacity = '0.6';
      regenBtn.textContent = 'Regenerating…';
      let context = {};
      try {
        context = buildDomContext(findImageBySrc(srcUrl), srcUrl);
      } catch {}
      chrome.runtime.sendMessage({ type: 'regenerateAltText', srcUrl, context }, (res) => {
        regenBtn.disabled = false;
        regenBtn.style.opacity = '1';
        regenBtn.textContent = chrome.i18n.getMessage('btn_regen') || 'Regenerate';
      });
    };
    row.appendChild(regenBtn);
  }

  const closeBtn = document.createElement('button');
  closeBtn.textContent = chrome.i18n.getMessage('btn_close') || 'Close';
  styleBtn(closeBtn, 'ghost');
  closeBtn.onclick = destroyModal;
  row.appendChild(closeBtn);

  card.appendChild(row);
  modalRoot.appendChild(card);
  modalRoot.addEventListener('click', (e) => {
    if (e.target === modalRoot) destroyModal();
  });
  document.documentElement.appendChild(modalRoot);
}

function syncCounter(counterEl, value) {
  const len = String(value || '').length;
  counterEl.textContent = `${len}/120`;
  counterEl.style.color = len > 120 ? '#b91c1c' : '#64748b';
}

function styleBtn(btn, variant = 'primary') {
  btn.style.fontFamily = 'Inter, "Segoe UI", Roboto, -apple-system, system-ui, sans-serif';
  btn.style.cursor = 'pointer';
  btn.style.padding = '10px 16px';
  btn.style.minHeight = '42px';
  btn.style.borderRadius = '12px';
  btn.style.fontSize = '15px';
  btn.style.fontWeight = '600';
  btn.style.lineHeight = '1';
  btn.style.transition = 'all 120ms ease';
  btn.style.whiteSpace = 'nowrap';

  if (variant === 'outline') {
    btn.style.border = '1px solid #dbeafe';
    btn.style.background = '#ffffff';
    btn.style.color = '#0b1b44';
    return;
  }
  if (variant === 'ghost') {
    btn.style.border = '1px solid #dbeafe';
    btn.style.background = '#f8fbff';
    btn.style.color = '#334155';
    return;
  }
  btn.style.border = '1px solid #0b1b44';
  btn.style.background = '#0b1b44';
  btn.style.color = '#ffffff';
}

function updateAltTextModal(text) {
  const textarea = document.getElementById('atg-modal-textarea');
  if (textarea) textarea.value = text;
  const counter = document.getElementById('atg-modal-counter');
  if (counter) syncCounter(counter, text || '');
}

function destroyModal() {
  if (modalRoot && modalRoot.parentNode) modalRoot.parentNode.removeChild(modalRoot);
  modalRoot = null;
}

function inferImageRole(img) {
  if (!img) return 'content';
  const alt = (img.getAttribute('alt') || '').trim();
  const ariaHidden = img.getAttribute('aria-hidden') === 'true';
  const role = (img.getAttribute('role') || '').toLowerCase();
  const classes = (img.className || '').toLowerCase();
  const srcLower = (img.currentSrc || img.src || '').toLowerCase();
  const isLogoLike = /logo/.test(alt) || /logo/.test(classes) || /logo/.test(srcLower);

  // Decorative if explicitly empty alt or aria-hidden
  const small = (img.naturalWidth || img.width || 0) <= 24 && (img.naturalHeight || img.height || 0) <= 24;
  if (alt === '' || ariaHidden || role === 'presentation' || role === 'none' || small) return isLogoLike ? 'logo' : 'decorative';

  // Functional if inside a link or button
  const link = img.closest('a,button,[role="button"]');
  if (link) return isLogoLike ? 'logo' : 'functional';

  if (isLogoLike) return 'logo';
  return 'content';
}

function buildImageNotes(img) {
  if (!img) return '';
  const role = inferImageRole(img);
  if (role === 'functional') {
    const link = img.closest('a,button,[role="button"]');
    const note = link?.getAttribute('aria-label') || link?.title || link?.innerText || link?.textContent || '';
    return note.trim();
  }
  if (role === 'logo') {
    // try to extract brand from filename or surrounding text
    const src = img.currentSrc || img.src || '';
    const name = src.split('/').pop() || '';
    const brand = name.replace(/[-_]/g, ' ').replace(/\.[a-z0-9]+(\?.*)?$/i, '').replace(/logo/i,'').trim();
    return brand || '';
  }
  // For content images, provide concise nearby heading as note
  const fig = img.closest('figure');
  const cap = fig?.querySelector('figcaption');
  if (cap?.innerText?.trim()) return cap.innerText.trim();
  const h = img.closest('section, article, div')?.querySelector?.('h1,h2,h3');
  if (h?.innerText?.trim()) return h.innerText.trim();
  return '';
}

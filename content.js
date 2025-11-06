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
  modalRoot.style.background = 'rgba(0,0,0,0.35)';

  const card = document.createElement('div');
  card.style.fontFamily = 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
  card.style.width = 'min(640px, calc(100vw - 32px))';
  card.style.maxHeight = '80vh';
  card.style.overflow = 'auto';
  card.style.background = 'white';
  card.style.borderRadius = '12px';
  card.style.boxShadow = '0 10px 30px rgba(0,0,0,0.25)';
  card.style.padding = '16px';

  const title = document.createElement('div');
  title.textContent = (isError ? (chrome.i18n.getMessage('modal_error') || 'Alt Text Error') : (chrome.i18n.getMessage('modal_title') || 'Generated Alt Text'));
  title.style.fontWeight = '600';
  title.style.marginBottom = '8px';
  card.appendChild(title);

  const textarea = document.createElement('textarea');
  textarea.value = initialText;
  textarea.style.width = '100%';
  textarea.style.minHeight = '120px';
  textarea.style.fontSize = '14px';
  textarea.style.lineHeight = '1.4';
  textarea.style.border = '1px solid #ddd';
  textarea.style.borderRadius = '8px';
  textarea.style.padding = '10px';
  textarea.id = 'atg-modal-textarea';
  card.appendChild(textarea);
  // Language selector
  const langRow = document.createElement('div');
  langRow.style.display = 'flex';
  langRow.style.gap = '8px';
  langRow.style.alignItems = 'center';
  langRow.style.margin = '8px 0';
  const langLabel = document.createElement('div');
  langLabel.className = 'muted';
  langLabel.textContent = 'Language';
  const langSelect = document.createElement('select');
  langSelect.id = 'atg-lang-select';
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
  counter.className = 'muted';
  counter.style.margin = '6px 0 0 0';
  counter.style.fontSize = '12px';
  card.appendChild(counter);
  const len = (textarea.value || '').length;
  counter.textContent = `${len}/120`;
  counter.style.color = len > 120 ? '#b00' : '#666';

  const row = document.createElement('div');
  row.style.display = 'flex';
  row.style.gap = '8px';
  row.style.marginTop = '10px';

  const copyBtn = document.createElement('button');
  copyBtn.textContent = chrome.i18n.getMessage('btn_copy') || 'Copy to Clipboard';
  styleBtn(copyBtn);
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
    styleBtn(regenBtn, true);
    regenBtn.onclick = async () => {
      regenBtn.disabled = true;
      regenBtn.textContent = 'Regenerating…';
      const context = await new Promise((resolve) => { chrome.runtime.sendMessage({ type: 'collectContext' }, resolve); }).catch(() => ({}));
      chrome.runtime.sendMessage({ type: 'regenerateAltText', srcUrl, context }, (res) => {
        regenBtn.disabled = false;
        regenBtn.textContent = chrome.i18n.getMessage('btn_regen') || 'Regenerate';
      });
    };
    row.appendChild(regenBtn);
  }

  const closeBtn = document.createElement('button');
  closeBtn.textContent = chrome.i18n.getMessage('btn_close') || 'Close';
  styleBtn(closeBtn);
  closeBtn.onclick = destroyModal;
  row.appendChild(closeBtn);

  card.appendChild(row);
  modalRoot.appendChild(card);
  modalRoot.addEventListener('click', (e) => {
    if (e.target === modalRoot) destroyModal();
  });
  document.documentElement.appendChild(modalRoot);
}

function styleBtn(btn, outlined = false) {
  btn.style.cursor = 'pointer';
  btn.style.padding = '8px 12px';
  btn.style.borderRadius = '8px';
  btn.style.fontSize = '14px';
  btn.style.border = outlined ? '1px solid #555' : '1px solid #0b5';
  btn.style.background = outlined ? '#fff' : '#0b5';
  btn.style.color = outlined ? '#111' : '#fff';
}

function updateAltTextModal(text) {
  const textarea = document.getElementById('atg-modal-textarea');
  if (textarea) textarea.value = text;
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

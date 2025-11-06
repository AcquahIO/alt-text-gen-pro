// utils/i18n.js
export function t(key, substitutions) {
  try {
    const msg = chrome?.i18n?.getMessage?.(key, substitutions);
    if (msg) return msg;
  } catch {}
  return key;
}

export function applyI18n(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    const text = t(key);
    if (text) el.textContent = text;
  });
  root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    const key = el.getAttribute('data-i18n-placeholder');
    const text = t(key);
    if (text) el.setAttribute('placeholder', text);
  });
}


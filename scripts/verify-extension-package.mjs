import { execFileSync } from 'node:child_process';

const archive = process.argv[2];
if (!archive) {
  throw new Error('Usage: node scripts/verify-extension-package.mjs <extension.zip>');
}

function unzipText(entry) {
  return execFileSync('unzip', ['-p', archive, entry], { encoding: 'utf8' });
}

const entries = execFileSync('unzip', ['-Z1', archive], { encoding: 'utf8' })
  .split(/\r?\n/)
  .filter(Boolean);
const entrySet = new Set(entries);
const manifest = JSON.parse(unzipText('manifest.json'));

const declaredResources = new Set([
  manifest.background?.service_worker,
  manifest.action?.default_popup,
  ...Object.values(manifest.action?.default_icon || {}),
  ...Object.values(manifest.icons || {}),
]);
for (const resourceGroup of manifest.web_accessible_resources || []) {
  for (const resource of resourceGroup.resources || []) declaredResources.add(resource);
}
for (const scriptGroup of manifest.content_scripts || []) {
  for (const resource of [...(scriptGroup.js || []), ...(scriptGroup.css || [])]) {
    declaredResources.add(resource);
  }
}
declaredResources.delete(undefined);

const missing = [...declaredResources].filter(resource => !entrySet.has(resource));
if (missing.length) {
  throw new Error(`Manifest resources missing from archive: ${missing.join(', ')}`);
}

if (manifest.content_scripts) {
  throw new Error('Persistent content scripts are not allowed; use activeTab injection.');
}
if (!(manifest.permissions || []).includes('activeTab')) {
  throw new Error('Manifest must declare activeTab.');
}

const broadHostPermission = (manifest.host_permissions || []).find(permission =>
  permission === '<all_urls>' || /^https?:\/\/\*\/\*$/.test(permission),
);
if (broadHostPermission) {
  throw new Error(`Broad persistent host permission found: ${broadHostPermission}`);
}

const forbiddenEntry = entries.find(entry =>
  /(^|\/)(?:node_modules|server|\.git)(?:\/|$)/.test(entry) ||
  /(^|\/)\.env(?:\.|$)/.test(entry) ||
  /openaiClient/i.test(entry),
);
if (forbiddenEntry) {
  throw new Error(`Forbidden archive entry: ${forbiddenEntry}`);
}

for (const entry of entries.filter(name => /\.(?:js|html|json)$/i.test(name))) {
  const source = unzipText(entry);
  if (/api\.openai\.com/i.test(source)) {
    throw new Error(`Direct OpenAI browser endpoint found in ${entry}`);
  }
  if (/\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}/.test(source)) {
    throw new Error(`Possible OpenAI API key found in ${entry}`);
  }
}

const locale = manifest.default_locale;
if (locale && /^__MSG_/.test(manifest.description || '')) {
  const key = manifest.description.slice(6, -2);
  const messages = JSON.parse(unzipText(`_locales/${locale}/messages.json`));
  const description = String(messages[key]?.message || '');
  if (!description || description.length > 132) {
    throw new Error(`Chrome Store description must be 1–132 characters; found ${description.length}.`);
  }
}

console.log(`Verified ${entries.filter(entry => !entry.endsWith('/')).length} packaged files.`);

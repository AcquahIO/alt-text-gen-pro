import crypto from 'node:crypto';
export function randomState(bytes = 32) {
    return crypto.randomBytes(bytes).toString('base64url');
}
export function env(name) {
    const value = process.env[name];
    if (!value)
        throw new Error(`Missing required env var ${name}`);
    return value;
}
export function renderTemplate(template, replacements) {
    let result = template;
    for (const [key, val] of Object.entries(replacements)) {
        result = result.replace(new RegExp(`{{\\s*${key}\\s*}}`, 'g'), val);
    }
    return result;
}
//# sourceMappingURL=utils.js.map
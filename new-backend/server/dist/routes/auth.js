import { Router } from 'express';
import { prisma } from '../db.js';
import { env, randomState, renderTemplate } from '../utils.js';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import argon2 from 'argon2';
import { signAccessToken } from '../jwt.js';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import crypto from 'node:crypto';
import { createRemoteJWKSet, jwtVerify } from 'jose';
const APP_BASE_URL = env('APP_BASE_URL');
const GOOGLE_CLIENT_ID = env('GOOGLE_CLIENT_ID');
const GOOGLE_CLIENT_SECRET = env('GOOGLE_CLIENT_SECRET');
const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const GOOGLE_ISSUER = 'https://accounts.google.com';
const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
const loginHtml = readFileSync(path.resolve(process.cwd(), 'src/html/login.html'), 'utf8');
const limiter = rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: true, legacyHeaders: false });
function base64Url(buffer) {
    return buffer
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
}
function generatePkcePair() {
    const codeVerifier = base64Url(crypto.randomBytes(32));
    const codeChallenge = base64Url(crypto.createHash('sha256').update(codeVerifier).digest());
    return { codeVerifier, codeChallenge };
}
async function issueLoginCode(userId, state, redirectUri) {
    const code = randomState(24);
    await prisma.loginCode.create({
        data: {
            code,
            userId,
            state,
            redirectUri,
            expiresAt: new Date(Date.now() + 60_000),
        },
    });
    return code;
}
async function consumeLoginCode(code) {
    const record = await prisma.loginCode.findUnique({ where: { code } });
    if (!record)
        throw new Error('Invalid code');
    if (record.consumedAt)
        throw new Error('Code already used');
    if (record.expiresAt.getTime() < Date.now())
        throw new Error('Code expired');
    await prisma.loginCode.update({ where: { code }, data: { consumedAt: new Date() } });
    const user = await prisma.user.findUnique({ where: { id: record.userId } });
    if (!user)
        throw new Error('User not found');
    return { user, state: record.state };
}
const router = Router();
router.get('/auth/start', (req, res) => {
    const redirectUri = req.query.redirect_uri;
    const state = req.query.state;
    if (typeof redirectUri !== 'string' || typeof state !== 'string') {
        return res.status(400).send('Missing redirect_uri/state');
    }
    const html = renderTemplate(loginHtml, { REDIRECT_URI: redirectUri, STATE: state });
    res.type('html').send(html);
});
router.get('/auth/google', async (req, res) => {
    const redirectUri = req.query.redirect_uri;
    const state = req.query.state;
    if (typeof redirectUri !== 'string' || typeof state !== 'string') {
        return res.status(400).send('Missing redirect_uri/state');
    }
    const { codeVerifier, codeChallenge } = generatePkcePair();
    const encodedState = Buffer.from(JSON.stringify({ redirect_uri: redirectUri, client_state: state, code_verifier: codeVerifier }), 'utf8').toString('base64url');
    const url = new URL(GOOGLE_AUTH_ENDPOINT);
    url.searchParams.set('client_id', GOOGLE_CLIENT_ID);
    url.searchParams.set('redirect_uri', `${APP_BASE_URL}/auth/google/callback`);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'openid email profile');
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'consent');
    url.searchParams.set('code_challenge', codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');
    url.searchParams.set('state', encodedState);
    res.redirect(url.toString());
});
router.get('/auth/google/callback', async (req, res) => {
    const code = req.query.code;
    const encodedState = req.query.state;
    if (typeof code !== 'string' || typeof encodedState !== 'string') {
        return res.status(400).send('Missing code/state');
    }
    let statePayload;
    try {
        statePayload = JSON.parse(Buffer.from(encodedState, 'base64url').toString('utf8'));
    }
    catch {
        return res.status(400).send('Invalid state payload');
    }
    const tokenResponse = await fetch(GOOGLE_TOKEN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: GOOGLE_CLIENT_ID,
            client_secret: GOOGLE_CLIENT_SECRET,
            grant_type: 'authorization_code',
            code,
            redirect_uri: `${APP_BASE_URL}/auth/google/callback`,
            code_verifier: statePayload.code_verifier,
        }),
    });
    if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        return res.status(400).send(`Token exchange failed: ${errorText}`);
    }
    const tokens = (await tokenResponse.json());
    if (!tokens.id_token)
        return res.status(400).send('Missing id_token');
    const { payload } = await jwtVerify(tokens.id_token, GOOGLE_JWKS, {
        issuer: GOOGLE_ISSUER,
        audience: GOOGLE_CLIENT_ID,
    });
    const email = payload.email?.toLowerCase();
    const emailVerified = payload.email_verified;
    if (!email || !emailVerified) {
        return res.status(400).send('Google account must have a verified email.');
    }
    const user = await prisma.user.upsert({
        where: { email },
        update: { googleSub: payload.sub, emailVerified: true },
        create: { email, emailVerified: true, googleSub: payload.sub },
    });
    const codeToken = await issueLoginCode(user.id, statePayload.client_state, statePayload.redirect_uri);
    const redirectUrl = new URL(statePayload.redirect_uri);
    redirectUrl.searchParams.set('code', codeToken);
    redirectUrl.searchParams.set('state', statePayload.client_state);
    res.redirect(303, redirectUrl.toString());
});
router.post('/auth/register/email', limiter, async (req, res, next) => {
    try {
        const schema = z.object({
            email: z.string().email(),
            password: z.string().min(8),
            redirect_uri: z.string().url(),
            state: z.string(),
        });
        const { email: rawEmail, password, redirect_uri, state } = schema.parse(req.body);
        const email = rawEmail.toLowerCase();
        const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
        const user = await prisma.user.upsert({
            where: { email },
            update: { passwordHash, emailVerified: true },
            create: { email, passwordHash, emailVerified: true },
        });
        const codeToken = await issueLoginCode(user.id, state, redirect_uri);
        const redirectUrl = new URL(redirect_uri);
        redirectUrl.searchParams.set('code', codeToken);
        redirectUrl.searchParams.set('state', state);
        res.redirect(303, redirectUrl.toString());
    }
    catch (err) {
        next(err);
    }
});
router.post('/auth/login/email', limiter, async (req, res, next) => {
    try {
        const schema = z.object({
            email: z.string().email(),
            password: z.string().min(8),
            redirect_uri: z.string().url(),
            state: z.string(),
        });
        const { email: rawEmail, password, redirect_uri, state } = schema.parse(req.body);
        const email = rawEmail.toLowerCase();
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.passwordHash)
            return res.status(400).send('Invalid credentials');
        const valid = await argon2.verify(user.passwordHash, password);
        if (!valid)
            return res.status(400).send('Invalid credentials');
        const codeToken = await issueLoginCode(user.id, state, redirect_uri);
        const redirectUrl = new URL(redirect_uri);
        redirectUrl.searchParams.set('code', codeToken);
        redirectUrl.searchParams.set('state', state);
        res.redirect(303, redirectUrl.toString());
    }
    catch (err) {
        next(err);
    }
});
router.post('/auth/exchange', async (req, res) => {
    const schema = z.object({ code: z.string().min(10) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: 'Invalid payload' });
    try {
        const { user } = await consumeLoginCode(parsed.data.code);
        const token = await signAccessToken({ sub: user.id, email: user.email });
        res.json({
            accessToken: token,
            user: {
                id: user.id,
                email: user.email,
                emailVerified: user.emailVerified,
                subscriptionStatus: user.subscriptionStatus,
                trialEnd: user.trialEnd,
            },
        });
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
export const authRouter = router;
//# sourceMappingURL=auth.js.map
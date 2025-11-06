import { SignJWT, jwtVerify } from 'jose';
import { env } from './utils.js';
const secret = new TextEncoder().encode(env('JWT_SECRET'));
export async function signAccessToken(payload) {
    return await new SignJWT({ email: payload.email })
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject(payload.sub)
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(secret);
}
export async function verifyAccessToken(token) {
    const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] });
    return { sub: payload.sub, email: payload.email };
}
export function requireAuth(req, res, next) {
    const header = req.headers.authorization;
    if (!header)
        return res.status(401).json({ error: 'Missing Authorization header' });
    const [, token] = header.split(' ');
    if (!token)
        return res.status(401).json({ error: 'Malformed Authorization header' });
    verifyAccessToken(token)
        .then(({ sub, email }) => {
        req.user = { sub, email };
        next();
    })
        .catch(() => res.status(401).json({ error: 'Invalid or expired token' }));
}
//# sourceMappingURL=jwt.js.map
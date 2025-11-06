import { Router } from 'express';
import { requireAuth } from '../jwt.js';
import { prisma } from '../db.js';
import { stripe } from '../stripe.js';
import { env } from '../utils.js';
const APP_BASE_URL = env('APP_BASE_URL');
const PRICE_ID = env('PRICE_ID_GBP_10');
const router = Router();
router.post('/api/create-checkout-session', requireAuth, async (req, res) => {
    const userId = req.user.sub;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user)
        return res.status(404).json({ error: 'User not found' });
    let customerId = user.stripeCustomerId;
    if (!customerId) {
        const customer = await stripe.customers.create({ email: user.email, metadata: { userId: user.id } });
        customerId = customer.id;
        await prisma.user.update({ where: { id: user.id }, data: { stripeCustomerId: customerId } });
    }
    const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: customerId,
        client_reference_id: user.id,
        success_url: `${APP_BASE_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${APP_BASE_URL}/billing/cancel`,
        subscription_data: { trial_period_days: 3 },
        payment_method_collection: 'if_required',
        line_items: [{ price: PRICE_ID, quantity: 1 }],
    });
    res.json({ url: session.url });
});
router.post('/api/create-portal-session', requireAuth, async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.user.sub } });
    if (!user?.stripeCustomerId)
        return res.status(400).json({ error: 'No Stripe customer on file' });
    const portal = await stripe.billingPortal.sessions.create({
        customer: user.stripeCustomerId,
        return_url: `${APP_BASE_URL}/billing/success`,
    });
    res.json({ url: portal.url });
});
router.get('/billing/success', (_req, res) => {
    res.type('html').send('<html><body><h1>Checkout complete</h1><p>You can return to the extension.</p></body></html>');
});
router.get('/billing/cancel', (_req, res) => {
    res.type('html').send('<html><body><h1>Checkout canceled</h1><p>You can retry from the extension.</p></body></html>');
});
export const billingRouter = router;
//# sourceMappingURL=billing.js.map
import express, { Router } from 'express';
import { stripe } from '../stripe.js';
import { env } from '../utils.js';
import { prisma } from '../db.js';
const router = Router();
const webhookSecret = env('STRIPE_WEBHOOK_SECRET');
router.post('/', express.raw({ type: 'application/json' }), async (req, res) => {
    const signature = req.headers['stripe-signature'];
    if (!signature)
        return res.status(400).send('Missing signature');
    let event;
    try {
        event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
    }
    catch (err) {
        return res.status(400).send(`Webhook error: ${err.message}`);
    }
    try {
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object;
                if (session.client_reference_id && session.customer) {
                    await prisma.user.update({
                        where: { id: session.client_reference_id },
                        data: {
                            stripeCustomerId: typeof session.customer === 'string' ? session.customer : session.customer.id,
                            stripeSubscriptionId: typeof session.subscription === 'string'
                                ? session.subscription
                                : session.subscription?.id ?? null,
                            subscriptionStatus: 'trialing',
                        },
                    });
                }
                break;
            }
            case 'customer.subscription.updated':
            case 'customer.subscription.deleted':
            case 'customer.subscription.created': {
                const subscription = event.data.object;
                const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
                await prisma.user.updateMany({
                    where: { stripeCustomerId: customerId },
                    data: {
                        subscriptionStatus: subscription.status,
                        trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
                        stripeSubscriptionId: subscription.id,
                    },
                });
                break;
            }
            case 'invoice.payment_failed': {
                const invoice = event.data.object;
                const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
                if (customerId) {
                    await prisma.user.updateMany({
                        where: { stripeCustomerId: customerId },
                        data: { subscriptionStatus: 'past_due' },
                    });
                }
                break;
            }
            case 'invoice.paid': {
                const invoice = event.data.object;
                const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
                if (customerId) {
                    await prisma.user.updateMany({
                        where: { stripeCustomerId: customerId },
                        data: { subscriptionStatus: 'active' },
                    });
                }
                break;
            }
            default:
                break;
        }
    }
    catch (err) {
        console.error('Webhook handler failed', err);
        return res.status(500).send('Webhook handler failed');
    }
    res.json({ received: true });
});
export const stripeWebhookRouter = router;
//# sourceMappingURL=webhooks.js.map
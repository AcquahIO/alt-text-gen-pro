import { Router } from 'express';
import { requireAuth, AuthenticatedRequest } from '../jwt.js';
import { prisma } from '../db.js';
import { FAIR_USE_LIMITS, getUsageSnapshot } from '../fairUse.js';

const router = Router();

router.get('/api/whoami', requireAuth, async (req: AuthenticatedRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.sub },
    select: {
      id: true,
      email: true,
      emailVerified: true,
      subscriptionStatus: true,
      trialEnd: true,
      stripeCustomerId: true,
    },
  });
  res.json({ user });
});

router.get('/api/subscription-status', requireAuth, async (req: AuthenticatedRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.sub } });
  if (!user) return res.status(404).json({ error: 'User not found' });
  const usage = await getUsageSnapshot(user.id);
  res.json({
    status: user.subscriptionStatus ?? 'none',
    trial_end: user.trialEnd,
    limits: FAIR_USE_LIMITS,
    usage,
  });
});

export const statusRouter = router;

import { prisma } from './db.js';

const BUCKETS = ['hour', 'day', 'month'] as const;
type UsageBucket = (typeof BUCKETS)[number];

export const FAIR_USE_LIMITS: Record<UsageBucket, number> = { hour: 60, day: 200, month: 5000 };

function windowStartFor(bucket: UsageBucket, now = new Date()) {
  const d = new Date(now);
  if (bucket === 'hour') d.setMinutes(0, 0, 0);
  else if (bucket === 'day') d.setHours(0, 0, 0, 0);
  else {
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
  }
  return d;
}

export async function requireActiveOrTrial(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('User not found');
  const now = new Date();
  const allowed = new Set(['active', 'trialing', 'past_due']);
  const trialActive = user.trialEnd ? user.trialEnd > now : false;
  if (!allowed.has(user.subscriptionStatus ?? '') && !trialActive) throw new Error('Subscription required');
  return user;
}

async function ensureWithinLimit(userId: string, bucket: UsageBucket, windowStart: Date) {
  const counter = await prisma.usageCounter.findUnique({
    where: { userId_bucket_windowStart: { userId, bucket, windowStart } },
  });
  if (counter && counter.count >= FAIR_USE_LIMITS[bucket]) {
    throw new Error(`Fair use limit reached (${bucket})`);
  }
}

export async function checkAndIncrementUsage(userId: string) {
  const now = new Date();
  for (const bucket of BUCKETS) {
    await ensureWithinLimit(userId, bucket, windowStartFor(bucket, now));
  }
  for (const bucket of BUCKETS) {
    await prisma.usageCounter.upsert({
      where: {
        userId_bucket_windowStart: {
          userId,
          bucket,
          windowStart: windowStartFor(bucket, now),
        },
      },
      update: { count: { increment: 1 } },
      create: {
        userId,
        bucket,
        windowStart: windowStartFor(bucket, now),
        count: 1,
      },
    });
  }
}

export async function getUsageSnapshot(userId: string) {
  const now = new Date();
  const snapshot: Record<UsageBucket, number> = { hour: 0, day: 0, month: 0 };
  for (const bucket of BUCKETS) {
    const record = await prisma.usageCounter.findUnique({
      where: {
        userId_bucket_windowStart: {
          userId,
          bucket,
          windowStart: windowStartFor(bucket, now),
        },
      },
    });
    snapshot[bucket] = record?.count ?? 0;
  }
  return snapshot;
}

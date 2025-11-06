import { Plan } from '@/lib/session';

interface PlanBadgeProps {
  plan: Plan;
  trialEndsAt?: string | null;
}

function daysRemaining(trialEndsAt?: string | null): number | null {
  if (!trialEndsAt) return null;
  const end = new Date(trialEndsAt).getTime();
  if (Number.isNaN(end)) return null;
  const diff = end - Date.now();
  if (diff <= 0) return 0;
  return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export function PlanBadge({ plan, trialEndsAt }: PlanBadgeProps) {
  const baseClasses = 'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium shadow-sm';
  switch (plan) {
    case 'trial': {
      const days = daysRemaining(trialEndsAt);
      const label = days === null ? 'Trial' : `Trial · ${days} day${days === 1 ? '' : 's'} left`;
      return <span className={`${baseClasses} bg-amber-100 text-amber-900`}>{label}</span>;
    }
    case 'paid':
      return <span className={`${baseClasses} bg-emerald-100 text-emerald-900`}>Pro (Active)</span>;
    default:
      return <span className={`${baseClasses} bg-slate-200 text-slate-700`}>Free</span>;
  }
}

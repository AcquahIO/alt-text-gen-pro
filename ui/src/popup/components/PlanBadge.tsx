import { Plan } from '@/lib/session';
import { type CSSProperties } from 'react';

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
  const baseStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    padding: '4px 12px',
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: '0.01em',
    border: '1px solid transparent',
    whiteSpace: 'nowrap',
    lineHeight: 1.2,
  };

  const dotStyle = (color: string): CSSProperties => ({
    width: 7,
    height: 7,
    borderRadius: 999,
    background: color,
    boxShadow: `0 0 0 2px ${color}20`,
  });

  switch (plan) {
    case 'trial': {
      const days = daysRemaining(trialEndsAt);
      const label = days === null ? 'Trial' : `Trial · ${days} day${days === 1 ? '' : 's'} left`;
      return (
        <span style={{ ...baseStyle, background: '#fff7ed', color: '#9a3412', borderColor: '#fdba74' }}>
          <span style={dotStyle('#f59e0b')} />
          {label}
        </span>
      );
    }
    case 'paid':
      return (
        <span style={{ ...baseStyle, background: '#ecfdf3', color: '#166534', borderColor: '#86efac' }}>
          <span style={dotStyle('#16a34a')} />
          Pro · Active
        </span>
      );
    default:
      return (
        <span style={{ ...baseStyle, background: '#eff6ff', color: '#1e3a8a', borderColor: '#bfdbfe' }}>
          <span style={dotStyle('#64748b')} />
          Free
        </span>
      );
  }
}

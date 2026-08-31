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
    gap: 5,
    borderRadius: 5,
    padding: '3px 7px',
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.035em',
    border: '1px solid transparent',
    whiteSpace: 'nowrap',
    lineHeight: 1.2,
  };

  const dotStyle = (color: string): CSSProperties => ({
    width: 7,
    height: 7,
    borderRadius: 999,
    background: color,
  });

  switch (plan) {
    case 'trial': {
      const days = daysRemaining(trialEndsAt);
      const label = days === null ? 'Trial' : `Trial · ${days} day${days === 1 ? '' : 's'} left`;
      return (
        <span style={{ ...baseStyle, background: '#fffaeb', color: '#b54708', borderColor: '#f3d38a' }}>
          <span style={dotStyle('#f59e0b')} />
          {label}
        </span>
      );
    }
    case 'paid':
      return (
        <span style={{ ...baseStyle, background: '#ffffff', color: '#0d5bd7', borderColor: '#9eb9e8' }}>
          Pro
        </span>
      );
    default:
      return (
        <span style={{ ...baseStyle, background: '#f6f8fb', color: '#475467', borderColor: '#d9dee8' }}>
          Free
        </span>
      );
  }
}

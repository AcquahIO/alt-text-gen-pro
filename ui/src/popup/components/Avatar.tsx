import { type CSSProperties } from 'react';
import { UserRound } from 'lucide-react';

interface AvatarProps {
  url?: string | null;
  name?: string;
  tone?: 'free' | 'trial' | 'paid';
}

export function Avatar({ url, name, tone = 'free' }: AvatarProps) {
  const palette = tone === 'paid'
    ? { dot: '#17a673', surface: '#071d4f', text: '#ffffff' }
    : tone === 'trial'
      ? { dot: '#f79009', surface: '#fff7e6', text: '#93370d' }
      : { dot: '#98a2b3', surface: '#eef4ff', text: '#1849a9' };

  const wrapperStyle: CSSProperties = {
    position: 'relative',
    width: 38,
    height: 38,
    borderRadius: 999,
    padding: 2,
    background: '#ffffff',
    border: '1px solid #d9dee8',
    boxShadow: 'none',
    flexShrink: 0,
  };

  const statusDot = (
    <span
      aria-hidden="true"
      style={{
        position: 'absolute',
        right: -1,
        bottom: 0,
        width: 10,
        height: 10,
        border: '2px solid #ffffff',
        borderRadius: 999,
        background: palette.dot,
      }}
    />
  );

  if (url) {
    return (
      <div style={wrapperStyle}>
        <img
          src={url}
          alt={name || 'Account avatar'}
          className="h-full w-full rounded-full object-cover"
        />
        {statusDot}
      </div>
    );
  }
  return (
    <div style={wrapperStyle}>
      <div
        className="h-full w-full rounded-full flex items-center justify-center text-sm font-semibold"
        style={{
          background: palette.surface,
          color: palette.text,
        }}
      >
        <UserRound size={18} strokeWidth={1.9} aria-hidden="true" />
      </div>
      {statusDot}
    </div>
  );
}

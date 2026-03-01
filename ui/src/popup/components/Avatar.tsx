import { useMemo, type CSSProperties } from 'react';

interface AvatarProps {
  url?: string | null;
  name?: string;
  tone?: 'free' | 'trial' | 'paid';
}

function initialsFromName(name?: string): string {
  if (!name) return '??';
  const parts = name.split(/[\s._-]+/).filter(Boolean);
  if (!parts.length) return name.slice(0, 2).toUpperCase();
  const picked = parts.slice(0, 2).map((part) => part.charAt(0) ?? '');
  const initials = picked.join('').toUpperCase();
  return initials || '??';
}

export function Avatar({ url, name, tone = 'free' }: AvatarProps) {
  const initials = useMemo(() => initialsFromName(name), [name]);

  const palette = tone === 'paid'
    ? { ring: '#22c55e', surface: '#ecfdf3', text: '#14532d' }
    : tone === 'trial'
      ? { ring: '#f59e0b', surface: '#fff7ed', text: '#7c2d12' }
      : { ring: '#1e3a8a', surface: '#eff6ff', text: '#1e3a8a' };

  const wrapperStyle: CSSProperties = {
    position: 'relative',
    width: 48,
    height: 48,
    borderRadius: 999,
    padding: 2.5,
    background: '#ffffff',
    border: `2px solid ${palette.ring}`,
    boxShadow: '0 2px 8px rgba(2, 8, 23, 0.08)',
    flexShrink: 0,
  };

  if (url) {
    return (
      <div style={wrapperStyle}>
        <img
          src={url}
          alt={name || 'Account avatar'}
          className="h-full w-full rounded-full object-cover"
        />
      </div>
    );
  }
  return (
    <div style={wrapperStyle}>
      <div
        className="h-full w-full rounded-full flex items-center justify-center text-sm font-semibold"
        style={{
          background: tone === 'trial' ? '#f59e0b' : palette.surface,
          color: tone === 'trial' ? '#ffffff' : palette.text,
        }}
      >
        {initials}
      </div>
    </div>
  );
}

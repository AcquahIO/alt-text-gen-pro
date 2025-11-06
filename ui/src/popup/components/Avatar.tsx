import { useMemo } from 'react';

interface AvatarProps {
  url?: string | null;
  name?: string;
}

function initialsFromName(name?: string): string {
  if (!name) return '??';
  const parts = name.split(/[\s._-]+/).filter(Boolean);
  if (!parts.length) return name.slice(0, 2).toUpperCase();
  const picked = parts.slice(0, 2).map((part) => part.charAt(0) ?? '');
  const initials = picked.join('').toUpperCase();
  return initials || '??';
}

export function Avatar({ url, name }: AvatarProps) {
  const initials = useMemo(() => initialsFromName(name), [name]);
  if (url) {
    return (
      <img
        src={url}
        alt={name || 'Account avatar'}
        className="h-10 w-10 rounded-full object-cover shadow-sm"
      />
    );
  }
  return (
    <div className="h-10 w-10 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-sm font-semibold">
      {initials}
    </div>
  );
}

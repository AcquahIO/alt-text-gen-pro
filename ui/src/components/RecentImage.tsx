import { useState } from 'react';
import { Button } from './ui/button';
import { Copy, Check, X } from 'lucide-react';
import { RecentAltItem } from '@/lib/types';

interface RecentImageProps {
  items: (RecentAltItem & { id?: string })[];
  onClear: () => void;
}

export function RecentImage({ items, onClear }: RecentImageProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = async (item: RecentAltItem & { id?: string }) => {
    try {
      await navigator.clipboard.writeText(item.altText);
      const id = item.id || item.srcUrl || item.altText;
      setCopiedId(id);
      setTimeout(() => setCopiedId((current) => (current === id ? null : current)), 2000);
    } catch (error) {
      console.error('Failed to copy', error);
    }
  };

  if (!items.length) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm text-muted-foreground">Recent from right-click</h2>
        <Button 
          variant="ghost" 
          size="sm"
          onClick={onClear}
        >
          <X className="w-4 h-4 mr-2" />
          Clear
        </Button>
      </div>

      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
        {items.map((item) => {
          const key = item.id || item.srcUrl || item.altText;
          const copied = copiedId === key;
          return (
            <div key={key} className="flex gap-3 p-3 border rounded-lg bg-card">
              <img
                src={item.srcUrl}
                alt={item.altText}
                className="w-8 h-8 object-cover rounded-md flex-shrink-0 border"
              />
              <div className="flex-1 flex flex-col gap-2 min-w-0">
                <p
                  className="text-sm leading-snug text-foreground/90 break-words"
                  style={{
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {item.altText}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(item)}
                  className="self-end"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-2" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from './ui/button';
import { Copy, Check, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { RecentAltItem } from '@/lib/types';

interface RecentImageProps {
  items: (RecentAltItem & { id?: string })[];
  onClear: () => void;
}

const ITEMS_PER_PAGE = 8;

export function RecentImage({ items, onClear }: RecentImageProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

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

  const totalPages = Math.max(1, Math.ceil(Math.max(items.length, 1) / ITEMS_PER_PAGE));
  const safePage = Math.min(page, totalPages - 1);
  const pageStart = safePage * ITEMS_PER_PAGE;
  const pageItems = useMemo(() => items.slice(pageStart, pageStart + ITEMS_PER_PAGE), [items, pageStart]);

  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = 0;
    }
  }, [safePage]);

  if (!items.length) return null;

  return (
    <div
      className="rounded-2xl border bg-card"
      style={{
        borderColor: '#dbeafe',
        background: '#ffffff',
        boxShadow: '0 2px 12px rgba(30, 58, 138, 0.06)',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <h2 className="text-sm font-semibold" style={{ color: '#0b1b44', lineHeight: 1.2 }}>
            Recent from right-click
          </h2>
          <p className="text-xs text-muted-foreground">
            {items.length} recent result{items.length === 1 ? '' : 's'}{totalPages > 1 ? ` • Page ${safePage + 1} of ${totalPages}` : ''}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onClear}
          style={{
            borderColor: '#dbeafe',
            color: '#334155',
            background: '#f8fbff',
            borderRadius: 10,
            minHeight: 34,
            paddingInline: 12,
          }}
        >
          <X className="w-4 h-4 mr-1.5" />
          Clear
        </Button>
      </div>

      <div
        ref={listRef}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          maxHeight: 220,
          overflowY: 'auto',
          paddingRight: 2,
        }}
      >
        {pageItems.map((item) => {
          const key = item.id || item.srcUrl || item.altText;
          const copied = copiedId === key;
          return (
            <div
              key={key}
              style={{
                display: 'grid',
                gridTemplateColumns: '52px minmax(0, 1fr) auto',
                alignItems: 'center',
                gap: 12,
                border: '1px solid #dbeafe',
                borderRadius: 14,
                background: '#f8fbff',
                padding: 10,
              }}
            >
              <img
                src={item.srcUrl}
                alt={item.altText}
                className="object-cover flex-shrink-0 border"
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 10,
                  borderColor: '#bfdbfe',
                  background: '#ffffff',
                }}
              />
              <div className="min-w-0">
                <p
                  className="text-sm break-words"
                  style={{
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    lineHeight: 1.35,
                    color: '#0f172a',
                    margin: 0,
                  }}
                >
                  {item.altText}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(item)}
                style={{
                  borderColor: '#dbeafe',
                  borderRadius: 10,
                  minHeight: 36,
                  minWidth: 86,
                  paddingInline: 12,
                  color: '#0b1b44',
                  background: '#ffffff',
                }}
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 mr-1.5" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-1.5" />
                    Copy
                  </>
                )}
              </Button>
            </div>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={safePage === 0}
            style={{
              borderColor: '#dbeafe',
              color: '#0b1b44',
              borderRadius: 10,
              minHeight: 34,
              background: '#ffffff',
            }}
          >
            <ChevronLeft className="w-4 h-4 mr-1.5" />
            Previous
          </Button>
          <div className="text-xs text-muted-foreground">
            Showing {pageStart + 1}-{Math.min(items.length, pageStart + ITEMS_PER_PAGE)} of {items.length}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={safePage >= totalPages - 1}
            style={{
              borderColor: '#dbeafe',
              color: '#0b1b44',
              borderRadius: 10,
              minHeight: 34,
              background: '#ffffff',
            }}
          >
            Next
            <ChevronRight className="w-4 h-4 ml-1.5" />
          </Button>
        </div>
      )}
    </div>
  );
}

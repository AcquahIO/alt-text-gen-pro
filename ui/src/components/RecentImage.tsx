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
    <section className="command-recent" aria-labelledby="recent-results-heading">
      <div className="command-recent__header">
        <div>
          <h2 id="recent-results-heading" className="command-eyebrow">Recent from right-click</h2>
          <p className="command-helper" style={{ marginTop: 4 }}>
            {items.length} recent result{items.length === 1 ? '' : 's'}{totalPages > 1 ? ` • Page ${safePage + 1} of ${totalPages}` : ''}
          </p>
        </div>
        <Button
          className="command-secondary"
          size="sm"
          onClick={onClear}
        >
          <X className="w-3.5 h-3.5" />
          Clear
        </Button>
      </div>

      <div ref={listRef} className="command-recent__list">
        {pageItems.map((item) => {
          const key = item.id || item.srcUrl || item.altText;
          const copied = copiedId === key;
          return (
            <div key={key} className="command-recent__row">
              <img src={item.srcUrl} alt={item.altText} />
              <p className="command-recent__text">{item.altText}</p>
              <Button
                className="command-secondary"
                size="sm"
                onClick={() => copyToClipboard(item)}
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy
                  </>
                )}
              </Button>
            </div>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-2">
          <Button
            className="command-secondary"
            size="sm"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={safePage === 0}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Previous
          </Button>
          <div className="command-shortcut">
            Showing {pageStart + 1}-{Math.min(items.length, pageStart + ITEMS_PER_PAGE)} of {items.length}
          </div>
          <Button
            className="command-secondary"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={safePage >= totalPages - 1}
          >
            Next
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}
    </section>
  );
}

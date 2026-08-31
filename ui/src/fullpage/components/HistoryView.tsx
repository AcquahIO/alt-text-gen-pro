import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { RecentAltItem } from '@/lib/types';
import { Check, Clock3, Copy, ImageIcon, Loader2, LogIn, RefreshCw, Trash2 } from 'lucide-react';

interface HistoryViewProps {
  items: RecentAltItem[];
  loading: boolean;
  signedIn: boolean;
  onSignIn: () => Promise<void> | void;
  onRefresh: () => Promise<void> | void;
  onClear: () => Promise<void> | void;
}

function formatHistoryDate(value?: number): string {
  if (!value || !Number.isFinite(value)) return 'Recently generated';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function HistoryView({ items, loading, signedIn, onSignIn, onRefresh, onClear }: HistoryViewProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [clearing, setClearing] = useState(false);

  const copyResult = async (item: RecentAltItem, index: number) => {
    try {
      await navigator.clipboard.writeText(item.altText);
      setCopiedIndex(index);
      window.setTimeout(() => setCopiedIndex((current) => (current === index ? null : current)), 1800);
    } catch {
      setCopiedIndex(null);
    }
  };

  const clearHistory = async () => {
    setClearing(true);
    try {
      await onClear();
    } finally {
      setClearing(false);
    }
  };

  return (
    <section className="command-page-view" aria-labelledby="history-heading">
      <div className="command-view-heading">
        <div>
          <span className="command-eyebrow">Account history</span>
          <h2 id="history-heading">Recent alt text</h2>
          <p>Results generated from webpage images are stored locally for this signed-in account.</p>
        </div>
        {signedIn ? (
          <div className="command-view-heading__actions">
            <Button className="command-secondary" size="sm" onClick={onRefresh} disabled={loading}>
              <RefreshCw size={14} className={loading ? 'animate-spin' : undefined} />
              Refresh
            </Button>
            <Button className="command-danger-button" size="sm" variant="ghost" onClick={clearHistory} disabled={clearing || !items.length}>
              <Trash2 size={14} />
              {clearing ? 'Clearing…' : 'Clear history'}
            </Button>
          </div>
        ) : null}
      </div>

      {!signedIn ? (
        <div className="command-view-empty">
          <LogIn size={22} />
          <h3>Sign in to view your history</h3>
          <p>History is kept separate for each extension account.</p>
          <Button className="command-primary" onClick={onSignIn}><LogIn size={15} />Sign in</Button>
        </div>
      ) : loading ? (
        <div className="command-view-empty" aria-live="polite">
          <Loader2 size={22} className="animate-spin" />
          <h3>Loading recent results</h3>
        </div>
      ) : items.length ? (
        <div className="command-history-list">
          {items.map((item, index) => (
            <article className="command-history-row" key={`${item.srcUrl}-${item.when ?? index}-${index}`}>
              <div className="command-history-row__image">
                {item.srcUrl ? <img src={item.srcUrl} alt="" /> : <ImageIcon size={20} />}
              </div>
              <div className="command-history-row__body">
                <p>{item.altText}</p>
                <span><Clock3 size={12} />{formatHistoryDate(item.when)}{item.pageTitle ? ` · ${item.pageTitle}` : ''}</span>
              </div>
              <Button className="command-secondary" size="sm" onClick={() => copyResult(item, index)}>
                {copiedIndex === index ? <Check size={14} /> : <Copy size={14} />}
                {copiedIndex === index ? 'Copied' : 'Copy'}
              </Button>
            </article>
          ))}
        </div>
      ) : (
        <div className="command-view-empty">
          <Clock3 size={22} />
          <h3>No recent results yet</h3>
          <p>Generate alt text from a webpage and it will appear here.</p>
        </div>
      )}
    </section>
  );
}

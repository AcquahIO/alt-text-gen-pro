import { useState } from 'react';
import { Button } from './ui/button';
import { Wand2, Copy, Download, Check, AlertCircle, Loader2 } from 'lucide-react';
import { UploadItem } from '@/lib/types';

interface ImageResultCardProps {
  item: UploadItem;
  fileSizeLabel: string;
  onGenerate: () => Promise<void> | void;
  onCopy: () => Promise<void> | void;
  onDownload: () => Promise<void> | void;
}

export function ImageResultCard({ item, fileSizeLabel, onGenerate, onCopy, onDownload }: ImageResultCardProps) {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleGenerate = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onGenerate();
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = async () => {
    await onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const statusLabel = (() => {
    if (item.status === 'generating') return 'Generating…';
    if (item.status === 'done') return 'Ready';
    if (item.status === 'error') return item.error || 'Failed';
    return 'Ready';
  })();

  const isBusy = busy || item.status === 'generating';
  const isReady = item.status === 'done' && Boolean(item.altText);
  const isGenerating = item.status === 'generating';

  const statusStyles = (() => {
    if (isGenerating) {
      return {
        border: '#93c5fd',
        bg: '#eff6ff',
        text: '#1d4ed8',
      };
    }
    if (isReady) {
      return {
        border: '#86efac',
        bg: '#ecfdf3',
        text: '#166534',
      };
    }
    return {
      border: '#bfdbfe',
      bg: '#eff6ff',
      text: '#1e3a8a',
    };
  })();

  return (
    <div
      className="border rounded-2xl bg-card p-6"
      style={{
        borderColor: '#dbeafe',
        boxShadow: '0 2px 10px rgba(30, 58, 138, 0.05)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 18,
          flexWrap: 'wrap',
        }}
      >
        <div
          style={{
            width: 220,
            maxWidth: '100%',
            flex: '0 0 220px',
          }}
        >
          <div
            className="flex items-center justify-center rounded-lg border"
            style={{
              height: 150,
              overflow: 'hidden',
              padding: 10,
              borderColor: isReady ? '#86efac' : '#dbeafe',
              background: isReady ? '#f0fdf4' : '#f8fbff',
              boxShadow: isReady ? 'inset 0 0 0 1px #bbf7d0' : undefined,
            }}
          >
            <img
              src={item.dataUrl}
              alt={item.altText || item.name}
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                width: 'auto',
                height: 'auto',
                objectFit: 'contain',
              }}
            />
          </div>
        </div>

        <div
          style={{
            flex: '1 1 420px',
            minWidth: 260,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
            <h3 className="text-sm font-medium" style={{ lineHeight: 1.25 }}>
              {item.name}{' '}
              <span className="text-muted-foreground">({fileSizeLabel})</span>
            </h3>
            <span
              className="text-xs"
              style={{
                border: `1px solid ${statusStyles.border}`,
                borderRadius: 999,
                padding: '4px 10px',
                background: statusStyles.bg,
                color: statusStyles.text,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {isGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
              {isReady ? <Check className="w-3 h-3" /> : null}
              {statusLabel}
            </span>
          </div>

          {item.status === 'error' && item.error && (
            <div className="flex items-center gap-1 text-xs text-destructive">
              <AlertCircle className="w-3 h-3" />
              <span>{item.error}</span>
            </div>
          )}

          <div
            className="rounded-lg border p-3 text-sm whitespace-pre-wrap break-words text-muted-foreground"
            style={{ minHeight: 78, borderColor: '#dbeafe', background: '#f8fbff' }}
          >
            {item.altText || 'No alt text generated yet.'}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexWrap: 'wrap',
            }}
          >
            <Button
              onClick={handleGenerate}
              disabled={isBusy}
              style={{
                backgroundColor: '#0b1b44',
                color: '#ffffff',
                minWidth: 120,
                borderRadius: 12,
                border: '1px solid #0b1b44',
              }}
            >
              <Wand2 className={`w-4 h-4 ${isBusy ? 'animate-pulse' : ''}`} />
              <span>Generate</span>
            </Button>

            <Button
              variant="outline"
              onClick={handleCopy}
              disabled={!item.altText}
              style={{ minWidth: 106, borderColor: '#dbeafe', color: '#0b1b44' }}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy</span>
                </>
              )}
            </Button>

            <Button
              variant="outline"
              onClick={onDownload}
              disabled={!item.altText}
              style={{ borderColor: '#dbeafe', color: '#0b1b44' }}
            >
              <Download className="w-4 h-4" />
              <span>Download with metadata</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { Button } from './ui/button';
import { Wand2, Copy, Download, Check, AlertCircle } from 'lucide-react';
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

  return (
    <div className="border rounded-2xl bg-card p-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr),minmax(240px,320px)]">
        <div className="flex items-center justify-center rounded-xl bg-muted/40 p-4">
          <img
            src={item.dataUrl}
            alt={item.altText || item.name}
            className="max-h-[420px] w-full object-contain"
          />
        </div>

        <div className="space-y-5">
          <div className="space-y-2">
            <div>
              <h3 className="text-sm font-medium">
                {item.name}{' '}
                <span className="text-muted-foreground">({fileSizeLabel})</span>
              </h3>
              <p className="text-xs text-muted-foreground">{statusLabel}</p>
            </div>
            {item.status === 'error' && item.error && (
              <div className="flex items-center gap-1 text-xs text-destructive">
                <AlertCircle className="w-3 h-3" />
                <span>{item.error}</span>
              </div>
            )}
            {item.altText && (
              <p className="rounded-lg border bg-background/60 p-3 text-sm whitespace-pre-wrap break-words">
                {item.altText}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Button
              className="w-full bg-green-600 hover:bg-green-700 text-white"
              onClick={handleGenerate}
              disabled={isBusy}
            >
              <Wand2 className={`w-4 h-4 ${isBusy ? 'animate-pulse' : ''}`} />
              <span>Generate</span>
            </Button>

            <Button
              className="w-full bg-green-600 hover:bg-green-700 text-white"
              onClick={handleCopy}
              disabled={!item.altText}
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
              className="w-full"
              variant="outline"
              onClick={onDownload}
              disabled={!item.altText}
            >
              <Download className="w-4 h-4" />
              <span>Download with Metadata</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

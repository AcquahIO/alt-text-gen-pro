import { useState } from 'react';
import { Button } from './ui/button';
import { AlertCircle, Check, Copy, Download, Loader2, Sparkles, Trash2 } from 'lucide-react';
import { UploadItem } from '@/lib/types';

interface ImageResultCardProps {
  item: UploadItem;
  fileSizeLabel: string;
  onGenerate: () => Promise<void> | void;
  onAltTextChange: (value: string) => void;
  onCopy: () => Promise<void> | void;
  onDownload: () => Promise<void> | void;
  onRemove: () => void;
}

const ALT_TEXT_MAX_LENGTH = 125;

export function ImageResultCard({
  item,
  fileSizeLabel,
  onGenerate,
  onAltTextChange,
  onCopy,
  onDownload,
  onRemove,
}: ImageResultCardProps) {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const isGenerating = item.status === 'generating';
  const isReady = item.status === 'done' && Boolean(item.altText);
  const isError = item.status === 'error';
  const isBusy = busy || isGenerating;

  const handleGenerate = async () => {
    if (isBusy) return;
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
    window.setTimeout(() => setCopied(false), 2000);
  };

  const statusClass = isError
    ? 'command-status command-status--error'
    : isGenerating
      ? 'command-status command-status--generating'
      : isReady
        ? 'command-status command-status--ready'
        : 'command-status';

  const statusLabel = isError
    ? 'Failed'
    : isGenerating
      ? 'Generating'
      : isReady
        ? 'Ready'
        : 'Queued';

  return (
    <article className="command-result-row">
      <div className="command-result-row__image">
        <img src={item.dataUrl || item.sourceUrl} alt={item.altText || item.name} />
      </div>

      <div className="command-result-row__body">
        <div className="command-result-row__meta">
          <h3 className="command-result-row__name">
            {item.name} <span className="command-result-row__size">· {fileSizeLabel}</span>
          </h3>
          <span className={statusClass}>
            {isGenerating ? <Loader2 size={12} className="animate-spin" /> : null}
            {isReady ? <Check size={12} /> : null}
            {isError ? <AlertCircle size={12} /> : null}
            {statusLabel}
          </span>
        </div>

        <div className="command-result-row__editor">
          <textarea
            className={`command-result-row__output ${item.altText ? '' : 'command-result-row__output--empty'}`}
            value={item.altText}
            maxLength={ALT_TEXT_MAX_LENGTH}
            onChange={(event) => onAltTextChange(event.target.value)}
            placeholder="Generate alt text, then edit it here before copying or downloading."
            aria-label={`Alt text for ${item.name}`}
          />
          <span className="command-result-row__count" aria-live="polite">
            {item.altText.length}/{ALT_TEXT_MAX_LENGTH}
          </span>
        </div>

        {isError && item.error ? <div className="command-notice command-notice--error">{item.error}</div> : null}
      </div>

      <div className="command-result-row__actions">
        <Button className="command-primary" onClick={handleGenerate} disabled={isBusy}>
          <Sparkles size={14} />
          {isGenerating ? 'Generating…' : isReady ? 'Regenerate' : 'Generate'}
        </Button>
        <Button className="command-secondary" onClick={handleCopy} disabled={!item.altText}>
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
        <Button
          className="command-secondary"
          onClick={onDownload}
          disabled={!item.altText || !item.dataUrl}
          title={item.dataUrl ? 'Download with metadata' : 'Metadata download is available for uploaded files only'}
        >
          <Download size={14} />
          Download
        </Button>
        <Button className="command-danger-button" variant="ghost" onClick={onRemove}>
          <Trash2 size={14} />
          Remove
        </Button>
      </div>
    </article>
  );
}

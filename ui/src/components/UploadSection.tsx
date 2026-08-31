import { useEffect, useRef, useState } from 'react';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import {
  ChevronRight,
  CloudUpload,
  ExternalLink,
  FileText,
  Globe2,
  ImageIcon,
  Sparkles,
  X,
} from 'lucide-react';
import { PendingUploadEntry } from '@/lib/types';

interface UploadSectionProps {
  language: string;
  onLanguageChange: (value: string) => void;
  context: string;
  onContextChange: (value: string) => void;
  queuedItems: PendingUploadEntry[];
  onFilesSelected: (files: FileList) => Promise<void> | void;
  onRemoveQueued: (index: number) => Promise<void> | void;
  onOpenFullPage: () => Promise<void> | void;
  onGenerateUploads: () => Promise<void> | void;
  onGenerateCurrentPage: () => Promise<void> | void;
  disabled?: boolean;
  disabledMessage?: string;
  onRequireAuth?: () => void;
}

const LANGUAGE_OPTIONS = [
  ['auto', 'Auto'], ['en', 'English'], ['es', 'Spanish'], ['fr', 'French'],
  ['de', 'German'], ['it', 'Italian'], ['pt', 'Portuguese'], ['ja', 'Japanese'],
  ['zh', 'Chinese'], ['ko', 'Korean'], ['ar', 'Arabic'], ['hi', 'Hindi'],
] as const;

export function UploadSection({
  language,
  onLanguageChange,
  context,
  onContextChange,
  queuedItems,
  onFilesSelected,
  onRemoveQueued,
  onOpenFullPage,
  onGenerateUploads,
  onGenerateCurrentPage,
  disabled = false,
  disabledMessage,
  onRequireAuth,
}: UploadSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const selectValue = language || 'auto';
  const finalDisabled = busy || disabled;

  const requireAccess = () => {
    if (!disabled) return true;
    onRequireAuth?.();
    return false;
  };

  const chooseFiles = () => {
    if (!requireAccess()) return;
    fileInputRef.current?.click();
  };

  const scanPage = async () => {
    if (!requireAccess() || busy) return;
    setBusy(true);
    try {
      await onGenerateCurrentPage();
    } finally {
      setBusy(false);
    }
  };

  const generateUploads = async () => {
    if (!requireAccess() || busy || !queuedItems.length) return;
    setBusy(true);
    try {
      await onGenerateUploads();
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (!event.metaKey || event.defaultPrevented) return;
      if (event.key === '1') {
        event.preventDefault();
        chooseFiles();
      }
      if (event.key === '2') {
        event.preventDefault();
        void scanPage();
      }
      if (event.key === 'Enter' && queuedItems.length) {
        event.preventDefault();
        void generateUploads();
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  });

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!requireAccess()) {
      event.target.value = '';
      return;
    }
    const files = event.target.files;
    if (!files?.length) return;
    setBusy(true);
    try {
      await onFilesSelected(files);
    } finally {
      setBusy(false);
      event.target.value = '';
    }
  };

  return (
    <div>
      <input ref={fileInputRef} type="file" multiple accept="image/*" onChange={handleFileChange} className="hidden" />

      <section className="command-section" aria-labelledby="popup-source-heading">
        <div className="command-eyebrow-row">
          <h2 id="popup-source-heading" className="command-eyebrow">Source</h2>
          <span className="command-shortcut">⌘ 1–2</span>
        </div>
        <div className="command-source-grid">
          <button
            type="button"
            className={`command-source-button ${queuedItems.length ? 'command-source-button--active' : ''}`}
            onClick={chooseFiles}
            disabled={finalDisabled}
          >
            <CloudUpload size={20} strokeWidth={1.8} />
            Upload images
          </button>
          <button type="button" className="command-source-button" onClick={() => void scanPage()} disabled={finalDisabled}>
            <FileText size={19} strokeWidth={1.8} />
            Scan this page
          </button>
        </div>
        <p className="command-helper">Add images from your device or collect images from the current tab.</p>
      </section>

      <section className="command-section" aria-labelledby="popup-queue-heading">
        <div className="command-queue-heading">
          <h2 id="popup-queue-heading" className="command-eyebrow">Queued files</h2>
          {queuedItems.length > 0 ? (
            <span className="command-ready-count">
              {queuedItems.length} image{queuedItems.length === 1 ? '' : 's'} ready
              <span className="command-ready-dot" />
              <ChevronRight size={14} />
            </span>
          ) : null}
        </div>

        {queuedItems.length ? (
          <div className="command-queue-grid">
            {queuedItems.slice(0, 3).map((item, index) => (
              <div className="command-queue-item" key={`${item.name}-${index}`}>
                <img src={item.dataUrl || item.sourceUrl} alt={item.name} />
                <button
                  type="button"
                  className="command-queue-remove"
                  aria-label={`Remove ${item.name}`}
                  onClick={() => void onRemoveQueued(index)}
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="command-empty-queue">
            <ImageIcon size={17} strokeWidth={1.7} />
            No images queued yet
          </div>
        )}
      </section>

      <section className="command-section">
        <div className="command-field-grid">
          <div className="command-field">
            <Label htmlFor="popup-language" className="command-label">Language</Label>
            <Select value={selectValue} onValueChange={(value) => onLanguageChange(value === 'auto' ? '' : value)}>
              <SelectTrigger id="popup-language" aria-label="Language">
                <span className="flex items-center gap-2 min-w-0">
                  <Globe2 size={16} strokeWidth={1.7} />
                  <SelectValue placeholder="Auto" />
                </span>
              </SelectTrigger>
              <SelectContent>
                {LANGUAGE_OPTIONS.map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="command-field">
            <Label htmlFor="popup-context" className="command-label">SEO context</Label>
            <Textarea
              id="popup-context"
              className="command-textarea"
              placeholder="Product, brand, or focus keyword"
              value={context}
              onChange={(event) => onContextChange(event.target.value)}
            />
          </div>
          <p className="command-context-help">Add product, brand, or keyword context for more accurate alt text.</p>
        </div>

        {disabled && disabledMessage ? <div className="command-notice" style={{ marginTop: 12 }}>{disabledMessage}</div> : null}

        <Button
          className="command-primary command-primary--wide"
          onClick={() => void generateUploads()}
          disabled={finalDisabled || queuedItems.length === 0}
          style={{ marginTop: 14 }}
        >
          <Sparkles size={16} strokeWidth={1.8} />
          {busy ? 'Preparing workspace…' : queuedItems.length
            ? `Generate ${queuedItems.length} alt text${queuedItems.length === 1 ? '' : 's'}`
            : 'Choose images to continue'}
          <span className="command-primary__shortcut">⌘ ↵</span>
        </Button>
      </section>

      <button type="button" className="command-workspace-link" onClick={() => void onOpenFullPage()}>
        <span className="command-workspace-link__label">
          <ExternalLink size={16} strokeWidth={1.8} />
          Open workspace
        </span>
        <span className="command-shortcut">⌘ O</span>
      </button>
    </div>
  );
}

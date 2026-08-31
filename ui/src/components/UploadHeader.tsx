import { useRef } from 'react';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { CloudUpload, FileText, Globe2, Sparkles, X } from 'lucide-react';
import { UploadItem } from '@/lib/types';

interface UploadHeaderProps {
  language: string;
  onLanguageChange: (value: string) => void;
  context: string;
  onContextChange: (value: string) => void;
  focusKeyword: string;
  onFocusKeywordChange: (value: string) => void;
  brand: string;
  onBrandChange: (value: string) => void;
  onAddFiles: (files: FileList) => Promise<void> | void;
  onGenerateAll: () => Promise<void> | void;
  onRemove: (id: string) => void;
  onClear: () => void;
  busy?: boolean;
  items: UploadItem[];
  disabled?: boolean;
  onRequireAuth?: () => void;
}

const LANGUAGE_OPTIONS = [
  ['auto', 'Auto'], ['en', 'English'], ['es', 'Spanish'], ['fr', 'French'],
  ['de', 'German'], ['it', 'Italian'], ['pt', 'Portuguese'], ['ja', 'Japanese'],
  ['zh', 'Chinese'], ['ko', 'Korean'], ['ar', 'Arabic'], ['hi', 'Hindi'],
] as const;

export function UploadHeader({
  language,
  onLanguageChange,
  context,
  onContextChange,
  focusKeyword,
  onFocusKeywordChange,
  brand,
  onBrandChange,
  onAddFiles,
  onGenerateAll,
  onRemove,
  onClear,
  busy = false,
  items,
  disabled = false,
  onRequireAuth,
}: UploadHeaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectValue = language || 'auto';
  const finalDisabled = busy || disabled;

  const chooseFiles = () => {
    if (disabled) {
      onRequireAuth?.();
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) {
      onRequireAuth?.();
      event.target.value = '';
      return;
    }
    const files = event.target.files;
    if (!files?.length) return;
    await onAddFiles(files);
    event.target.value = '';
  };

  return (
    <section className="command-workbench" aria-labelledby="workspace-source-heading">
      <input ref={fileInputRef} type="file" multiple accept="image/*" onChange={handleFileChange} className="hidden" />

      <div className="command-eyebrow-row">
        <h2 id="workspace-source-heading" className="command-eyebrow">Source</h2>
        <span className="command-shortcut">Workspace</span>
      </div>
      <div className="command-workbench__source">
        <button type="button" className="command-source-button command-source-button--active" onClick={chooseFiles} disabled={finalDisabled}>
          <CloudUpload size={20} strokeWidth={1.8} />
          Upload images
        </button>
        <button
          type="button"
          className="command-source-button"
          disabled
          title="Scan the current page from the extension popup"
        >
          <FileText size={19} strokeWidth={1.8} />
          Page images arrive here
        </button>
      </div>
      <p className="command-helper">Add more files here, or use the toolbar popup to collect images from a webpage.</p>

      <div className="command-workbench__queue">
        <div className="command-queue-heading">
          <h2 className="command-eyebrow">Queued files</h2>
          {items.length ? (
            <div className="flex items-center gap-3">
              <span className="command-ready-count">
                {items.length} image{items.length === 1 ? '' : 's'} ready
                <span className="command-ready-dot" />
              </span>
              <Button className="command-danger-button" size="sm" variant="ghost" onClick={onClear}>Clear all</Button>
            </div>
          ) : null}
        </div>

        {items.length ? (
          <div className="command-workbench__queue-grid">
            {items.map((item) => (
              <div className="command-queue-item" key={item.id}>
                <img src={item.dataUrl || item.sourceUrl} alt={item.name} />
                <button type="button" className="command-queue-remove" aria-label={`Remove ${item.name}`} onClick={() => onRemove(item.id)}>
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="command-empty-queue">No images queued yet</div>
        )}
      </div>

      <div className="command-workbench__controls">
        <div className="command-field">
          <Label htmlFor="full-language" className="command-label">Language</Label>
          <Select value={selectValue} onValueChange={(value) => onLanguageChange(value === 'auto' ? '' : value)}>
            <SelectTrigger id="full-language" aria-label="Language">
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

        <div className="command-field command-field--context">
          <Label htmlFor="full-context" className="command-label">Page or product context</Label>
          <Textarea
            id="full-context"
            className="command-textarea"
            placeholder="What is this page, product, or article about?"
            value={context}
            onChange={(event) => onContextChange(event.target.value)}
          />
        </div>

        <div className="command-field">
          <Label htmlFor="full-keyword" className="command-label">Focus keyword <span className="command-optional">Optional</span></Label>
          <input
            id="full-keyword"
            className="command-input"
            type="text"
            value={focusKeyword}
            onChange={(event) => onFocusKeywordChange(event.target.value)}
            placeholder="e.g. oak dining chair"
            maxLength={80}
          />
        </div>

        <div className="command-field">
          <Label htmlFor="full-brand" className="command-label">Brand <span className="command-optional">Optional</span></Label>
          <input
            id="full-brand"
            className="command-input"
            type="text"
            value={brand}
            onChange={(event) => onBrandChange(event.target.value)}
            placeholder="e.g. North & Pine"
            maxLength={80}
          />
        </div>
      </div>
      <p className="command-context-help">Context improves relevance. Keywords and brands are used only when the image visibly supports them.</p>

      <div className="command-workbench__actions" style={{ marginTop: 14 }}>
        <Button className="command-primary" onClick={onGenerateAll} disabled={finalDisabled || items.length === 0}>
          <Sparkles size={16} strokeWidth={1.8} />
          {busy ? 'Generating…' : `Generate ${items.length || ''} alt text${items.length === 1 ? '' : 's'}`.replace('  ', ' ')}
          <span className="command-primary__shortcut">⌘ ↵</span>
        </Button>
        <Button className="command-secondary" onClick={chooseFiles} disabled={finalDisabled}>
          <CloudUpload size={16} strokeWidth={1.8} />
          Add more
        </Button>
      </div>
    </section>
  );
}

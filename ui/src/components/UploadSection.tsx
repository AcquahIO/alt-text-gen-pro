import { useRef, useState } from 'react';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Wand2, ExternalLink, Upload } from 'lucide-react';

interface UploadSectionProps {
  language: string;
  onLanguageChange: (value: string) => void;
  context: string;
  onContextChange: (value: string) => void;
  onFilesSelected: (files: FileList) => Promise<void> | void;
  onOpenFullPage: () => Promise<void> | void;
  onGenerateCurrentPage: () => Promise<void> | void;
  disabled?: boolean;
  disabledMessage?: string;
  onRequireAuth?: () => void;
}

export function UploadSection({
  language,
  onLanguageChange,
  context,
  onContextChange,
  onFilesSelected,
  onOpenFullPage,
  onGenerateCurrentPage,
  disabled = false,
  disabledMessage,
  onRequireAuth,
}: UploadSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [lastSelectionCount, setLastSelectionCount] = useState(0);
  const [busy, setBusy] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) {
      onRequireAuth?.();
      e.target.value = '';
      return;
    }
    const files = e.target.files;
    if (!files || files.length === 0) {
      setLastSelectionCount(0);
      return;
    }
    setBusy(true);
    try {
      setLastSelectionCount(files.length);
      await onFilesSelected(files);
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  };

  const handleGenerate = async () => {
    if (disabled) {
      onRequireAuth?.();
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      await onGenerateCurrentPage();
    } finally {
      setBusy(false);
    }
  };

  const selectValue = language || 'auto';

  const handleLanguageChange = (value: string) => {
    onLanguageChange(value === 'auto' ? '' : value);
  };

  const finalDisabled = busy || disabled;

  return (
    <div
      className="rounded-xl border bg-card"
      style={{
        borderColor: '#dbeafe',
        boxShadow: '0 2px 10px rgba(30, 58, 138, 0.05)',
        padding: 18,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <h2 className="text-2xl font-semibold text-foreground" style={{ lineHeight: 1.1, letterSpacing: '-0.01em' }}>
          Upload images
        </h2>
        <p className="text-base text-muted-foreground">Choose language, add optional context, then generate.</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Label htmlFor="popup-language" className="text-sm">
          Language
        </Label>
        <Select value={selectValue} onValueChange={handleLanguageChange}>
          <SelectTrigger
            id="popup-language"
            className="w-full"
            style={{
              borderColor: '#dbeafe',
              borderRadius: 16,
              minHeight: 52,
              background: '#ffffff',
              fontSize: 16,
            }}
          >
            <SelectValue placeholder="Auto" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">Auto</SelectItem>
            <SelectItem value="en">English</SelectItem>
            <SelectItem value="es">Spanish</SelectItem>
            <SelectItem value="fr">French</SelectItem>
            <SelectItem value="de">German</SelectItem>
            <SelectItem value="it">Italian</SelectItem>
            <SelectItem value="pt">Portuguese</SelectItem>
            <SelectItem value="ja">Japanese</SelectItem>
            <SelectItem value="zh">Chinese</SelectItem>
            <SelectItem value="ko">Korean</SelectItem>
            <SelectItem value="ar">Arabic</SelectItem>
            <SelectItem value="hi">Hindi</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
        }}
      >
        <Button
          size="lg"
          onClick={() => {
            if (disabled) {
              onRequireAuth?.();
              return;
            }
            fileInputRef.current?.click();
          }}
          disabled={finalDisabled}
          style={{
            backgroundColor: '#0b1b44',
            color: '#ffffff',
            borderRadius: 14,
            border: '1px solid #0b1b44',
            minWidth: 172,
          }}
        >
          <Upload className="w-4 h-4" />
          Choose files
        </Button>
        <div
          className="text-sm text-muted-foreground"
          style={{
            border: '1px solid #dbeafe',
            borderRadius: 14,
            padding: '11px 16px',
            background: '#ffffff',
            minWidth: 176,
            lineHeight: 1.1,
          }}
        >
          {lastSelectionCount > 0 ? `${lastSelectionCount} file${lastSelectionCount > 1 ? 's' : ''} selected` : 'No file chosen'}
        </div>
      </div>

      <Button
        variant="outline"
        className="w-full"
        onClick={() => {
          if (disabled) {
            onRequireAuth?.();
            return;
          }
          onOpenFullPage();
        }}
        disabled={finalDisabled}
        style={{
          borderColor: '#dbeafe',
          borderRadius: 16,
          minHeight: 52,
          fontSize: 17,
          color: '#0b1b44',
          background: '#ffffff',
        }}
      >
        <ExternalLink className="w-4 h-4 mr-2" />
        Open full page
      </Button>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Label htmlFor="popup-context" className="text-sm">
          Optional context
        </Label>
        <Textarea
          id="popup-context"
          placeholder="Project/site context to inform descriptions (optional)"
          value={context}
          onChange={(e) => onContextChange(e.target.value)}
          style={{
            minHeight: 120,
            resize: 'vertical',
            borderColor: '#dbeafe',
            borderRadius: 16,
            fontSize: 16,
          }}
        />
      </div>

      {disabled && disabledMessage && (
        <div className="text-sm rounded-md border px-3 py-2" style={{ background: '#fffbeb', borderColor: '#fed7aa', color: '#92400e' }}>
          {disabledMessage}
        </div>
      )}

      <Button
        className="w-full"
        onClick={handleGenerate}
        disabled={finalDisabled}
        style={{
          background: '#0b1b44',
          color: '#ffffff',
          border: '1px solid #0b1b44',
          borderRadius: 14,
          minHeight: 48,
        }}
      >
        <Wand2 className={`w-4 h-4 mr-2 ${finalDisabled ? '' : busy ? 'animate-pulse' : ''}`} />
        Generate all images on this page
      </Button>
    </div>
  );
}

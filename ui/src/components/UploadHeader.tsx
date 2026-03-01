import { useRef } from 'react';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Wand2, Upload } from 'lucide-react';

interface UploadHeaderProps {
  language: string;
  onLanguageChange: (value: string) => void;
  context: string;
  onContextChange: (value: string) => void;
  onAddFiles: (files: FileList) => Promise<void> | void;
  onGenerateAll: () => Promise<void> | void;
  busy?: boolean;
  itemCount: number;
  disabled?: boolean;
  onRequireAuth?: () => void;
}

export function UploadHeader({
  language,
  onLanguageChange,
  context,
  onContextChange,
  onAddFiles,
  onGenerateAll,
  busy = false,
  itemCount,
  disabled = false,
  onRequireAuth,
}: UploadHeaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectValue = language || 'auto';

  const handleLanguageValueChange = (value: string) => {
    onLanguageChange(value === 'auto' ? '' : value);
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) {
      onRequireAuth?.();
      event.target.value = '';
      return;
    }
    const files = event.target.files;
    if (!files || files.length === 0) return;
    await onAddFiles(files);
    event.target.value = '';
  };

  const finalDisabled = busy || disabled;

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
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 16,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h2 className="text-2xl font-semibold" style={{ lineHeight: 1.1, letterSpacing: '-0.01em', color: '#0b1b44' }}>
            Upload images
          </h2>
          <p className="text-base text-muted-foreground" style={{ marginTop: 6 }}>
            Generate alt text in batches with consistent formatting.
          </p>
        </div>
        <span
          className="text-sm text-muted-foreground"
          style={{
            border: '1px solid #dbeafe',
            borderRadius: 999,
            padding: '6px 12px',
            background: '#eff6ff',
            color: '#1e3a8a',
          }}
        >
          {itemCount > 0 ? `${itemCount} image${itemCount > 1 ? 's' : ''} ready` : 'No files queued'}
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 18,
          alignItems: 'start',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Label htmlFor="full-language" className="text-sm">
              Language
            </Label>
            <Select value={selectValue} onValueChange={handleLanguageValueChange}>
              <SelectTrigger
                id="full-language"
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
            <Button
              onClick={onGenerateAll}
              disabled={finalDisabled || itemCount === 0}
              style={{
                backgroundColor: '#0b1b44',
                color: '#ffffff',
                border: '1px solid #0b1b44',
                borderRadius: 14,
                minHeight: 44,
              }}
            >
              <Wand2 className={`w-4 h-4 ${finalDisabled ? '' : busy ? 'animate-pulse' : ''}`} />
              <span>{busy ? 'Generating…' : 'Generate all'}</span>
            </Button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Label htmlFor="full-context" className="text-sm">
            Optional context
          </Label>
          <Textarea
            id="full-context"
            placeholder="Project/site context to inform descriptions (optional)"
            value={context}
            onChange={(e) => onContextChange(e.target.value)}
            style={{
              minHeight: 124,
              resize: 'vertical',
              borderColor: '#dbeafe',
              borderRadius: 16,
              background: '#ffffff',
              fontSize: 16,
            }}
          />
        </div>
      </div>
    </div>
  );
}

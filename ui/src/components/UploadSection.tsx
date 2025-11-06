import { useRef, useState } from 'react';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Wand2, ExternalLink } from 'lucide-react';

interface UploadSectionProps {
  language: string;
  onLanguageChange: (value: string) => void;
  context: string;
  onContextChange: (value: string) => void;
  onFilesSelected: (files: FileList) => Promise<void> | void;
  onOpenFullPage: () => Promise<void> | void;
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
      await onOpenFullPage();
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
    <div className="space-y-4">
      <h2 className="text-sm text-muted-foreground">Upload images to generate alt text</h2>

      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Label htmlFor="popup-language" className="text-sm whitespace-nowrap min-w-fit">
            Language
          </Label>
          <Select value={selectValue} onValueChange={handleLanguageChange}>
            <SelectTrigger id="popup-language">
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

        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
          <Button
            variant="outline"
            onClick={() => {
              if (disabled) {
                onRequireAuth?.();
                return;
              }
              fileInputRef.current?.click();
            }}
            disabled={finalDisabled}
          >
            Choose files
          </Button>
          <span className="text-sm text-muted-foreground">
            {lastSelectionCount > 0 ? `${lastSelectionCount} file${lastSelectionCount > 1 ? 's' : ''} selected` : 'No file chosen'}
          </span>
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
        >
          <ExternalLink className="w-4 h-4 mr-2" />
          Open Full Page
        </Button>

        <div className="space-y-2">
          <Label htmlFor="popup-context" className="text-sm">
            Optional context
          </Label>
          <Textarea
            id="popup-context"
            placeholder="Project/site context to inform descriptions (optional)"
            value={context}
            onChange={(e) => onContextChange(e.target.value)}
            className="min-h-[100px] resize-none"
          />
        </div>

        {disabled && disabledMessage && (
          <div className="bg-amber-50 text-amber-700 text-sm p-3 rounded-md border border-amber-200">
            {disabledMessage}
          </div>
        )}

        <Button
          className="w-full"
          onClick={handleGenerate}
          disabled={finalDisabled}
        >
          <Wand2 className={`w-4 h-4 mr-2 ${finalDisabled ? '' : busy ? 'animate-pulse' : ''}`} />
          Generate All
        </Button>
      </div>
    </div>
  );
}

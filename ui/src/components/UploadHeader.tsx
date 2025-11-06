import { useRef } from 'react';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Wand2 } from 'lucide-react';

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
    <div className="border rounded-2xl bg-card p-6">
      <h2 className="mb-6 text-lg font-medium">Upload images to generate alt text</h2>

      <div className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,320px),minmax(0,1fr)] items-start">
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="full-language" className="text-sm">
                Language
              </Label>
              <Select value={selectValue} onValueChange={handleLanguageValueChange}>
                <SelectTrigger id="full-language" className="w-full">
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

            <div className="space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="flex flex-wrap items-center gap-3">
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
                  {itemCount > 0 ? `${itemCount} image${itemCount > 1 ? 's' : ''} ready` : 'No files queued yet'}
                </span>
                <Button
                  className="ml-auto w-full bg-green-600 hover:bg-green-700 text-white sm:w-auto"
                  onClick={onGenerateAll}
                  disabled={finalDisabled || itemCount === 0}
                >
                  <Wand2 className={`w-4 h-4 ${finalDisabled ? '' : busy ? 'animate-pulse' : ''}`} />
                  <span>{busy ? 'Generating…' : 'Generate All'}</span>
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="full-context" className="text-sm">
              Optional context
            </Label>
            <Textarea
              id="full-context"
              placeholder="Project/site context to inform descriptions (optional)"
              value={context}
              onChange={(e) => onContextChange(e.target.value)}
              className="min-h-[140px] resize-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

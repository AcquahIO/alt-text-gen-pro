import { useCallback, useEffect, useMemo, useState } from 'react';
import { UploadHeader } from '@/components/UploadHeader';
import { ImageResultCard } from '@/components/ImageResultCard';
import { Button } from '@/components/ui/button';
import { Toaster } from '@/components/ui/sonner';
import {
  consumePendingUploads,
  downloadWithMetadata,
  generateAltTextForDataUrl,
  getPreferredLanguage,
  getSavedContext,
  getRuntimeUrl,
  setPreferredLanguage,
  setSavedContext,
  formatFileSize,
} from '@/lib/extension';
import { entriesToItems, filesToUploadItems } from '@/lib/uploads';
import { UploadItem } from '@/lib/types';
import { toast } from 'sonner';
import { Wand2 } from 'lucide-react';

export default function FullPageApp() {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [language, setLanguage] = useState('');
  const [context, setContext] = useState('');
  const [generatingAll, setGeneratingAll] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const [pending, storedLang, storedCtx] = await Promise.all([
        consumePendingUploads().catch(() => null),
        getPreferredLanguage().catch(() => ''),
        getSavedContext().catch(() => ''),
      ]);
      if (!mounted) return;
      const initialItems = entriesToItems(pending?.entries || []);
      setItems(initialItems);
      setLanguage((pending?.language ?? storedLang ?? '').toString());
      setContext((pending?.context ?? storedCtx ?? '').toString());
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const handleAddFiles = useCallback(async (files: FileList) => {
    if (!files.length) return;
    const newItems = await filesToUploadItems(files);
    setItems((current) => [...newItems, ...current]);
  }, []);

  const updateItem = useCallback((id: string, updater: (item: UploadItem) => UploadItem) => {
    setItems((current) => current.map((item) => (item.id === id ? updater(item) : item)));
  }, []);

  const generateItem = useCallback(
    async (id: string) => {
      let snapshot: UploadItem | undefined;
      setItems((current) =>
        current.map((item) => {
          if (item.id === id) {
            snapshot = item;
            return { ...item, status: 'generating', error: undefined };
          }
          return item;
        }),
      );
      if (!snapshot) return;
      try {
        const { altText } = await generateAltTextForDataUrl(snapshot.dataUrl, context);
        updateItem(id, (item) => ({ ...item, altText, status: 'done', error: undefined }));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        updateItem(id, (item) => ({ ...item, status: 'error', error: message }));
        toast.error(message || 'Generation failed');
      }
    },
    [context, updateItem],
  );

  const handleGenerateItem = useCallback(async (id: string) => {
    await generateItem(id);
  }, [generateItem]);

  const handleGenerateAll = useCallback(async () => {
    if (!items.length) return;
    setGeneratingAll(true);
    try {
      for (const item of items) {
        if (item.status === 'done' && item.altText) continue;
        await generateItem(item.id);
      }
    } finally {
      setGeneratingAll(false);
    }
  }, [items, generateItem]);

  const handleCopy = useCallback(async (item: UploadItem) => {
    if (!item.altText) return;
    try {
      await navigator.clipboard.writeText(item.altText);
      toast.success('Copied to clipboard');
    } catch (error) {
      toast.error('Copy failed');
    }
  }, []);

  const handleDownload = useCallback(async (item: UploadItem) => {
    if (!item.altText) return;
    try {
      await downloadWithMetadata(item, item.altText);
      toast.success('Downloaded with metadata');
    } catch (error) {
      toast.error('Download failed');
    }
  }, []);

  const handleLanguageChange = useCallback(async (value: string) => {
    setLanguage(value);
    await setPreferredLanguage(value);
  }, []);

  const handleContextChange = useCallback(async (value: string) => {
    setContext(value);
    await setSavedContext(value);
  }, []);

  const renderedItems = useMemo(() => items, [items]);
  const iconSrc = useMemo(() => getRuntimeUrl('icons/icon32.png'), []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-card/40 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-6 lg:px-10 py-4">
          <div className="flex items-center gap-2">
            <img src={iconSrc} alt="Alt Text Generator" className="w-7 h-7 rounded-lg" />
            <h1 className="text-lg font-semibold">Alt Text Generator</h1>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 lg:px-10 py-10 space-y-8">
        <UploadHeader
          language={language}
          onLanguageChange={handleLanguageChange}
          context={context}
          onContextChange={handleContextChange}
          onAddFiles={handleAddFiles}
          onGenerateAll={handleGenerateAll}
          busy={generatingAll}
          itemCount={items.length}
        />

        {renderedItems.length > 0 ? (
          <div className="space-y-6">
            {renderedItems.map((item) => (
              <ImageResultCard
                key={item.id}
                item={item}
                fileSizeLabel={formatFileSize(item.size)}
                onGenerate={() => handleGenerateItem(item.id)}
                onCopy={() => handleCopy(item)}
                onDownload={() => handleDownload(item)}
              />
            ))}
          </div>
        ) : (
          <div className="border border-dashed rounded-xl p-12 text-center text-muted-foreground">
            <p>No images queued yet. Use the uploader above or the extension popup to start.</p>
          </div>
        )}

        <div className="flex justify-center pt-2">
          <Button
            className="w-full max-w-sm bg-green-600 hover:bg-green-700 text-white sm:w-auto"
            onClick={handleGenerateAll}
            disabled={generatingAll || items.length === 0}
          >
            <Wand2 className={`w-4 h-4 ${generatingAll ? 'animate-pulse' : ''}`} />
            <span>{generatingAll ? 'Generating…' : 'Generate All'}</span>
          </Button>
        </div>
      </main>
      <Toaster richColors position="top-center" />
    </div>
  );
}

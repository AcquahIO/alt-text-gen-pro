import { useCallback, useEffect, useMemo, useState } from 'react';
import { UploadHeader } from '@/components/UploadHeader';
import { ImageResultCard } from '@/components/ImageResultCard';
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
  const iconSrc = useMemo(() => getRuntimeUrl('icons/icon-32.png'), []);

  return (
    <div className="min-h-screen text-foreground" style={{ background: '#f8fbff' }}>
      <header className="border-b" style={{ borderColor: '#dbeafe', background: '#ffffff' }}>
        <div
          style={{
            maxWidth: 1080,
            marginInline: 'auto',
            padding: '16px 24px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              justifyContent: 'space-between',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <img src={iconSrc} alt="Alt Text Generator" className="w-7 h-7 rounded-lg" />
              <h1 className="text-lg font-semibold" style={{ letterSpacing: '-0.01em', color: '#0b1b44' }}>
                Alt Text Generator
              </h1>
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
              {items.length} image{items.length === 1 ? '' : 's'} queued
            </span>
          </div>
        </div>
      </header>

      <main
        style={{
          maxWidth: 1080,
          marginInline: 'auto',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}
      >
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
          <div
            className="border border-dashed rounded-xl text-center text-muted-foreground"
            style={{ padding: '42px 24px', borderColor: '#dbeafe', background: '#ffffff' }}
          >
            <p>No images queued yet. Use the uploader above or the extension popup to start.</p>
          </div>
        )}
      </main>
      <Toaster richColors position="top-center" />
    </div>
  );
}

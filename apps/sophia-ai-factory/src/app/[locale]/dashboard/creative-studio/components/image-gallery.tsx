'use client';

import { useState, useCallback, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { Download, Copy, AlertCircle, ImageIcon } from 'lucide-react';
import { Card } from '@/seed/components/ui/card';
import { Skeleton } from '@/seed/components/ui/skeleton';
import { Button } from '@/seed/components/ui/button';

export interface ImageRecord {
  id: string;
  status: string;
  resultUrl?: string | null;
  thumbnailUrl?: string | null;
  prompt: string;
  model: string;
  createdAt: number;
}

interface GalleryApiRow {
  id: string;
  status: string;
  result_url: string | null;
  thumbnail_url: string | null;
  prompt: string | null;
  model: string;
  created_at: number;
}

interface ImageGalleryProps {
  pendingImages?: ImageRecord[];
}

export function ImageGallery({ pendingImages = [] }: ImageGalleryProps) {
  const t = useTranslations('creativeStudio.image');
  const [historyImages, setHistoryImages] = useState<ImageRecord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [brokenImages, setBrokenImages] = useState<Set<string>>(new Set());

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/creative-studio/images');
      if (!res.ok) {
        setLoadError(t('loadHistoryFailed'));
        return;
      }
      const data = (await res.json()) as { images: GalleryApiRow[] };
      const mapped: ImageRecord[] = (data.images ?? []).map((row) => ({
        id: row.id,
        status: row.status,
        resultUrl: row.result_url,
        thumbnailUrl: row.thumbnail_url,
        prompt: row.prompt ?? '',
        model: row.model,
        createdAt: row.created_at,
      }));
      setHistoryImages(mapped);
    } catch {
      setLoadError(t('loadHistoryFailed'));
    } finally {
      setIsLoadingHistory(false);
    }
  }, [t]);

  const retryHistory = useCallback(() => {
    setLoadError(null);
    setIsLoadingHistory(true);
    fetchHistory();
  }, [fetchHistory]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const historyIds = new Set(historyImages.map((img) => img.id));
  const sessionImages = pendingImages.filter((img) => !historyIds.has(img.id));
  const allImages = [...sessionImages, ...historyImages];

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center h-48 rounded-lg border border-destructive/30 bg-destructive/5 gap-3">
        <AlertCircle className="w-8 h-8 text-destructive" aria-hidden="true" />
        <p className="text-sm text-destructive">{loadError}</p>
        <Button size="sm" variant="secondary" onClick={retryHistory}>
          {t('retry')}
        </Button>
      </div>
    );
  }

  if (isLoadingHistory) {
    return <GallerySkeleton />;
  }

  if (allImages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 rounded-lg border border-dashed border-border gap-3">
        <ImageIcon className="w-10 h-10 text-muted-foreground/40" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">{t('generateFirst')}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {allImages.map((img) => (
        <ImageCard key={img.id} image={img} brokenImages={brokenImages} setBrokenImages={setBrokenImages} />
      ))}
    </div>
  );
}

function ImageCard({
  image,
  brokenImages,
  setBrokenImages,
}: {
  image: ImageRecord;
  brokenImages: Set<string>;
  setBrokenImages: React.Dispatch<React.SetStateAction<Set<string>>>;
}) {
  const t = useTranslations('creativeStudio.image');
  const isPending = image.status === 'pending' || image.status === 'processing';
  const isFailed = image.status === 'failed';
  const isCompleted = image.status === 'completed' && image.resultUrl && !brokenImages.has(image.id);
  const isBroken = brokenImages.has(image.id);
  const [imgError, setImgError] = useState(false);

  function handleDownload() {
    if (!image.resultUrl) return;
    const a = document.createElement('a');
    a.href = image.resultUrl;
    a.download = `sophia-${image.id}.png`;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.click();
  }

  function handleCopyUrl() {
    if (!image.resultUrl) return;
    navigator.clipboard.writeText(image.resultUrl).catch(() => {});
  }

  return (
    <Card className="overflow-hidden group relative">
      <div className="aspect-square bg-muted relative">
        {imgError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <ImageIcon className="w-8 h-8 text-muted-foreground/40" aria-hidden="true" />
            <p className="text-xs text-muted-foreground">{t('loadFailed')}</p>
          </div>
        )}
        {isPending && !imgError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <Skeleton className="w-full h-full absolute inset-0" />
            <div className="relative z-10 flex flex-col items-center gap-1">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-muted-foreground capitalize">{image.status}</span>
            </div>
          </div>
        )}
        {isFailed && !imgError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-destructive/5">
            <AlertCircle className="w-8 h-8 text-destructive" aria-hidden="true" />
            <p className="text-xs text-destructive text-center px-2">{t('generationFailed')}</p>
          </div>
        )}
        {isCompleted && (
          <>
            <Image
              src={image.resultUrl!}
              alt={image.prompt}
              fill
              className="w-full h-full object-cover"
              loading="lazy"
              onError={() => setImgError(true)}
            />
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3 gap-2">
              <p className="text-white text-xs line-clamp-2">{image.prompt}</p>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" className="flex-1 text-xs" onClick={handleDownload}>
                  <Download className="w-3 h-3 mr-1" aria-hidden="true" />
                  {t('download')}
                </Button>
                <Button size="sm" variant="secondary" className="flex-1 text-xs" onClick={handleCopyUrl}>
                  <Copy className="w-3 h-3 mr-1" aria-hidden="true" />
                  {t('copyUrl')}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
      <div className="px-3 py-2">
        <p className="text-xs text-muted-foreground truncate">{image.model}</p>
      </div>
    </Card>
  );
}

function GallerySkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="aspect-square rounded-lg" />
      ))}
    </div>
  );
}

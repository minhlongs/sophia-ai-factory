'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/seed/components/ui/button';
import { Input } from '@/seed/components/ui/input';
import { Label } from '@/seed/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/seed/components/ui/card';
import { createBatchAction, startBatchAction } from '@/app/actions/batch-generate-action';
import { Upload, Loader2, AlertCircle, CheckCircle } from 'lucide-react';

interface BatchUploadFormProps {
  onBatchCreated: (batchId: string) => void;
}

export function BatchUploadForm({ onBatchCreated }: BatchUploadFormProps) {
  const t = useTranslations('batch');
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ videoCount: number; estimatedCostCents: number; batchId: string } | null>(null);

  async function handleUpload() {
    if (!file) return;
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.set('file', file);
    formData.set('name', name || file.name);

    const result = await createBatchAction(formData);
    if (!result.success) {
      setError(result.error);
      setLoading(false);
      return;
    }

    setPreview(result.data);
    setLoading(false);
  }

  async function handleStart() {
    if (!preview) return;
    setLoading(true);
    setError(null);

    const result = await startBatchAction(preview.batchId);
    if (!result.success) {
      setError(result.error);
      setLoading(false);
      return;
    }

    onBatchCreated(preview.batchId);
    setLoading(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{t('uploadTitle')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label className="text-xs">{t('batchName')}</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('batchNamePlaceholder')}
            className="h-9"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs">{t('uploadFile')}</Label>
          <label className="flex items-center justify-center gap-2 h-20 border border-dashed border-border rounded-md cursor-pointer hover:bg-muted/50 transition-colors">
            <input
              type="file"
              accept=".csv,.json"
              className="hidden"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setPreview(null);
                setError(null);
              }}
            />
            <Upload className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              {file ? file.name : t('uploadHint')}
            </span>
          </label>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-destructive text-xs">
            <AlertCircle className="w-3 h-3 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {preview && (
          <div className="flex items-center gap-2 text-xs bg-muted/50 p-3 rounded-md">
            <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
            <div>
              <p className="font-medium">
                {preview.videoCount} {t('videosReady')}
              </p>
              <p className="text-muted-foreground">
                {t('estimatedCost')}: ${(preview.estimatedCostCents / 100).toFixed(2)}
              </p>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          {!preview ? (
            <Button
              onClick={handleUpload}
              disabled={!file || loading}
              size="sm"
              className="w-full"
            >
              {loading && <Loader2 className="w-3 h-3 animate-spin mr-1" />}
              {t('validate')}
            </Button>
          ) : (
            <Button
              onClick={handleStart}
              disabled={loading}
              size="sm"
              className="w-full"
            >
              {loading && <Loader2 className="w-3 h-3 animate-spin mr-1" />}
              {t('startBatch')}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

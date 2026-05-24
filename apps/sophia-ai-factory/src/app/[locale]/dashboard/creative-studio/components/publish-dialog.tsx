'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/seed/components/ui/button';
import { Input } from '@/seed/components/ui/input';
import { Label } from '@/seed/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/seed/components/ui/dialog';
import {
  publishVideoAction,
  getConnectedPlatformsAction,
} from '@/app/actions/publish-video-action';
import { Loader2, Send, Youtube } from 'lucide-react';

interface PublishDialogProps {
  videoId: string;
  videoUrl: string;
  videoTitle?: string;
}

const PLATFORM_ICONS: Record<string, typeof Youtube> = {
  youtube: Youtube,
};

export function PublishDialog({ videoId, videoUrl, videoTitle }: PublishDialogProps) {
  const t = useTranslations('publish');
  const [open, setOpen] = useState(false);
  const [platforms, setPlatforms] = useState<Array<{ platform: string; channelName: string | null }>>([]);
  const [selectedPlatform, setSelectedPlatform] = useState<string>('youtube');
  const [title, setTitle] = useState(videoTitle ?? '');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [privacy, setPrivacy] = useState<'public' | 'unlisted' | 'private'>('private');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (open) {
      getConnectedPlatformsAction().then((res) => {
        if (res.success) setPlatforms(res.data);
      });
    }
  }, [open]);

  async function handlePublish() {
    setLoading(true);
    setError(null);

    const result = await publishVideoAction({
      videoId,
      videoUrl,
      platform: selectedPlatform as 'youtube',
      title,
      description,
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      privacy,
    });

    if (!result.success) {
      setError(result.error);
    } else {
      setSuccess(true);
    }
    setLoading(false);
  }

  const connectedPlatforms = platforms.filter((p) => ['youtube'].includes(p.platform));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1">
          <Send className="w-3 h-3" />
          {t('publish')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm">{t('publishVideo')}</DialogTitle>
        </DialogHeader>

        {success ? (
          <div className="text-center py-4 text-sm text-green-600">
            {t('publishSuccess')}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Platform selector */}
            <div className="space-y-2">
              <Label className="text-xs">{t('platform')}</Label>
              <div className="flex gap-2">
                {connectedPlatforms.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t('noPlatforms')}</p>
                ) : (
                  connectedPlatforms.map((p) => {
                    const Icon = PLATFORM_ICONS[p.platform] ?? Send;
                    return (
                      <Button
                        key={p.platform}
                        variant={selectedPlatform === p.platform ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setSelectedPlatform(p.platform)}
                        className="gap-1"
                      >
                        <Icon className="w-3 h-3" />
                        {p.platform}
                      </Button>
                    );
                  })
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">{t('title')}</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-9" />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">{t('description')}</Label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full h-20 rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">{t('tags')}</Label>
              <Input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder={t('tagsPlaceholder')}
                className="h-9"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">{t('privacy')}</Label>
              <select
                value={privacy}
                onChange={(e) => setPrivacy(e.target.value as typeof privacy)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="private">{t('private')}</option>
                <option value="unlisted">{t('unlisted')}</option>
                <option value="public">{t('public')}</option>
              </select>
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}

            <Button
              onClick={handlePublish}
              disabled={loading || !title || connectedPlatforms.length === 0}
              className="w-full"
              size="sm"
            >
              {loading && <Loader2 className="w-3 h-3 animate-spin mr-1" />}
              {t('publishNow')}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Eye, EyeOff, ExternalLink } from 'lucide-react';
import { UseFormReturn } from 'react-hook-form';
import { UserProfileFormValues } from '@/lib/schemas/settings';

interface ApiKeysSectionProps {
  form: UseFormReturn<UserProfileFormValues>;
  isPending: boolean;
  defaultValues: UserProfileFormValues;
}

interface KeyConfig {
  id: keyof UserProfileFormValues['apiKeys'];
  label: string;
  description: string;
  placeholder: string;
  helpUrl: string;
  helpText: string;
}

const KEY_CONFIGS: KeyConfig[] = [
  {
    id: 'openai',
    label: 'OpenAI / OpenRouter',
    description: 'Trí tuệ nhân tạo cho nội dung văn bản',
    placeholder: 'sk-...',
    helpUrl: 'https://openrouter.ai/keys',
    helpText: 'Lấy key tại OpenRouter',
  },
  {
    id: 'anthropic',
    label: 'Anthropic (Claude)',
    description: 'AI cao cấp cho phân tích và sáng tạo',
    placeholder: 'sk-ant-...',
    helpUrl: 'https://console.anthropic.com/settings/keys',
    helpText: 'Lấy key tại Anthropic',
  },
  {
    id: 'elevenlabs',
    label: 'ElevenLabs',
    description: 'Tạo giọng nói AI tự nhiên cho video',
    placeholder: 'xi-...',
    helpUrl: 'https://elevenlabs.io/subscription',
    helpText: 'Lấy key tại ElevenLabs',
  },
  {
    id: 'heygen',
    label: 'HeyGen',
    description: 'Tạo video AI với avatar ảo',
    placeholder: 'hg-...',
    helpUrl: 'https://app.heygen.com/settings/api-keys',
    helpText: 'Lấy key tại HeyGen',
  },
  {
    id: 'muapi',
    label: 'MuAPI (Media AI)',
    description: 'Tạo ảnh, video, nhạc AI (Midjourney, Kling, Suno)',
    placeholder: 'mu-...',
    helpUrl: 'https://muapi.ai/dashboard',
    helpText: 'Lấy key tại MuAPI',
  },
];

export function ApiKeysSection({ form, isPending, defaultValues }: ApiKeysSectionProps) {
  const { register } = form;
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});

  const toggleKeyVisibility = (key: string) => {
    setShowKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>API Keys</CardTitle>
        <CardDescription>
          Nhập API key của bạn. Key được mã hóa an toàn.
          Để trống nếu muốn giữ nguyên key hiện tại.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {KEY_CONFIGS.map((config) => (
          <div key={config.id} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor={config.id} className="text-sm font-medium">
                {config.label}
              </Label>
              <a
                href={config.helpUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 transition-colors"
              >
                {config.helpText}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <p className="text-xs text-muted-foreground">{config.description}</p>
            <div className="relative">
              <Input
                id={config.id}
                type={showKeys[config.id] ? 'text' : 'password'}
                placeholder={
                  defaultValues.apiKeys[config.id] ? '********' : config.placeholder
                }
                {...register(`apiKeys.${config.id}`)}
                disabled={isPending}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => toggleKeyVisibility(config.id)}
                aria-label={showKeys[config.id] ? `Hide ${config.label} key` : `Show ${config.label} key`}
              >
                {showKeys[config.id] ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
          </div>
        ))}

        <div className="rounded-lg bg-violet-500/5 border border-violet-500/10 px-4 py-3 mt-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Bảo mật:</strong> Key được mã hóa AES-256 trước khi lưu.
            Chỉ bạn mới có thể sử dụng key của mình. Không ai trong hệ thống có thể đọc key gốc.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

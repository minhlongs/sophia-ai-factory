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
import { Eye, EyeOff } from 'lucide-react';
import { UseFormReturn } from 'react-hook-form';
import { UserProfileFormValues } from '@/lib/schemas/settings';

interface ApiKeysSectionProps {
  form: UseFormReturn<UserProfileFormValues>;
  isPending: boolean;
  defaultValues: UserProfileFormValues;
}

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
          Securely store your API keys. They are encrypted at rest. Leave
          empty to keep existing keys unchanged.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="openai">OpenAI API Key</Label>
          <div className="relative">
            <Input
              id="openai"
              type={showKeys.openai ? 'text' : 'password'}
              placeholder={
                defaultValues.apiKeys.openai ? '********' : 'sk-...'
              }
              {...register('apiKeys.openai')}
              disabled={isPending}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
              onClick={() => toggleKeyVisibility('openai')}
              aria-label={showKeys.openai ? 'Hide OpenAI API key' : 'Show OpenAI API key'}
            >
              {showKeys.openai ? (
                <EyeOff className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Eye className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="anthropic">Anthropic API Key</Label>
          <div className="relative">
            <Input
              id="anthropic"
              type={showKeys.anthropic ? 'text' : 'password'}
              placeholder={
                defaultValues.apiKeys.anthropic ? '********' : 'sk-ant-...'
              }
              {...register('apiKeys.anthropic')}
              disabled={isPending}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
              onClick={() => toggleKeyVisibility('anthropic')}
              aria-label={showKeys.anthropic ? 'Hide Anthropic API key' : 'Show Anthropic API key'}
            >
              {showKeys.anthropic ? (
                <EyeOff className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Eye className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="elevenlabs">ElevenLabs API Key</Label>
          <div className="relative">
            <Input
              id="elevenlabs"
              type={showKeys.elevenlabs ? 'text' : 'password'}
              placeholder={
                defaultValues.apiKeys.elevenlabs ? '********' : 'xi-...'
              }
              {...register('apiKeys.elevenlabs')}
              disabled={isPending}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
              onClick={() => toggleKeyVisibility('elevenlabs')}
              aria-label={showKeys.elevenlabs ? 'Hide ElevenLabs API key' : 'Show ElevenLabs API key'}
            >
              {showKeys.elevenlabs ? (
                <EyeOff className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Eye className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

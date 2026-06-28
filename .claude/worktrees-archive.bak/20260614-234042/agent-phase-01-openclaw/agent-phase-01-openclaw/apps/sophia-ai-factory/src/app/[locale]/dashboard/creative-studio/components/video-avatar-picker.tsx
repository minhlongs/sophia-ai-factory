'use client';

import { useTranslations } from 'next-intl';

interface AvatarPreset {
  id: string;
  name: string;
  initials: string;
  color: string;
}

const AVATAR_PRESETS: AvatarPreset[] = [
  { id: 'anna_costume1_cameraA', name: 'Anna', initials: 'AN', color: 'bg-blue-500' },
  { id: 'bryan_costume1_cameraA', name: 'Bryan', initials: 'BR', color: 'bg-green-500' },
  { id: 'carol_costume1_cameraA', name: 'Carol', initials: 'CA', color: 'bg-purple-500' },
  { id: 'david_costume1_cameraA', name: 'David', initials: 'DA', color: 'bg-orange-500' },
  { id: 'elena_costume1_cameraA', name: 'Elena', initials: 'EL', color: 'bg-pink-500' },
  { id: 'frank_costume1_cameraA', name: 'Frank', initials: 'FR', color: 'bg-teal-500' },
];

interface VideoAvatarPickerProps {
  value: string;
  onChange: (id: string) => void;
}

export function VideoAvatarPicker({ value, onChange }: VideoAvatarPickerProps) {
  const t = useTranslations('creativeStudio');

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{t('video.avatarLabel')}</span>
      <div className="grid grid-cols-3 gap-2">
        {AVATAR_PRESETS.map((avatar) => {
          const isSelected = value === avatar.id;
          return (
            <button
              key={avatar.id}
              type="button"
              onClick={() => onChange(avatar.id)}
              className={[
                'flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center transition-colors',
                isSelected
                  ? 'border-primary ring-2 ring-primary ring-offset-1'
                  : 'border-border hover:border-primary/50',
              ].join(' ')}
              aria-pressed={isSelected}
            >
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full text-white text-sm font-semibold ${avatar.color}`}
              >
                {avatar.initials}
              </div>
              <span className="text-xs text-muted-foreground">{avatar.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

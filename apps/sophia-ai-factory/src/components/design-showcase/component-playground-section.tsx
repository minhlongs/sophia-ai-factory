'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { AlertCircle, CheckCircle2, Sparkles } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/seed/components/ui/alert';
import { Badge, type BadgeProps } from '@/seed/components/ui/badge';
import { Button, type ButtonProps } from '@/seed/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/seed/components/ui/card';
import { Input } from '@/seed/components/ui/input';

type ButtonVariantOption = NonNullable<ButtonProps['variant']>;
type ButtonSizeOption = NonNullable<ButtonProps['size']>;
type BadgeVariantOption = NonNullable<BadgeProps['variant']>;
type AlertVariantOption = 'default' | 'destructive';

const BUTTON_VARIANTS: readonly ButtonVariantOption[] = [
  'primary',
  'default',
  'secondary',
  'outline',
  'ghost',
  'destructive',
  'glow',
  'glass',
  'link',
];

const BUTTON_SIZES: readonly ButtonSizeOption[] = ['sm', 'default', 'md', 'lg'];

const BADGE_VARIANTS: readonly BadgeVariantOption[] = [
  'basic',
  'premium',
  'enterprise',
  'default',
  'secondary',
  'outline',
  'destructive',
];

function ButtonPlaygroundCard() {
  const t = useTranslations('designShowcase');
  const [buttonVariant, setButtonVariant] = React.useState<ButtonVariantOption>('primary');
  const [buttonSize, setButtonSize] = React.useState<ButtonSizeOption>('default');
  const [buttonDisabled, setButtonDisabled] = React.useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('playground.buttonTitle')}</CardTitle>
        <CardDescription>{t('playground.buttonSubtitle')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex min-h-24 items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 p-6">
          <Button
            type="button"
            variant={buttonVariant}
            size={buttonSize}
            disabled={buttonDisabled}
            data-testid="playground-button-preview"
            data-variant={buttonVariant}
            data-size={buttonSize}
          >
            <Sparkles className="mr-2 h-4 w-4" aria-hidden="true" />
            {t('playground.buttonSampleLabel')}
          </Button>
        </div>

        <div className="space-y-3">
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">
              {t('playground.controls.variant')}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {BUTTON_VARIANTS.map((variant) => (
                <Button
                  key={variant}
                  type="button"
                  size="sm"
                  variant={buttonVariant === variant ? 'primary' : 'outline'}
                  onClick={() => setButtonVariant(variant)}
                  aria-pressed={buttonVariant === variant}
                >
                  {variant}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                {t('playground.controls.size')}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {BUTTON_SIZES.map((size) => (
                  <Button
                    key={size}
                    type="button"
                    size="sm"
                    variant={buttonSize === size ? 'primary' : 'outline'}
                    onClick={() => setButtonSize(size)}
                    aria-pressed={buttonSize === size}
                  >
                    {size}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                {t('playground.controls.state')}
              </p>
              <Button
                type="button"
                size="sm"
                variant={buttonDisabled ? 'destructive' : 'outline'}
                onClick={() => setButtonDisabled((prev) => !prev)}
                aria-pressed={buttonDisabled}
                data-testid="playground-button-disabled-toggle"
              >
                {buttonDisabled
                  ? t('playground.controls.disabledOn')
                  : t('playground.controls.disabledOff')}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function BadgeCardPlaygroundCard() {
  const t = useTranslations('designShowcase');
  const [badgeVariant, setBadgeVariant] = React.useState<BadgeVariantOption>('enterprise');
  const [cardGlass, setCardGlass] = React.useState(false);
  const [cardHover, setCardHover] = React.useState(true);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('playground.badgeCardTitle')}</CardTitle>
        <CardDescription>{t('playground.badgeCardSubtitle')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <Card
          glass={cardGlass}
          hover={cardHover}
          data-testid="playground-card-preview"
          data-glass={String(cardGlass)}
          data-hover={String(cardHover)}
          className="p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">
                {t('playground.cardSampleTitle')}
              </p>
              <p className="text-xs text-muted-foreground">{t('playground.cardSampleBody')}</p>
            </div>
            <Badge
              variant={badgeVariant}
              data-testid="playground-badge-preview"
              data-variant={badgeVariant}
            >
              {badgeVariant}
            </Badge>
          </div>
        </Card>

        <div className="space-y-3">
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">
              {t('playground.controls.badgeVariant')}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {BADGE_VARIANTS.map((variant) => (
                <Button
                  key={variant}
                  type="button"
                  size="sm"
                  variant={badgeVariant === variant ? 'primary' : 'outline'}
                  onClick={() => setBadgeVariant(variant)}
                  aria-pressed={badgeVariant === variant}
                >
                  {variant}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={cardGlass ? 'primary' : 'outline'}
              onClick={() => setCardGlass((prev) => !prev)}
              aria-pressed={cardGlass}
            >
              glass: {String(cardGlass)}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={cardHover ? 'primary' : 'outline'}
              onClick={() => setCardHover((prev) => !prev)}
              aria-pressed={cardHover}
            >
              hover: {String(cardHover)}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function InputAlertPlaygroundCards() {
  const t = useTranslations('designShowcase');
  const [inputDisabled, setInputDisabled] = React.useState(false);
  const [inputValue, setInputValue] = React.useState('');
  const [alertVariant, setAlertVariant] = React.useState<AlertVariantOption>('default');

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t('playground.inputTitle')}</CardTitle>
          <CardDescription>{t('playground.inputSubtitle')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="design-playground-input"
              className="text-xs font-medium text-foreground"
            >
              {t('playground.inputLabel')}
            </label>
            <Input
              id="design-playground-input"
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              disabled={inputDisabled}
              placeholder={t('playground.inputPlaceholder')}
              data-testid="playground-input-preview"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button
              type="button"
              size="sm"
              variant={inputDisabled ? 'destructive' : 'outline'}
              onClick={() => setInputDisabled((prev) => !prev)}
              aria-pressed={inputDisabled}
            >
              {inputDisabled
                ? t('playground.controls.disabledOn')
                : t('playground.controls.disabledOff')}
            </Button>
            <span className="font-mono text-xs text-muted-foreground">
              {inputValue.length} {t('playground.charsLabel')}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('playground.alertTitle')}</CardTitle>
          <CardDescription>{t('playground.alertSubtitle')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant={alertVariant} data-testid="playground-alert-preview">
            {alertVariant === 'destructive' ? (
              <AlertCircle className="h-4 w-4" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            )}
            <AlertTitle>
              {alertVariant === 'destructive'
                ? t('playground.alertDestructiveTitle')
                : t('playground.alertDefaultTitle')}
            </AlertTitle>
            <AlertDescription>
              {alertVariant === 'destructive'
                ? t('playground.alertDestructiveBody')
                : t('playground.alertDefaultBody')}
            </AlertDescription>
          </Alert>

          <div className="flex gap-2">
            {(['default', 'destructive'] as const).map((variant) => (
              <Button
                key={variant}
                type="button"
                size="sm"
                variant={alertVariant === variant ? 'primary' : 'outline'}
                onClick={() => setAlertVariant(variant)}
                aria-pressed={alertVariant === variant}
              >
                {variant}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  );
}

export function ComponentPlaygroundSection() {
  const t = useTranslations('designShowcase');

  return (
    <section
      id="playground"
      aria-labelledby="design-playground-heading"
      className="scroll-mt-24 space-y-8"
    >
      <div className="space-y-1.5">
        <Badge variant="basic">{t('playground.eyebrow')}</Badge>
        <h2
          id="design-playground-heading"
          className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl"
        >
          {t('playground.title')}
        </h2>
        <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
          {t('playground.description')}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ButtonPlaygroundCard />
        <BadgeCardPlaygroundCard />
        <InputAlertPlaygroundCards />
      </div>
    </section>
  );
}

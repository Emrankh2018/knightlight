import type { ComponentPropsWithRef, ElementType } from 'react';

/**
 * hero: the one panel per screen that matters most (lamp glow).
 * stat: small figures. plain: default content block. interactive: a card that is a link or button target.
 */
export type CardVariant = 'hero' | 'stat' | 'plain' | 'interactive';

const VARIANTS: Record<CardVariant, string> = {
  hero: 'rounded-hero border-2 border-amber bg-surface p-6 shadow-glow',
  stat: 'rounded-card border border-line bg-surface p-4 shadow-card',
  plain: 'rounded-card border border-line bg-surface p-4 shadow-card',
  interactive:
    'rounded-card border-2 border-line bg-surface p-4 shadow-card transition hover:-translate-y-0.5 hover:border-amber hover:shadow-lift motion-reduce:transform-none',
};

export const cardClass = (variant: CardVariant = 'plain', extra = ''): string => `${VARIANTS[variant]} ${extra}`.trim();

type CardProps<T extends ElementType> = { as?: T; variant?: CardVariant } & Omit<ComponentPropsWithRef<T>, 'as' | 'variant'>;

export default function Card<T extends ElementType = 'section'>({ as, variant = 'plain', className = '', ...rest }: CardProps<T>) {
  const Tag: ElementType = as ?? 'section';
  return <Tag className={cardClass(variant, className)} {...rest} />;
}

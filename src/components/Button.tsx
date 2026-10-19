import type { ComponentPropsWithRef } from 'react';
import { Link, type LinkProps } from 'react-router-dom';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const BASE =
  'inline-flex min-h-12 min-w-12 items-center justify-center gap-2 rounded-xl px-5 py-2 text-lg font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-amber text-ink hover:brightness-95',
  secondary: 'border-2 border-ink bg-surface text-ink hover:bg-ink hover:text-cream dark:border-amber dark:text-amber dark:hover:bg-amber dark:hover:text-ink',
  ghost: 'text-fg hover:bg-line/60',
  danger: 'bg-coral text-white hover:brightness-95',
};

export const buttonClass = (variant: ButtonVariant = 'primary', extra = ''): string => `${BASE} ${VARIANTS[variant]} ${extra}`.trim();

interface ButtonProps extends ComponentPropsWithRef<'button'> {
  variant?: ButtonVariant;
}

export default function Button({ variant = 'primary', className = '', type = 'button', ...rest }: ButtonProps) {
  return <button type={type} className={buttonClass(variant, className)} {...rest} />;
}

interface ButtonLinkProps extends LinkProps {
  variant?: ButtonVariant;
}

/** A router link that looks like a button. */
export function ButtonLink({ variant = 'primary', className = '', ...rest }: ButtonLinkProps) {
  return <Link className={buttonClass(variant, className)} {...rest} />;
}

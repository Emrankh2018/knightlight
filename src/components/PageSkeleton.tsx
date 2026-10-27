import { m } from '../i18n';

/** Placeholder shown while a lazy route loads. Keeps the page shape so nothing jumps. */
export default function PageSkeleton() {
  return (
    <div role="status" className="mx-auto w-full max-w-7xl space-y-5 px-4 py-6">
      <span className="sr-only">{m().common.loading}</span>
      <div aria-hidden="true" className="kl-skeleton h-10 w-2/5 rounded-control" />
      <div aria-hidden="true" className="kl-skeleton h-5 w-3/5 rounded-control" />
      <div aria-hidden="true" className="grid gap-4 md:grid-cols-3">
        <div className="kl-skeleton h-44 rounded-card" />
        <div className="kl-skeleton h-44 rounded-card" />
        <div className="kl-skeleton h-44 rounded-card" />
      </div>
    </div>
  );
}

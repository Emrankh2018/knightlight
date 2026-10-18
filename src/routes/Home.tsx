import { m } from '../i18n';

export default function Home() {
  return (
    <section>
      <h1 className="text-3xl font-extrabold">{m().app.name}</h1>
      <p className="mt-2 text-lg text-muted">{m().app.tagline}</p>
    </section>
  );
}

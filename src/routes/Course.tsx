import { m } from '../i18n';

export default function Course() {
  return (
    <section>
      <h1 className="text-3xl font-extrabold">{m().routes.course}</h1>
      <p className="mt-2 text-lg text-muted">{m().routes.comingSoon}</p>
    </section>
  );
}

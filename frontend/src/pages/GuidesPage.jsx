import { Link } from 'react-router-dom';
import SeoHead from '../components/seo/SeoHead';
import PublicNavbar from '../components/layout/PublicNavbar';
import { guides } from '../content/guides';

const GuidesPage = () => {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Mentora Study Guides',
    url: 'https://mentora-ai.app/guides',
    description: 'Study guides for university students: exam prep, lecture-slide revision, PDF note summarization, and smarter AI study workflows.',
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_8%_10%,rgba(190,242,100,0.35)_0%,rgba(236,253,245,0.55)_28%,transparent_50%),radial-gradient(circle_at_90%_9%,rgba(110,231,183,0.28)_0%,rgba(209,250,229,0.5)_26%,transparent_52%),linear-gradient(180deg,#f7faf7_0%,#f5f7fb_100%)]">
      <SeoHead
        title="Study Guides For University Students"
        description="Explore practical study guides for exam prep, lecture revision, and AI-assisted learning with your own course materials."
        path="/guides"
        keywords="study guides for university students, exam preparation guide, lecture slide revision, AI study workflow"
        structuredData={structuredData}
      />

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle,rgba(15,23,42,0.08)_0.8px,transparent_0.9px)] bg-size-[22px_22px]" />

      <PublicNavbar />

      <main className="relative z-10 mx-auto w-[min(1080px,calc(100%-32px))] py-12 sm:py-16">
        <header className="mb-8 sm:mb-10">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-700">Mentora Resources</p>
          <h1 className="mt-2 font-['Sora'] text-3xl font-bold tracking-[-0.03em] text-slate-900 sm:text-4xl">
            Study Guides That Match Your University Workflow
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
            These guides are designed for real student use cases: learning from lecture slides, preparing for exams,
            converting PDF notes into revision packs, and studying with source-grounded AI support.
          </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {guides.map((guide) => (
            <article
              key={guide.slug}
              className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                {guide.readingMinutes} min read
              </p>
              <h2 className="mt-2 text-lg font-semibold leading-7 text-slate-900">{guide.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{guide.description}</p>
              <Link
                to={`/guides/${guide.slug}`}
                className="mt-4 inline-block text-sm font-semibold text-emerald-700 hover:text-emerald-900"
              >
                Read guide
              </Link>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
};

export default GuidesPage;

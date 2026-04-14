import { Link, Navigate, useParams } from 'react-router-dom';
import SeoHead from '../components/seo/SeoHead';
import PublicNavbar from '../components/layout/PublicNavbar';
import { getGuideBySlug, guides } from '../content/guides';

const GuideArticlePage = () => {
  const { slug } = useParams();
  const guide = getGuideBySlug(slug || '');

  if (!guide) {
    return <Navigate to="/guides" replace />;
  }

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: guide.title,
    description: guide.description,
    dateModified: guide.updatedAt,
    mainEntityOfPage: `https://mentora-ai.app/guides/${guide.slug}`,
    author: {
      '@type': 'Organization',
      name: 'Mentora',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Mentora',
    },
  };

  const related = guides.filter((item) => item.slug !== guide.slug).slice(0, 3);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_8%_10%,rgba(190,242,100,0.35)_0%,rgba(236,253,245,0.55)_28%,transparent_50%),radial-gradient(circle_at_90%_9%,rgba(110,231,183,0.28)_0%,rgba(209,250,229,0.5)_26%,transparent_52%),linear-gradient(180deg,#f7faf7_0%,#f5f7fb_100%)]">
      <SeoHead
        title={guide.title}
        description={guide.description}
        path={`/guides/${guide.slug}`}
        keywords={guide.keywords}
        type="article"
        structuredData={structuredData}
      />

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle,rgba(15,23,42,0.08)_0.8px,transparent_0.9px)] bg-size-[22px_22px]" />

      <PublicNavbar />

      <main className="relative z-10 mx-auto w-[min(920px,calc(100%-32px))] py-10 sm:py-14">
        <nav className="mb-4 text-sm text-slate-500">
          <Link to="/" className="hover:text-slate-700">Home</Link>
          <span className="px-2">/</span>
          <Link to="/guides" className="hover:text-slate-700">Guides</Link>
          <span className="px-2">/</span>
          <span className="text-slate-700">{guide.title}</span>
        </nav>

        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <header>
            <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">
              {guide.readingMinutes} min read
            </p>
            <h1 className="mt-2 font-['Sora'] text-3xl font-bold tracking-[-0.03em] text-slate-900 sm:text-4xl">
              {guide.title}
            </h1>
            <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">{guide.intro}</p>
          </header>

          <div className="mt-8 space-y-6">
            {guide.sections.map((section) => (
              <section key={section.heading}>
                <h2 className="text-xl font-semibold text-slate-900">{section.heading}</h2>
                <ul className="mt-3 space-y-2">
                  {section.points.map((point) => (
                    <li key={point} className="text-sm leading-7 text-slate-700 sm:text-base">
                      - {point}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          <aside className="mt-8 rounded-xl border border-emerald-200 bg-emerald-50 p-4 sm:p-5">
            <h3 className="text-base font-semibold text-emerald-900">{guide.ctaTitle}</h3>
            <p className="mt-2 text-sm leading-7 text-emerald-800">{guide.ctaText}</p>
            <Link
              to="/register"
              className="mt-3 inline-block rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
            >
              Start with Mentora
            </Link>
          </aside>
        </article>

        <section className="mt-8">
          <h3 className="text-lg font-semibold text-slate-900">Related Guides</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {related.map((item) => (
              <Link
                key={item.slug}
                to={`/guides/${item.slug}`}
                className="rounded-xl border border-slate-200 bg-white p-4 text-sm font-medium text-slate-700 shadow-sm hover:border-emerald-300 hover:text-emerald-800"
              >
                {item.title}
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
};

export default GuideArticlePage;

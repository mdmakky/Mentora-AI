import { useEffect } from 'react';

const SITE_NAME = 'Mentora';
const SITE_URL = 'https://mentora-ai.app';
const DEFAULT_DESCRIPTION = 'Mentora is an AI study assistant for university students. Upload PDFs and notes, ask source-backed questions, and track study progress.';
const DEFAULT_IMAGE = `${SITE_URL}/og-image.png`;

const upsertMetaByName = (name, content) => {
  if (!content) return;
  let tag = document.head.querySelector(`meta[name="${name}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute('name', name);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
};

const upsertMetaByProperty = (property, content) => {
  if (!content) return;
  let tag = document.head.querySelector(`meta[property="${property}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute('property', property);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
};

const upsertCanonical = (href) => {
  let link = document.head.querySelector('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', href);
};

const upsertJsonLd = (data) => {
  const id = 'dynamic-seo-jsonld';
  let script = document.head.querySelector(`#${id}`);

  if (!data) {
    if (script) script.remove();
    return;
  }

  if (!script) {
    script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = id;
    document.head.appendChild(script);
  }

  script.textContent = JSON.stringify(data);
};

const SeoHead = ({
  title,
  description = DEFAULT_DESCRIPTION,
  path = '/',
  image = DEFAULT_IMAGE,
  type = 'website',
  robots = 'index, follow',
  keywords,
  structuredData,
}) => {
  useEffect(() => {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const canonicalUrl = `${SITE_URL}${normalizedPath === '/' ? '/' : normalizedPath}`;
    const finalTitle = title?.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;

    document.title = finalTitle;

    upsertMetaByName('description', description);
    upsertMetaByName('robots', robots);
    upsertMetaByName('googlebot', robots);
    if (keywords) upsertMetaByName('keywords', keywords);

    upsertCanonical(canonicalUrl);

    upsertMetaByProperty('og:type', type);
    upsertMetaByProperty('og:url', canonicalUrl);
    upsertMetaByProperty('og:title', finalTitle);
    upsertMetaByProperty('og:description', description);
    upsertMetaByProperty('og:image', image);
    upsertMetaByProperty('og:site_name', SITE_NAME);

    upsertMetaByName('twitter:card', 'summary_large_image');
    upsertMetaByName('twitter:url', canonicalUrl);
    upsertMetaByName('twitter:title', finalTitle);
    upsertMetaByName('twitter:description', description);
    upsertMetaByName('twitter:image', image);

    upsertJsonLd(structuredData);
  }, [title, description, path, image, type, robots, keywords, structuredData]);

  return null;
};

export default SeoHead;

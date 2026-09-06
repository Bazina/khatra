#!/usr/bin/env node
/**
 * مولّد خاطرة — يقرأ ملفات المقالات، ثم يحدّث الصفحة الرئيسية وملف التغذية.
 * بلا اعتماديات. شغّله: node build.js
 */

const fs = require('fs');
const path = require('path');

const SITE = {
  url: 'https://youssefbazina.github.io/khatra',
  title: 'خاطرة',
  subtitle: 'خواطر مطوّلة: تجارب، وقراءة، وما يعلق في الذهن فيستحق أن يُكتب.',
  author: 'يوسف بازينة',
  wordsPerMinute: 180,
};

const ROOT = __dirname;
const SKIP = new Set(['assets', 'node_modules', '_template', '.git', '.github']);

const readingLabel = (minutes) => {
  const n = toArabicDigits(minutes);
  if (minutes === 1) return 'دقيقة قراءة';
  if (minutes === 2) return 'دقيقتان قراءة';
  if (minutes <= 10) return `${n} دقائق قراءة`;
  return `${n} دقيقة قراءة`;
};

const toArabicDigits = (value) =>
  String(value).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);

const formatDate = (iso) =>
  new Intl.DateTimeFormat('ar-EG-u-nu-arab', {
    year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
  }).format(new Date(iso));

const escapeXml = (value) =>
  value.replace(/[<>&"']/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]));

const matchOne = (html, pattern) => {
  const found = html.match(pattern);
  return found ? found[1].trim() : '';
};

const countWords = (html) => {
  const body = matchOne(html, /<div class="prose"[^>]*>([\s\S]*?)<\/div>\s*<footer/);
  const text = (body || html)
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ');
  return text.split(/\s+/).filter(Boolean).length;
};

const listPostDirs = () =>
  fs.readdirSync(ROOT, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !SKIP.has(e.name) && !e.name.startsWith('.'))
    .map((e) => e.name)
    .filter((slug) => fs.existsSync(path.join(ROOT, slug, 'index.html')));

const readPost = (slug) => {
  const file = path.join(ROOT, slug, 'index.html');
  const html = fs.readFileSync(file, 'utf8');
  const published = matchOne(html, /property="article:published_time" content="([^"]+)"/);
  if (!published) {
    console.warn(`تجاهل ${slug}: لا يوجد article:published_time`);
    return null;
  }
  const minutes = Math.max(1, Math.round(countWords(html) / SITE.wordsPerMinute));
  return {
    slug, file, html, published, minutes,
    kicker: matchOne(html, /<div class="kicker[^"]*">([^<]+)<\/div>/),
    title: matchOne(html, /<h1 class="article-title[^"]*">([\s\S]*?)<\/h1>/),
    pageTitle: matchOne(html, /<title>([\s\S]*?)<\/title>/),
    description: matchOne(html, /<meta name="description" content="([^"]+)"/),
    section: matchOne(html, /property="article:section" content="([^"]+)"/),
  };
};

const stampReadingTime = (post) => {
  const updated = post.html.replace(
    /(<span class="rt">)[^<]*(<\/span>)/,
    `$1${readingLabel(post.minutes)}$2`
  );
  if (updated !== post.html) fs.writeFileSync(post.file, updated);
};

const renderEntry = (post) => `
  <a class="entry" href="${post.slug}/index.html">
    <h2 class="entry-title">${post.title}</h2>
    <p class="entry-desc">${post.description}</p>
    <div class="entry-meta">
      <span>${post.kicker || ''}</span>
      <span>${formatDate(post.published)}</span>
      <span>${readingLabel(post.minutes)}</span>
    </div>
  </a>`;

const renderFeedList = (posts) => {
  const chunks = [];
  let currentYear = null;
  for (const post of posts) {
    const year = new Date(post.published).getUTCFullYear();
    if (year !== currentYear) {
      currentYear = year;
      chunks.push(`\n  <div class="year">${toArabicDigits(year)}</div>`);
    }
    chunks.push(renderEntry(post));
  }
  return chunks.join('\n');
};

const writeHomepage = (posts) => {
  const file = path.join(ROOT, 'index.html');
  const html = fs.readFileSync(file, 'utf8');
  const next = html.replace(
    /<!-- POSTS:START -->[\s\S]*?<!-- POSTS:END -->/,
    `<!-- POSTS:START -->${renderFeedList(posts)}\n<!-- POSTS:END -->`
  );
  fs.writeFileSync(file, next);
};

const writeFeed = (posts) => {
  const updated = posts.length ? posts[0].published : new Date(0).toISOString();
  const entries = posts.map((post) => `  <entry>
    <title>${escapeXml(post.pageTitle || post.title)}</title>
    <link href="${SITE.url}/${post.slug}/"/>
    <id>${SITE.url}/${post.slug}/</id>
    <updated>${post.published}</updated>
    <summary>${escapeXml(post.description)}</summary>
    <author><name>${escapeXml(SITE.author)}</name></author>
  </entry>`).join('\n');

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="ar">
  <title>${escapeXml(SITE.title)}</title>
  <subtitle>${escapeXml(SITE.subtitle)}</subtitle>
  <link href="${SITE.url}/feed.xml" rel="self"/>
  <link href="${SITE.url}/"/>
  <id>${SITE.url}/</id>
  <updated>${updated}</updated>
  <author><name>${escapeXml(SITE.author)}</name></author>
${entries}
</feed>
`;
  fs.writeFileSync(path.join(ROOT, 'feed.xml'), xml);
};

const build = () => {
  const posts = listPostDirs()
    .map(readPost)
    .filter(Boolean)
    .sort((a, b) => new Date(b.published) - new Date(a.published));

  posts.forEach(stampReadingTime);
  writeHomepage(posts);
  writeFeed(posts);
  console.log(`تم بناء ${toArabicDigits(posts.length)} خاطرة.`);
  posts.forEach((p) => console.log(`  · ${p.slug} — ${readingLabel(p.minutes)}`));
};

build();

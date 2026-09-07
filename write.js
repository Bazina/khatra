#!/usr/bin/env node
/**
 * محرّر خاطرة — خادم محلي للكتابة والنشر.
 * شغّله: node write.js  ثم افتح http://127.0.0.1:4000
 * لا يستمع إلا على الجهاز نفسه، ولا يحتاج أي اعتماديات.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const markup = require('./_editor/markup.js');

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 4000);
const HOST = '127.0.0.1';
const SKIP = new Set(['assets', 'node_modules', '_template', '_editor', '.git', '.github']);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.xml': 'application/xml; charset=utf-8',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
};

const toArabicDigits = (value) =>
  String(value).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);

const formatDate = (iso) =>
  new Intl.DateTimeFormat('ar-EG-u-nu-arab', {
    year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
  }).format(new Date(iso));

const escapeAttr = (value) =>
  String(value).replace(/[<>&"]/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));

const matchOne = (html, pattern) => {
  const found = html.match(pattern);
  return found ? found[1].trim() : '';
};

const listPostDirs = () =>
  fs.readdirSync(ROOT, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !SKIP.has(e.name) && !e.name.startsWith('.'))
    .map((e) => e.name)
    .filter((slug) => fs.existsSync(path.join(ROOT, slug, 'index.html')));

const describePost = (slug) => {
  const html = fs.readFileSync(path.join(ROOT, slug, 'index.html'), 'utf8');
  return {
    slug,
    title: matchOne(html, /<h1 class="article-title[^"]*">([\s\S]*?)<\/h1>/),
    kicker: matchOne(html, /<div class="kicker[^"]*">([^<]+)<\/div>/),
    published: matchOne(html, /property="article:published_time" content="([^"]+)"/),
    editable: fs.existsSync(path.join(ROOT, slug, 'source.txt')),
  };
};

const loadDraft = (slug) => {
  const dir = path.join(ROOT, slug);
  const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
  const sourceFile = path.join(dir, 'source.txt');
  return {
    slug,
    title: matchOne(html, /<h1 class="article-title[^"]*">([\s\S]*?)<\/h1>/),
    kicker: matchOne(html, /<div class="kicker[^"]*">([^<]+)<\/div>/),
    standfirst: matchOne(html, /<p class="article-standfirst[^"]*">([\s\S]*?)<\/p>/),
    description: matchOne(html, /<meta name="description" content="([^"]+)"/),
    section: matchOne(html, /property="article:section" content="([^"]+)"/),
    published: matchOne(html, /property="article:published_time" content="([^"]+)"/).slice(0, 10),
    body: fs.existsSync(sourceFile) ? fs.readFileSync(sourceFile, 'utf8') : '',
    editable: fs.existsSync(sourceFile),
  };
};

const nextNumber = () => {
  const numbers = listPostDirs()
    .map((slug) => Number((slug.match(/^khatra-(\d+)$/) || [])[1]))
    .filter(Number.isFinite);
  return numbers.length ? Math.max(...numbers) + 1 : 1;
};

const renderPostPage = (draft) => {
  const site = 'https://bazina.github.io/khatra';
  const pageTitle = `${draft.kicker} - ${draft.title}`;
  const url = `${site}/${draft.slug}/`;
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="author" content="يوسف بازينة">
<meta name="description" content="${escapeAttr(draft.description)}">
<title>${escapeAttr(pageTitle)}</title>
<link rel="canonical" href="${url}">

<meta property="og:type" content="article">
<meta property="og:locale" content="ar_AR">
<meta property="og:site_name" content="خاطرة">
<meta property="og:title" content="${escapeAttr(pageTitle)}">
<meta property="og:description" content="${escapeAttr(draft.description)}">
<meta property="og:url" content="${url}">
<meta property="article:published_time" content="${draft.published}T00:00:00Z">
<meta property="article:author" content="يوسف بازينة">
<meta property="article:section" content="${escapeAttr(draft.section || 'خواطر')}">

<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${escapeAttr(draft.kicker)}">
<meta name="twitter:description" content="${escapeAttr(draft.description)}">

<link rel="icon" type="image/svg+xml" href="../favicon.svg">
<link rel="alternate" type="application/atom+xml" title="خاطرة" href="../feed.xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Aref+Ruqaa:wght@400;700&family=IBM+Plex+Sans+Arabic:wght@300;400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="../assets/css/khatra.css">
</head>
<body>

<div class="progress" id="progress"></div>

<article class="article">

  <header class="article-header">
    <div class="kicker rise rise-1">${draft.kicker}</div>
    <h1 class="article-title rise rise-2">${draft.title}</h1>
    <p class="article-standfirst rise rise-3">${draft.standfirst}</p>
    <div class="article-meta rise rise-3">
      ${formatDate(draft.published)} · <span class="rt">قراءة</span>
    </div>
  </header>

  <div class="prose">

    ${markup.toHtml(draft.body)}

  </div>

  <footer class="article-footer">
    <a class="back" href="../">← كل الخواطر</a>
  </footer>

</article>

<footer class="site-footer">
<!-- FOOTER:START -->
<!-- FOOTER:END -->
</footer>

<script>
(function(){
  var bar=document.getElementById('progress');
  var tick=function(){
    var h=document.documentElement;
    var max=h.scrollHeight-h.clientHeight;
    bar.style.width=(max>0?(h.scrollTop/max)*100:0)+'%';
  };
  addEventListener('scroll',tick,{passive:true});
  tick();
})();
</script>

</body>
</html>
`;
};

const saveDraft = (draft) => {
  if (!/^[a-z0-9-]+$/.test(draft.slug)) throw new Error('المُعرّف يقبل الحروف اللاتينية الصغيرة والأرقام والشرطة فقط');
  if (!draft.title.trim()) throw new Error('العنوان مطلوب');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.published)) throw new Error('التاريخ بصيغة YYYY-MM-DD');
  const dir = path.join(ROOT, draft.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'source.txt'), draft.body);
  fs.writeFileSync(path.join(dir, 'index.html'), renderPostPage(draft));
  return dir;
};

const run = (command, args) =>
  new Promise((resolve, reject) => {
    execFile(command, args, { cwd: ROOT }, (error, stdout, stderr) => {
      const output = `${stdout}${stderr}`.trim();
      if (error) reject(new Error(`${command} ${args.join(' ')}\n${output}`));
      else resolve(output || `${command} ${args.join(' ')} ✓`);
    });
  });

const build = () => run(process.execPath, ['build.js']);

const publish = async (draft) => {
  const log = [];
  saveDraft(draft);
  log.push(await build());
  log.push(await run('git', ['pull', '--rebase', '--quiet', 'origin', 'main']).catch((e) => e.message));
  log.push(await run('git', ['add', '-A']));
  log.push(await run('git', ['commit', '-m', `${draft.kicker}: ${draft.title}`]).catch((e) => e.message));
  log.push(await run('git', ['push', 'origin', 'main']));
  return log.filter(Boolean).join('\n');
};

const sendJson = (res, status, payload) => {
  const body = JSON.stringify(payload);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
};

const readBody = (req) =>
  new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 5e6) reject(new Error('حجم كبير جدًا'));
    });
    req.on('end', () => {
      try { resolve(JSON.parse(raw || '{}')); } catch (e) { reject(e); }
    });
  });

const serveFile = (res, filePath) => {
  if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404); res.end('غير موجود'); return;
  }
  res.writeHead(200, {
    'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream',
    'Cache-Control': 'no-store',
  });
  fs.createReadStream(filePath).pipe(res);
};

const routes = {
  'GET /api/posts': async () => ({
    posts: listPostDirs().map(describePost).sort((a, b) => (a.published < b.published ? 1 : -1)),
    nextNumber: nextNumber(),
    nextNumberArabic: toArabicDigits(nextNumber()),
    today: new Date().toISOString().slice(0, 10),
  }),
  'POST /api/save': async (body) => ({ ok: true, dir: path.basename(saveDraft(body)), log: await build() }),
  'POST /api/publish': async (body) => ({ ok: true, log: await publish(body) }),
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${HOST}:${PORT}`);
  const key = `${req.method} ${url.pathname}`;

  if (key === 'GET /') return serveFile(res, path.join(ROOT, '_editor', 'editor.html'));
  if (key === 'GET /api/post') {
    try { return sendJson(res, 200, loadDraft(url.searchParams.get('slug'))); }
    catch (e) { return sendJson(res, 404, { error: e.message }); }
  }

  const handler = routes[key];
  if (handler) {
    try {
      const body = req.method === 'POST' ? await readBody(req) : null;
      return sendJson(res, 200, await handler(body));
    } catch (e) {
      return sendJson(res, 400, { error: e.message });
    }
  }

  return serveFile(res, path.join(ROOT, decodeURIComponent(url.pathname).replace(/^\/+/, '')));
});

server.listen(PORT, HOST, () => {
  console.log(`محرّر خاطرة → http://${HOST}:${PORT}`);
});

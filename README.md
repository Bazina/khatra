# خاطرة

مدونة شخصية ثابتة (static). كل خاطرة صفحة HTML قائمة بذاتها، والصفحة الرئيسية وملف التغذية يُولَّدان تلقائيًا.

## البنية

```
خاطرة/
├── index.html            ← الصفحة الرئيسية (القائمة مولَّدة بين POSTS:START/END)
├── feed.xml              ← Atom (مولَّد)
├── favicon.svg
├── build.js              ← المولّد، بلا اعتماديات
├── .nojekyll             ← تعطيل Jekyll على GitHub Pages
├── assets/css/khatra.css ← التنسيق المشترك
├── _template/index.html  ← قالب خاطرة جديدة (لا يُنشر)
└── khatra-1/index.html   ← خاطرة
```

## خاطرة جديدة

```bash
cp -r _template khatra-2
# حرّر khatra-2/index.html: العنوان، الوصف، article:published_time، النص
node build.js
git add . && git commit -m "خاطرة رقم ٢" && git push
```

`build.js` يقرأ من كل مقالة: `<title>`، `meta[name=description]`، `article:published_time`، `.kicker`، `.article-title`؛ ثم يحسب زمن القراءة ويكتبه في `<span class="rt">`، ويرتّب المقالات ويجمّعها بالسنة، ويكتب `index.html` و `feed.xml`.

الـ workflow يشغّل `build.js` عند كل push، فلا حاجة لتشغيله يدويًا — لكنه مفيد للمعاينة المحلية.

## معاينة محلية

```bash
python3 -m http.server 8000
# http://localhost:8000
```

## عناصر جاهزة في القالب

`.pull` اقتباس بارز · `blockquote` نقل · `.def` صندوق تعريف · `.demo` صندوق تفاعلي · `.divider` فاصل · `.fn` + `.notes` حواشٍ · جداول · `pre`/`code` بترميز LTR داخل نص RTL.

الوضع الليلي يتبع نظام التشغيل تلقائيًا.

## النشر

Settings → Pages → Source = GitHub Actions.

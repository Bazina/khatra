/**
 * صياغة خاطرة → HTML.
 * يعمل في المتصفح (globalThis.khatraMarkup) وفي Node (module.exports).
 */
(function (root) {
  'use strict';

  const RAW_OPEN = '<<<';
  const RAW_CLOSE = '>>>';

  const escapeHtml = (text) =>
    text.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

  const inline = (text) =>
    escapeHtml(text)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/_([^_]+)_/g, '<em>$1</em>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
      .replace(/\[\^([^\]]+)\]/g, '<span class="fn">$1</span>');

  const isBlank = (line) => line.trim() === '';

  class Reader {
    constructor(lines) {
      this.lines = lines;
      this.at = 0;
    }
    done() { return this.at >= this.lines.length; }
    peek() { return this.lines[this.at]; }
    next() { return this.lines[this.at++]; }
    takeWhile(test) {
      const taken = [];
      while (!this.done() && test(this.peek())) taken.push(this.next());
      return taken;
    }
  }

  const readRaw = (reader) => {
    reader.next();
    const body = reader.takeWhile((line) => line.trim() !== RAW_CLOSE);
    if (!reader.done()) reader.next();
    return body.join('\n');
  };

  const readQuote = (reader) => {
    const lines = reader.takeWhile((line) => line.startsWith('>'));
    const said = [];
    let cite = '';
    for (const line of lines) {
      const text = line.replace(/^>\s?/, '');
      if (text.startsWith('—')) cite = text.replace(/^—\s*/, '');
      else said.push(text);
    }
    const citation = cite ? `\n      <cite>${inline(cite)}</cite>` : '';
    return `<blockquote>\n      ${inline(said.join(' '))}${citation}\n    </blockquote>`;
  };

  const readPull = (reader) => {
    const main = reader.next().replace(/^!!\s?/, '');
    let sub = '';
    if (!reader.done() && reader.peek().startsWith('!!~')) {
      sub = reader.next().replace(/^!!~\s?/, '');
    }
    const tail = sub
      ? `<br><span class="pull-sub">${inline(sub)}</span>`
      : '';
    return `<div class="pull">${inline(main)}${tail}</div>`;
  };

  const readDefBlock = (reader) => {
    const label = reader.next().replace(/^:::\s?/, '').trim();
    const body = reader.takeWhile((line) => line.trim() !== ':::');
    if (!reader.done()) reader.next();
    const heading = label ? `\n      <div class="def-label">${inline(label)}</div>` : '';
    return `<div class="def">${heading}\n      ${toHtml(body.join('\n'))}\n    </div>`;
  };

  const readDef = (reader) => {
    const [label, ...rest] = reader.next().replace(/^::\s?/, '').split('|');
    return `<div class="def">\n      <div class="def-label">${inline(label.trim())}</div>\n      <p>${inline(rest.join('|').trim())}</p>\n    </div>`;
  };

  const readList = (reader, ordered) => {
    const pattern = ordered ? /^\d+[.)]\s+/ : /^-\s+/;
    const items = reader
      .takeWhile((line) => pattern.test(line))
      .map((line) => `      <li>${inline(line.replace(pattern, ''))}</li>`);
    const tag = ordered ? 'ol' : 'ul';
    return `<${tag}>\n${items.join('\n')}\n    </${tag}>`;
  };

  const readNotes = (reader) => {
    const items = reader
      .takeWhile((line) => /^\^/.test(line))
      .map((line) => `        <li>${inline(line.replace(/^\^\S*\s?/, ''))}</li>`);
    return `<div class="notes">\n      <div class="notes-title">حواشٍ</div>\n      <ol>\n${items.join('\n')}\n      </ol>\n    </div>`;
  };

  const readParagraph = (reader) => {
    const text = reader.takeWhile((line) => !isBlank(line) && !opensBlock(line)).join(' ');
    return text ? `<p>${inline(text)}</p>` : '';
  };

  const opensBlock = (line) =>
    line.startsWith('#') || line.startsWith('>') || line.startsWith('!!') ||
    line.startsWith('::') || line.startsWith('^') || line.trim() === '---' ||
    line.trim() === RAW_OPEN || /^-\s+/.test(line) || /^\d+[.)]\s+/.test(line);

  const readBlock = (reader) => {
    const line = reader.peek();
    if (isBlank(line)) { reader.next(); return ''; }
    if (line.trim() === RAW_OPEN) return readRaw(reader);
    if (line.trim() === '---') { reader.next(); return '<div class="divider">۞</div>'; }
    if (line.startsWith('### ')) return `<h3>${inline(reader.next().slice(4))}</h3>`;
    if (line.startsWith('## ')) return `<h2>${inline(reader.next().slice(3))}</h2>`;
    if (line.startsWith('!!')) return readPull(reader);
    if (line.startsWith(':::')) return readDefBlock(reader);
    if (line.startsWith('::')) return readDef(reader);
    if (line.startsWith('>')) return readQuote(reader);
    if (line.startsWith('^')) return readNotes(reader);
    if (/^-\s+/.test(line)) return readList(reader, false);
    if (/^\d+[.)]\s+/.test(line)) return readList(reader, true);
    return readParagraph(reader);
  };

  const toHtml = (source) => {
    const reader = new Reader(String(source).replace(/\r\n/g, '\n').split('\n'));
    const blocks = [];
    while (!reader.done()) {
      const block = readBlock(reader);
      if (block) blocks.push(block);
    }
    return blocks.join('\n\n    ');
  };

  const api = { toHtml, inline, escapeHtml };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.khatraMarkup = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

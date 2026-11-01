// Generates the static privacy policy page for Firebase Hosting from the in-app legal text.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const legal = JSON.parse(
  readFileSync(new URL('../src/content/legal.json', import.meta.url), 'utf8'),
);
const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const style = `body{font-family:system-ui,sans-serif;max-width:760px;margin:0 auto;padding:24px;line-height:1.5;color:#212121}
h1{color:#0B1736}h2{margin-top:1.6em}nav a{margin-right:12px}`;

function renderDoc(doc) {
  const parts = [`<h1>${esc(doc.title)}</h1>`];
  if (doc.updated) parts.push(`<p><em>${esc(doc.updated)}</em></p>`);
  for (const section of doc.sections) {
    parts.push(`<h2>${esc(section.heading)}</h2>`);
    let list = false;
    for (const block of section.blocks) {
      if (block.type === 'li' && !list) {
        parts.push('<ul>');
        list = true;
      }
      if (block.type !== 'li' && list) {
        parts.push('</ul>');
        list = false;
      }
      parts.push(
        block.type === 'li'
          ? `<li>${esc(block.text)}</li>`
          : `<p>${esc(block.text)}</p>`,
      );
    }
    if (list) parts.push('</ul>');
  }
  return parts.join('\n');
}

const page = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(legal.privacy.en.title)} - SkiManiacs</title>
<style>${style}</style></head><body>
<nav><a href="/delete-account/">Delete account / Brisanje naloga</a></nav>
<section lang="en">${renderDoc(legal.privacy.en)}</section>
<hr>
<section lang="sr">${renderDoc(legal.privacy.sr)}</section>
</body></html>
`;

mkdirSync(new URL('../hosting/privacy/', import.meta.url), { recursive: true });
writeFileSync(new URL('../hosting/privacy/index.html', import.meta.url), page);
console.log('hosting/privacy/index.html written');

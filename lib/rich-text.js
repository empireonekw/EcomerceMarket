// Product descriptions with basic formatting, stored as plain text with a few markers — never as HTML, so nothing
// a seller types can inject markup into the page:
//   **bold**   *italic*   __underline__   lines starting "- " (bullets) or "1. " (numbered)
// A backslash escapes a marker character (\*, \_, \\). Plain-text descriptions (no markers) render exactly as before:
// blank lines separate paragraphs, single line breaks are kept.
// Written by components/seller/RichTextEditor.jsx, rendered by components/RichText.jsx.

const INLINE = /\\([\\*_])|\*\*(.+?)\*\*|__(.+?)__|\*(.+?)\*/gs;

/** Inline text → [{ text } | { bold | italic | underline: children }]. */
export function parseInline(text) {
  const out = [];
  let last = 0;
  let plain = '';
  const flush = () => {
    if (plain) out.push({ text: plain });
    plain = '';
  };
  for (const m of text.matchAll(INLINE)) {
    plain += text.slice(last, m.index);
    last = m.index + m[0].length;
    if (m[1] !== undefined) {
      plain += m[1]; // escaped marker character
      continue;
    }
    flush();
    if (m[2] !== undefined) out.push({ bold: parseInline(m[2]) });
    else if (m[3] !== undefined) out.push({ underline: parseInline(m[3]) });
    else out.push({ italic: parseInline(m[4]) });
  }
  plain += text.slice(last);
  flush();
  return out;
}

const BULLET = /^\s*[-•]\s+/;
const NUMBERED = /^\s*\d+[.)]\s+/;

/** Whole description → blocks: { type: 'p', lines: [inline[]] } | { type: 'ul' | 'ol', items: [inline[]] }. */
export function parseRichText(text) {
  const blocks = [];
  for (const line of String(text ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n')) {
    const listType = BULLET.test(line) ? 'ul' : NUMBERED.test(line) ? 'ol' : null;
    const prev = blocks[blocks.length - 1];
    if (listType) {
      const item = parseInline(line.replace(listType === 'ul' ? BULLET : NUMBERED, ''));
      if (prev?.type === listType) prev.items.push(item);
      else blocks.push({ type: listType, items: [item] });
    } else if (!line.trim()) {
      if (prev && !prev.closed) prev.closed = true; // a blank line ends the paragraph or list
    } else if (prev?.type === 'p' && !prev.closed) {
      prev.lines.push(parseInline(line));
    } else {
      blocks.push({ type: 'p', lines: [parseInline(line)] });
    }
  }
  return blocks.map(({ closed: _, ...b }) => b);
}

const inlineText = (nodes) => nodes.map((n) => n.text ?? inlineText(n.bold ?? n.italic ?? n.underline)).join('');

/** Description without markers — for meta descriptions, previews and length checks. */
export function stripRichText(text) {
  return parseRichText(text)
    .map((b) => (b.type === 'p' ? b.lines : b.items).map(inlineText).join('\n'))
    .join('\n\n');
}

// ---- Editor round-trip (the browser editor works in HTML; storage stays in markers) ----

const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function inlineToHtml(nodes) {
  return nodes
    .map((n) => {
      if (n.text !== undefined) return escapeHtml(n.text);
      if (n.bold) return `<b>${inlineToHtml(n.bold)}</b>`;
      if (n.italic) return `<i>${inlineToHtml(n.italic)}</i>`;
      return `<u>${inlineToHtml(n.underline)}</u>`;
    })
    .join('');
}

/** Stored description → HTML for the editor (all text escaped). */
export function richTextToHtml(text) {
  return parseRichText(text)
    .map((b) =>
      b.type === 'p'
        ? `<div>${b.lines.map(inlineToHtml).join('<br>')}</div>`
        : `<${b.type}>${b.items.map((item) => `<li>${inlineToHtml(item) || '<br>'}</li>`).join('')}</${b.type}>`,
    )
    .join('<div><br></div>');
}

const escapeMarkers = (s) => s.replace(/([\\*_])/g, '\\$1');

/** Editor DOM → stored description. Only bold/italic/underline, line breaks and lists survive; everything else is text. */
export function domToRichText(root) {
  const lines = [''];
  const newLine = () => {
    if (lines[lines.length - 1] !== '' || lines.length === 1) lines.push('');
  };
  const inline = (node) => {
    if (node.nodeType === 3) return escapeMarkers(node.nodeValue.replace(/ /g, ' '));
    if (node.nodeType !== 1) return '';
    const tag = node.tagName.toLowerCase();
    if (tag === 'br') return '\n';
    const inner = [...node.childNodes].map(inline).join('');
    if (!inner.trim()) return inner;
    const weight = node.style?.fontWeight;
    if (tag === 'b' || tag === 'strong' || weight === 'bold' || Number(weight) >= 600) return `**${inner}**`;
    if (tag === 'i' || tag === 'em' || node.style?.fontStyle === 'italic') return `*${inner}*`;
    if (tag === 'u' || node.style?.textDecorationLine?.includes('underline')) return `__${inner}__`;
    return inner;
  };
  const block = (node) => {
    const tag = node.nodeType === 1 ? node.tagName.toLowerCase() : '';
    if (tag === 'ul' || tag === 'ol') {
      newLine();
      let n = 0;
      for (const li of node.children) {
        if (li.tagName.toLowerCase() !== 'li') continue;
        n += 1;
        lines[lines.length - 1] = `${tag === 'ul' ? '- ' : `${n}. `}${[...li.childNodes].map(inline).join('').replace(/\n+/g, ' ').trim()}`;
        lines.push('');
      }
      return;
    }
    if (['div', 'p', 'li', 'h1', 'h2', 'h3', 'h4', 'blockquote'].includes(tag)) {
      newLine();
      for (const child of node.childNodes) block(child);
      newLine();
      return;
    }
    const text = inline(node).split('\n');
    lines[lines.length - 1] += text[0];
    for (const rest of text.slice(1)) lines.push(rest);
  };
  for (const child of root.childNodes) block(child);
  return lines
    .map((l) => l.replace(/[ \t]+$/g, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

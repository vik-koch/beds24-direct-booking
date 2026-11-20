import sanitizeHtml from 'sanitize-html';

const bold = /font-weight:\s*(bold|bolder|[6-9]00)/;
const italic = /font-style:\s*italic/;

// Summernote's HTML as Beds24 stores it, reduced to what the page styles: paragraphs, lists,
// quotes, rules, links, strong and emphasis, and one level of heading. Empty when nothing is
// written, as a text left empty is stored as <p><br></p>. A table's rows become paragraphs.
export function richText(html: string): string {
  const clean = sanitizeHtml(
    html.replace(/\uFEFF/g, '').replace(/<\/t[dh]>\s*(?=<t[dh][\s>])/g, ' – $&'),
    {
      allowedTags: 'p br ul ol li blockquote hr sup sub a strong em h2'.split(' '),
      allowedAttributes: { a: ['href'] },
      allowedSchemes: ['http', 'https', 'mailto', 'tel'],
      allowProtocolRelative: false,
      // Dropped with their content; any other tag not allowed is unwrapped, its text kept.
      nonTextTags: ['script', 'style', 'textarea', 'option', 'noscript', 'video', 'iframe'],
      transformTags: {
        // Kept only with one of the schemes: a relative address would lead under the page's own.
        a: (tagName, { href = '' }): sanitizeHtml.Tag => ({
          tagName,
          attribs: /^(https?|mailto|tel):/i.test(href) ? { href } : {},
        }),
        tr: 'p',
        b: 'strong',
        i: 'em',
        ...Object.fromEntries(['h1', 'h3', 'h4', 'h5', 'h6'].map((tag) => [tag, 'h2'])),
        span: (_, attribs) => ({
          tagName: bold.test(attribs['style'] ?? '')
            ? 'strong'
            : italic.test(attribs['style'] ?? '')
              ? 'em'
              : 'span',
          attribs: {},
        }),
      },
      exclusiveFilter: (frame) =>
        ['p', 'a', 'strong', 'em', 'h2', 'li'].includes(frame.tag) &&
        !frame.text.trim() &&
        !frame.mediaChildren.length,
    },
  );
  return clean
    .replace(/<a>(.*?)<\/a>/g, '$1')
    .replace(/(<br \/>\s*)+(<\/(p|li|h2)>)/g, '$2')
    .trim();
}

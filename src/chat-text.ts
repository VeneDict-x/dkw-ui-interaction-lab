// Plain text only. Deliberately do not decode HTML entities or URL-like text.
const segmenter = new Intl.Segmenter('ru', { granularity: 'grapheme' });
export const graphemes = (text: string) => [...segmenter.segment(text)].map((s) => s.segment);
export const plainText = (text: string) => text.replace(/<[^\s<>][^<>]*>/gu, '');
export const cleanDraft = (text: string) => graphemes(plainText(text)).slice(0, 500).join('');
export function editDraft(
  text: string,
  start: number,
  end: number,
  inserted: string,
): { text: string; caret: number } {
  const edges = [0];
  for (const g of graphemes(text)) edges.push(edges[edges.length - 1] + g.length);
  if (start === end) start = end = edges.find((n) => n >= start) ?? text.length;
  else {
    start = edges.filter((n) => n <= start).at(-1) ?? 0;
    end = edges.find((n) => n >= end) ?? text.length;
  }
  const left = text.slice(0, start),
    right = text.slice(end),
    clean = plainText(inserted);
  const proposal = left + clean + right;
  if (plainText(proposal) !== proposal) return reconcileDraft(text, plainText(proposal));
  const available = Math.max(0, 500 - graphemes(left + right).length);
  let addition = graphemes(clean).slice(0, available).join('');
  while (addition && graphemes(left + addition + right).length > 500)
    addition = graphemes(addition).slice(0, -1).join('');
  if (inserted && !addition) return { text, caret: end };
  return { text: left + addition + right, caret: left.length + addition.length };
}
export function reconcileDraft(old: string, proposed: string): { text: string; caret: number } {
  const a = graphemes(old),
    b = graphemes(proposed);
  let prefix = 0,
    suffix = 0;
  while (prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) prefix++;
  while (
    suffix < a.length - prefix &&
    suffix < b.length - prefix &&
    a[a.length - 1 - suffix] === b[b.length - 1 - suffix]
  )
    suffix++;
  const start = a.slice(0, prefix).join('').length;
  return editDraft(
    old,
    start,
    old.length - a.slice(a.length - suffix).join('').length,
    b.slice(prefix, b.length - suffix).join(''),
  );
}

import type { Source } from "./types";

export function safeSourceUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (
      !["https:", "http:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      return null;
    return url.href;
  } catch {
    return null;
  }
}

type Annotation = {
  type: string;
  url?: string;
  title?: string;
  start_index?: number;
  end_index?: number;
};
// Retain prose and replace provider citation markers with ordinary clickable
// Markdown links. Never turn an untrusted annotation into executable URLs/HTML.
export function citeText(
  text: string,
  annotations: Annotation[],
  sources: Source[] = [],
) {
  const edits: { start: number; end: number; link: string }[] = [];
  const seen = new Set<string>();
  for (const a of annotations) {
    if (a.type !== "url_citation" || !a.url) continue;
    const url = safeSourceUrl(a.url);
    if (!url) continue;
    let index = sources.findIndex((s) => s.url === url);
    if (index < 0) {
      index = sources.length;
      sources.push({
        url,
        title: a.title?.slice(0, 500) || new URL(url).hostname,
      });
    }
    const start = a.start_index,
      end = a.end_index;
    if (
      !Number.isInteger(start) ||
      !Number.isInteger(end) ||
      start! < 0 ||
      end! < start! ||
      end! > text.length
    )
      continue;
    const span = text.slice(start, end);
    // Providers can already return a regular Markdown source link.
    if (/\]\(https?:\/\//.test(span)) continue;
    // Replace only a whole citation marker, never surrounding prose.
    const marker = /^\s*\uE200[^\uE201]*\uE201\s*$/u.test(span);
    const key = `${start}:${end}:${url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    edits.push({
      start: marker ? start! : end!,
      end: end!,
      link: ` [${index + 1}](${url.replaceAll("(", "%28").replaceAll(")", "%29")})`,
    });
  }
  let boundary = text.length + 1;
  for (const e of edits.sort((a, b) => b.start - a.start)) {
    if (e.end > boundary) continue;
    text = text.slice(0, e.start) + e.link + text.slice(e.end);
    boundary = e.start;
  }
  return { text, sources };
}

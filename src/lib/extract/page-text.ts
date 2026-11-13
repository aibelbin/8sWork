const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] !== '#') return ENTITIES[entity.toLowerCase()] ?? match;
    const code = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
    try {
      return String.fromCodePoint(code);
    } catch {
      return match;
    }
  });
}

const tidy = (s: string) =>
  decodeEntities(s)
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ *\n[\s]*/g, '\n')
    .trim();

// Reduces a job page to what the model needs: title, embedded JobPosting data (JSON-LD) and visible text.
export function htmlToText(html: string, maxChars: number): string {
  const title = html.match(/<title(?:\s[^>]*)?>([\s\S]*?)<\/title>/i)?.[1] ?? '';
  const jsonLd = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map((m) =>
    m[1].trim(),
  );
  const body = html
    .replace(/<head(?:\s[^>]*)?>[\s\S]*?<\/head>/i, ' ')
    .replace(/<(script|style|noscript|svg|template)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<(?:br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/section)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
  return [tidy(title), ...jsonLd, tidy(body)].filter(Boolean).join('\n\n').slice(0, maxChars);
}

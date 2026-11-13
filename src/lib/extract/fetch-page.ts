import 'server-only';
import { lookup } from 'node:dns/promises';
import { htmlToText } from './page-text';
import { isPublicAddress } from './public-address';

const MAX_BYTES = 2_000_000;
const MAX_REDIRECTS = 3;

export class PageFetchError extends Error {}

// Fetches a user-supplied link without letting it reach internal addresses (checked on every redirect hop).
// shortcut: the DNS check and fetch() resolve separately (DNS-rebinding window); pin the resolved IP with a custom dispatcher if this ever runs next to sensitive internal services.
export async function fetchPageText(rawUrl: string, maxChars: number): Promise<string> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new PageFetchError('That does not look like a valid link.');
  }

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new PageFetchError('Only http and https links are supported.');
    const addresses = await lookup(url.hostname, { all: true }).catch(() => []);
    if (addresses.length === 0 || addresses.some((a) => !isPublicAddress(a.address))) {
      throw new PageFetchError("Couldn't reach that link.");
    }

    const res = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(10_000),
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; JobTracker/1.0)', accept: 'text/html,text/plain' },
    }).catch(() => {
      throw new PageFetchError("Couldn't load that page.");
    });

    const location = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && location) {
      url = new URL(location, url);
      continue;
    }
    if (!res.ok) {
      const loginWall = [401, 403, 999].includes(res.status);
      throw new PageFetchError(
        loginWall ? 'That site needs a login, so the page can’t be read.' : `The page answered with an error (${res.status}).`,
      );
    }
    const type = res.headers.get('content-type') ?? '';
    if (!/text\/html|application\/xhtml|text\/plain/.test(type)) throw new PageFetchError('That link is not a web page.');
    const body = await readCapped(res, MAX_BYTES);
    return type.includes('html') ? htmlToText(body, maxChars) : body.slice(0, maxChars);
  }
  throw new PageFetchError('That link redirects too many times.');
}

async function readCapped(res: Response, maxBytes: number): Promise<string> {
  if (!res.body) return '';
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > maxBytes) {
      await reader.cancel();
      break;
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

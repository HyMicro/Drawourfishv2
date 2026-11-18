/// <reference types="@cloudflare/workers-types" />
import { ReefRoom } from './room';

export { ReefRoom };

interface Env {
  REEF: DurableObjectNamespace;
  ASSETS: Fetcher;
  ALLOWED_ORIGINS?: string;
}

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' ws: wss:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "media-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ');

function secure(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set('Content-Security-Policy', CSP);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Referrer-Policy', 'no-referrer');
  headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), gyroscope=(), accelerometer=()',
  );
  headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function isOriginAllowed(request: Request, env: Env): boolean {
  const origin = request.headers.get('Origin');
  if (!origin) return true; // native clients / QA scripts
  let originUrl: URL;
  try {
    originUrl = new URL(origin);
  } catch {
    return false;
  }
  const host = request.headers.get('Host');
  if (host && originUrl.host === host) return true;
  const allowed = (env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return allowed.includes(origin);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/health') {
      return secure(
        Response.json({
          ok: true,
          name: 'draw-our-fish',
          platform: 'cloudflare-workers',
          now: new Date().toISOString(),
        }),
      );
    }

    if (url.pathname === '/ws') {
      if (!isOriginAllowed(request, env)) {
        return secure(new Response('Forbidden origin', { status: 403 }));
      }
      const id = env.REEF.idFromName('draw-our-fish-global-reef');
      return env.REEF.get(id).fetch(request);
    }

    // The public app lives at the clean Pages URL. Keep the workers.dev
    // hostname as an internal backend only and redirect stray visitors.
    if (url.hostname.endsWith('.workers.dev')) {
      return Response.redirect(`https://drawourfish.pages.dev${url.pathname}${url.search}`, 302);
    }

    const assetResponse = await env.ASSETS.fetch(request);
    const contentType = assetResponse.headers.get('content-type') ?? '';
    return contentType.includes('text/html') ? secure(assetResponse) : assetResponse;
  },
};

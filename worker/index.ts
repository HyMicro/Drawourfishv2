/// <reference types="@cloudflare/workers-types" />
import { ReefRoom } from './room';

export { ReefRoom };

interface Env {
  REEF: DurableObjectNamespace;
  ASSETS: Fetcher;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/api/health') {
      return Response.json({
        ok: true,
        name: 'draw-our-fish',
        platform: 'cloudflare-workers',
        now: new Date().toISOString(),
      });
    }
    if (url.pathname === '/ws') {
      const id = env.REEF.idFromName('draw-our-fish-global-reef');
      return env.REEF.get(id).fetch(request);
    }
    return env.ASSETS.fetch(request);
  },
};

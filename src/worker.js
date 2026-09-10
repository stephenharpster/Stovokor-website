import { onRequestGet, onRequestPost } from '../functions/api/contact.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/api/contact') {
      if (request.method === 'POST') {
        return onRequestPost({ request, env, ctx });
      }
      return onRequestGet();
    }
    return env.ASSETS.fetch(request);
  },
};

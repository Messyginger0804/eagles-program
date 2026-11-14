import { withBase } from '../lib/url';
import { THEME_COLOR } from '../config';

export function GET() {
  const manifest = {
    name: 'Wilmer-Hutchins Eagles Game Day',
    short_name: 'WH Eagles',
    description: 'Unofficial fan site: roster, schedule and stats for the Wilmer-Hutchins Eagles.',
    start_url: withBase('/'),
    scope: withBase('/'),
    display: 'standalone',
    background_color: THEME_COLOR,
    theme_color: THEME_COLOR,
    icons: [
      { src: withBase('/brand/icon-192.png'), sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: withBase('/brand/icon-512.png'), sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: withBase('/brand/icon-512.png'), sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
  return new Response(JSON.stringify(manifest, null, 2), { headers: { 'Content-Type': 'application/manifest+json' } });
}

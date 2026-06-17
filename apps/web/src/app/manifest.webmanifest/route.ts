export const dynamic = 'force-static';

export function GET() {
  const manifest = {
    name: 'Razby.ru',
    short_name: 'Razby',
    description: 'Разберём стройку на части',
    start_url: '/',
    display: 'standalone',
    background_color: '#f8fafc',
    theme_color: '#ea580c',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
  };
  return new Response(JSON.stringify(manifest), {
    headers: { 'Content-Type': 'application/manifest+json' },
  });
}

import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import QRCode from 'qrcode';

/** Pick the address a phone on the same Wi-Fi is most likely able to reach. */
function pickLanUrl(urls: string[]): string | null {
  const score = (u: string) =>
    u.includes('//192.168.') ? 0 : u.includes('//10.') ? 1 : u.includes('//172.') ? 2 : 3;
  return [...urls].sort((a, b) => score(a) - score(b))[0] ?? null;
}

/**
 * Local-server helper: prints a QR code for this PC's Wi-Fi address so a phone
 * can open the game, and tells the in-game "Print QR codes" page that address.
 */
function phoneQr(): Plugin {
  return {
    name: 'sotw-phone-qr',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__lan', (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ url: pickLanUrl(server.resolvedUrls?.network ?? []) }));
      });

      const printUrls = server.printUrls.bind(server);
      server.printUrls = () => {
        printUrls();
        const url = pickLanUrl(server.resolvedUrls?.network ?? []);
        if (!url) {
          console.log('\n  No Wi-Fi address found. Connect this PC to Wi-Fi and restart.\n');
          return;
        }
        QRCode.toString(url, { type: 'terminal', small: true }).then((qr) => {
          console.log(`\n  Scan with an iPhone on the same Wi-Fi to play:\n  ${url}\n`);
          console.log(qr);
          if (url.startsWith('https')) {
            console.log(
              '  The phone will warn that the connection is not private (local test\n' +
                '  certificate). Tap "Show Details", then "visit this website".\n',
            );
          }
        });
      };
    },
  };
}

// `npm run dev` serves over https (needed for the camera on phones).
// `npm run dev:http` serves plain http for quick desktop testing.
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [mode === 'http' ? null : basicSsl(), phoneQr()],
  server: { host: true, port: 5173 },
  preview: { host: true },
  build: { target: 'es2020' },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
}));

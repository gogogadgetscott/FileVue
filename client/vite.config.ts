import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Check if SSL certificates exist for HTTPS dev server
const certsPath = path.resolve(__dirname, '../certs');
const hasSSL = fs.existsSync(path.join(certsPath, 'key.pem')) && 
               fs.existsSync(path.join(certsPath, 'cert.pem'));

// Use HTTPS for API proxy when SSL is enabled
const apiTarget = hasSSL ? 'https://localhost:443' : 'http://localhost:80';

export default defineConfig({
  plugins: [react()],
  server: {
    https: hasSSL ? {
      key: fs.readFileSync(path.join(certsPath, 'key.pem')),
      cert: fs.readFileSync(path.join(certsPath, 'cert.pem')),
    } : undefined,
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
        secure: false, // Allow self-signed certificates
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});

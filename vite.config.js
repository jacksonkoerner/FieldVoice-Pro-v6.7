import { defineConfig } from 'vite';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  plugins: [
    wasm(),
    topLevelAwait(),
    viteStaticCopy({
      targets: [
        { src: 'sw.js', dest: '' },
        { src: 'manifest.json', dest: '' },
        { src: 'icons/*', dest: 'icons' },
        { src: 'public/@powersync/**/*', dest: '@powersync' }
      ]
    })
  ],
  base: '/',  // Vercel hosts at root (was /FieldVoice-Pro-v6.7/ for GitHub Pages)
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: 'index.html',
        auth: 'auth.html',
        settings: 'settings.html',
        projects: 'projects.html',
        'project-config': 'project-config.html',
        'quick-interview': 'quick-interview.html',
        report: 'report.html',
        finalreview: 'finalreview.html',
        archives: 'archives.html',
        drafts: 'drafts.html',
        permissions: 'permissions.html',
        landing: 'landing.html'
      }
    }
  },
  optimizeDeps: {
    exclude: ['@journeyapps/wa-sqlite', '@powersync/web']
  },
  worker: {
    format: 'es',
    plugins: () => [wasm(), topLevelAwait()]
  }
});

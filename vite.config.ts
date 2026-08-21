import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    base: './', // Permet un déploiement correct sur GitHub Pages peu importe le sous-dossier
    plugins: [
      react(), 
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['logo.png', 'audio/*.mp3'],
        workbox: {
          // Les MP3 sont inclus au précache, y compris sur GitHub Pages.
          globPatterns: ['**/*.{js,css,html,ico,png,svg,mp3}'],
          // Chaque fichier audio local peut aller jusqu'à 5 Mo dans le précache PWA.
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        },
        manifest: {
          name: 'À qui qu\'elle est cette Tête de visage ?',
          short_name: 'Quiz Tête',
          description: 'Jeu interactif - À qui qu\'elle est cette Tête de visage ?',
          theme_color: '#312e81',
          background_color: '#000000',
          display: 'fullscreen',
          icons: [
            {
              src: 'logo.png',
              sizes: '192x192 512x512',
              type: 'image/png',
              purpose: 'any'
            }
          ]
        }
      })
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

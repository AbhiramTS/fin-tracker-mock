import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import packageJson from './package.json';
import fs from 'fs';

// Inject a unique build stamp into sw.js so every build gets a fresh cache name.
// Without this, the service worker cache never expires and users see stale builds.
function injectSwVersion() {
	const stamp = Date.now().toString(36); // e.g. "lxyz123"
	return {
		name: 'inject-sw-version',
		writeBundle() {
			const swPath = resolve(__dirname, 'dist/sw.js');
			if (fs.existsSync(swPath)) {
				const content = fs.readFileSync(swPath, 'utf-8');
				fs.writeFileSync(swPath, content.replace('__CACHE_VERSION__', `v4-${stamp}`));
				console.info(`[sw] cache version → v4-${stamp}`);
			}
		},
	};
}

export default defineConfig({
	plugins: [react(), injectSwVersion()],
	define: {
		__APP_VERSION__: JSON.stringify(packageJson.version),
	},
	resolve: {
		alias: { '@': resolve(__dirname, './src') },
	},
	// For GitHub Pages with custom domain: base: "/"
	// For github.io/<repo>: base: "/fintracker/"
	base: '/fin-tracker-mock/',
	build: {
		outDir: 'dist',
		sourcemap: false,
		rollupOptions: {
			output: {
				manualChunks: {
					vendor: ['react', 'react-dom'],
					radix: [
						'@radix-ui/react-dialog',
						'@radix-ui/react-select',
						'@radix-ui/react-tabs',
						'@radix-ui/react-progress',
					],
					charts: ['recharts'],
					firebase: ['firebase/app', 'firebase/firestore'],
				},
			},
		},
	},
});

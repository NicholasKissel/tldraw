import react from '@vitejs/plugin-react-swc'
import { defineConfig } from 'vite'
import srvx from 'vite-plugin-srvx'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
	return {
		plugins: [
			react(
				/* EXCLUDE_FROM_TEMPLATE_EXPORT_START */
				{ tsDecorators: true }
				/* EXCLUDE_FROM_TEMPLATE_EXPORT_END */
			),
			// Route API and all other routes for SPA fallback
			...srvx({ entry: 'server/server.ts', serverRoutes: ['/api/*', '/**'] }),
		],
		// Bundle all dependencies into server.js for production deployment
		// This makes the server build self-contained without needing node_modules
		ssr:
			mode === 'server'
				? {
						noExternal: true,
					}
				: undefined,
	}
})

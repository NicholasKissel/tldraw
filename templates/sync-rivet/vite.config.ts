import react from '@vitejs/plugin-react-swc'
import { defineConfig } from 'vite'
import srvx from 'vite-plugin-srvx'

// https://vitejs.dev/config/
export default defineConfig(() => {
	return {
		plugins: [
			react(
				/* EXCLUDE_FROM_TEMPLATE_EXPORT_START */
				{ tsDecorators: true }
				/* EXCLUDE_FROM_TEMPLATE_EXPORT_END */
			),
			...srvx({ entry: 'server/server.ts', serverRoutes: ['/api/*'] }),
		],
	}
})

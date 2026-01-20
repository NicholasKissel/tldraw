import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { unfurl } from 'unfurl.js'
import { registry } from './actors'

// Cached index.html content for SPA fallback
let indexHtmlCache: string | null = null
async function getIndexHtml() {
	if (!indexHtmlCache) {
		// In production, index.html is in ./public (copied from dist/public in Dockerfile)
		// In dev, Vite handles this differently
		const indexPath = join(process.cwd(), 'public', 'index.html')
		try {
			indexHtmlCache = await readFile(indexPath, 'utf-8')
		} catch {
			// Fallback for dev mode
			indexHtmlCache = '<!DOCTYPE html><html><body>Loading...</body></html>'
		}
	}
	return indexHtmlCache
}

// S3 configuration from environment variables (optional)
const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY
const S3_SECRET_KEY = process.env.S3_SECRET_KEY
const S3_BUCKET = process.env.S3_BUCKET
const S3_REGION = process.env.S3_REGION || 'us-east-1'
const S3_ENDPOINT = process.env.S3_ENDPOINT

function isS3Configured(): boolean {
	return !!(S3_ACCESS_KEY && S3_SECRET_KEY && S3_BUCKET)
}

function getS3Client(): S3Client | null {
	if (!isS3Configured()) return null
	return new S3Client({
		region: S3_REGION,
		endpoint: S3_ENDPOINT,
		credentials: {
			accessKeyId: S3_ACCESS_KEY!,
			secretAccessKey: S3_SECRET_KEY!,
		},
		// Use path-style URLs for S3-compatible services like MinIO
		forcePathStyle: !!S3_ENDPOINT,
	})
}

const app = new Hono()

// Rivet actor handler
app.all('/api/rivet/*', (c) => registry.handler(c.req.raw))

// Check if S3 is configured
app.get('/api/uploads', (c) => {
	return c.json({ available: isS3Configured() })
})

// Get presigned upload URL
app.post('/api/uploads/:objectName', async (c) => {
	const s3 = getS3Client()
	if (!s3) {
		return c.json({ error: 'S3 is not configured' }, 503)
	}

	const objectName = c.req.param('objectName')
	const sanitizedName = objectName.replace(/[^a-zA-Z0-9._-]/g, '_')
	const contentType = c.req.header('content-type') || 'application/octet-stream'

	// Only allow image and video uploads
	if (!contentType.startsWith('image/') && !contentType.startsWith('video/')) {
		return c.json({ error: 'Invalid content type. Only images and videos are allowed.' }, 400)
	}

	const command = new PutObjectCommand({
		Bucket: S3_BUCKET,
		Key: `uploads/${sanitizedName}`,
		ContentType: contentType,
	})

	const url = await getSignedUrl(s3, command, { expiresIn: 3600 })
	return c.json({ url, objectName: sanitizedName })
})

// Asset download endpoint - redirects to presigned S3 URL
app.get('/api/uploads/:objectName', async (c) => {
	const s3 = getS3Client()
	if (!s3) {
		return c.json({ error: 'S3 is not configured' }, 503)
	}

	const objectName = c.req.param('objectName')
	const sanitizedName = objectName.replace(/[^a-zA-Z0-9._-]/g, '_')

	const command = new GetObjectCommand({
		Bucket: S3_BUCKET,
		Key: `uploads/${sanitizedName}`,
	})

	const url = await getSignedUrl(s3, command, { expiresIn: 3600 })
	return c.redirect(url, 302)
})

// Bookmark unfurling endpoint
app.get('/api/unfurl', async (c) => {
	const url = c.req.query('url')
	if (!url) {
		return c.json({ error: 'Missing url parameter' }, 400)
	}

	try {
		const result = await unfurl(url)

		// Extract the most relevant metadata
		const title = result.title || result.open_graph?.title || ''
		const description = result.description || result.open_graph?.description || ''
		const image = result.open_graph?.images?.[0]?.url || ''
		const favicon = result.favicon || ''

		return c.json({ title, description, image, favicon })
	} catch (e) {
		console.error('Unfurl error:', e)
		return c.json({ title: '', description: '', image: '', favicon: '' })
	}
})

// Serve static files from public directory
app.use('/*', serveStatic({ root: './public' }))

// SPA fallback - serve index.html for any non-API, non-asset routes
// This handles client-side routing for direct links to rooms
app.get('*', async (c) => {
	const path = c.req.path

	// Skip API routes (already handled above)
	if (path.startsWith('/api/')) {
		return c.notFound()
	}

	const html = await getIndexHtml()
	return c.html(html)
})

// Start server when running directly (not imported by vite-plugin-srvx in dev)
const port = parseInt(process.env.PORT || '3000', 10)
console.log(`Starting server on port ${port}...`)

serve({
	fetch: app.fetch,
	port,
})

console.log(`Server listening on http://localhost:${port}`)

export default app

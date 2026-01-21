import { type RoomSnapshot, TLSocketRoom } from '@tldraw/sync-core'
import { createTLSchema, defaultShapeSchemas, type TLRecord } from '@tldraw/tlschema'
import throttle from 'lodash.throttle'
import { actor, ActorKv, setup } from 'rivetkit'

const schema = createTLSchema({
	shapes: { ...defaultShapeSchemas },
})

const tldrawRoom = actor({
	createVars: async (c) => {
		const initialSnapshot = await loadSnapshot(c.kv)

		const persistSnapshot = throttle(() => {
			saveSnapshot(c.kv, room)
		}, 1_000)

		const room = new TLSocketRoom<TLRecord, void>({
			schema,
			initialSnapshot,
			onDataChange: persistSnapshot,
		})

		return { room, persistSnapshot }
	},
	onSleep: async (c) => {
		c.vars.persistSnapshot.cancel()
		await saveSnapshot(c.kv, c.vars.room)
	},
	onWebSocket: async (c, websocket) => {
		if (!c.request) {
			websocket.close(1008, 'Missing request')
			return
		}

		const url = new URL(c.request.url)
		const sessionId = url.searchParams.get('sessionId')

		if (!sessionId) {
			websocket.close(1008, 'Missing sessionId')
			return
		}

		c.vars.room.handleSocketConnect({
			sessionId,
			socket: websocket,
		})

		await new Promise(() => {})
	},
})

const SNAPSHOT_KEY = new TextEncoder().encode('snapshot')

async function loadSnapshot(kv: ActorKv) {
	const data = await kv.get(SNAPSHOT_KEY)
	if (data) {
		// Handle both string and Uint8Array return types
		const json = typeof data === 'string' ? data : new TextDecoder().decode(data)
		return JSON.parse(json) as RoomSnapshot
	}
	return undefined
}

function saveSnapshot(kv: ActorKv, room: TLSocketRoom<TLRecord, void>) {
	const snapshot = room.getCurrentSnapshot()
	const json = JSON.stringify(snapshot)
	return kv.put(SNAPSHOT_KEY, new TextEncoder().encode(json))
}

export const registry = setup({
	use: { tldrawRoom },
})

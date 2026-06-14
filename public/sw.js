const CACHE_NAME = 'olingo-cache-v2'
const ASSETS = ['/', '/index.html', '/manifest.webmanifest']

self.addEventListener('install', (event) => {
	self.skipWaiting()
	event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)))
})

self.addEventListener('activate', (event) => {
	event.waitUntil(
		Promise.all([
			caches
				.keys()
				.then((keys) =>
					Promise.all(
						keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
					)
				),
			self.clients.claim(),
		])
	)
})

async function networkFirst(request) {
	const cached = await caches.match(request)
	try {
		const response = await fetch(request)
		if (response.ok) {
			const cache = await caches.open(CACHE_NAME)
			await cache.put(request, response.clone())
		}
		return response
	} catch {
		return cached
	}
}

self.addEventListener('fetch', (event) => {
	const { request } = event
	if (request.method !== 'GET') return
	const url = new URL(request.url)
	if (url.origin !== self.location.origin) return
	if (
		url.pathname.startsWith('/api/') ||
		url.pathname.startsWith('/.netlify/functions/')
	) {
		return
	}
	event.respondWith(networkFirst(request))
})

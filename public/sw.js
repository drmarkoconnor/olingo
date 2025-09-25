const CACHE_NAME = 'olingo-cache-v1'
const ASSETS = ['/', '/index.html', '/manifest.webmanifest']

self.addEventListener('install', (event) => {
	event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)))
})

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(
					keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
				)
			)
	)
})

self.addEventListener('fetch', (event) => {
	const { request } = event
	if (request.method !== 'GET') return
	event.respondWith(
		caches.match(request).then(
			(cached) =>
				cached ||
				fetch(request)
					.then((resp) => {
						const copy = resp.clone()
						caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
						return resp
					})
					.catch(() => cached)
		)
	)
})


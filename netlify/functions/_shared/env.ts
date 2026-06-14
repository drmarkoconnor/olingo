declare const Netlify:
	| {
			env: {
				get: (name: string) => string | undefined
			}
	  }
	| undefined

export function getEnv(name: string) {
	if (typeof Netlify !== 'undefined') return Netlify.env.get(name)
	return undefined
}

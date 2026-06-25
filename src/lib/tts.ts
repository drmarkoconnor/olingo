import { apiFetch } from '@/lib/api'

let currentAudio: HTMLAudioElement | null = null

export function canTTS() {
	return (
		typeof window !== 'undefined' &&
		('Audio' in window || 'speechSynthesis' in window)
	)
}

function stopCurrentAudio() {
	currentAudio?.pause()
	if (currentAudio?.src.startsWith('blob:')) URL.revokeObjectURL(currentAudio.src)
	currentAudio = null
	window.speechSynthesis?.cancel()
}

async function speakWithServer(text: string) {
	try {
		const response = await apiFetch('/api/italian-tts', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ text }),
		})
		if (!response.ok) return false
		const blob = await response.blob()
		const url = URL.createObjectURL(blob)
		const audio = new Audio(url)
		currentAudio = audio
		audio.onended = () => {
			URL.revokeObjectURL(url)
			if (currentAudio === audio) currentAudio = null
		}
		audio.onerror = () => {
			URL.revokeObjectURL(url)
			if (currentAudio === audio) currentAudio = null
		}
		await audio.play()
		return true
	} catch {
		return false
	}
}

function voiceScore(voice: SpeechSynthesisVoice, lang: string) {
	const voiceLang = voice.lang.toLowerCase()
	const targetLang = lang.toLowerCase()
	const name = voice.name.toLowerCase()
	let score = 0
	if (voiceLang === targetLang) score += 20
	if (voiceLang.startsWith('it')) score += 14
	if (name.includes('ital')) score += 10
	if (name.includes('alice') || name.includes('luca')) score += 4
	if (voice.localService) score += 1
	return score
}

async function getVoices() {
	const synth = window.speechSynthesis
	const immediate = synth.getVoices()
	if (immediate.length) return immediate
	return new Promise<SpeechSynthesisVoice[]>((resolve) => {
		const timeout = window.setTimeout(() => {
			synth.removeEventListener('voiceschanged', onVoices)
			resolve(synth.getVoices())
		}, 700)
		function onVoices() {
			window.clearTimeout(timeout)
			synth.removeEventListener('voiceschanged', onVoices)
			resolve(synth.getVoices())
		}
		synth.addEventListener('voiceschanged', onVoices)
	})
}

async function speakWithBrowser(text: string, lang: string) {
	if (!('speechSynthesis' in window)) return
	const utterance = new SpeechSynthesisUtterance(text)
	const voices = await getVoices()
	const voice = voices
		.map((item) => ({ item, score: voiceScore(item, lang) }))
		.sort((a, b) => b.score - a.score)[0]
	if (voice?.score > 0) utterance.voice = voice.item
	utterance.lang = lang
	utterance.rate = lang.toLowerCase().startsWith('it') ? 0.86 : 0.95
	utterance.pitch = 1.0
	window.speechSynthesis.speak(utterance)
}

export async function speak(text: string, lang = 'it-IT') {
	if (!canTTS()) return
	const cleaned = text.replace(/\s+/g, ' ').trim()
	if (!cleaned) return
	stopCurrentAudio()
	const shouldUseServer = lang.toLowerCase().startsWith('it')
	if (shouldUseServer && (await speakWithServer(cleaned))) return
	await speakWithBrowser(cleaned, lang)
}

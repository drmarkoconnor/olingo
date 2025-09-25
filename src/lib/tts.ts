export function canTTS() {
	return typeof window !== 'undefined' && 'speechSynthesis' in window
}

export function speak(text: string, lang = 'it-IT') {
	if (!canTTS()) return
	const u = new SpeechSynthesisUtterance(text)
	u.lang = lang
	u.rate = 0.95
	u.pitch = 1.0
	window.speechSynthesis.cancel()
	window.speechSynthesis.speak(u)
}


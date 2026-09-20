import { useEffect, useRef, useState } from 'react'
import type { VoiceRecording } from '@/components/SentenceVoiceRecorder'
import { apiFetch, friendlyApiError } from '@/lib/api'
import { db, type SpeakingDraft } from '@/storage/db'

/** An unmarked recording survives refresh; only explicit confirmation may assess it. */
export function useSentenceSpeech({ userId, exerciseId, resetKey, onTranscript, hintsUsed, wordBankUsed }: {
	userId: string
	exerciseId?: string
	resetKey: string
	onTranscript: (text: string) => void
	hintsUsed: number
	wordBankUsed: boolean
}) {
	const [draft, setDraft] = useState<SpeakingDraft | null>(null)
	const [audioUrl, setAudioUrl] = useState<string | null>(null)
	const [loading, setLoading] = useState(false)
	const [ready, setReady] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const draftRef = useRef<SpeakingDraft | null>(null)
	const generation = useRef(0)
	const controller = useRef<AbortController | null>(null)
	const inFlight = useRef(false)
	const writes = useRef<Promise<unknown>>(Promise.resolve())
	const transcriptCallback = useRef(onTranscript)
	transcriptCallback.current = onTranscript

	function store(next: SpeakingDraft) {
		const write = writes.current.catch(() => undefined).then(() => db.speakingDrafts.put(next))
		writes.current = write
		return write
	}

	useEffect(() => {
		const epoch = ++generation.current
		controller.current?.abort()
		inFlight.current = false
		draftRef.current = null
		setDraft(null)
		setLoading(false)
		setReady(false)
		setError(null)
		if (!exerciseId) { setReady(true); return }
		void writes.current.catch(() => undefined)
			.then(() => db.speakingDrafts.get([userId, exerciseId]))
			.then(async (saved) => {
				if (epoch !== generation.current) return
				// A refresh between grading and cleanup must not offer the same attempt again.
				if (saved) {
					const assessed = await db.exerciseLogs.where('exerciseId').equals(saved.exerciseId)
						.filter((log) => log.userId === userId && log.attemptId === saved.attemptId).first()
					if (epoch !== generation.current) return
					if (assessed) {
						await db.speakingDrafts.delete([saved.userId, saved.exerciseId])
						return
					}
					draftRef.current = saved
					setDraft(saved)
					transcriptCallback.current(saved.transcript)
				}
			})
			.catch(() => { if (epoch === generation.current) setError('Saved speech could not be opened on this device.') })
			.finally(() => { if (epoch === generation.current) setReady(true) })
		return () => { generation.current++; controller.current?.abort() }
	}, [userId, exerciseId, resetKey])

	useEffect(() => {
		if (!draft?.audio) { setAudioUrl(null); return }
		const url = URL.createObjectURL(draft.audio)
		setAudioUrl(url)
		return () => URL.revokeObjectURL(url)
	}, [draft?.audio])

	async function transcribe(next = draftRef.current) {
		if (!next || inFlight.current) return
		inFlight.current = true
		const epoch = generation.current
		const abort = new AbortController()
		controller.current = abort
		const timeout = window.setTimeout(() => abort.abort(), 50_000)
		setLoading(true)
		setError(null)
		try {
			await store(next)
			if (epoch !== generation.current) return
			const form = new FormData()
			const extension = next.audio.type.includes('mp4') ? 'mp4' : next.audio.type.includes('ogg') ? 'ogg' : 'webm'
			form.append('audio', next.audio, `olingo-answer.${extension}`)
			form.append('skillId', next.exerciseId)
			form.append('timingBasis', next.timingBasis)
			form.append('recordingDurationMs', String(next.recordingDurationMs))
			// Do not send recording-to-voice onset as prompt-to-answer retrieval latency.
			if (next.utteranceDurationMs !== null) form.append('utteranceDurationMs', String(next.utteranceDurationMs))
			const response = await apiFetch('/api/transcribe-speech', { method: 'POST', body: form, signal: abort.signal })
			const data = await response.json().catch(() => null)
			if (!response.ok || typeof data?.transcript !== 'string' || !data.transcript.trim()) {
				throw new Error(friendlyApiError(response.status, data?.error, 'Transcription is unavailable. Retry or type what you said below. Nothing has been marked.'))
			}
			if (epoch !== generation.current) return
			const updated = { ...next, rawTranscript: data.transcript.trim(), transcript: data.transcript.trim(), updatedAt: new Date().toISOString() }
			await store(updated)
			if (epoch !== generation.current) return
			draftRef.current = updated
			setDraft(updated)
			transcriptCallback.current(updated.transcript)
		} catch (cause) {
			if (epoch === generation.current) setError(cause instanceof Error && cause.name !== 'AbortError' ? cause.message : 'Transcription timed out. Your recording is kept on this device; retry or type what you said.')
		} finally {
			window.clearTimeout(timeout)
			if (epoch === generation.current) { inFlight.current = false; setLoading(false) }
		}
	}

	async function recording(value: VoiceRecording) {
		if (!exerciseId || inFlight.current) return
		const next: SpeakingDraft = {
			...value, userId, exerciseId, attemptId: crypto.randomUUID(), recordedAt: new Date().toISOString(),
			transcript: '', rawTranscript: '', hintsUsed, wordBankUsed, updatedAt: new Date().toISOString(),
		}
		draftRef.current = next
		setDraft(next)
		transcriptCallback.current('')
		await transcribe(next)
	}

	function editTranscript(text: string) {
		transcriptCallback.current(text)
		if (!draftRef.current) return
		const next = { ...draftRef.current, transcript: text, updatedAt: new Date().toISOString() }
		draftRef.current = next
		setDraft(next)
		const epoch = generation.current
		void store(next).catch(() => {
			if (epoch === generation.current) setError('This transcript could not be saved on this device. Keep this page open.')
		})
	}

	async function clearAfterAssessment() {
		const previous = draftRef.current
		if (!previous || previous.userId !== userId || previous.exerciseId !== exerciseId) return
		const deletion = writes.current.catch(() => undefined).then(() => db.speakingDrafts.delete([previous.userId, previous.exerciseId]))
		writes.current = deletion
		await deletion
	}

	async function discard() {
		if (inFlight.current) return
		controller.current?.abort()
		const epoch = ++generation.current
		inFlight.current = true
		setLoading(true)
		try {
			await clearAfterAssessment()
			if (epoch !== generation.current) return
			draftRef.current = null
			setDraft(null)
			setError(null)
			transcriptCallback.current('')
		} catch {
			if (epoch === generation.current) setError('Could not remove the saved recording. Please retry.')
		} finally {
			if (epoch === generation.current) { inFlight.current = false; setLoading(false) }
		}
	}

	return { draft, audioUrl, loading, ready, error, setError, recording, transcribe, editTranscript, discard, clearAfterAssessment }
}

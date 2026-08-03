import { useEffect, useRef, useState } from 'react'
import { Loader2, Mic2, Square } from 'lucide-react'

export type VoiceRecording = {
	audio: Blob
	responseLatencyMs: number
	utteranceDurationMs: number
}

function preferredMimeType() {
	if (typeof MediaRecorder === 'undefined') return ''
	return (
		[
			'audio/webm;codecs=opus',
			'audio/webm',
			'audio/mp4',
			'audio/ogg;codecs=opus',
		].find((type) => MediaRecorder.isTypeSupported(type)) ?? ''
	)
}

export default function SentenceVoiceRecorder({
	busy,
	disabled,
	promptStartedAt,
	onRecording,
}: {
	busy: boolean
	disabled: boolean
	promptStartedAt: number
	onRecording: (recording: VoiceRecording) => void
}) {
	const [recording, setRecording] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const recorderRef = useRef<MediaRecorder | null>(null)
	const streamRef = useRef<MediaStream | null>(null)
	const chunksRef = useRef<BlobPart[]>([])
	const audioContextRef = useRef<AudioContext | null>(null)
	const animationRef = useRef<number | null>(null)
	const recordingStartedAtRef = useRef(0)
	const speechStartedAtRef = useRef<number | null>(null)

	function stopAudioGraph() {
		if (animationRef.current !== null) {
			window.cancelAnimationFrame(animationRef.current)
			animationRef.current = null
		}
		void audioContextRef.current?.close().catch(() => undefined)
		audioContextRef.current = null
		streamRef.current?.getTracks().forEach((track) => track.stop())
		streamRef.current = null
	}

	useEffect(
		() => () => {
			if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
			stopAudioGraph()
		},
		[]
	)

	async function startRecording() {
		setError(null)
		if (
			!navigator.mediaDevices?.getUserMedia ||
			typeof MediaRecorder === 'undefined'
		) {
			setError('Voice recording is not available in this browser.')
			return
		}
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
			streamRef.current = stream
			chunksRef.current = []
			recordingStartedAtRef.current = Date.now()
			speechStartedAtRef.current = null

			const mimeType = preferredMimeType()
			const recorder = new MediaRecorder(
				stream,
				mimeType ? { mimeType } : undefined
			)
			recorderRef.current = recorder
			recorder.ondataavailable = (event) => {
				if (event.data.size) chunksRef.current.push(event.data)
			}
			recorder.onstop = () => {
				const stoppedAt = Date.now()
				const audio = new Blob(chunksRef.current, {
					type: recorder.mimeType || 'audio/webm',
				})
				const speechStartedAt =
					speechStartedAtRef.current ?? recordingStartedAtRef.current
				stopAudioGraph()
				setRecording(false)
				if (!audio.size) {
					setError('No audio was captured. Please try again.')
					return
				}
				onRecording({
					audio,
					responseLatencyMs: Math.max(0, speechStartedAt - promptStartedAt),
					utteranceDurationMs: Math.max(0, stoppedAt - speechStartedAt),
				})
			}

			const AudioContextClass =
				window.AudioContext ??
				(window as typeof window & { webkitAudioContext?: typeof AudioContext })
					.webkitAudioContext
			if (AudioContextClass) {
				const context = new AudioContextClass()
				audioContextRef.current = context
				const analyser = context.createAnalyser()
				analyser.fftSize = 1024
				context.createMediaStreamSource(stream).connect(analyser)
				const samples = new Uint8Array(analyser.fftSize)
				const detectSpeech = () => {
					analyser.getByteTimeDomainData(samples)
					let energy = 0
					for (const sample of samples) {
						const centred = (sample - 128) / 128
						energy += centred * centred
					}
					const rms = Math.sqrt(energy / samples.length)
					if (rms > 0.045 && speechStartedAtRef.current === null) {
						speechStartedAtRef.current = Date.now()
					}
					animationRef.current = window.requestAnimationFrame(detectSpeech)
				}
				detectSpeech()
			}

			recorder.start(200)
			setRecording(true)
		} catch (recordingError) {
			stopAudioGraph()
			setRecording(false)
			setError(
				recordingError instanceof Error
					? recordingError.message
					: 'Microphone access was not available.'
			)
		}
	}

	function stopRecording() {
		if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
	}

	return (
		<div className="sentence-recorder">
			<button
				className={recording ? 'btn btn-recording' : 'btn btn-primary'}
				type="button"
				disabled={disabled || busy}
				onClick={recording ? stopRecording : startRecording}>
				{busy ? (
					<Loader2 className="spin" size={18} />
				) : recording ? (
					<Square size={18} />
				) : (
					<Mic2 size={18} />
				)}
				{busy ? 'Checking speech' : recording ? 'Stop and check' : 'Answer aloud'}
			</button>
			{recording && <span className="recording-status">Listening...</span>}
			{error && <span className="field-error">{error}</span>}
		</div>
	)
}

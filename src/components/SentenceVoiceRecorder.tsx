import { useEffect, useRef, useState } from 'react'
import { Loader2, Mic2, Square } from 'lucide-react'
import { createVoiceTimingDetector } from '@/audio/voice-timing'

export type VoiceRecording = {
	audio: Blob
	responseLatencyMs: number | null
	utteranceDurationMs: number | null
	recordingDurationMs: number
	timingBasis: 'recording-start'
	speechDetected: boolean | null
}

const MAX_RECORDING_MS = 60_000
const MAX_AUDIO_BYTES = 3_000_000

function preferredMimeType() {
	return ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']
		.find((type) => MediaRecorder.isTypeSupported(type)) ?? ''
}

export default function SentenceVoiceRecorder({ busy, disabled, onRecording, onActiveChange }: {
	busy: boolean
	disabled: boolean
	onRecording: (recording: VoiceRecording) => void
	onActiveChange?: (active: boolean) => void
}) {
	const [phase, setPhase] = useState<'idle' | 'starting' | 'recording' | 'stopping'>('idle')
	const [error, setError] = useState<string | null>(null)
	const [elapsedMs, setElapsedMs] = useState(0)
	const [level, setLevel] = useState(0)
	const [analysisAvailable, setAnalysisAvailable] = useState(false)
	const recorderRef = useRef<MediaRecorder | null>(null)
	const streamRef = useRef<MediaStream | null>(null)
	const audioContextRef = useRef<AudioContext | null>(null)
	const animationRef = useRef<number | null>(null)
	const intervalRef = useRef<number | null>(null)
	const startingRef = useRef(false)
	const generationRef = useRef(0)
	const mountedRef = useRef(true)
	const stopRef = useRef<() => void>(() => undefined)
	const onRecordingRef = useRef(onRecording)
	const onActiveChangeRef = useRef(onActiveChange)
	onRecordingRef.current = onRecording
	onActiveChangeRef.current = onActiveChange

	function releaseResources() {
		if (animationRef.current !== null) window.cancelAnimationFrame(animationRef.current)
		if (intervalRef.current !== null) window.clearInterval(intervalRef.current)
		animationRef.current = null
		intervalRef.current = null
		void audioContextRef.current?.close().catch(() => undefined)
		audioContextRef.current = null
		streamRef.current?.getTracks().forEach((track) => track.stop())
		streamRef.current = null
	}

	useEffect(() => {
		mountedRef.current = true
		return () => {
			mountedRef.current = false
			generationRef.current += 1
			const recorder = recorderRef.current
			if (recorder) {
				recorder.onstop = null
				recorder.ondataavailable = null
				recorder.onerror = null
				if (recorder.state !== 'inactive') recorder.stop()
			}
			releaseResources()
		}
	}, [])

	async function startRecording() {
		if (startingRef.current || recorderRef.current || busy || disabled) return
		if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
			setError('Recording needs a supported browser and a secure HTTPS page. You can type your answer instead.')
			return
		}
		startingRef.current = true
		onActiveChangeRef.current?.(true)
		const generation = ++generationRef.current
		const current = () => mountedRef.current && generationRef.current === generation
		setPhase('starting')
		setError(null)
		setElapsedMs(0)
		setLevel(0)
		setAnalysisAvailable(false)
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
			if (!current()) {
				stream.getTracks().forEach((track) => track.stop())
				return
			}
			streamRef.current = stream
			const mimeType = preferredMimeType()
			const recorder = new MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: 64_000 })
			recorderRef.current = recorder
			const chunks: BlobPart[] = []
			let byteCount = 0
			let failure: string | null = null
			let stoppedAt: number | null = null
			let startedAt = 0
			const detector = createVoiceTimingDetector()
			const stop = () => {
				if (!current() || stoppedAt !== null) return
				stoppedAt = performance.now()
				setPhase('stopping')
				if (recorder.state !== 'inactive') recorder.stop()
			}
			stopRef.current = stop
			recorder.ondataavailable = (event) => {
				if (!current() || !event.data.size) return
				chunks.push(event.data)
				byteCount += event.data.size
				if (byteCount >= MAX_AUDIO_BYTES) stop()
			}
			recorder.onerror = () => {
				if (!current()) return
				failure = 'Recording was interrupted. Please record your answer again.'
				stop()
			}
			recorder.onstop = () => {
				if (!current()) return
				const duration = Math.max(0, (stoppedAt ?? performance.now()) - startedAt)
				const audio = new Blob(chunks, { type: recorder.mimeType || mimeType || 'audio/webm' })
				const timing = detector.result(duration)
				releaseResources()
				recorderRef.current = null
				startingRef.current = false
				setPhase('idle')
				onActiveChangeRef.current?.(false)
				setLevel(0)
				setElapsedMs(duration)
				if (failure || !audio.size || audio.size > MAX_AUDIO_BYTES || timing.speechDetected === false) {
					setError(failure ?? (!audio.size ? 'No audio was captured. Please try again.' : audio.size > MAX_AUDIO_BYTES ? 'This recording is too large. Please try a shorter answer.' : 'No sustained voice was detected. Check your microphone and try again, or type your answer.'))
					return
				}
				onRecordingRef.current({ audio, ...timing, recordingDurationMs: Math.round(duration), timingBasis: 'recording-start' })
			}
			stream.getAudioTracks().forEach((track) => track.addEventListener('ended', () => {
				if (current() && recorder.state === 'recording') {
					failure = 'The microphone disconnected. Please reconnect it and try again.'
					stop()
				}
			}, { once: true }))

			// Audio analysis is optional: unsupported or suspended contexts leave timing unknown.
			const AudioContextClass = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
			let analyser: AnalyserNode | null = null
			let samples: Uint8Array<ArrayBuffer> | null = null
			try {
				if (AudioContextClass) {
					const context = new AudioContextClass()
					audioContextRef.current = context
					analyser = context.createAnalyser()
					analyser.fftSize = 1024
					context.createMediaStreamSource(stream).connect(analyser)
					samples = new Uint8Array(analyser.fftSize)
					if (context.state === 'suspended') void context.resume().catch(() => undefined)
				}
			} catch {
				analyser = null
				void audioContextRef.current?.close().catch(() => undefined)
				audioContextRef.current = null
			}
			recorder.start(200)
			startedAt = performance.now()
			startingRef.current = false
			setPhase('recording')
			const detectSpeech = () => {
				if (!current() || recorder.state !== 'recording' || stoppedAt !== null) return
				if (analyser && samples && audioContextRef.current?.state === 'running') {
					analyser.getByteTimeDomainData(samples)
					let energy = 0
					for (const sample of samples) energy += ((sample - 128) / 128) ** 2
					const rms = Math.sqrt(energy / samples.length)
					detector.sample(rms, performance.now() - startedAt)
					setLevel(Math.min(100, Math.round(rms * 500)))
					setAnalysisAvailable(true)
				}
				animationRef.current = window.requestAnimationFrame(detectSpeech)
			}
			detectSpeech()
			intervalRef.current = window.setInterval(() => {
				if (!current() || stoppedAt !== null) return
				const elapsed = performance.now() - startedAt
				setElapsedMs(elapsed)
				if (elapsed >= MAX_RECORDING_MS) stop()
			}, 100)
		} catch (recordingError) {
			if (!current()) return
			releaseResources()
			recorderRef.current = null
			startingRef.current = false
			setPhase('idle')
			onActiveChangeRef.current?.(false)
			setError(recordingError instanceof DOMException && recordingError.name === 'NotAllowedError'
				? 'Microphone access was denied. Allow it in your browser and try again, or type your answer.'
				: 'Could not start the microphone. Check its connection and try again, or type your answer.')
		}
	}

	const recording = phase === 'recording'
	return (
		<div className="sentence-recorder">
			<button className={recording ? 'btn btn-recording' : 'btn btn-primary'} type="button"
				disabled={phase === 'starting' || phase === 'stopping' || (!recording && (disabled || busy))}
				onClick={recording ? () => stopRef.current() : startRecording}>
				{busy || phase === 'starting' || phase === 'stopping' ? <Loader2 className="spin" size={18} /> : recording ? <Square size={18} /> : <Mic2 size={18} />}
				{phase === 'starting' ? 'Opening microphone…' : phase === 'stopping' ? 'Finishing recording…' : recording ? 'Stop recording' : busy ? 'Processing answer…' : 'Record answer'}
			</button>
			{recording && <div className="recorder-timing">
				<span className="recording-status" role="status">Recording</span>
				<strong aria-label="Recording duration">{(elapsedMs / 1000).toFixed(1)} s / 60 s</strong>
				{analysisAvailable ? <meter className="recorder-meter" aria-label="Microphone input level" min={0} max={100} value={level} /> : <span>Recording; input meter unavailable</span>}
			</div>}
			{error && <span className="field-error" role="alert">{error}</span>}
		</div>
	)
}

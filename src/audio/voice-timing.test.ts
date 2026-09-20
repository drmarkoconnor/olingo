import { describe, expect, it } from 'vitest'
import { createVoiceTimingDetector } from './voice-timing'

describe('voice timing', () => {
	it('does not invent speech when audio analysis is unavailable', () => {
		expect(createVoiceTimingDetector().result()).toEqual({
			responseLatencyMs: null, utteranceDurationMs: null, speechDetected: null,
		})
	})
	it('rejects silence and isolated clicks without assigning latency', () => {
		const detector = createVoiceTimingDetector()
		for (let ms = 0; ms <= 1000; ms += 20) detector.sample(ms === 400 ? 0.5 : 0, ms)
		expect(detector.result()).toEqual({
			responseLatencyMs: null, utteranceDurationMs: null, speechDetected: false,
		})
	})
	it('measures onset from recording start and excludes trailing silence', () => {
		const detector = createVoiceTimingDetector()
		for (let ms = 0; ms <= 2000; ms += 20) detector.sample(ms >= 400 && ms <= 1200 ? 0.1 : 0, ms)
		expect(detector.result()).toEqual({
			responseLatencyMs: 400, utteranceDurationMs: 800, speechDetected: true,
		})
	})
	it('does not treat two distant samples as sustained sound', () => {
		const detector = createVoiceTimingDetector()
		detector.sample(0.2, 0)
		detector.sample(0.2, 1000)
		expect(detector.result().responseLatencyMs).toBeNull()
	})
	it('leaves timing unknown when audio observation stops before the recording ends', () => {
		const detector = createVoiceTimingDetector()
		for (let ms = 0; ms <= 500; ms += 20) detector.sample(0, ms)
		expect(detector.result(5000)).toEqual({
			responseLatencyMs: null, utteranceDurationMs: null, speechDetected: null,
		})
	})
	it('does not extend a spoken response to a later isolated click', () => {
		const detector = createVoiceTimingDetector()
		for (let ms = 0; ms <= 2000; ms += 20) detector.sample(ms <= 600 || ms === 1500 ? 0.1 : 0, ms)
		expect(detector.result().utteranceDurationMs).toBe(600)
	})
})

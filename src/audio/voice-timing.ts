// Energy detection estimates speech timing, not pronunciation or fluency.
// Require sustained sound so a click does not invent a spoken response.
export function createVoiceTimingDetector() {
	let candidateStartedAt: number | null = null
	let firstVoiceAt: number | null = null
	let lastVoiceAt: number | null = null
	let sampledMs = 0
	let previousSampleAt: number | null = null
	return {
		sample(rms: number, elapsedMs: number) {
			if (previousSampleAt !== null) {
				const gap = elapsedMs - previousSampleAt
				if (gap > 100) candidateStartedAt = null
				sampledMs += Math.min(Math.max(gap, 0), 100)
			}
			previousSampleAt = elapsedMs
			if (rms < 0.025) {
				candidateStartedAt = null
				return
			}
			candidateStartedAt ??= elapsedMs
			if (elapsedMs - candidateStartedAt >= 120) {
				firstVoiceAt ??= candidateStartedAt
				lastVoiceAt = elapsedMs
			}
		},
		result(recordingDurationMs?: number) {
			// A suspended audio context or backgrounded tab must not turn
			// unobserved speech into a confident silence verdict or timing score.
			if (recordingDurationMs !== undefined && sampledMs < recordingDurationMs * 0.7) {
				return { responseLatencyMs: null, utteranceDurationMs: null, speechDetected: null }
			}
			return {
				responseLatencyMs: firstVoiceAt,
				utteranceDurationMs:
					firstVoiceAt !== null && lastVoiceAt !== null
						? Math.max(0, lastVoiceAt - firstVoiceAt)
						: null,
				speechDetected: firstVoiceAt !== null ? true : sampledMs >= 250 ? false : null,
			}
		},
	}
}

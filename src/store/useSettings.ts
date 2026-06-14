import { create } from 'zustand'

type SettingsState = {
	dailyGoal: number
	sound: boolean
	tts: boolean
	targetLevel: 'A1' | 'A2' | 'B1'
	sentenceLength: 'short' | 'medium' | 'long'
	programWeek: number
	setDailyGoal: (n: number) => void
	setSound: (v: boolean) => void
	setTTS: (v: boolean) => void
	setTargetLevel: (v: SettingsState['targetLevel']) => void
	setSentenceLength: (v: SettingsState['sentenceLength']) => void
	setProgramWeek: (n: number) => void
}

const LS_KEY = 'olingo.settings'

type PersistedSettings = Pick<
	SettingsState,
	| 'dailyGoal'
	| 'sound'
	| 'tts'
	| 'targetLevel'
	| 'sentenceLength'
	| 'programWeek'
>

function clampProgramWeek(value: number) {
	if (!Number.isFinite(value)) return 1
	return Math.min(24, Math.max(1, Math.round(value)))
}

function load(): PersistedSettings {
	try {
		const raw = localStorage.getItem(LS_KEY)
		if (raw) {
			const parsed = JSON.parse(raw)
			return {
				...{
					dailyGoal: 30,
					sound: true,
					tts: true,
					targetLevel: 'B1' as const,
					sentenceLength: 'medium' as const,
					programWeek: 1,
				},
				...parsed,
				programWeek: clampProgramWeek(parsed.programWeek ?? 1),
			}
		}
	} catch {}
	return {
		dailyGoal: 30,
		sound: true,
		tts: true,
		targetLevel: 'B1',
		sentenceLength: 'medium',
		programWeek: 1,
	}
}

function save(s: SettingsState) {
	const { dailyGoal, sound, tts, targetLevel, sentenceLength, programWeek } = s
	localStorage.setItem(
		LS_KEY,
		JSON.stringify({
			dailyGoal,
			sound,
			tts,
			targetLevel,
			sentenceLength,
			programWeek,
		})
	)
}

export const useSettings = create<SettingsState>((set, get) => ({
	...load(),
	setDailyGoal: (dailyGoal) => {
		set({ dailyGoal })
		save(get())
	},
	setSound: (sound) => {
		set({ sound })
		save(get())
	},
	setTTS: (tts) => {
		set({ tts })
		save(get())
	},
	setTargetLevel: (targetLevel) => {
		set({ targetLevel })
		save(get())
	},
	setSentenceLength: (sentenceLength) => {
		set({ sentenceLength })
		save(get())
	},
	setProgramWeek: (programWeek) => {
		set({ programWeek: clampProgramWeek(programWeek) })
		save(get())
	},
}))

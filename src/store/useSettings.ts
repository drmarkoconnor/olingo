import { create } from 'zustand'

type SettingsState = {
	dailyGoal: number
	sound: boolean
	tts: boolean
	targetLevel: 'A1' | 'A2' | 'B1'
	sentenceLength: 'short' | 'medium' | 'long'
	setDailyGoal: (n: number) => void
	setSound: (v: boolean) => void
	setTTS: (v: boolean) => void
	setTargetLevel: (v: SettingsState['targetLevel']) => void
	setSentenceLength: (v: SettingsState['sentenceLength']) => void
}

const LS_KEY = 'olingo.settings'

type PersistedSettings = Pick<
	SettingsState,
	'dailyGoal' | 'sound' | 'tts' | 'targetLevel' | 'sentenceLength'
>

function load(): PersistedSettings {
	try {
		const raw = localStorage.getItem(LS_KEY)
		if (raw) {
			return {
				...{
					dailyGoal: 15,
					sound: true,
					tts: true,
					targetLevel: 'B1' as const,
					sentenceLength: 'medium' as const,
				},
				...JSON.parse(raw),
			}
		}
	} catch {}
	return {
		dailyGoal: 15,
		sound: true,
		tts: true,
		targetLevel: 'B1',
		sentenceLength: 'medium',
	}
}

function save(s: SettingsState) {
	const { dailyGoal, sound, tts, targetLevel, sentenceLength } = s
	localStorage.setItem(
		LS_KEY,
		JSON.stringify({ dailyGoal, sound, tts, targetLevel, sentenceLength })
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
}))

import { create } from 'zustand'

type SettingsState = {
	dailyGoal: number
	sound: boolean
	tts: boolean
	setDailyGoal: (n: number) => void
	setSound: (v: boolean) => void
	setTTS: (v: boolean) => void
}

const LS_KEY = 'olingo.settings'

function load(): Pick<SettingsState, 'dailyGoal' | 'sound' | 'tts'> {
	try {
		const raw = localStorage.getItem(LS_KEY)
		if (raw) return JSON.parse(raw)
	} catch {}
	return { dailyGoal: 20, sound: true, tts: true }
}

function save(s: Pick<SettingsState, 'dailyGoal' | 'sound' | 'tts'>) {
	localStorage.setItem(LS_KEY, JSON.stringify(s))
}

export const useSettings = create<SettingsState>((set, get) => ({
	...load(),
	setDailyGoal: (dailyGoal) => {
		set({ dailyGoal })
		save({ ...get() })
	},
	setSound: (sound) => {
		set({ sound })
		save({ ...get() })
	},
	setTTS: (tts) => {
		set({ tts })
		save({ ...get() })
	},
}))


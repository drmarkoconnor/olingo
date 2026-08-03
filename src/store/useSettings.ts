import { create } from 'zustand'
import { cefrLevels, scenes, type CefrLevel } from '@/learning/content'
import {
	focusAvailableAtLevel,
	normaliseChallengeMode,
	normaliseSessionDomain,
	normaliseSessionFocus,
	type ChallengeMode,
	type SessionDomain,
	type SessionFocus,
} from '@/learning/session-focus'

type SettingsState = {
	dailyGoal: number
	sound: boolean
	tts: boolean
	targetLevel: CefrLevel
	sentenceLength: 'short' | 'medium' | 'long'
	programWeek: number
	sessionFocus: SessionFocus
	sessionDomain: SessionDomain
	challengeMode: ChallengeMode
	selectedSceneId: string
	selectedSceneAction: string
	setDailyGoal: (n: number) => void
	setSound: (v: boolean) => void
	setTTS: (v: boolean) => void
	setTargetLevel: (v: SettingsState['targetLevel']) => void
	setSentenceLength: (v: SettingsState['sentenceLength']) => void
	setProgramWeek: (n: number) => void
	setSessionFocus: (v: SessionFocus) => void
	setSessionDomain: (v: SessionDomain) => void
	setChallengeMode: (v: ChallengeMode) => void
	setSelectedScene: (sceneId: string, action?: string) => void
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
	| 'sessionFocus'
	| 'sessionDomain'
	| 'challengeMode'
	| 'selectedSceneId'
	| 'selectedSceneAction'
>

const defaultSettings: PersistedSettings = {
	dailyGoal: 30,
	sound: true,
	tts: true,
	targetLevel: 'B1',
	sentenceLength: 'medium',
	programWeek: 1,
	sessionFocus: 'adaptive',
	sessionDomain: 'mixed',
	challengeMode: 'stretch',
	selectedSceneId: 'milan-cafe',
	selectedSceneAction: 'Ask opinion',
}

function clampProgramWeek(value: number) {
	if (!Number.isFinite(value)) return 1
	return Math.min(24, Math.max(1, Math.round(value)))
}

function normaliseTargetLevel(value: unknown): CefrLevel {
	return cefrLevels.includes(value as CefrLevel) ? (value as CefrLevel) : 'B1'
}

function normaliseSceneId(value: unknown) {
	const scene = scenes.find((item) => item.id === value)
	return scene?.id ?? defaultSettings.selectedSceneId
}

function normaliseSceneAction(sceneId: string, value: unknown) {
	const scene = scenes.find((item) => item.id === sceneId) ?? scenes[0]
	if (typeof value === 'string' && scene.actions.includes(value)) return value
	return scene.actions[0] ?? defaultSettings.selectedSceneAction
}

function load(): PersistedSettings {
	try {
		if (typeof localStorage === 'undefined') return defaultSettings
		const raw = localStorage.getItem(LS_KEY)
		if (raw) {
			const parsed = JSON.parse(raw)
			const selectedSceneId = normaliseSceneId(parsed.selectedSceneId)
			return {
				...defaultSettings,
				...parsed,
				targetLevel: normaliseTargetLevel(parsed.targetLevel),
				programWeek: clampProgramWeek(parsed.programWeek ?? 1),
				sessionFocus: normaliseSessionFocus(parsed.sessionFocus),
				sessionDomain: normaliseSessionDomain(parsed.sessionDomain),
				challengeMode: normaliseChallengeMode(parsed.challengeMode),
				selectedSceneId,
				selectedSceneAction: normaliseSceneAction(
					selectedSceneId,
					parsed.selectedSceneAction
				),
			}
		}
	} catch {}
	return defaultSettings
}

function save(s: SettingsState) {
	if (typeof localStorage === 'undefined') return
	const {
		dailyGoal,
		sound,
		tts,
		targetLevel,
		sentenceLength,
		programWeek,
		sessionFocus,
		sessionDomain,
		challengeMode,
		selectedSceneId,
		selectedSceneAction,
	} = s
	localStorage.setItem(
		LS_KEY,
		JSON.stringify({
			dailyGoal,
			sound,
			tts,
			targetLevel,
			sentenceLength,
			programWeek,
			sessionFocus,
			sessionDomain,
			challengeMode,
			selectedSceneId,
			selectedSceneAction,
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
		set({
			targetLevel,
			sessionFocus: focusAvailableAtLevel(get().sessionFocus, targetLevel)
				? get().sessionFocus
				: 'adaptive',
		})
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
	setSessionFocus: (sessionFocus) => {
		set({
			sessionFocus: focusAvailableAtLevel(sessionFocus, get().targetLevel)
				? sessionFocus
				: 'adaptive',
		})
		save(get())
	},
	setSessionDomain: (sessionDomain) => {
		set({ sessionDomain })
		save(get())
	},
	setChallengeMode: (challengeMode) => {
		set({ challengeMode })
		save(get())
	},
	setSelectedScene: (sceneId, action) => {
		const selectedSceneId = normaliseSceneId(sceneId)
		set({
			selectedSceneId,
			selectedSceneAction: normaliseSceneAction(selectedSceneId, action),
		})
		save(get())
	},
}))

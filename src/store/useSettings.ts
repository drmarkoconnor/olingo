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

const LS_KEY = 'olingo.settings.v2'
let activeSettingsUser: string | null = null

export function settingsStorageKey(userId: string) {
	return `${LS_KEY}:${encodeURIComponent(userId)}`
}

export type PersistedSettings = Pick<
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

export const defaultSettings: PersistedSettings = {
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

export function normaliseSettings(value: unknown): PersistedSettings {
	const parsed = value && typeof value === 'object' ? value as Partial<PersistedSettings> : {}
	const selectedSceneId = normaliseSceneId(parsed.selectedSceneId)
	const targetLevel = normaliseTargetLevel(parsed.targetLevel)
	const sessionFocus = normaliseSessionFocus(parsed.sessionFocus)
	return {
		dailyGoal: typeof parsed.dailyGoal === 'number' && Number.isFinite(parsed.dailyGoal) ? Math.max(5, Math.min(120, Math.round(parsed.dailyGoal))) : defaultSettings.dailyGoal,
		sound: typeof parsed.sound === 'boolean' ? parsed.sound : defaultSettings.sound,
		tts: typeof parsed.tts === 'boolean' ? parsed.tts : defaultSettings.tts,
		targetLevel,
		sentenceLength: ['short', 'medium', 'long'].includes(parsed.sentenceLength ?? '') ? parsed.sentenceLength! : defaultSettings.sentenceLength,
		programWeek: clampProgramWeek(parsed.programWeek ?? 1),
		sessionFocus: focusAvailableAtLevel(sessionFocus, targetLevel) ? sessionFocus : 'adaptive',
		sessionDomain: normaliseSessionDomain(parsed.sessionDomain),
		challengeMode: normaliseChallengeMode(parsed.challengeMode),
		selectedSceneId,
		selectedSceneAction: normaliseSceneAction(selectedSceneId, parsed.selectedSceneAction),
	}
}

function load(userId: string | null): PersistedSettings {
	try {
		if (!userId || typeof localStorage === 'undefined') return { ...defaultSettings }
		const raw = localStorage.getItem(settingsStorageKey(userId))
		return raw ? normaliseSettings(JSON.parse(raw)) : { ...defaultSettings }
	} catch {
		return { ...defaultSettings }
	}
}

function save(s: SettingsState) {
	if (!activeSettingsUser || typeof localStorage === 'undefined') return
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
	try { localStorage.setItem(
		settingsStorageKey(activeSettingsUser),
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
	) } catch { /* Preferences still work in memory when browser storage is unavailable. */ }
}

export const useSettings = create<SettingsState>((set, get) => ({
	...load(null),
	setDailyGoal: (dailyGoal) => {
		set({ dailyGoal: normaliseSettings({ ...get(), dailyGoal }).dailyGoal })
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

/** Switch synchronously with authentication: never expose the previous learner's preferences. */
export function switchSettingsUser(userId: string | null) {
	if (activeSettingsUser === userId) return
	activeSettingsUser = userId
	useSettings.setState(load(userId))
}

export function getSettingsSnapshot(): PersistedSettings {
	return normaliseSettings(useSettings.getState())
}

/** Ignore a late cloud response after the account changed. */
export function applyUserSettings(userId: string, settings: unknown): boolean {
	if (activeSettingsUser !== userId) return false
	useSettings.setState(normaliseSettings(settings))
	save(useSettings.getState())
	return true
}

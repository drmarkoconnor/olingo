import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { applyUserSettings, defaultSettings, getSettingsSnapshot, settingsStorageKey, switchSettingsUser, useSettings } from './useSettings'

beforeEach(() => {
	const values = new Map<string, string>()
	vi.stubGlobal('localStorage', {
		getItem: (key: string) => values.get(key) ?? null,
		setItem: (key: string, value: string) => values.set(key, value),
	})
	switchSettingsUser(null)
})
afterEach(() => { switchSettingsUser(null); vi.unstubAllGlobals() })

describe('learner preferences', () => {
	it('switches Mark, Ann and Marky without copying anyone’s preferences', () => {
		localStorage.setItem('olingo.settings', JSON.stringify({ targetLevel: 'C2' }))
		switchSettingsUser('mark')
		expect(getSettingsSnapshot().targetLevel).toBe(defaultSettings.targetLevel)
		useSettings.getState().setTargetLevel('B2')
		switchSettingsUser('ann')
		expect(getSettingsSnapshot().targetLevel).toBe(defaultSettings.targetLevel)
		useSettings.getState().setTargetLevel('A1')
		switchSettingsUser('marky')
		expect(getSettingsSnapshot().targetLevel).toBe(defaultSettings.targetLevel)
		switchSettingsUser('mark')
		expect(getSettingsSnapshot().targetLevel).toBe('B2')
		switchSettingsUser('ann')
		expect(getSettingsSnapshot().targetLevel).toBe('A1')
		switchSettingsUser(null)
		expect(getSettingsSnapshot().targetLevel).toBe(defaultSettings.targetLevel)
	})
	it('rejects late cloud preferences belonging to a signed-out account', () => {
		switchSettingsUser('mark')
		switchSettingsUser('ann')
		expect(applyUserSettings('mark', { targetLevel: 'C2' })).toBe(false)
		expect(getSettingsSnapshot().targetLevel).toBe(defaultSettings.targetLevel)
		expect(applyUserSettings('ann', { targetLevel: 'A2' })).toBe(true)
		expect(getSettingsSnapshot().targetLevel).toBe('A2')
	})
	it('recovers safely from corrupt preferences without leaking arbitrary fields', () => {
		localStorage.setItem(settingsStorageKey('mark'), '{')
		switchSettingsUser('mark')
		expect(getSettingsSnapshot()).toEqual(defaultSettings)
		applyUserSettings('mark', { targetLevel: 'C3', dailyGoal: -9, unknown: 'secret' })
		expect(getSettingsSnapshot().targetLevel).toBe('B1')
		expect(getSettingsSnapshot().dailyGoal).toBe(5)
		expect(getSettingsSnapshot()).not.toHaveProperty('unknown')
	})
})

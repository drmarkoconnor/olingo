import { addDays, nowISO } from '@/utils/time'
import type { UserCard } from '@/storage/db'

export type ReviewOutcome = 'correct' | 'wrong'

// Simplified SM-2 like scheduling with ease factor and interval in days
export function scheduleReview(
	card: UserCard,
	outcome: ReviewOutcome
): UserCard {
	const easeMin = 1.3
	let ease = card.ease || 2.3
	let interval = Math.max(1, card.intervalDays || 0)

	if (outcome === 'correct') {
		// increase ease slightly, and grow interval
		ease = Math.min(3.0, ease + 0.02)
		if (interval < 1) interval = 1
		else if (interval === 1) interval = 2
		else interval = Math.round(interval * ease)
		const nextDueAt = addDays(new Date(), interval).toISOString()
		const correctCount = (card.correctCount || 0) + 1
		const updated: UserCard = {
			...card,
			lastReviewedAt: nowISO(),
			nextDueAt,
			correctCount,
			wrongCount: card.wrongCount || 0,
			ease,
			intervalDays: interval,
		}
		// Mastery rule: 3 correct with interval >= 180 days => archive
		if (correctCount >= 3 && interval >= 180) {
			updated.archived = 1
		}
		return updated
	} else {
		// wrong: decrease ease and shorten interval
		ease = Math.max(easeMin, ease - 0.2)
		interval = 1 // reshow soon (tomorrow)
		return {
			...card,
			lastReviewedAt: nowISO(),
			nextDueAt: addDays(new Date(), interval).toISOString(),
			correctCount: card.correctCount || 0,
			wrongCount: (card.wrongCount || 0) + 1,
			ease,
			intervalDays: interval,
			archived: 0,
		}
	}
}


import type { CefrLevel } from './content'

export type ConversationSource = { label: string; url?: string; excerpt: string }
export type ConversationLine = { role: 'partner' | 'learner'; text: string }
export type GeneratedConversationTurn = {
	id: string
	npcLine: string
	instruction: string
	example: string
	hint: string
}
export type GeneratedConversationEpisode = {
	id: string
	lessonId: string
	level: CefrLevel
	canDo: string
	title: string
	context: string
	situationKey: string
	turns: GeneratedConversationTurn[]
	source?: ConversationSource
	interests?: string[]
	createdAt: string
}
export type GenerateConversationRequest = {
	lessonId: string
	mode: 'episode' | 'next-turn'
	requestId?: string
	interests?: string[]
	episodeId?: string
	turnIndex?: 1 | 2
	history?: ConversationLine[]
	source?: ConversationSource
	avoidSituations?: string[]
}
export type GenerateConversationResponse =
	| { episode: GeneratedConversationEpisode; provider: 'openai'; generationId: string }
	| { turn: GeneratedConversationTurn; episodeId: string; lessonId: string; provider: 'openai'; generationId: string }

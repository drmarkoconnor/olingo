import { sceneVocabulary, type CefrLevel, type SceneVocabulary } from '@/learning/content'
import type { VocabDomain } from '@/learning/conversation-frames'
import { getCurriculumStage } from '@/learning/curriculum'
import { selectLevelBalanced } from '@/learning/learning-profile'
import { apiFetch } from '@/lib/api'
import { db, type UserCard, type Word } from '@/storage/db'
import { scheduleReview } from '@/srs/scheduler'

export type VocabularyReviewCard = SceneVocabulary & {
	category: VocabDomain | 'scene'
	level: CefrLevel
	utilityScore: number
	lastReviewedAt?: string | null
	nextDueAt?: string | null
	correctCount: number
	wrongCount: number
	intervalDays: number
	dueKind: 'due' | 'new' | 'future'
	source?: 'seed' | 'ai' | 'fallback'
}

type VocabularySeed = [
	italian: string,
	english: string,
	partOfSpeech: string,
	level?: CefrLevel,
	utilityScore?: number,
]

export type VocabularyOptions = {
	programWeek?: number
	targetLevel?: CefrLevel
	limit?: number
	dateKey?: string
}

const levelRank: Record<CefrLevel, number> = {
	A1: 1,
	A2: 2,
	B1: 3,
	B2: 4,
	C1: 5,
}

const sceneDomains: Record<string, VocabDomain[]> = {
	'milan-cafe': ['cafe', 'food', 'family', 'culture'],
	'family-table': ['family', 'food', 'home'],
	bookshop: ['culture', 'shopping', 'local-news'],
	'piazza-newsstand': ['local-news', 'culture', 'cafe'],
	station: ['travel', 'shopping', 'cafe'],
	cinema: ['culture', 'cafe', 'sport'],
}

const weekDomains: Array<{ from: number; domains: VocabDomain[] }> = [
	{ from: 17, domains: ['local-news', 'culture', 'sport'] },
	{ from: 13, domains: ['health', 'home', 'shopping'] },
	{ from: 9, domains: ['travel', 'cafe', 'sport'] },
	{ from: 5, domains: ['shopping', 'home', 'cafe'] },
	{ from: 1, domains: ['food', 'family', 'cafe'] },
]

const thematicSeeds: Record<VocabDomain, VocabularySeed[]> = {
	food: [
		['il sale', 'the salt', 'noun', 'A1', 98],
		['il pane', 'the bread', 'noun', 'A1', 96],
		["l'acqua", 'the water', 'noun', 'A1', 96],
		['il vino', 'the wine', 'noun', 'A1', 90],
		['la pasta', 'the pasta', 'noun', 'A1', 94],
		['il riso', 'the rice', 'noun', 'A1', 84],
		['la carne', 'the meat', 'noun', 'A1', 88],
		['il pesce', 'the fish', 'noun', 'A1', 88],
		['le verdure', 'the vegetables', 'noun', 'A1', 88],
		['la frutta', 'the fruit', 'noun', 'A1', 84],
		['il piatto', 'the dish', 'noun', 'A1', 92],
		['il coltello', 'the knife', 'noun', 'A1', 82],
		['la forchetta', 'the fork', 'noun', 'A1', 82],
		['il cucchiaio', 'the spoon', 'noun', 'A1', 80],
		['passami', 'pass me', 'chunk', 'A2', 96],
		['assaggiare', 'to taste', 'verb', 'A2', 86],
		['ordinare', 'to order', 'verb', 'A2', 90],
		['ho già mangiato', 'I have already eaten', 'chunk', 'A2', 90],
		['mi piace', 'I like it', 'chunk', 'A1', 98],
		['non mi piace molto', 'I do not like it much', 'chunk', 'A2', 92],
	],
	family: [
		['mia madre', 'my mother', 'noun', 'A1', 96],
		['mio padre', 'my father', 'noun', 'A1', 96],
		['mio figlio', 'my son', 'noun', 'A1', 94],
		['mia figlia', 'my daughter', 'noun', 'A1', 94],
		['mio fratello', 'my brother', 'noun', 'A1', 90],
		['mia sorella', 'my sister', 'noun', 'A1', 90],
		['mio marito', 'my husband', 'noun', 'A1', 88],
		['mia moglie', 'my wife', 'noun', 'A1', 88],
		['i miei genitori', 'my parents', 'noun', 'A2', 88],
		['i miei figli', 'my children', 'noun', 'A2', 92],
		['la famiglia', 'the family', 'noun', 'A1', 94],
		['a casa', 'at home', 'chunk', 'A1', 92],
		['insieme', 'together', 'adverb', 'A1', 88],
		['domani', 'tomorrow', 'adverb', 'A1', 90],
		['ieri', 'yesterday', 'adverb', 'A1', 92],
		['chiamare', 'to call', 'verb', 'A1', 92],
		['aiutare', 'to help', 'verb', 'A1', 92],
		['ho chiamato', 'I called', 'chunk', 'A2', 92],
		['mi ha detto', 'he/she told me', 'chunk', 'A2', 94],
		['ci vediamo dopo', 'we will see each other later', 'chunk', 'A2', 94],
	],
	sport: [
		['la partita', 'the match', 'noun', 'A1', 94],
		['la squadra', 'the team', 'noun', 'A1', 90],
		['il giocatore', 'the player', 'noun', 'A2', 82],
		['il risultato', 'the result', 'noun', 'A2', 88],
		['il biglietto', 'the ticket', 'noun', 'A1', 84],
		['lo stadio', 'the stadium', 'noun', 'A2', 80],
		['vincere', 'to win', 'verb', 'A2', 84],
		['perdere', 'to lose', 'verb', 'A2', 84],
		['giocare', 'to play', 'verb', 'A1', 88],
		['tifare per', 'to support', 'chunk', 'A2', 78],
		['prima della partita', 'before the match', 'chunk', 'A2', 88],
		['dopo la partita', 'after the match', 'chunk', 'A2', 88],
		['chi ha vinto', 'who won', 'chunk', 'A2', 84],
		['abbiamo perso', 'we lost', 'chunk', 'A2', 84],
		['abbiamo vinto', 'we won', 'chunk', 'A2', 84],
	],
	cafe: [
		['un caffè', 'a coffee', 'noun', 'A1', 98],
		['un cappuccino', 'a cappuccino', 'noun', 'A1', 90],
		['il conto', 'the bill', 'noun', 'A1', 96],
		['il tavolo', 'the table', 'noun', 'A1', 92],
		['il cameriere', 'the waiter', 'noun', 'A2', 88],
		['la cameriera', 'the waitress', 'noun', 'A2', 86],
		['il menù', 'the menu', 'noun', 'A1', 90],
		['il posto', 'the place', 'noun', 'A1', 90],
		['qui', 'here', 'adverb', 'A1', 94],
		['fuori', 'outside', 'adverb', 'A1', 84],
		['dentro', 'inside', 'adverb', 'A1', 84],
		['pagare', 'to pay', 'verb', 'A1', 92],
		['prendere', 'to have / take', 'verb', 'A1', 96],
		['vorrei', 'I would like', 'chunk', 'A1', 98],
		['posso pagare', 'can I pay', 'chunk', 'A2', 94],
		['ho già pagato', 'I have already paid', 'chunk', 'A2', 92],
		['secondo me', 'in my opinion', 'chunk', 'A1', 88],
		['penso che', 'I think that', 'chunk', 'A2', 88],
		['che cosa prendi', 'what are you having', 'chunk', 'A2', 90],
		['arrivo subito', 'I will be right there', 'chunk', 'A2', 84],
	],
	shopping: [
		['il negozio', 'the shop', 'noun', 'A1', 90],
		['la spesa', 'the shopping', 'noun', 'A1', 94],
		['il prezzo', 'the price', 'noun', 'A1', 90],
		['lo sconto', 'the discount', 'noun', 'A2', 78],
		['la taglia', 'the size', 'noun', 'A2', 82],
		['la ricevuta', 'the receipt', 'noun', 'A2', 82],
		['la borsa', 'the bag', 'noun', 'A1', 84],
		['comprare', 'to buy', 'verb', 'A1', 92],
		['cercare', 'to look for', 'verb', 'A1', 90],
		['costare', 'to cost', 'verb', 'A1', 88],
		['quanto costa', 'how much does it cost', 'chunk', 'A1', 96],
		['sto cercando', 'I am looking for', 'chunk', 'A2', 92],
		['mi serve', 'I need', 'chunk', 'A2', 92],
		['troppo caro', 'too expensive', 'chunk', 'A2', 82],
		['va bene così', 'that is fine', 'chunk', 'A2', 88],
	],
	travel: [
		['il treno', 'the train', 'noun', 'A1', 94],
		['il binario', 'the platform', 'noun', 'A2', 92],
		['la stazione', 'the station', 'noun', 'A1', 94],
		['il biglietto', 'the ticket', 'noun', 'A1', 90],
		['la valigia', 'the suitcase', 'noun', 'A1', 84],
		["l'autobus", 'the bus', 'noun', 'A1', 86],
		['la fermata', 'the stop', 'noun', 'A2', 84],
		['in ritardo', 'late', 'chunk', 'A2', 92],
		['in orario', 'on time', 'chunk', 'A2', 88],
		['partire', 'to leave', 'verb', 'A1', 94],
		['arrivare', 'to arrive', 'verb', 'A1', 94],
		['scendere', 'to get off', 'verb', 'A2', 82],
		['dove si trova', 'where is it', 'chunk', 'A2', 94],
		['a che ora parte', 'what time does it leave', 'chunk', 'A2', 94],
		['devo cambiare', 'I have to change', 'chunk', 'A2', 88],
	],
	home: [
		['la cucina', 'the kitchen', 'noun', 'A1', 90],
		['il bagno', 'the bathroom', 'noun', 'A1', 88],
		['la camera', 'the bedroom', 'noun', 'A1', 84],
		['il soggiorno', 'the living room', 'noun', 'A2', 80],
		['la porta', 'the door', 'noun', 'A1', 86],
		['la finestra', 'the window', 'noun', 'A1', 82],
		['la chiave', 'the key', 'noun', 'A1', 88],
		['pulire', 'to clean', 'verb', 'A2', 78],
		['preparare', 'to prepare', 'verb', 'A1', 88],
		['mettere', 'to put', 'verb', 'A1', 92],
		['sul tavolo', 'on the table', 'chunk', 'A1', 92],
		['in cucina', 'in the kitchen', 'chunk', 'A1', 90],
		['ho messo', 'I put', 'chunk', 'A2', 88],
		['non lo trovo', 'I cannot find it', 'chunk', 'A2', 92],
		['puoi aprire', 'can you open', 'chunk', 'A2', 86],
	],
	health: [
		['il medico', 'the doctor', 'noun', 'A1', 90],
		['la farmacia', 'the pharmacy', 'noun', 'A1', 90],
		['la medicina', 'the medicine', 'noun', 'A2', 84],
		['la testa', 'the head', 'noun', 'A1', 84],
		['la schiena', 'the back', 'noun', 'A2', 78],
		['il dolore', 'the pain', 'noun', 'A2', 82],
		['stanco', 'tired', 'adjective', 'A1', 86],
		['male', 'bad / pain', 'adverb', 'A1', 88],
		['mi fa male', 'it hurts me', 'chunk', 'A2', 94],
		['non sto bene', 'I am not well', 'chunk', 'A1', 94],
		['ho bisogno di', 'I need', 'chunk', 'A2', 92],
		['devo riposare', 'I have to rest', 'chunk', 'A2', 88],
		['posso prendere', 'can I take', 'chunk', 'A2', 86],
		['da quanto tempo', 'for how long', 'chunk', 'A2', 80],
		['mi sento meglio', 'I feel better', 'chunk', 'A2', 84],
	],
	culture: [
		['il libro', 'the book', 'noun', 'A1', 88],
		['il film', 'the film', 'noun', 'A1', 90],
		['la musica', 'the music', 'noun', 'A1', 90],
		['la mostra', 'the exhibition', 'noun', 'A2', 84],
		['il museo', 'the museum', 'noun', 'A1', 86],
		['il cinema', 'the cinema', 'noun', 'A1', 86],
		['la storia', 'the story / history', 'noun', 'A1', 86],
		['interessante', 'interesting', 'adjective', 'A1', 90],
		['lento', 'slow', 'adjective', 'A1', 78],
		['divertente', 'fun', 'adjective', 'A1', 82],
		['mi è piaciuto', 'I liked it', 'chunk', 'A2', 92],
		['non mi convince', 'it does not convince me', 'chunk', 'B1', 82],
		['vale la pena', 'it is worth it', 'chunk', 'B1', 86],
		['di che parla', 'what is it about', 'chunk', 'A2', 88],
		['andiamo insieme', 'let us go together', 'chunk', 'A2', 88],
	],
	'local-news': [
		['la notizia', 'the news item', 'noun', 'A2', 90],
		['il giornale', 'the newspaper', 'noun', 'A1', 82],
		['il sindaco', 'the mayor', 'noun', 'B1', 72],
		['la scuola', 'the school', 'noun', 'A1', 86],
		['il lavoro', 'the work', 'noun', 'A1', 88],
		['la città', 'the city', 'noun', 'A1', 88],
		['il problema', 'the problem', 'noun', 'A1', 90],
		['la soluzione', 'the solution', 'noun', 'A2', 78],
		['succedere', 'to happen', 'verb', 'A2', 84],
		['cambiare', 'to change', 'verb', 'A2', 84],
		['ho letto che', 'I read that', 'chunk', 'A2', 92],
		['secondo il giornale', 'according to the newspaper', 'chunk', 'B1', 78],
		['non ne so molto', 'I do not know much about it', 'chunk', 'B1', 88],
		['mi sembra importante', 'it seems important to me', 'chunk', 'B1', 88],
		['che cosa ne pensi', 'what do you think about it', 'chunk', 'A2', 94],
	],
}

const levelSpeechSeeds: Partial<Record<CefrLevel, VocabularySeed[]>> = {
	B1: [
		['non sono sicuro', 'I am not sure', 'chunk', 'B1', 96],
		['dipende dalla situazione', 'it depends on the situation', 'chunk', 'B1', 92],
		['ti faccio sapere', 'I will let you know', 'chunk', 'B1', 96],
		['ci penso io', 'I will take care of it', 'chunk', 'B1', 96],
		['non importa', 'it does not matter', 'chunk', 'B1', 94],
		["sono d'accordo", 'I agree', 'chunk', 'B1', 96],
		['hai ragione', 'you are right', 'chunk', 'B1', 94],
		["che cos'è successo?", 'what happened', 'chunk', 'B1', 94],
		["l'ho già fatto", 'I have already done it', 'chunk', 'B1', 94],
		['ne parliamo dopo', 'we will talk about it later', 'chunk', 'B1', 94],
		['devo ancora decidere', 'I still have to decide', 'chunk', 'B1', 92],
		['fammi sapere', 'let me know', 'chunk', 'B1', 96],
		['non riesco a trovarlo', 'I cannot find it', 'chunk', 'B1', 92],
		['è successo ieri', 'it happened yesterday', 'chunk', 'B1', 90],
		['posso occuparmene io', 'I can take care of it', 'chunk', 'B1', 92],
		['mi sono dimenticato', 'I forgot', 'chunk', 'B1', 92],
	],
	B2: [
		['non ne sono del tutto convinto', 'I am not entirely convinced', 'chunk', 'B2', 96],
		['dipende da come la vedi', 'it depends how you see it', 'chunk', 'B2', 94],
		['se ho capito bene', 'if I understood correctly', 'chunk', 'B2', 96],
		['fino a un certo punto', 'up to a point', 'chunk', 'B2', 92],
		['potrebbe valerne la pena', 'it might be worth it', 'chunk', 'B2', 94],
		['a quanto pare', 'apparently', 'chunk', 'B2', 92],
		['detto questo', 'that said', 'chunk', 'B2', 94],
		['il punto è che', 'the point is that', 'chunk', 'B2', 96],
		['avrei qualche dubbio', 'I would have some doubts', 'chunk', 'B2', 92],
		['non lo escluderei', 'I would not rule it out', 'chunk', 'B2', 90],
		['la vedo diversamente', 'I see it differently', 'chunk', 'B2', 94],
		['dipende dalle circostanze', 'it depends on the circumstances', 'chunk', 'B2', 90],
		['ti spiego cosa intendo', 'I will explain what I mean', 'chunk', 'B2', 94],
		['sarebbe meglio aspettare', 'it would be better to wait', 'chunk', 'B2', 94],
		['non è proprio così', 'that is not quite right', 'chunk', 'B2', 94],
		['ne possiamo riparlare', 'we can discuss it again', 'chunk', 'B2', 92],
	],
	C1: [
		['a dire il vero', 'to tell the truth', 'chunk', 'C1', 96],
		['per quanto ne so', 'as far as I know', 'chunk', 'C1', 96],
		['in altre parole', 'in other words', 'chunk', 'C1', 96],
		['detto altrimenti', 'put another way', 'chunk', 'C1', 92],
		['a ben vedere', 'on closer inspection', 'chunk', 'C1', 90],
		['non necessariamente', 'not necessarily', 'chunk', 'C1', 94],
		['resta da capire se', 'it remains to be seen whether', 'chunk', 'C1', 94],
		['non è detto che', 'it is not necessarily the case that', 'chunk', 'C1', 96],
		['per essere precisi', 'to be precise', 'chunk', 'C1', 94],
		['tutto sommato', 'all things considered', 'chunk', 'C1', 92],
		['se vogliamo essere onesti', 'if we are being honest', 'chunk', 'C1', 92],
		['la questione è più complessa', 'the issue is more complex', 'chunk', 'C1', 94],
		['non darei nulla per scontato', 'I would not take anything for granted', 'chunk', 'C1', 92],
		['vale la pena distinguere', 'it is worth making a distinction', 'chunk', 'C1', 92],
		['fino a prova contraria', 'until proven otherwise', 'chunk', 'C1', 90],
		['mi permetto di dissentire', 'I beg to differ', 'chunk', 'C1', 90],
	],
}

function seed(
	domain: VocabDomain,
	[italian, english, partOfSpeech, level = 'A1', utilityScore = 80]: VocabularySeed
): VocabularyReviewCard {
	return {
		id: `v-${domain}-${slugify(italian)}`,
		sceneId: domain,
		italian,
		english,
		partOfSpeech,
		category: domain,
		level,
		utilityScore,
		correctCount: 0,
		wrongCount: 0,
		intervalDays: 0,
		dueKind: 'new',
		source: 'seed',
	}
}

function slugify(value: string) {
	return value
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '')
}

function stableHash(value: string) {
	let hash = 2166136261
	for (let index = 0; index < value.length; index += 1) {
		hash ^= value.charCodeAt(index)
		hash = Math.imul(hash, 16777619)
	}
	return hash >>> 0
}

function isDue(iso?: string | null) {
	if (!iso) return true
	return new Date(iso).getTime() <= Date.now()
}

function dueKind(card?: UserCard): VocabularyReviewCard['dueKind'] {
	if (!card?.lastReviewedAt) return 'new'
	return isDue(card.nextDueAt) ? 'due' : 'future'
}

function createUserCard(userId: string, wordId: string): UserCard {
	return {
		userId,
		wordId,
		lastReviewedAt: null,
		nextDueAt: null,
		correctCount: 0,
		wrongCount: 0,
		ease: 2.3,
		intervalDays: 0,
		archived: 0,
	}
}

function toWord(card: VocabularyReviewCard): Word {
	return {
		id: card.id,
		italian: card.italian,
		english: card.english,
		pos: card.partOfSpeech,
		category: card.category,
		level: card.level,
		utilityScore: card.utilityScore,
		source: card.source ?? 'seed',
		contentHash: stableHash(
			`${card.italian.toLowerCase()}::${card.english.toLowerCase()}`
		).toString(36),
		createdAt: new Date().toISOString(),
	}
}

export function getVocabularyDomainsForScene(sceneId: string, programWeek = 1) {
	const domains = new Set<VocabDomain>(sceneDomains[sceneId] ?? ['cafe', 'food'])
	for (const stage of weekDomains) {
		if (programWeek >= stage.from) {
			stage.domains.forEach((domain) => domains.add(domain))
			break
		}
	}
	return Array.from(domains)
}

export function getThematicVocabularyForScene(
	sceneId: string,
	options: Pick<VocabularyOptions, 'programWeek' | 'targetLevel'> = {}
) {
	const targetLevel = options.targetLevel ?? 'B1'
	const domains = getVocabularyDomainsForScene(sceneId, options.programWeek)
	const maxRank = levelRank[targetLevel]
	const sceneItems: VocabularyReviewCard[] = sceneVocabulary
		.filter((item) => item.sceneId === sceneId)
		.map((item) => ({
			...item,
			category: 'scene' as const,
			level: 'A1' as CefrLevel,
			utilityScore: 95,
			correctCount: 0,
			wrongCount: 0,
			intervalDays: 0,
			dueKind: 'new' as const,
			source: 'seed' as const,
		}))
	const themed = domains.flatMap((domain) =>
		thematicSeeds[domain]
			.map((item) => seed(domain, item))
			.filter((item) => levelRank[item.level] <= maxRank)
	)
	const speechFrames = (levelSpeechSeeds[targetLevel] ?? []).map((item) =>
		seed(domains[0] ?? 'cafe', item)
	)
	const unique = new Map<string, VocabularyReviewCard>()
	for (const item of [...speechFrames, ...sceneItems, ...themed]) {
		const key = `${item.italian.toLowerCase()}::${item.english.toLowerCase()}`
		if (!unique.has(key)) unique.set(key, item)
	}
	return Array.from(unique.values()).sort((a, b) => {
		if (b.utilityScore !== a.utilityScore) return b.utilityScore - a.utilityScore
		return a.italian.localeCompare(b.italian)
	})
}

function generatedWordToCard(word: Word): VocabularyReviewCard | null {
	if (!word.level || !word.category || !word.utilityScore) return null
	return {
		id: word.id,
		sceneId: word.category,
		italian: word.italian,
		english: word.english,
		partOfSpeech: word.pos ?? 'chunk',
		category: word.category as VocabDomain,
		level: word.level,
		utilityScore: word.utilityScore,
		correctCount: 0,
		wrongCount: 0,
		intervalDays: 0,
		dueKind: 'new',
		source: word.source ?? 'ai',
	}
}

function attachState(item: VocabularyReviewCard, card: UserCard) {
	return {
		...item,
		lastReviewedAt: card.lastReviewedAt,
		nextDueAt: card.nextDueAt,
		correctCount: card.correctCount,
		wrongCount: card.wrongCount,
		intervalDays: card.intervalDays,
		dueKind: dueKind(card),
	}
}

function sortVocabularyQueue(
	a: VocabularyReviewCard,
	b: VocabularyReviewCard,
	userId: string,
	dateKey: string
) {
	const rank = { due: 0, new: 1, future: 2 } as const
	if (rank[a.dueKind] !== rank[b.dueKind]) return rank[a.dueKind] - rank[b.dueKind]
	if (a.dueKind === 'due' && b.dueKind === 'due') {
		const aDue = a.nextDueAt ? new Date(a.nextDueAt).getTime() : 0
		const bDue = b.nextDueAt ? new Date(b.nextDueAt).getTime() : 0
		if (aDue !== bDue) return aDue - bDue
		if (b.wrongCount !== a.wrongCount) return b.wrongCount - a.wrongCount
	}
	if (a.dueKind === 'future' && b.dueKind === 'future') {
		if (a.intervalDays !== b.intervalDays) return a.intervalDays - b.intervalDays
	}
	const aRotation = stableHash(`${userId}:${dateKey}:${a.id}`) % 1_000_000
	const bRotation = stableHash(`${userId}:${dateKey}:${b.id}`) % 1_000_000
	const aScore = aRotation - a.utilityScore * 10_000
	const bScore = bRotation - b.utilityScore * 10_000
	return aScore - bScore
}

export async function loadVocabularyReviewQueue(
	userId: string,
	sceneId: string,
	options: VocabularyOptions = {}
) {
	const limit = Math.max(8, Math.min(40, Math.round(options.limit ?? 18)))
	const dateKey = options.dateKey ?? new Date().toISOString().slice(0, 10)
	const seedPool = getThematicVocabularyForScene(sceneId, options)
	const domains = new Set(getVocabularyDomainsForScene(sceneId, options.programWeek))
	const targetLevel = options.targetLevel ?? 'B1'
	const generated = (await db.words.toArray())
		.filter(
			(word) =>
				word.source !== 'seed' &&
				Boolean(word.category && domains.has(word.category as VocabDomain)) &&
				Boolean(word.level && levelRank[word.level] <= levelRank[targetLevel])
		)
		.map(generatedWordToCard)
		.filter((item): item is VocabularyReviewCard => Boolean(item))
	const uniquePool = new Map<string, VocabularyReviewCard>()
	for (const item of [...generated, ...seedPool]) {
		const key = `${item.italian.toLowerCase()}::${item.english.toLowerCase()}`
		if (!uniquePool.has(key)) uniquePool.set(key, item)
	}
	const pool = Array.from(uniquePool.values())
	const existingCards = await db.userCards.where('userId').equals(userId).toArray()
	const cardMap = new Map(existingCards.map((card) => [card.wordId, card]))
	const toCreate = pool
		.filter((item) => !cardMap.has(item.id))
		.map((item) => createUserCard(userId, item.id))

	await db.transaction('rw', db.words, db.userCards, async () => {
		await db.words.bulkPut(pool.map(toWord))
		if (toCreate.length) await db.userCards.bulkPut(toCreate)
	})

	const createdMap = new Map(toCreate.map((card) => [card.wordId, card]))
	const queue = pool
		.map((item) => {
			const card = cardMap.get(item.id) ?? createdMap.get(item.id)
			return card ? attachState(item, card) : item
		})
		.filter((item) => item.dueKind !== 'future')
		.sort((a, b) => sortVocabularyQueue(a, b, userId, dateKey))

	return selectLevelBalanced(queue, (item) => item.level, targetLevel, limit)
}

type GeneratedVocabularyPayload = {
	italian?: string
	english?: string
	partOfSpeech?: string
	domain?: VocabDomain
	level?: CefrLevel
	utilityScore?: number
}

type VocabularyPackResponse = {
	packId?: string
	provider?: 'openai' | 'fallback'
	level?: CefrLevel
	items?: GeneratedVocabularyPayload[]
}

function normalisedPair(italian: string, english: string) {
	return `${italian.trim().toLowerCase()}::${english.trim().toLowerCase()}`
}

export async function saveGeneratedVocabulary(
	items: GeneratedVocabularyPayload[],
	options: { targetLevel: CefrLevel; provider?: 'openai' | 'fallback' }
) {
	const existing = await db.words.toArray()
	const seen = new Set(existing.map((word) => normalisedPair(word.italian, word.english)))
	const saved: Word[] = []
	const now = new Date().toISOString()

	for (const item of items) {
		const italian = item.italian?.trim() ?? ''
		const english = item.english?.trim() ?? ''
		const level = item.level ?? options.targetLevel
		const domain = item.domain
		const utilityScore = Math.max(0, Math.min(100, Math.round(item.utilityScore ?? 0)))
		const key = normalisedPair(italian, english)
		if (!italian || !english || !domain || seen.has(key)) continue
		if (level !== options.targetLevel || utilityScore < 75) continue
		if (italian.split(/\s+/).length > 7) continue
		seen.add(key)
		const contentHash = stableHash(key).toString(36)
		saved.push({
			id: `v-ai-${contentHash}`,
			italian,
			english,
			pos: item.partOfSpeech?.trim() || 'chunk',
			category: domain,
			level,
			utilityScore,
			source: options.provider === 'fallback' ? 'fallback' : 'ai',
			contentHash,
			createdAt: now,
		})
	}
	if (saved.length) await db.words.bulkPut(saved)
	return saved
}

export async function restoreGeneratedVocabularyLibrary(targetLevel: CefrLevel) {
	try {
		const response = await apiFetch(
			`/api/generated-library?kind=vocabulary&level=${targetLevel}`
		)
		if (!response.ok) return []
		const data = (await response.json()) as { packs?: VocabularyPackResponse[] }
		const restored: Word[] = []
		for (const pack of data.packs ?? []) {
			restored.push(
				...(await saveGeneratedVocabulary(pack.items ?? [], {
					targetLevel: pack.level ?? targetLevel,
					provider: pack.provider,
				}))
			)
		}
		return restored
	} catch {
		return []
	}
}

export async function ensureGeneratedVocabularyPool(
	userId: string,
	sceneId: string,
	options: VocabularyOptions & { minFresh?: number }
) {
	const targetLevel = options.targetLevel ?? 'B1'
	const domains = getVocabularyDomainsForScene(sceneId, options.programWeek)
	const minFresh = Math.max(12, options.minFresh ?? 24)
	const refillAt = Math.max(8, Math.ceil(minFresh / 2))
	let generated = (await db.words.toArray()).filter(
		(word) =>
			word.source !== 'seed' &&
			word.level === targetLevel &&
			Boolean(word.category && domains.includes(word.category as VocabDomain))
	)
	const userCards = await db.userCards.where('userId').equals(userId).toArray()
	const seenIds = new Set(
		userCards.filter((card) => card.lastReviewedAt).map((card) => card.wordId)
	)
	let fresh = generated.filter((word) => !seenIds.has(word.id))
	if (fresh.length >= refillAt || typeof window === 'undefined') return generated

	if (!generated.length) {
		await restoreGeneratedVocabularyLibrary(targetLevel)
		generated = (await db.words.toArray()).filter(
			(word) =>
				word.source !== 'seed' &&
				word.level === targetLevel &&
				Boolean(word.category && domains.includes(word.category as VocabDomain))
		)
		fresh = generated.filter((word) => !seenIds.has(word.id))
		if (fresh.length >= refillAt) return generated
	}

	const allWords = await db.words.toArray()
	try {
		const response = await apiFetch('/api/generate-vocabulary-pack', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				level: targetLevel,
				programWeek: options.programWeek ?? 1,
				stage: getCurriculumStage(options.programWeek ?? 1),
				domains,
				targetCount: Math.min(36, Math.max(24, minFresh - fresh.length)),
				avoidItalian: allWords.map((word) => word.italian).slice(-240),
				avoidEnglish: allWords.map((word) => word.english).slice(-240),
			}),
		})
		if (!response.ok) return generated
		const pack = (await response.json()) as VocabularyPackResponse
		await saveGeneratedVocabulary(pack.items ?? [], {
			targetLevel,
			provider: pack.provider,
		})
		return (await db.words.toArray()).filter(
			(word) => word.source !== 'seed' && word.level === targetLevel
		)
	} catch {
		return generated
	}
}

export async function recordVocabularyReview(
	userId: string,
	card: SceneVocabulary,
	correct: boolean
) {
	const reviewCard =
		'category' in card
			? (card as VocabularyReviewCard)
			: ({
					...card,
					category: 'scene',
					level: 'A1',
					utilityScore: 80,
					correctCount: 0,
					wrongCount: 0,
					intervalDays: 0,
					dueKind: 'new',
					source: 'seed',
			  } satisfies VocabularyReviewCard)
	await db.words.put(toWord(reviewCard))
	const existing =
		(await db.userCards.get([userId, reviewCard.id])) ??
		createUserCard(userId, reviewCard.id)
	const updated = scheduleReview(existing, correct ? 'correct' : 'wrong')
	await db.transaction('rw', db.userCards, db.reviewLogs, async () => {
		await db.userCards.put(updated)
		await db.reviewLogs.add({
			userId,
			wordId: reviewCard.id,
			ts: new Date().toISOString(),
			correct: correct ? 1 : 0,
		})
	})
	return updated
}

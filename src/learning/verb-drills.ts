import type { CefrLevel, Exercise, ExerciseDifficulty } from '@/learning/content'
import {
	actionForFunction,
	countItalianWords,
	type CommunicativeFunction,
	type TenseFocus,
	type VocabDomain,
} from '@/learning/conversation-frames'
import {
	drillStageLabels,
	getDrillFamily,
	getDrillStagePlan,
	drillLevelRank,
	type DrillFamilyId,
	type DrillFocus,
	type DrillStage,
} from '@/learning/drill-catalogue'
import type { ComplexityStep, CueMode } from '@/learning/session-focus'

export type DrillPromptSource = 'book-led' | 'openai'

export type DrillPrompt = {
	id: string
	familyId: DrillFamilyId
	focus: DrillFocus
	stage: DrillStage
	stageLabel: string
	instruction: string
	cueMode: CueMode
	complexityStep: ComplexityStep
	source: DrillPromptSource
	exercise: Exercise
}

export type DrillRun = {
	id: string
	familyId: DrillFamilyId
	focus: DrillFocus
	level: CefrLevel
	targetCount: number
	source: DrillPromptSource
	prompts: DrillPrompt[]
	createdAt: string
}

export type GeneratedDrillPayload = {
	stage: DrillStage
	instruction?: string
	promptEnglish: string
	targetItalian: string
	acceptedItalian?: string[]
	hints?: string[]
	npcLine?: string
	keyVerb?: string
	tenseFocus?: TenseFocus
	vocabDomain?: VocabDomain
	communicativeFunction?: CommunicativeFunction
	maxWords?: number
	utilityScore?: number
}

type DrillSeed = {
	stage: DrillStage
	minLevel: CefrLevel
	english: string
	italian: string
	accepted?: string[]
	hints?: string[]
	npcLine?: string
	keyVerb: string
	tense?: TenseFocus
	domain?: VocabDomain
	function?: CommunicativeFunction
	maxWords?: number
}

const difficultyByLevel: Record<CefrLevel, ExerciseDifficulty> = {
	A1: 1,
	A2: 2,
	B1: 3,
	B2: 4,
	C1: 5,
}

const stageRank: Record<DrillStage, number> = {
	meet: 0,
	retrieve: 1,
	switch: 2,
	polarity: 3,
	pronoun: 4,
	time: 5,
	conversation: 6,
}

const stageInstruction: Record<DrillStage, string> = {
	meet: 'Hear it once, say it once, then hide the Italian.',
	retrieve: 'Say this precise meaning in Italian.',
	switch: 'Change the person or one concrete detail.',
	polarity: 'Build the question or negative without starting again.',
	pronoun: 'Replace the clear noun with the useful spoken pronoun.',
	time: 'Keep the meaning while moving it through time.',
	conversation: 'Give the first short reply that fits the Italian speaker.',
}

const stageCue: Record<DrillStage, { cueMode: CueMode; step: ComplexityStep }> = {
	meet: { cueMode: 'model', step: 1 },
	retrieve: { cueMode: 'english', step: 2 },
	switch: { cueMode: 'english', step: 3 },
	polarity: { cueMode: 'english', step: 3 },
	pronoun: { cueMode: 'situation', step: 4 },
	time: { cueMode: 'situation', step: 4 },
	conversation: { cueMode: 'interaction', step: 5 },
}

const familyDefaults: Record<
	DrillFamilyId,
	{ domain: VocabDomain; function: CommunicativeFunction; keyVerb: string }
> = {
	'doing-making': { domain: 'home', function: 'narrate', keyVerb: 'fare' },
	'modal-engine': { domain: 'family', function: 'plan', keyVerb: 'volere' },
	movement: { domain: 'travel', function: 'plan', keyVerb: 'andare' },
	giving: { domain: 'food', function: 'request', keyVerb: 'dare' },
	speaking: { domain: 'family', function: 'repair', keyVerb: 'dire' },
	'taking-placing': { domain: 'home', function: 'locate', keyVerb: 'mettere' },
	'experiencer-patterns': { domain: 'family', function: 'react', keyVerb: 'piacere' },
	'reflexive-routines': { domain: 'home', function: 'narrate', keyVerb: 'alzarsi' },
}

function s(
	stage: DrillStage,
	minLevel: CefrLevel,
	english: string,
	italian: string,
	keyVerb: string,
	overrides: Partial<DrillSeed> = {}
): DrillSeed {
	return { stage, minLevel, english, italian, keyVerb, ...overrides }
}

function rows(
	stage: DrillStage,
	minLevel: CefrLevel,
	keyVerb: string,
	values: Array<[string, string]>,
	overrides: Partial<DrillSeed> = {}
) {
	return values.map(([english, italian]) =>
		s(stage, minLevel, english, italian, keyVerb, overrides)
	)
}

function doingMakingSeeds(): DrillSeed[] {
	return [
		s('meet', 'A1', 'I am making dinner.', 'Preparo la cena.', 'preparare', {
			domain: 'food',
		}),
		...rows('retrieve', 'A1', 'fare', [
			['I am having breakfast.', 'Faccio colazione.'],
			['I am going shopping.', 'Faccio la spesa.'],
			['I am taking a walk.', 'Faccio una passeggiata.'],
			['I am asking a question.', 'Faccio una domanda.'],
			['I am preparing the table.', 'Preparo la tavola.'],
			['I am sorting out the room.', 'Sistemo la stanza.'],
			['I am changing my mind.', 'Cambio idea.'],
			['I am doing it now.', 'Lo faccio adesso.'],
		]),
		...rows('switch', 'A1', 'fare', [
			['What are you doing today?', 'Che cosa fai oggi?'],
			['We are making dinner.', 'Prepariamo la cena.'],
			['They are going shopping.', 'Fanno la spesa.'],
			['Are you setting the table?', 'Prepari la tavola?'],
			['We will sort everything out.', 'Sistemiamo tutto.'],
			['She is changing her mind.', 'Cambia idea.'],
			['Do you take a walk after lunch?', 'Fai una passeggiata dopo pranzo?'],
			['We are asking a question.', 'Facciamo una domanda.'],
		]),
		...rows('polarity', 'A1', 'fare', [
			['I am not making dinner.', 'Non preparo la cena.'],
			['Are you having breakfast?', 'Fai colazione?'],
			['We are not going shopping today.', 'Oggi non facciamo la spesa.'],
			['Are they taking a walk?', 'Fanno una passeggiata?'],
			['I am not changing my mind.', 'Non cambio idea.'],
			['Are you sorting out the room?', 'Sistemi la stanza?'],
			['I am not doing it now.', 'Non lo faccio adesso.'],
			['Why are you asking this question?', 'Perché fai questa domanda?'],
			['We are not preparing anything.', 'Non prepariamo niente.'],
			['Is she making coffee?', 'Prepara il caffè?'],
			['Do I have to set the table?', 'Devo preparare la tavola?'],
		]),
		...rows('time', 'A2', 'fare', [
			['I made dinner yesterday.', 'Ho preparato la cena ieri.'],
			['We went shopping this morning.', 'Abbiamo fatto la spesa stamattina.'],
			['I took a walk after lunch.', 'Ho fatto una passeggiata dopo pranzo.'],
			['I changed my mind.', 'Ho cambiato idea.'],
			['I sorted everything out yesterday.', 'Ho sistemato tutto ieri.'],
			['I will prepare dinner tomorrow.', 'Preparerò la cena domani.'],
			['We will go shopping later.', 'Faremo la spesa dopo.'],
			['I was making coffee.', 'Preparavo il caffè.'],
			['I used to take a walk here.', 'Facevo una passeggiata qui.'],
			['I would do it differently.', 'Lo farei diversamente.'],
		]),
		...conversationRows([
			['Che cosa fai stasera?', 'I am making dinner.', 'Preparo la cena.', 'preparare'],
			['Hai già fatto la spesa?', 'No, I will go shopping later.', 'No, farò la spesa dopo.', 'fare'],
			['Prepari tu il caffè?', 'Yes, I will make it now.', 'Sì, lo preparo adesso.', 'preparare'],
			['La stanza è ancora in disordine.', 'I will sort it out tomorrow.', 'La sistemo domani.', 'sistemare'],
			['Facciamo una passeggiata?', 'Yes, after lunch.', 'Sì, dopo pranzo.', 'fare'],
			['Hai cambiato idea?', 'No, I have not changed my mind.', 'No, non ho cambiato idea.', 'cambiare'],
			['Chi prepara la tavola?', 'We will set the table.', 'Prepariamo noi la tavola.', 'preparare'],
			['Puoi fare una domanda?', 'Yes, I have one question.', 'Sì, ho una domanda.', 'fare'],
		]),
	]
}

type ActionSlot = { en: string; it: string }

const modalActions: ActionSlot[] = [
	{ en: 'come on Sunday', it: 'venire domenica' },
	{ en: 'help with dinner', it: 'aiutare con la cena' },
	{ en: 'call Mum', it: 'chiamare la mamma' },
	{ en: 'leave now', it: 'partire adesso' },
	{ en: 'buy the bread', it: 'comprare il pane' },
	{ en: 'wait here', it: 'aspettare qui' },
	{ en: 'finish the work', it: 'finire il lavoro' },
	{ en: 'speak more slowly', it: 'parlare più lentamente' },
]

function modalSeeds(): DrillSeed[] {
	const retrieve = modalActions.flatMap((action, index) => [
		s('retrieve', 'A1', `I want to ${action.en}.`, `Voglio ${action.it}.`, 'volere'),
		s('retrieve', 'A1', `Can you ${action.en}?`, `Puoi ${action.it}?`, 'potere'),
		...(index < 6
			? [s('retrieve', 'A1', `I have to ${action.en}.`, `Devo ${action.it}.`, 'dovere')]
			: []),
	])
	return [
		s('meet', 'A1', 'I want to go home.', 'Voglio andare a casa.', 'volere'),
		...retrieve,
		...rows('switch', 'A1', 'potere', [
			['We want to come on Sunday.', 'Vogliamo venire domenica.'],
			['They can help with dinner.', 'Possono aiutare con la cena.'],
			['She has to call Mum.', 'Deve chiamare la mamma.'],
			['Do you want to leave now?', 'Vuoi partire adesso?'],
			['We can buy the bread.', 'Possiamo comprare il pane.'],
			['They have to wait here.', 'Devono aspettare qui.'],
			['Can she finish the work?', 'Può finire il lavoro?'],
			['We want to speak more slowly.', 'Vogliamo parlare più lentamente.'],
		]),
		...rows('polarity', 'A1', 'volere', [
			['I do not want to leave now.', 'Non voglio partire adesso.'],
			["Can't you come on Sunday?", 'Non puoi venire domenica?'],
			['We do not have to buy the bread.', 'Non dobbiamo comprare il pane.'],
			['Do they want to wait here?', 'Vogliono aspettare qui?'],
			['She cannot help with dinner.', 'Non può aiutare con la cena.'],
			['Do I have to call Mum?', 'Devo chiamare la mamma?'],
			['I cannot finish the work today.', 'Oggi non posso finire il lavoro.'],
			['Why do you want to leave?', 'Perché vuoi partire?'],
			['We do not want to wait.', 'Non vogliamo aspettare.'],
			['Can they come with us?', 'Possono venire con noi?'],
			['You do not have to do it now.', 'Non devi farlo adesso.'],
		]),
		...rows('pronoun', 'A2', 'volere', [
			['I want to buy it.', 'Voglio comprarlo.'],
			['Can you call her?', 'Puoi chiamarla?'],
			['I have to help him.', 'Devo aiutarlo.'],
			['We want to see them.', 'Vogliamo vederli.'],
			['She cannot find it.', 'Non riesce a trovarlo.'],
			['Do you want to tell her?', 'Vuoi dirglielo?'],
			['I have to give it to him.', 'Devo darglielo.'],
			['Can you bring it to Mum?', 'Puoi portarlo alla mamma?'],
			['I do not want to give it to her.', 'Non voglio darglielo.'],
			['We managed to finish it.', 'Siamo riusciti a finirlo.'],
			['Could you explain it to me?', 'Potresti spiegarmelo?'],
			['I would like to ask her.', 'Vorrei chiederle una cosa.'],
		]),
		...rows('time', 'A2', 'volere', [
			['I wanted to call you.', 'Volevo chiamarti.'],
			['I had to leave early.', 'Ho dovuto partire presto.'],
			['We managed to finish.', 'Siamo riusciti a finire.'],
			['I could not come yesterday.', 'Ieri non potevo venire.'],
			['I will have to call Mum.', 'Dovrò chiamare la mamma.'],
			['We will be able to help.', 'Potremo aiutare.'],
			['I would like to buy the bread.', 'Vorrei comprare il pane.'],
			['Could you wait here?', 'Potresti aspettare qui?'],
			['I was supposed to call her.', 'Dovevo chiamarla.'],
			['I did not manage to find it.', 'Non sono riuscito a trovarlo.'],
		]),
		...conversationRows([
			['Vieni a cena domenica?', 'Yes, I can come.', 'Sì, posso venire.', 'potere'],
			['Puoi aiutarmi con la cena?', 'Yes, I can help you.', 'Sì, posso aiutarti.', 'potere'],
			['Perché vai via?', 'I have to call Mum.', 'Devo chiamare la mamma.', 'dovere'],
			['Vuoi un caffè?', 'Yes, I would like one.', 'Sì, ne vorrei uno.', 'volere'],
			['Hai finito il lavoro?', 'No, I did not manage to finish it.', 'No, non sono riuscito a finirlo.', 'riuscire'],
			['Partiamo adesso?', 'No, I want to wait.', 'No, voglio aspettare.', 'volere'],
			['Puoi comprare il pane?', 'Yes, I will buy it.', 'Sì, posso comprarlo.', 'potere'],
			['Devo farlo subito?', 'No, you do not have to do it now.', 'No, non devi farlo adesso.', 'dovere'],
		]),
	]
}

const places = [
	{ en: 'home', it: 'a casa' },
	{ en: 'to the cafe', it: 'al bar' },
	{ en: 'to the market', it: 'al mercato' },
	{ en: 'to the match', it: 'alla partita' },
	{ en: 'to the centre', it: 'in centro' },
	{ en: 'to Rome', it: 'a Roma' },
]

function movementSeeds(): DrillSeed[] {
	return [
		s('meet', 'A1', 'I am going home.', 'Vado a casa.', 'andare', { domain: 'home' }),
		...places.flatMap((place) => [
			s('retrieve', 'A1', `I am going ${place.en}.`, `Vado ${place.it}.`, 'andare'),
			s('retrieve', 'A1', `Are you coming ${place.en}?`, `Vieni ${place.it}?`, 'venire'),
		]),
		...rows('switch', 'A1', 'andare', [
			['We are going to the cafe.', 'Andiamo al bar.'],
			['They are coming home.', 'Vengono a casa.'],
			['She is leaving for Rome.', 'Parte per Roma.'],
			['Are you returning after dinner?', 'Torni dopo cena?'],
			['We are leaving early.', 'Partiamo presto.'],
			['They are going to the match.', 'Vanno alla partita.'],
			['Is he coming with us?', 'Viene con noi?'],
			['I am returning to the centre.', 'Torno in centro.'],
		]),
		...rows('polarity', 'A1', 'andare', [
			['I am not going home yet.', 'Non vado ancora a casa.'],
			['Are you coming with us?', 'Vieni con noi?'],
			['We are not leaving now.', 'Non partiamo adesso.'],
			['Why are they returning early?', 'Perché tornano presto?'],
			['She is not going to the cafe.', 'Non va al bar.'],
			['Is he leaving for Rome?', 'Parte per Roma?'],
			['I am not coming to dinner.', 'Non vengo a cena.'],
			['Are we going to the market?', 'Andiamo al mercato?'],
			['They are not returning today.', 'Oggi non tornano.'],
			['When are you leaving?', 'Quando parti?'],
			['Is she coming home?', 'Viene a casa?'],
		]),
		...rows('time', 'A2', 'andare', [
			['I went home early.', 'Sono andato a casa presto.'],
			['We came to dinner yesterday.', 'Siamo venuti a cena ieri.'],
			['They left at eight.', 'Sono partiti alle otto.'],
			['She returned after lunch.', 'È tornata dopo pranzo.'],
			['I used to go to the market.', 'Andavo al mercato.'],
			['We will go to Rome tomorrow.', 'Andremo a Roma domani.'],
			['Will you come with us?', 'Verrai con noi?'],
			['I will return after dinner.', 'Tornerò dopo cena.'],
			['They were leaving when I called.', 'Partivano quando ho chiamato.'],
			['I would come, but I cannot.', 'Verrei, ma non posso.'],
		]),
		...conversationRows([
			['Vieni con noi?', 'Yes, I am coming.', 'Sì, vengo con voi.', 'venire'],
			['Quando parti?', 'I am leaving tomorrow.', 'Parto domani.', 'partire'],
			['Dove andate?', 'We are going to the cafe.', 'Andiamo al bar.', 'andare'],
			['Sei già tornato?', 'Yes, I returned early.', 'Sì, sono tornato presto.', 'tornare'],
			['Andiamo al mercato?', 'No, I am going home.', 'No, vado a casa.', 'andare'],
			['A che ora venite?', 'We will come at eight.', 'Veniamo alle otto.', 'venire'],
			['Perché è partita?', 'She had to go home.', 'Doveva andare a casa.', 'andare'],
			['Ci vediamo in centro?', 'Yes, I will come there.', 'Sì, vengo lì.', 'venire'],
		]),
	]
}

function givingSeeds(): DrillSeed[] {
	return [
		s('meet', 'A1', 'I give the book to my sister.', 'Do il libro a mia sorella.', 'dare', {
			domain: 'family',
		}),
		...rows('retrieve', 'A1', 'dare', [
			['I give the keys to Mum.', 'Do le chiavi alla mamma.'],
			['I pass the salt to you.', 'Ti passo il sale.'],
			['I bring the coffee to Marco.', 'Porto il caffè a Marco.'],
			['I return the book to Anna.', 'Restituisco il libro ad Anna.'],
			['I offer you a coffee.', 'Ti offro un caffè.'],
			['I give the photo to my brother.', 'Do la foto a mio fratello.'],
			['I pass the water to Maria.', "Passo l'acqua a Maria."],
			['I bring the bread to the table.', 'Porto il pane a tavola.'],
		]),
		...rows('switch', 'A1', 'dare', [
			['Can you give me the book?', 'Mi dai il libro?'],
			['We give the keys to Mum.', 'Diamo le chiavi alla mamma.'],
			['They bring the coffee to Marco.', 'Portano il caffè a Marco.'],
			['She returns the book to Anna.', 'Restituisce il libro ad Anna.'],
			['Pass me the water, please.', "Passami l'acqua, per favore."],
			['We offer them a coffee.', 'Offriamo loro un caffè.'],
			['Do you bring the bread to the table?', 'Porti il pane a tavola?'],
			['They give the photo to my sister.', 'Danno la foto a mia sorella.'],
		]),
		...rows('polarity', 'A1', 'dare', [
			['I do not give him the keys.', 'Non gli do le chiavi.'],
			['Can you pass me the salt?', 'Mi passi il sale?'],
			['We are not bringing the coffee.', 'Non portiamo il caffè.'],
			['Do they return the book today?', 'Restituiscono il libro oggi?'],
			['I do not want to give it away.', 'Non voglio darlo via.'],
			['Why are you giving her the photo?', 'Perché le dai la foto?'],
			['Do I bring the bread?', 'Porto io il pane?'],
			['She does not offer me a coffee.', 'Non mi offre un caffè.'],
			['Can we give it to Mum?', 'Possiamo darlo alla mamma?'],
			['They are not returning the money.', 'Non restituiscono i soldi.'],
			['Will you pass me the water?', "Mi passi l'acqua?"],
		]),
		...rows('pronoun', 'A2', 'dare', [
			['I give him the book.', 'Gli do il libro.'],
			['I give her the keys.', 'Le do le chiavi.'],
			['I give it to him.', 'Glielo do.'],
			['I give them to her.', 'Gliele do.'],
			['I give it to you.', 'Te lo do.'],
			['I want to give it to my sister.', 'Voglio darlo a mia sorella.'],
			['I want to give it to her.', 'Voglio darlo a lei.'],
			['I want to give it to him.', 'Glielo voglio dare.'],
			['I do not want to give it to her.', 'Non glielo voglio dare.'],
			['Can you pass it to me?', 'Puoi passarmelo?'],
			['I bring it to Mum.', 'Lo porto alla mamma.'],
			['I return it to Anna.', 'Glielo restituisco.'],
		]),
		...rows('time', 'A2', 'dare', [
			['I gave the book to Marco.', 'Ho dato il libro a Marco.'],
			['I gave it to him yesterday.', "Gliel'ho dato ieri."],
			['She passed me the salt.', 'Mi ha passato il sale.'],
			['We brought the coffee this morning.', 'Abbiamo portato il caffè stamattina.'],
			['I returned the keys yesterday.', 'Ho restituito le chiavi ieri.'],
			['I will give it to her tomorrow.', 'Glielo darò domani.'],
			['Will you bring it to Mum?', 'Lo porterai alla mamma?'],
			['I used to give him a hand.', 'Gli davo una mano.'],
			['I would pass it to you.', 'Te lo passerei.'],
			['Could you give it to her?', 'Potresti darglielo?'],
		]),
		...conversationRows([
			['Mi passi il sale?', 'Yes, I will pass it to you.', 'Sì, te lo passo.', 'passare'],
			['Hai dato il libro a Marco?', 'Yes, I gave it to him.', "Sì, gliel'ho dato.", 'dare'],
			['Porti tu il caffè alla mamma?', 'Yes, I will bring it to her.', 'Sì, glielo porto.', 'portare'],
			['A chi dai le chiavi?', 'I give them to my sister.', 'Le do a mia sorella.', 'dare'],
			['Mi restituisci il libro?', 'Yes, I will return it tomorrow.', 'Sì, te lo restituisco domani.', 'restituire'],
			['Vuoi un caffè?', 'No, offer it to Anna.', 'No, offrilo ad Anna.', 'offrire'],
			['Gli hai portato la foto?', 'No, I will bring it later.', 'No, gliela porto dopo.', 'portare'],
			['Posso dare il pane ai bambini?', 'Yes, give it to them.', 'Sì, dallo a loro.', 'dare'],
		]),
	]
}

function speakingSeeds(): DrillSeed[] {
	return [
		s('meet', 'A1', 'I am telling you the truth.', 'Ti dico la verità.', 'dire'),
		...rows('retrieve', 'A1', 'dire', [
			['I tell Anna everything.', 'Dico tutto ad Anna.'],
			['I ask the price.', 'Chiedo il prezzo.'],
			['I answer the question.', 'Rispondo alla domanda.'],
			['I explain the problem to Marco.', 'Spiego il problema a Marco.'],
			['I tell a short story.', 'Racconto una storia breve.'],
			['I ask for help.', 'Chiedo aiuto.'],
			['I repeat the sentence.', 'Ripeto la frase.'],
			['I confirm the time.', "Confermo l'orario."],
		]),
		...rows('switch', 'A1', 'dire', [
			['What are you saying?', 'Che cosa dici?'],
			['We tell Anna everything.', 'Diciamo tutto ad Anna.'],
			['They ask the price.', 'Chiedono il prezzo.'],
			['She answers the question.', 'Risponde alla domanda.'],
			['Can you explain the problem?', 'Puoi spiegare il problema?'],
			['We tell a short story.', 'Raccontiamo una storia breve.'],
			['Do you confirm the time?', "Confermi l'orario?"],
			['They repeat the sentence.', 'Ripetono la frase.'],
		]),
		...rows('polarity', 'A1', 'dire', [
			['I do not understand what you are saying.', 'Non capisco cosa dici.'],
			['Can you repeat, please?', 'Puoi ripetere, per favore?'],
			['I am not asking the price.', 'Non chiedo il prezzo.'],
			['Why are you not answering?', 'Perché non rispondi?'],
			['We do not tell Anna everything.', 'Non diciamo tutto ad Anna.'],
			['Can she explain the problem?', 'Può spiegare il problema?'],
			['I do not want to mention it.', 'Non voglio menzionarlo.'],
			['Are they telling the truth?', 'Dicono la verità?'],
			['I cannot answer now.', 'Non posso rispondere adesso.'],
			['Do you understand the question?', 'Capisci la domanda?'],
			['Can I ask you something?', 'Posso chiederti una cosa?'],
		]),
		...rows('pronoun', 'A2', 'dire', [
			['I tell her the truth.', 'Le dico la verità.'],
			['I tell it to her.', 'Glielo dico.'],
			['I explain it to him.', 'Glielo spiego.'],
			['Can you explain it to me?', 'Puoi spiegarmelo?'],
			['I ask him a question.', 'Gli faccio una domanda.'],
			['I tell you everything.', 'Ti dico tutto.'],
			['She tells it to us.', 'Ce lo dice.'],
			['We tell them the truth.', 'Diciamo loro la verità.'],
			['I want to tell it to her.', 'Voglio dirglielo.'],
			['Do not tell him.', 'Non dirglielo.'],
			['Can you repeat it to me?', 'Puoi ripetermelo?'],
			['I will explain it to Mum.', 'Lo spiego alla mamma.'],
		]),
		...rows('time', 'A2', 'dire', [
			['I told Anna the truth.', 'Ho detto la verità ad Anna.'],
			['I told her yesterday.', "Gliel'ho detto ieri."],
			['You explained the problem well.', 'Hai spiegato bene il problema.'],
			['We asked the price.', 'Abbiamo chiesto il prezzo.'],
			['She answered immediately.', 'Ha risposto subito.'],
			['I was telling you the truth.', 'Ti dicevo la verità.'],
			['I will explain it tomorrow.', 'Lo spiegherò domani.'],
			['I would ask him first.', 'Lo chiederei prima a lui.'],
			['I had already told her.', "Gliel'avevo già detto."],
			['Could you repeat the question?', 'Potresti ripetere la domanda?'],
		]),
		...conversationRows([
			['Che cosa hai detto ad Anna?', 'I told her the truth.', 'Le ho detto la verità.', 'dire'],
			['Hai capito?', 'No, can you repeat?', 'No, puoi ripetere?', 'ripetere'],
			['Perché non rispondi?', 'I do not know the answer.', 'Non so la risposta.', 'rispondere'],
			['Mi spieghi il problema?', 'Yes, I will explain it to you.', 'Sì, te lo spiego.', 'spiegare'],
			['Che cosa racconti?', 'I am telling a family story.', 'Racconto una storia di famiglia.', 'raccontare'],
			['Hai chiesto il prezzo?', 'Yes, I asked for it.', "Sì, l'ho chiesto.", 'chiedere'],
			["Puoi confermare l'orario?", 'Yes, I confirm it.', 'Sì, lo confermo.', 'confermare'],
			['Cosa gli hai detto?', 'I told him everything.', 'Gli ho detto tutto.', 'dire'],
		]),
	]
}

function takingPlacingSeeds(): DrillSeed[] {
	return [
		s('meet', 'A1', 'I put the keys on the table.', 'Metto le chiavi sul tavolo.', 'mettere'),
		...rows('retrieve', 'A1', 'prendere', [
			['I am taking the train.', 'Prendo il treno.'],
			['I am taking the book.', 'Prendo il libro.'],
			['I put the phone in the bag.', 'Metto il telefono nella borsa.'],
			['I leave the keys in the kitchen.', 'Lascio le chiavi in cucina.'],
			['I hold the glass.', 'Tengo il bicchiere.'],
			['I pick up the book.', 'Raccolgo il libro.'],
			['I put the bread on the table.', 'Metto il pane sul tavolo.'],
			['I leave the coat here.', 'Lascio il cappotto qui.'],
		]),
		...rows('switch', 'A1', 'mettere', [
			['Take the train at nine.', 'Prendi il treno alle nove.'],
			['We put the keys on the table.', 'Mettiamo le chiavi sul tavolo.'],
			['They leave the phone in the bag.', 'Lasciano il telefono nella borsa.'],
			['She holds the glass.', 'Tiene il bicchiere.'],
			['Can you pick up the book?', 'Puoi raccogliere il libro?'],
			['We take the bread.', 'Prendiamo il pane.'],
			['Leave the coat here.', 'Lascia il cappotto qui.'],
			['They put everything in the kitchen.', 'Mettono tutto in cucina.'],
		]),
		...rows('polarity', 'A1', 'mettere', [
			['Do not leave the phone here.', 'Non lasciare il telefono qui.'],
			['Where do I put the keys?', 'Dove metto le chiavi?'],
			['Are you taking the train?', 'Prendi il treno?'],
			['We are not taking the car.', 'Non prendiamo la macchina.'],
			['Why are they leaving the bread there?', 'Perché lasciano il pane lì?'],
			['Do I hold the glass?', 'Tengo io il bicchiere?'],
			['Do not put it in the bag.', 'Non metterlo nella borsa.'],
			['Can you leave the keys on the table?', 'Puoi lasciare le chiavi sul tavolo?'],
			['I cannot find where I left it.', "Non trovo dove l'ho lasciato."],
			['Are they picking up the books?', 'Raccolgono i libri?'],
			['Do we need to take the coats?', 'Dobbiamo prendere i cappotti?'],
		]),
		...rows('pronoun', 'A2', 'mettere', [
			['I take it.', 'Lo prendo.'],
			['I take them.', 'Li prendo.'],
			['I put it on the table.', 'Lo metto sul tavolo.'],
			['I put them in the bag.', 'Le metto nella borsa.'],
			['Leave it here.', 'Lascialo qui.'],
			['Do not leave it there.', 'Non lasciarlo lì.'],
			['I am holding it.', 'Lo tengo io.'],
			['Can you pick it up?', 'Puoi raccoglierlo?'],
			['Where did you put it?', "Dove l'hai messo?"],
			['I left it in the kitchen.', "L'ho lasciato in cucina."],
			['Put them on the table.', 'Mettile sul tavolo.'],
			['I will take it with me.', 'Lo porto con me.'],
		]),
		...rows('time', 'A2', 'mettere', [
			['I took the train yesterday.', 'Ho preso il treno ieri.'],
			['I put the keys on the table.', 'Ho messo le chiavi sul tavolo.'],
			['She left the phone in the kitchen.', 'Ha lasciato il telefono in cucina.'],
			['We held the glasses carefully.', 'Abbiamo tenuto i bicchieri con cura.'],
			['I used to take the bus.', "Prendevo l'autobus."],
			['I will put it in the bag.', 'Lo metterò nella borsa.'],
			['They will leave early.', 'Partiranno presto.'],
			['I had left it at home.', "L'avevo lasciato a casa."],
			['I would take the train.', 'Prenderei il treno.'],
			['Could you put it here?', 'Potresti metterlo qui?'],
		]),
		...conversationRows([
			['Dove sono le chiavi?', 'I put them on the table.', 'Le ho messe sul tavolo.', 'mettere'],
			['Prendi tu il pane?', 'Yes, I will take it.', 'Sì, lo prendo io.', 'prendere'],
			['Dove hai lasciato il telefono?', 'I left it in the kitchen.', "L'ho lasciato in cucina.", 'lasciare'],
			['Puoi tenere questo?', 'Yes, I will hold it.', 'Sì, lo tengo io.', 'tenere'],
			['Metto tutto nella borsa?', 'No, leave it here.', 'No, lascialo qui.', 'lasciare'],
			['Hai raccolto il libro?', 'Yes, I picked it up.', "Sì, l'ho raccolto.", 'raccogliere'],
			['Prendiamo la macchina?', 'No, let us take the train.', 'No, prendiamo il treno.', 'prendere'],
			['Dove metto i bicchieri?', 'Put them on the table.', 'Mettili sul tavolo.', 'mettere'],
		]),
	]
}

function experiencerSeeds(): DrillSeed[] {
	return [
		s('meet', 'A1', 'I like this coffee.', 'Mi piace questo caffè.', 'piacere', {
			domain: 'cafe',
		}),
		...rows('retrieve', 'A1', 'piacere', [
			['I like the music.', 'Mi piace la musica.'],
			['I like these olives.', 'Mi piacciono queste olive.'],
			['I miss you.', 'Mi manchi.'],
			['I need a glass.', 'Mi serve un bicchiere.'],
			['I need two chairs.', 'Mi servono due sedie.'],
			['One coffee is enough for me.', 'Mi basta un caffè.'],
			['It seems like a good idea to me.', 'Mi sembra una buona idea.'],
			['These colours seem too dark to me.', 'Questi colori mi sembrano troppo scuri.'],
		]),
		...rows('switch', 'A1', 'piacere', [
			['Do you like the music?', 'Ti piace la musica?'],
			['She likes these olives.', 'Le piacciono queste olive.'],
			['We miss you.', 'Ci manchi.'],
			['Do you need a chair?', 'Ti serve una sedia?'],
			['Marco needs two glasses.', 'Gli servono due bicchieri.'],
			['Is one coffee enough for you?', 'Ti basta un caffè?'],
			['It seems strange to her.', 'Le sembra strano.'],
			['Do these colours seem dark to you?', 'Ti sembrano scuri questi colori?'],
		]),
		...rows('polarity', 'A1', 'piacere', [
			['I do not like this coffee.', 'Non mi piace questo caffè.'],
			['Do you like these olives?', 'Ti piacciono queste olive?'],
			['Do you miss them?', 'Ti mancano?'],
			['I do not need a chair.', 'Non mi serve una sedia.'],
			['Are two glasses enough for you?', 'Ti bastano due bicchieri?'],
			['It does not seem right to me.', 'Non mi sembra giusto.'],
			['Why do you not like it?', 'Perché non ti piace?'],
			['Do we need more time?', 'Ci serve più tempo?'],
			['I do not miss that place.', 'Non mi manca quel posto.'],
			['Does the film seem too long to her?', 'Le sembra troppo lungo il film?'],
			['Is one chair enough?', 'Basta una sedia?'],
		]),
		...rows('pronoun', 'A2', 'piacere', [
			['I like it.', 'Mi piace.'],
			['Do you like it?', 'Ti piace?'],
			['She likes it.', 'Le piace.'],
			['He likes them.', 'Gli piacciono.'],
			['We like them.', 'Ci piacciono.'],
			['I miss her.', 'Mi manca.'],
			['I miss them.', 'Mi mancano.'],
			['She needs it.', 'Le serve.'],
			['Mum needs them.', 'Le servono.'],
			['It seems useful to me.', 'Mi sembra utile.'],
			['It seems useful to her.', 'Le sembra utile.'],
			['They seem expensive to us.', 'Ci sembrano cari.'],
		]),
		...rows('time', 'A2', 'piacere', [
			['I liked the film.', 'Mi è piaciuto il film.'],
			['I liked the songs.', 'Mi sono piaciute le canzoni.'],
			['I missed you yesterday.', 'Mi sei mancato ieri.'],
			['We needed more time.', 'Ci serviva più tempo.'],
			['One chair was enough for me.', 'Mi bastava una sedia.'],
			['It seemed strange to her.', 'Le sembrava strano.'],
			['I think I will like it.', 'Credo che mi piacerà.'],
			['We will need two cars.', 'Ci serviranno due macchine.'],
			['I would like it more without sugar.', 'Mi piacerebbe di più senza zucchero.'],
			['It would seem strange to them.', 'A loro sembrerebbe strano.'],
		]),
		...conversationRows([
			['Ti piace questo caffè?', 'Yes, I like it.', 'Sì, mi piace.', 'piacere'],
			['Ti piacciono le olive?', 'No, I do not like them.', 'No, non mi piacciono.', 'piacere'],
			['Ti manca la famiglia?', 'Yes, I miss my family.', 'Sì, mi manca.', 'mancare'],
			['Ti serve una sedia?', 'No, one is enough.', 'No, me ne basta una.', 'bastare'],
			['Come ti sembra il film?', 'It seems too long to me.', 'Mi sembra troppo lungo.', 'sembrare'],
			['Ci servono altri bicchieri?', 'Yes, we need two.', 'Sì, ce ne servono due.', 'servire'],
			['Le è piaciuta la cena?', 'Yes, she liked it.', 'Sì, le è piaciuta.', 'piacere'],
			['Ti manco?', 'Yes, I miss you.', 'Sì, mi manchi.', 'mancare'],
		]),
	]
}

function reflexiveSeeds(): DrillSeed[] {
	return [
		s('meet', 'A1', 'I get up early.', 'Mi alzo presto.', 'alzarsi'),
		...rows('retrieve', 'A1', 'alzarsi', [
			['I get dressed quickly.', 'Mi vesto in fretta.'],
			['I feel well today.', 'Oggi mi sento bene.'],
			['I remember the appointment.', "Mi ricordo dell'appuntamento."],
			['I have a good time with the family.', 'Mi diverto con la famiglia.'],
			['I worry about Mum.', 'Mi preoccupo per la mamma.'],
			['I sit down here.', 'Mi siedo qui.'],
			['I wash before breakfast.', 'Mi lavo prima di colazione.'],
			['I go to bed early.', 'Vado a letto presto.'],
		]),
		...rows('switch', 'A1', 'alzarsi', [
			['Do you get up early?', 'Ti alzi presto?'],
			['We get dressed quickly.', 'Ci vestiamo in fretta.'],
			['She feels well today.', 'Oggi si sente bene.'],
			['Do they remember the appointment?', "Si ricordano dell'appuntamento?"],
			['We have a good time together.', 'Ci divertiamo insieme.'],
			['Are you worried about Mum?', 'Ti preoccupi per la mamma?'],
			['They sit down here.', 'Si siedono qui.'],
			['We wash before breakfast.', 'Ci laviamo prima di colazione.'],
		]),
		...rows('polarity', 'A1', 'alzarsi', [
			['I do not get up early on Sunday.', 'La domenica non mi alzo presto.'],
			['Are you getting dressed now?', 'Ti vesti adesso?'],
			['We do not feel well.', 'Non ci sentiamo bene.'],
			['Do you remember the appointment?', "Ti ricordi dell'appuntamento?"],
			['She is not having a good time.', 'Non si diverte.'],
			['Why are they worried?', 'Perché si preoccupano?'],
			['Do I sit here?', 'Mi siedo qui?'],
			['We do not go to bed early.', 'Non andiamo a letto presto.'],
			['Are you washing your hands?', 'Ti lavi le mani?'],
			['I do not feel ready.', 'Non mi sento pronto.'],
			['Does she remember us?', 'Si ricorda di noi?'],
		]),
		...rows('pronoun', 'A2', 'vestirsi', [
			['I have to get dressed.', 'Devo vestirmi.'],
			['You have to get up.', 'Devi alzarti.'],
			['She wants to sit down.', 'Vuole sedersi.'],
			['We want to have a good time.', 'Vogliamo divertirci.'],
			['I do not want to worry.', 'Non voglio preoccuparmi.'],
			['Can you remember it?', 'Puoi ricordartelo?'],
			['I feel ready.', 'Mi sento pronto.'],
			['Do you feel better?', 'Ti senti meglio?'],
			['We remember her.', 'Ci ricordiamo di lei.'],
			['They have to hurry.', 'Devono sbrigarsi.'],
			['I would like to sit down.', 'Vorrei sedermi.'],
			['Try to relax.', 'Cerca di rilassarti.'],
		]),
		...rows('time', 'A2', 'alzarsi', [
			['I got up early.', 'Mi sono alzato presto.'],
			['She got dressed quickly.', 'Si è vestita in fretta.'],
			['We had a good time at dinner.', 'Ci siamo divertiti a cena.'],
			['I remembered to call Mum.', 'Mi sono ricordato di chiamare la mamma.'],
			['They felt better yesterday.', 'Ieri si sono sentiti meglio.'],
			['I used to get up early.', 'Mi alzavo presto.'],
			['We will get ready at eight.', 'Ci prepareremo alle otto.'],
			['I would feel better at home.', 'Mi sentirei meglio a casa.'],
			['She had already sat down.', 'Si era già seduta.'],
			['We will remember it.', 'Ce lo ricorderemo.'],
		]),
		...conversationRows([
			['A che ora ti alzi?', 'I get up at seven.', 'Mi alzo alle sette.', 'alzarsi'],
			['Ti senti bene?', 'Yes, I feel better.', 'Sì, mi sento meglio.', 'sentirsi'],
			["Ti ricordi dell'appuntamento?", 'Yes, I remember it.', 'Sì, me lo ricordo.', 'ricordarsi'],
			['Vi siete divertiti?', 'Yes, we had a good time.', 'Sì, ci siamo divertiti.', 'divertirsi'],
			['Perché ti preoccupi?', 'I am worried about Mum.', 'Mi preoccupo per la mamma.', 'preoccuparsi'],
			['Sei già vestito?', 'No, I have to get dressed.', 'No, devo vestirmi.', 'vestirsi'],
			['Ci sediamo qui?', 'Yes, let us sit here.', 'Sì, sediamoci qui.', 'sedersi'],
			['Quando vi preparate?', 'We will get ready after dinner.', 'Ci prepareremo dopo cena.', 'prepararsi'],
		]),
	]
}

function conversationRows(
	values: Array<[string, string, string, string]>
): DrillSeed[] {
	return values.map(([npcLine, english, italian, keyVerb]) =>
		s('conversation', 'A1', english, italian, keyVerb, {
			npcLine,
			function: 'react',
		})
	)
}

const seedBuilders: Record<DrillFamilyId, () => DrillSeed[]> = {
	'doing-making': doingMakingSeeds,
	'modal-engine': modalSeeds,
	movement: movementSeeds,
	giving: givingSeeds,
	speaking: speakingSeeds,
	'taking-placing': takingPlacingSeeds,
	'experiencer-patterns': experiencerSeeds,
	'reflexive-routines': reflexiveSeeds,
}

function simpleHash(value: string) {
	let hash = 5381
	for (let index = 0; index < value.length; index += 1) {
		hash = (hash * 33) ^ value.charCodeAt(index)
	}
	return (hash >>> 0).toString(36)
}

function rotate<T>(items: T[], amount: number) {
	if (!items.length) return items
	const offset = Math.abs(amount) % items.length
	return [...items.slice(offset), ...items.slice(0, offset)]
}

function cueForStage(stage: DrillStage) {
	return stageCue[stage]
}

function normaliseForDuplicate(value: string) {
	return value
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-z0-9]+/g, ' ')
		.trim()
}

function seedToPrompt(
	seed: DrillSeed,
	options: {
		familyId: DrillFamilyId
		focus: DrillFocus
		level: CefrLevel
		runId: string
		index: number
		source: DrillPromptSource
	}
): DrillPrompt {
	const family = getDrillFamily(options.familyId)
	const defaults = familyDefaults[options.familyId]
	const cue = cueForStage(seed.stage)
	const communicativeFunction = seed.function ?? defaults.function
	const targetWords = countItalianWords(seed.italian)
	const maxWords = Math.max(
		4,
		Math.min(12, seed.maxWords ?? Math.max(targetWords, targetWords + 1))
	)
	const exerciseId = `${options.runId}:${options.index}:${simpleHash(
		`${seed.english}:${seed.italian}`
	)}`
	const exercise: Exercise = {
		id: exerciseId,
		type:
			seed.stage === 'meet'
				? 'chunk'
				: seed.stage === 'time'
				? 'transform'
				: seed.stage === 'conversation'
				? 'scene'
				: 'sentence',
		sceneId: `drill-${options.familyId}`,
		promptEnglish: seed.english,
		targetItalian: seed.italian,
		acceptedItalian: Array.from(new Set([seed.italian, ...(seed.accepted ?? [])])),
		hints: seed.hints ?? family.contrasts.slice(0, 2),
		tags: Array.from(
			new Set([
				'drill',
				options.familyId,
				seed.stage,
				seed.keyVerb,
				seed.tense ?? 'present',
			])
		),
		phraseFamily: family.shortLabel,
		difficulty: difficultyByLevel[options.level],
		cefrLevel: options.level,
		phase:
			seed.stage === 'meet'
				? 'warmup'
				: seed.stage === 'conversation'
				? 'speak'
				: 'produce',
		action: actionForFunction(communicativeFunction),
		communicativeGoal: seed.english,
		spokenCue: stageInstruction[seed.stage],
		repairPrompts: [seed.english, `Say it again with one changed detail.`],
		sourceId: `drill-${options.source}`,
		strand: seed.stage === 'meet' ? 'input' : 'output',
		roundFocus: 'verbs-frames',
		keyVerb: seed.keyVerb ?? defaults.keyVerb,
		construction: `drill:${options.familyId}:${seed.stage}`,
		npcLine: seed.npcLine,
		frameId: `drill:${options.familyId}:${options.focus}`,
		tenseFocus: seed.tense ?? 'present',
		vocabDomain: seed.domain ?? defaults.domain,
		communicativeFunction,
		maxWords,
		utilityScore: 92,
	}
	return {
		id: exerciseId,
		familyId: options.familyId,
		focus: options.focus,
		stage: seed.stage,
		stageLabel: drillStageLabels[seed.stage],
		instruction: stageInstruction[seed.stage],
		cueMode: cue.cueMode,
		complexityStep: cue.step,
		source: options.source,
		exercise,
	}
}

function selectSeeds(
	familyId: DrillFamilyId,
	level: CefrLevel,
	focus: DrillFocus,
	count: number,
	seedValue: number
) {
	const all = seedBuilders[familyId]().filter(
		(item) => drillLevelRank(item.minLevel) <= drillLevelRank(level)
	)
	const plan = getDrillStagePlan(level, focus, count)
	const byStage = new Map<DrillStage, DrillSeed[]>()
	for (const stage of Object.keys(stageRank) as DrillStage[]) {
		byStage.set(
			stage,
			rotate(
				all.filter((item) => item.stage === stage),
				seedValue + stageRank[stage] * 3
			)
		)
	}
	const selected: DrillSeed[] = []
	const used = new Set<string>()
	for (const stage of plan) {
		const preferred = byStage.get(stage) ?? []
		const candidate = preferred.find((item) => {
			const key = `${normaliseForDuplicate(item.english)}:${normaliseForDuplicate(
				item.italian
			)}`
			return !used.has(key)
		})
		const fallback = rotate(all, seedValue + selected.length).find((item) => {
			const key = `${normaliseForDuplicate(item.english)}:${normaliseForDuplicate(
				item.italian
			)}`
			return !used.has(key)
		})
		const next = candidate ?? fallback
		if (!next) break
		used.add(
			`${normaliseForDuplicate(next.english)}:${normaliseForDuplicate(next.italian)}`
		)
		selected.push(next)
	}
	return selected.sort((a, b) => stageRank[a.stage] - stageRank[b.stage])
}

export function buildLocalDrillRun(options: {
	familyId: DrillFamilyId
	focus: DrillFocus
	level: CefrLevel
	targetCount: number
	seed?: number
}): DrillRun {
	const seedValue = Math.abs(Math.round(options.seed ?? Date.now()))
	const targetCount = Math.max(20, Math.min(30, Math.round(options.targetCount)))
	const runId = `drill:${options.familyId}:${options.level}:${options.focus}:${seedValue.toString(
		36
	)}`
	const selected = selectSeeds(
		options.familyId,
		options.level,
		options.focus,
		targetCount,
		seedValue
	)
	return {
		id: runId,
		familyId: options.familyId,
		focus: options.focus,
		level: options.level,
		targetCount,
		source: 'book-led',
		prompts: selected.map((seed, index) =>
			seedToPrompt(seed, {
				familyId: options.familyId,
				focus: options.focus,
				level: options.level,
				runId,
				index,
				source: 'book-led',
			})
		),
		createdAt: new Date().toISOString(),
	}
}

function generatedSeed(
	payload: GeneratedDrillPayload,
	familyId: DrillFamilyId
): DrillSeed {
	const defaults = familyDefaults[familyId]
	return {
		stage: payload.stage,
		minLevel: 'A1',
		english: payload.promptEnglish,
		italian: payload.targetItalian,
		accepted: payload.acceptedItalian,
		hints: payload.hints,
		npcLine: payload.npcLine,
		keyVerb: payload.keyVerb ?? defaults.keyVerb,
		tense: payload.tenseFocus,
		domain: payload.vocabDomain,
		function: payload.communicativeFunction,
		maxWords: payload.maxWords,
	}
}

export function buildGeneratedDrillRun(options: {
	familyId: DrillFamilyId
	focus: DrillFocus
	level: CefrLevel
	targetCount: number
	packId: string
	prompts: GeneratedDrillPayload[]
}): DrillRun {
	const fallback = buildLocalDrillRun({
		familyId: options.familyId,
		focus: options.focus,
		level: options.level,
		targetCount: options.targetCount,
		seed: Number.parseInt(simpleHash(options.packId), 36),
	})
	const seen = new Set<string>()
	const generated = options.prompts
		.filter((item) => item.promptEnglish?.trim() && item.targetItalian?.trim())
		.filter((item) => item.stage in stageRank)
		.filter((item) => {
			const key = `${normaliseForDuplicate(item.promptEnglish)}:${normaliseForDuplicate(
				item.targetItalian
			)}`
			if (seen.has(key)) return false
			seen.add(key)
			return true
		})
		.map((item) => generatedSeed(item, options.familyId))
		.sort((a, b) => stageRank[a.stage] - stageRank[b.stage])
	const localFill = fallback.prompts
		.map((prompt) => ({
			stage: prompt.stage,
			minLevel: 'A1' as CefrLevel,
			english: prompt.exercise.promptEnglish,
			italian: prompt.exercise.targetItalian,
			accepted: prompt.exercise.acceptedItalian,
			hints: prompt.exercise.hints,
			npcLine: prompt.exercise.npcLine,
			keyVerb: prompt.exercise.keyVerb ?? familyDefaults[options.familyId].keyVerb,
			tense: prompt.exercise.tenseFocus,
			domain: prompt.exercise.vocabDomain,
			function: prompt.exercise.communicativeFunction,
			maxWords: prompt.exercise.maxWords,
		}))
		.filter((item) => {
			const key = `${normaliseForDuplicate(item.english)}:${normaliseForDuplicate(
				item.italian
			)}`
			if (seen.has(key)) return false
			seen.add(key)
			return true
		})
	const selected = [...generated, ...localFill]
		.slice(0, options.targetCount)
		.sort((a, b) => stageRank[a.stage] - stageRank[b.stage])
	const runId = `drill-ai:${options.familyId}:${options.level}:${simpleHash(options.packId)}`
	return {
		id: runId,
		familyId: options.familyId,
		focus: options.focus,
		level: options.level,
		targetCount: options.targetCount,
		source: 'openai',
		prompts: selected.map((seed, index) =>
			seedToPrompt(seed, {
				familyId: options.familyId,
				focus: options.focus,
				level: options.level,
				runId,
				index,
				source: 'openai',
			})
		),
		createdAt: new Date().toISOString(),
	}
}

export function drillStageProgress(prompts: DrillPrompt[], completedCount: number) {
	const stages = Array.from(new Set(prompts.map((prompt) => prompt.stage)))
	return stages.map((stage) => {
		const indexes = prompts
			.map((prompt, index) => ({ prompt, index }))
			.filter((item) => item.prompt.stage === stage)
		const completed = indexes.filter((item) => item.index < completedCount).length
		return {
			stage,
			label: drillStageLabels[stage],
			completed,
			total: indexes.length,
			active: indexes.some((item) => item.index === completedCount),
		}
	})
}

export function drillRunIsValid(run: DrillRun) {
	if (run.prompts.length !== run.targetCount) return false
	const pairs = new Set(
		run.prompts.map(
			(prompt) =>
				`${normaliseForDuplicate(prompt.exercise.promptEnglish)}:${normaliseForDuplicate(
					prompt.exercise.targetItalian
				)}`
		)
	)
	return (
		pairs.size === run.prompts.length &&
		run.prompts.every(
			(prompt) =>
				countItalianWords(prompt.exercise.targetItalian) <=
				(prompt.exercise.maxWords ?? 12)
		)
	)
}

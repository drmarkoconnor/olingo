export type Scene = {
	id: string
	title: string
	location: string
	level: string
	objective: string
	narrative: string
	progressLabel: string
	imageUrl: string
	photoCredit: string
	photoUrl: string
	accent: string
	actions: string[]
}

export type ExerciseType = 'chunk' | 'sentence' | 'transform' | 'scene'

export type Exercise = {
	id: string
	type: ExerciseType
	sceneId: string
	promptEnglish: string
	targetItalian: string
	acceptedItalian: string[]
	hints: string[]
	tags: string[]
	phraseFamily: string
	difficulty: 1 | 2 | 3
	npcLine?: string
}

export type SceneVocabulary = {
	id: string
	sceneId: string
	italian: string
	english: string
	partOfSpeech: string
}

const unsplash = (photoId: string) =>
	`https://images.unsplash.com/${photoId}?auto=format&fit=crop&w=1600&q=80`

export const scenes: Scene[] = [
	{
		id: 'milan-cafe',
		title: 'Milan Cafe',
		location: 'Brera, Milan',
		level: 'A2 -> B1',
		objective: 'Open a relaxed conversation and ask for an opinion.',
		narrative:
			'You meet a friend outside a busy cafe. The aim is to sound natural, curious, and unhurried.',
		progressLabel: 'Scene beat 1 of 4',
		imageUrl: unsplash('photo-1631351856433-ab4389985628'),
		photoCredit: 'Wouter Groote Veldman on Unsplash',
		photoUrl:
			'https://unsplash.com/photos/brown-wicker-chairs-and-table-on-street-during-daytime-Q3hXRT95rCY',
		accent: '#ffb703',
		actions: ['Greet', 'Ask opinion', 'React', 'Continue chat'],
	},
	{
		id: 'family-table',
		title: 'Family Table',
		location: 'Dinner with friends',
		level: 'A2 -> B1',
		objective: 'Talk about family, plans, and what happened recently.',
		narrative:
			'The table is lively. You need short, warm sentences that keep the conversation moving.',
		progressLabel: 'Scene beat 1 of 4',
		imageUrl: unsplash('photo-1658951863101-b2fbab790b39'),
		photoCredit: 'Jay Gajjar on Unsplash',
		photoUrl:
			'https://unsplash.com/it/foto/persone-che-mangiano-la-pizza-a-un-tavolo-Cu4KmBDvclQ',
		accent: '#fb6f92',
		actions: ['Offer help', 'Tell a story', 'Ask follow-up', 'Compare tastes'],
	},
	{
		id: 'bookshop',
		title: 'Bookshop',
		location: 'Independent bookshop',
		level: 'B1 bridge',
		objective: 'Ask for recommendations and explain cultural preferences.',
		narrative:
			'You are browsing with someone who knows Italian books and films. Be specific, but keep it simple.',
		progressLabel: 'Locked after cafe beat 2',
		imageUrl: unsplash('photo-1762350834823-8b8cab219191'),
		photoCredit: 'Junaid Rahim on Unsplash',
		photoUrl:
			'https://unsplash.com/photos/interior-of-a-modern-bookstore-with-arched-shelves-ygsCgba7ptc',
		accent: '#2ec4b6',
		actions: ['Ask advice', 'Describe taste', 'Compare', 'Recommend back'],
	},
	{
		id: 'piazza-newsstand',
		title: 'Piazza Newsstand',
		location: 'Piazza del Duomo',
		level: 'B1 bridge',
		objective: 'Turn a headline into a simple opinion and a follow-up question.',
		narrative:
			'You notice a headline and use it as a low-pressure way into culture and news chat.',
		progressLabel: 'Locked after bookshop beat 1',
		imageUrl: unsplash('photo-1766475341256-689f4f6ef4cf'),
		photoCredit: 'Paulo De Jesus on Unsplash',
		photoUrl:
			'https://unsplash.com/photos/milan-cathedral-and-piazza-del-duomo-with-people-v_nRFtoUWdk',
		accent: '#3a86ff',
		actions: ['Read headline', 'Summarise', 'Ask view', 'Disagree softly'],
	},
	{
		id: 'station',
		title: 'Railway Platform',
		location: 'Italian station',
		level: 'A2 repair',
		objective: 'Ask for details, confirm, and repair misunderstanding.',
		narrative:
			'The station is noisy. Practise short sentences that help you stay calm and clear.',
		progressLabel: 'Available as repair scene',
		imageUrl: unsplash('photo-1767725162026-f2195e9b1dd0'),
		photoCredit: 'Tim Photoguy on Unsplash',
		photoUrl:
			'https://unsplash.com/photos/train-at-a-station-platform-with-exit-sign-IOQXzwdAowE',
		accent: '#8338ec',
		actions: ['Ask', 'Confirm', 'Repeat', 'Solve'],
	},
	{
		id: 'cinema',
		title: 'Cinema Foyer',
		location: 'Florence cinema',
		level: 'B1 bridge',
		objective: 'Discuss a film and explain what you liked or found slow.',
		narrative:
			'After the film, you need opinions, reasons, and gentle disagreement.',
		progressLabel: 'Locked after culture streak',
		imageUrl: unsplash('photo-1698213297907-d432ed91315f'),
		photoCredit: 'David Mkrtchian on Unsplash',
		photoUrl:
			'https://unsplash.com/photos/a-sign-that-reads-cinema-above-a-doorway-WU7MyD4nX-M',
		accent: '#ff006e',
		actions: ['Invite', 'React', 'Explain why', 'Plan next time'],
	},
]

export const exercises: Exercise[] = [
	{
		id: 'cafe-opinion-1',
		type: 'scene',
		sceneId: 'milan-cafe',
		promptEnglish: 'In my opinion, the coffee here is very good.',
		targetItalian: 'Secondo me, il caffe qui e molto buono.',
		acceptedItalian: [
			'secondo me il caffe qui e molto buono',
			'secondo me il cafe qui e molto buono',
			'secondo me il caffè qui è molto buono',
		],
		hints: ['Start with "Secondo me".', 'Use "qui" for "here".'],
		tags: ['opinion', 'accent', 'article'],
		phraseFamily: 'Giving opinions',
		difficulty: 1,
		npcLine: 'Cominciamo con una frase semplice.',
	},
	{
		id: 'cafe-followup-1',
		type: 'sentence',
		sceneId: 'milan-cafe',
		promptEnglish: 'What do you think about this place?',
		targetItalian: 'Che cosa pensi di questo posto?',
		acceptedItalian: [
			'che cosa pensi di questo posto',
			'cosa pensi di questo posto',
			'che ne pensi di questo posto',
		],
		hints: ['"What do you think" can be "Che cosa pensi".'],
		tags: ['question', 'preposition'],
		phraseFamily: 'Asking follow-up questions',
		difficulty: 1,
	},
	{
		id: 'cafe-soften-1',
		type: 'chunk',
		sceneId: 'milan-cafe',
		promptEnglish: 'I am not sure, but it seems interesting.',
		targetItalian: 'Non sono sicuro, ma mi sembra interessante.',
		acceptedItalian: [
			'non sono sicuro ma mi sembra interessante',
			'non sono sicura ma mi sembra interessante',
		],
		hints: ['Use "mi sembra" for "it seems to me".'],
		tags: ['softening', 'gender'],
		phraseFamily: 'Softening',
		difficulty: 2,
	},
	{
		id: 'family-week-1',
		type: 'sentence',
		sceneId: 'family-table',
		promptEnglish: 'How was your week?',
		targetItalian: 'Com e stata la tua settimana?',
		acceptedItalian: [
			'com e stata la tua settimana',
			'com è stata la tua settimana',
			'come e stata la tua settimana',
			'come è stata la tua settimana',
		],
		hints: ['Use "stata" because "settimana" is feminine.'],
		tags: ['question', 'agreement', 'past'],
		phraseFamily: 'Asking follow-up questions',
		difficulty: 1,
		npcLine: 'A tavola, una buona domanda apre tutto.',
	},
	{
		id: 'family-story-1',
		type: 'transform',
		sceneId: 'family-table',
		promptEnglish: 'Yesterday we went to the cinema, but the film was too long.',
		targetItalian: 'Ieri siamo andati al cinema, ma il film era troppo lungo.',
		acceptedItalian: [
			'ieri siamo andati al cinema ma il film era troppo lungo',
			'ieri siamo andate al cinema ma il film era troppo lungo',
		],
		hints: ['Movement verb: "siamo andati".', 'Use "era" for description in the past.'],
		tags: ['past', 'auxiliary', 'imperfect'],
		phraseFamily: 'Telling past events',
		difficulty: 3,
	},
	{
		id: 'family-help-1',
		type: 'sentence',
		sceneId: 'family-table',
		promptEnglish: 'Can I help you with dinner?',
		targetItalian: 'Posso aiutarti con la cena?',
		acceptedItalian: [
			'posso aiutarti con la cena',
			'posso aiutare con la cena',
			'ti posso aiutare con la cena',
		],
		hints: ['"Help you" can be "aiutarti".'],
		tags: ['clitic', 'question'],
		phraseFamily: 'Offering help',
		difficulty: 1,
	},
	{
		id: 'bookshop-rec-1',
		type: 'scene',
		sceneId: 'bookshop',
		promptEnglish: 'Can you recommend a contemporary Italian novel?',
		targetItalian: 'Mi puo consigliare un romanzo italiano contemporaneo?',
		acceptedItalian: [
			'mi puo consigliare un romanzo italiano contemporaneo',
			'mi può consigliare un romanzo italiano contemporaneo',
			'puoi consigliarmi un romanzo italiano contemporaneo',
		],
		hints: ['Formal: "Mi puo consigliare".', 'Informal: "Puoi consigliarmi".'],
		tags: ['politeness', 'clitic', 'culture'],
		phraseFamily: 'Asking advice',
		difficulty: 2,
	},
	{
		id: 'bookshop-taste-1',
		type: 'sentence',
		sceneId: 'bookshop',
		promptEnglish: 'I like stories about families and cities.',
		targetItalian: 'Mi piacciono le storie sulle famiglie e sulle citta.',
		acceptedItalian: [
			'mi piacciono le storie sulle famiglie e sulle citta',
			'mi piacciono le storie sulle famiglie e sulle città',
		],
		hints: ['Plural thing liked: "mi piacciono".'],
		tags: ['plural', 'preposition', 'culture'],
		phraseFamily: 'Describing taste',
		difficulty: 2,
	},
	{
		id: 'news-headline-1',
		type: 'scene',
		sceneId: 'piazza-newsstand',
		promptEnglish: 'I read that there is an important exhibition in Milan.',
		targetItalian: 'Ho letto che c e una mostra importante a Milano.',
		acceptedItalian: [
			'ho letto che c e una mostra importante a milano',
			'ho letto che cè una mostra importante a milano',
			'ho letto che c e una mostra importante in milano',
			'ho letto che c e un importante mostra a milano',
			'ho letto che c è una mostra importante a milano',
		],
		hints: ['Use "Ho letto che..." for "I read that...".'],
		tags: ['news', 'article', 'word-order'],
		phraseFamily: 'Summarising news',
		difficulty: 2,
	},
	{
		id: 'news-opinion-1',
		type: 'sentence',
		sceneId: 'piazza-newsstand',
		promptEnglish: 'It seems interesting, but I do not know much about it.',
		targetItalian: 'Mi sembra interessante, ma non ne so molto.',
		acceptedItalian: [
			'mi sembra interessante ma non ne so molto',
			'sembra interessante ma non ne so molto',
		],
		hints: ['"About it" can be "ne" in this phrase.'],
		tags: ['pronoun', 'softening', 'news'],
		phraseFamily: 'Softening',
		difficulty: 3,
	},
	{
		id: 'station-repeat-1',
		type: 'chunk',
		sceneId: 'station',
		promptEnglish: 'Sorry, could you repeat that more slowly?',
		targetItalian: 'Scusi, puo ripetere piu lentamente?',
		acceptedItalian: [
			'scusi puo ripetere piu lentamente',
			'scusi può ripetere più lentamente',
			'scusa puoi ripetere piu lentamente',
		],
		hints: ['Formal: "Scusi, puo..."', 'Informal: "Scusa, puoi..."'],
		tags: ['repair', 'politeness'],
		phraseFamily: 'Conversation repair',
		difficulty: 1,
	},
	{
		id: 'station-confirm-1',
		type: 'sentence',
		sceneId: 'station',
		promptEnglish: 'So the train leaves from platform seven?',
		targetItalian: 'Quindi il treno parte dal binario sette?',
		acceptedItalian: [
			'quindi il treno parte dal binario sette',
			'allora il treno parte dal binario sette',
		],
		hints: ['"Platform" is "binario" for trains.'],
		tags: ['travel', 'preposition'],
		phraseFamily: 'Confirming details',
		difficulty: 1,
	},
	{
		id: 'cinema-react-1',
		type: 'scene',
		sceneId: 'cinema',
		promptEnglish: 'I liked the film, even though it was a bit slow.',
		targetItalian: 'Mi e piaciuto il film, anche se era un po lento.',
		acceptedItalian: [
			'mi e piaciuto il film anche se era un po lento',
			'mi è piaciuto il film anche se era un po lento',
			'mi è piaciuto il film anche se era un po lento',
			'mi e piaciuto il film anche se era un po lento',
		],
		hints: ['For liking a film: "mi e piaciuto il film".'],
		tags: ['past', 'opinion', 'imperfect'],
		phraseFamily: 'Giving opinions',
		difficulty: 3,
	},
	{
		id: 'cinema-plan-1',
		type: 'sentence',
		sceneId: 'cinema',
		promptEnglish: 'Next time we could see something lighter.',
		targetItalian: 'La prossima volta potremmo vedere qualcosa di piu leggero.',
		acceptedItalian: [
			'la prossima volta potremmo vedere qualcosa di piu leggero',
			'la prossima volta potremmo vedere qualcosa di più leggero',
		],
		hints: ['"We could" is "potremmo".'],
		tags: ['conditional', 'planning'],
		phraseFamily: 'Making plans',
		difficulty: 3,
	},
]

export const sceneVocabulary: SceneVocabulary[] = [
	{
		id: 'v-cafe-posto',
		sceneId: 'milan-cafe',
		italian: 'il posto',
		english: 'the place',
		partOfSpeech: 'noun',
	},
	{
		id: 'v-cafe-pensare',
		sceneId: 'milan-cafe',
		italian: 'pensare',
		english: 'to think',
		partOfSpeech: 'verb',
	},
	{
		id: 'v-cafe-secondo-me',
		sceneId: 'milan-cafe',
		italian: 'secondo me',
		english: 'in my opinion',
		partOfSpeech: 'chunk',
	},
	{
		id: 'v-cafe-qui',
		sceneId: 'milan-cafe',
		italian: 'qui',
		english: 'here',
		partOfSpeech: 'adverb',
	},
	{
		id: 'v-family-settimana',
		sceneId: 'family-table',
		italian: 'la settimana',
		english: 'the week',
		partOfSpeech: 'noun',
	},
	{
		id: 'v-family-aiutare',
		sceneId: 'family-table',
		italian: 'aiutare',
		english: 'to help',
		partOfSpeech: 'verb',
	},
	{
		id: 'v-family-cena',
		sceneId: 'family-table',
		italian: 'la cena',
		english: 'dinner',
		partOfSpeech: 'noun',
	},
	{
		id: 'v-family-ieri',
		sceneId: 'family-table',
		italian: 'ieri',
		english: 'yesterday',
		partOfSpeech: 'adverb',
	},
	{
		id: 'v-book-romanzo',
		sceneId: 'bookshop',
		italian: 'il romanzo',
		english: 'the novel',
		partOfSpeech: 'noun',
	},
	{
		id: 'v-book-consigliare',
		sceneId: 'bookshop',
		italian: 'consigliare',
		english: 'to recommend',
		partOfSpeech: 'verb',
	},
	{
		id: 'v-book-storie',
		sceneId: 'bookshop',
		italian: 'le storie',
		english: 'the stories',
		partOfSpeech: 'noun',
	},
	{
		id: 'v-news-mostra',
		sceneId: 'piazza-newsstand',
		italian: 'la mostra',
		english: 'the exhibition',
		partOfSpeech: 'noun',
	},
	{
		id: 'v-news-ho-letto',
		sceneId: 'piazza-newsstand',
		italian: 'ho letto che',
		english: 'I read that',
		partOfSpeech: 'chunk',
	},
	{
		id: 'v-news-ne-so',
		sceneId: 'piazza-newsstand',
		italian: 'ne so',
		english: 'I know about it',
		partOfSpeech: 'chunk',
	},
	{
		id: 'v-station-binario',
		sceneId: 'station',
		italian: 'il binario',
		english: 'the platform',
		partOfSpeech: 'noun',
	},
	{
		id: 'v-station-ripetere',
		sceneId: 'station',
		italian: 'ripetere',
		english: 'to repeat',
		partOfSpeech: 'verb',
	},
	{
		id: 'v-station-lentamente',
		sceneId: 'station',
		italian: 'lentamente',
		english: 'slowly',
		partOfSpeech: 'adverb',
	},
	{
		id: 'v-cinema-film',
		sceneId: 'cinema',
		italian: 'il film',
		english: 'the film',
		partOfSpeech: 'noun',
	},
	{
		id: 'v-cinema-lento',
		sceneId: 'cinema',
		italian: 'lento',
		english: 'slow',
		partOfSpeech: 'adjective',
	},
	{
		id: 'v-cinema-potremmo',
		sceneId: 'cinema',
		italian: 'potremmo',
		english: 'we could',
		partOfSpeech: 'verb',
	},
]

export function getScene(sceneId: string) {
	return scenes.find((scene) => scene.id === sceneId) ?? scenes[0]
}

export function getExercise(exerciseId: string) {
	return exercises.find((exercise) => exercise.id === exerciseId)
}

export function getExercisesForScene(sceneId: string) {
	return exercises.filter((exercise) => exercise.sceneId === sceneId)
}

export function getVocabularyForScene(sceneId: string) {
	return sceneVocabulary.filter((item) => item.sceneId === sceneId)
}

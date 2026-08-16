import type { CefrLevel, Exercise, ExerciseDifficulty } from '@/learning/content'
import {
	actionForFunction,
	type CommunicativeFunction,
	type TenseFocus,
	type VocabDomain,
} from '@/learning/conversation-frames'
import type { ExerciseState } from '@/storage/db'

export type MemoryAnchor = {
	id: string
	label: string
	italian: string
	english: string
	situation: string
	acceptedItalian: string[]
	communicativeFunction: CommunicativeFunction
	tenseFocus: TenseFocus
	position: { x: number; y: number }
}

export type MemoryRoom = {
	id: string
	title: string
	italianTitle: string
	theme: string
	domain: VocabDomain
	zone: 'Arrival' | 'Ground floor' | 'Family floor' | 'Private floor'
	anchors: [MemoryAnchor, MemoryAnchor]
}

const anchors = (
	first: Omit<MemoryAnchor, 'position'>,
	second: Omit<MemoryAnchor, 'position'>,
	roomIndex: number
): [MemoryAnchor, MemoryAnchor] => {
	const flip = roomIndex % 2 === 1
	return [
		{ ...first, position: flip ? { x: 68, y: 31 } : { x: 29, y: 66 } },
		{ ...second, position: flip ? { x: 31, y: 68 } : { x: 72, y: 36 } },
	]
}

export const memoryRooms: MemoryRoom[] = [
	{
		id: 'driveway',
		title: 'Driveway',
		italianTitle: 'Il vialetto',
		theme: 'Transport and keys',
		domain: 'travel',
		zone: 'Arrival',
		anchors: anchors(
			{
				id: 'car-in-driveway',
				label: 'The car',
				italian: 'La macchina è nel vialetto.',
				english: 'The car is in the driveway.',
				situation: 'Tell someone where the car is.',
				acceptedItalian: ['L’auto è nel vialetto.', "L'auto è nel vialetto."],
				communicativeFunction: 'locate',
				tenseFocus: 'present',
			},
			{
				id: 'keys-in-car',
				label: 'The keys',
				italian: 'Ho lasciato le chiavi in macchina.',
				english: 'I left the keys in the car.',
				situation: 'Explain where you left the keys.',
				acceptedItalian: ['Ho lasciato le chiavi nell’auto.', "Ho lasciato le chiavi nell'auto."],
				communicativeFunction: 'narrate',
				tenseFocus: 'passato-prossimo',
			},
			0
		),
	},
	{
		id: 'coach-house',
		title: 'Coach House',
		italianTitle: 'La rimessa',
		theme: 'Arriving and leaving',
		domain: 'travel',
		zone: 'Arrival',
		anchors: anchors(
			{
				id: 'just-arrived',
				label: 'Arrival',
				italian: 'Siamo appena arrivati.',
				english: 'We have just arrived.',
				situation: 'Tell the family that you have just arrived.',
				acceptedItalian: ['Siamo arrivati adesso.'],
				communicativeFunction: 'narrate',
				tenseFocus: 'passato-prossimo',
			},
			{
				id: 'close-gate',
				label: 'The gate',
				italian: 'Chiudi il cancello, per favore.',
				english: 'Close the gate, please.',
				situation: 'Ask someone to close the gate politely.',
				acceptedItalian: ['Per favore, chiudi il cancello.'],
				communicativeFunction: 'request',
				tenseFocus: 'imperative',
			},
			1
		),
	},
	{
		id: 'loggia',
		title: 'Loggia',
		italianTitle: 'La loggia',
		theme: 'Weather and seasons',
		domain: 'home',
		zone: 'Arrival',
		anchors: anchors(
			{
				id: 'eat-outside',
				label: 'Outside',
				italian: 'Mangiamo fuori stasera?',
				english: 'Shall we eat outside tonight?',
				situation: 'Suggest eating outside tonight.',
				acceptedItalian: ['Ceniamo fuori stasera?'],
				communicativeFunction: 'plan',
				tenseFocus: 'present',
			},
			{
				id: 'sunny-today',
				label: 'The sun',
				italian: 'Oggi c’è il sole.',
				english: 'It is sunny today.',
				situation: 'Comment briefly on today’s sunny weather.',
				acceptedItalian: ["Oggi c'e il sole.", 'Oggi è una giornata di sole.'],
				communicativeFunction: 'react',
				tenseFocus: 'present',
			},
			2
		),
	},
	{
		id: 'utility-room',
		title: 'Utility Room',
		italianTitle: 'La lavanderia',
		theme: 'Laundry and household things',
		domain: 'home',
		zone: 'Arrival',
		anchors: anchors(
			{
				id: 'washing-machine-full',
				label: 'The washing machine',
				italian: 'La lavatrice è piena.',
				english: 'The washing machine is full.',
				situation: 'Say that the washing machine is full.',
				acceptedItalian: [],
				communicativeFunction: 'react',
				tenseFocus: 'present',
			},
			{
				id: 'where-towels',
				label: 'The towels',
				italian: 'Dove sono gli asciugamani?',
				english: 'Where are the towels?',
				situation: 'Ask where the towels are.',
				acceptedItalian: ['Gli asciugamani dove sono?'],
				communicativeFunction: 'locate',
				tenseFocus: 'present',
			},
			3
		),
	},
	{
		id: 'kitchen',
		title: 'Kitchen',
		italianTitle: 'La cucina',
		theme: 'Food and vegetables',
		domain: 'food',
		zone: 'Arrival',
		anchors: anchors(
			{
				id: 'pass-salt',
				label: 'The salt',
				italian: 'Passami il sale, per favore.',
				english: 'Pass me the salt, please.',
				situation: 'Ask someone at the table to pass you the salt.',
				acceptedItalian: ['Mi passi il sale, per favore?', 'Puoi passarmi il sale?'],
				communicativeFunction: 'request',
				tenseFocus: 'imperative',
			},
			{
				id: 'milk-in-fridge',
				label: 'The milk',
				italian: 'Il latte è nel frigo.',
				english: 'The milk is in the fridge.',
				situation: 'Tell someone where the milk is.',
				acceptedItalian: ['Il latte è in frigo.', 'Il latte è nel frigorifero.'],
				communicativeFunction: 'locate',
				tenseFocus: 'present',
			},
			4
		),
	},
	{
		id: 'steep-stairs',
		title: 'Steep Stairs',
		italianTitle: 'Le scale ripide',
		theme: 'Movement and caution',
		domain: 'home',
		zone: 'Arrival',
		anchors: anchors(
			{
				id: 'go-slowly',
				label: 'Go slowly',
				italian: 'Vai piano sulle scale.',
				english: 'Go slowly on the stairs.',
				situation: 'Warn someone to go slowly on the stairs.',
				acceptedItalian: ['Vai lentamente sulle scale.'],
				communicativeFunction: 'request',
				tenseFocus: 'imperative',
			},
			{
				id: 'coming-down',
				label: 'Coming down',
				italian: 'Sto scendendo.',
				english: 'I am coming down.',
				situation: 'Tell someone downstairs that you are coming down.',
				acceptedItalian: ['Scendo adesso.', 'Vengo giù.'],
				communicativeFunction: 'narrate',
				tenseFocus: 'present',
			},
			5
		),
	},
	{
		id: 'hallway',
		title: 'Hallway',
		italianTitle: 'L’ingresso',
		theme: 'Directions and arrivals',
		domain: 'home',
		zone: 'Ground floor',
		anchors: anchors(
			{
				id: 'hang-coat',
				label: 'The coat',
				italian: 'Appendi il cappotto qui.',
				english: 'Hang the coat here.',
				situation: 'Tell a guest where to hang the coat.',
				acceptedItalian: ['Metti il cappotto qui.'],
				communicativeFunction: 'request',
				tenseFocus: 'imperative',
			},
			{
				id: 'wait-at-entrance',
				label: 'The entrance',
				italian: 'Ti aspetto all’ingresso.',
				english: 'I’ll wait for you at the entrance.',
				situation: 'Arrange to wait for someone at the entrance.',
				acceptedItalian: ["Ti aspetto all'ingresso.", 'Aspetto te all’ingresso.'],
				communicativeFunction: 'plan',
				tenseFocus: 'present',
			},
			6
		),
	},
	{
		id: 'study',
		title: 'Study',
		italianTitle: 'Lo studio',
		theme: 'Calendar, days and work',
		domain: 'home',
		zone: 'Ground floor',
		anchors: anchors(
			{
				id: 'need-pen',
				label: 'The pen',
				italian: 'Mi serve una penna.',
				english: 'I need a pen.',
				situation: 'Say that you need a pen.',
				acceptedItalian: ['Ho bisogno di una penna.'],
				communicativeFunction: 'request',
				tenseFocus: 'present',
			},
			{
				id: 'finish-work',
				label: 'The work',
				italian: 'Devo finire questo lavoro.',
				english: 'I have to finish this work.',
				situation: 'Explain that you have to finish your work.',
				acceptedItalian: ['Devo finire il lavoro.'],
				communicativeFunction: 'give-reason',
				tenseFocus: 'modal-infinitive',
			},
			7
		),
	},
	{
		id: 'drawing-room',
		title: 'Drawing Room',
		italianTitle: 'Il salotto',
		theme: 'Conversation fillers and opinions',
		domain: 'family',
		zone: 'Ground floor',
		anchors: anchors(
			{
				id: 'please-sit',
				label: 'Take a seat',
				italian: 'Accomodati sul divano.',
				english: 'Make yourself comfortable on the sofa.',
				situation: 'Invite a friend to sit on the sofa.',
				acceptedItalian: ['Siediti sul divano.'],
				communicativeFunction: 'offer',
				tenseFocus: 'imperative',
			},
			{
				id: 'what-think',
				label: 'An opinion',
				italian: 'Tu che ne pensi?',
				english: 'What do you think about it?',
				situation: 'Ask the other person for their opinion.',
				acceptedItalian: ['Che ne pensi?', 'E tu, che ne pensi?'],
				communicativeFunction: 'ask-back',
				tenseFocus: 'present',
			},
			8
		),
	},
	{
		id: 'piano-room',
		title: 'Piano Room',
		italianTitle: 'La sala della musica',
		theme: 'Music and culture',
		domain: 'culture',
		zone: 'Ground floor',
		anchors: anchors(
			{
				id: 'know-song',
				label: 'The song',
				italian: 'Conosci questa canzone?',
				english: 'Do you know this song?',
				situation: 'Ask someone whether they know the song.',
				acceptedItalian: ['La conosci questa canzone?'],
				communicativeFunction: 'ask-back',
				tenseFocus: 'present',
			},
			{
				id: 'play-well',
				label: 'A compliment',
				italian: 'Suoni molto bene.',
				english: 'You play very well.',
				situation: 'Compliment someone on their playing.',
				acceptedItalian: ['Sai suonare molto bene.'],
				communicativeFunction: 'react',
				tenseFocus: 'present',
			},
			9
		),
	},
	{
		id: 'toilet',
		title: 'Toilet',
		italianTitle: 'Il bagno di servizio',
		theme: 'Essential requests',
		domain: 'home',
		zone: 'Ground floor',
		anchors: anchors(
			{
				id: 'where-bathroom',
				label: 'The bathroom',
				italian: 'Dov’è il bagno?',
				english: 'Where is the bathroom?',
				situation: 'Ask where the bathroom is.',
				acceptedItalian: ["Dov'e il bagno?", 'Il bagno dov’è?'],
				communicativeFunction: 'locate',
				tenseFocus: 'present',
			},
			{
				id: 'paper-finished',
				label: 'The paper',
				italian: 'È finita la carta igienica.',
				english: 'We have run out of toilet paper.',
				situation: 'Tell someone that the toilet paper has run out.',
				acceptedItalian: ['La carta igienica è finita.', 'Non c’è più carta igienica.'],
				communicativeFunction: 'narrate',
				tenseFocus: 'passato-prossimo',
			},
			10
		),
	},
	{
		id: 'dining-room',
		title: 'Dining Room',
		italianTitle: 'La sala da pranzo',
		theme: 'Food, table and numbers',
		domain: 'food',
		zone: 'Ground floor',
		anchors: anchors(
			{
				id: 'dinner-ready',
				label: 'Dinner',
				italian: 'La cena è pronta.',
				english: 'Dinner is ready.',
				situation: 'Tell everyone that dinner is ready.',
				acceptedItalian: ['È pronta la cena.'],
				communicativeFunction: 'react',
				tenseFocus: 'present',
			},
			{
				id: 'six-at-table',
				label: 'Six places',
				italian: 'Siamo in sei a tavola.',
				english: 'There are six of us at the table.',
				situation: 'Say that there will be six people at the table.',
				acceptedItalian: ['Saremo in sei a tavola.', 'A tavola siamo in sei.'],
				communicativeFunction: 'narrate',
				tenseFocus: 'present',
			},
			11
		),
	},
	{
		id: 'lounge',
		title: 'Lounge',
		italianTitle: 'Il soggiorno',
		theme: 'Family and shared time',
		domain: 'family',
		zone: 'Family floor',
		anchors: anchors(
			{
				id: 'lower-volume',
				label: 'The volume',
				italian: 'Abbassa un po’ il volume.',
				english: 'Turn the volume down a little.',
				situation: 'Ask someone to turn the volume down a little.',
				acceptedItalian: ["Abbassa un po' il volume.", 'Puoi abbassare un po’ il volume?'],
				communicativeFunction: 'request',
				tenseFocus: 'imperative',
			},
			{
				id: 'sit-here',
				label: 'Sit together',
				italian: 'Ci sediamo qui?',
				english: 'Shall we sit here?',
				situation: 'Suggest sitting here together.',
				acceptedItalian: ['Vogliamo sederci qui?', 'Sediamoci qui?'],
				communicativeFunction: 'plan',
				tenseFocus: 'present',
			},
			12
		),
	},
	{
		id: 'main-stairs',
		title: 'Main Stairs',
		italianTitle: 'La scala principale',
		theme: 'Position and movement',
		domain: 'home',
		zone: 'Family floor',
		anchors: anchors(
			{
				id: 'room-upstairs',
				label: 'Upstairs',
				italian: 'La mia camera è di sopra.',
				english: 'My room is upstairs.',
				situation: 'Tell a guest that your room is upstairs.',
				acceptedItalian: ['La mia stanza è di sopra.', 'La mia camera è al piano di sopra.'],
				communicativeFunction: 'locate',
				tenseFocus: 'present',
			},
			{
				id: 'turn-light-on',
				label: 'The light',
				italian: 'Accendi la luce, per favore.',
				english: 'Turn on the light, please.',
				situation: 'Ask someone to turn on the light.',
				acceptedItalian: ['Per favore, accendi la luce.', 'Puoi accendere la luce?'],
				communicativeFunction: 'request',
				tenseFocus: 'imperative',
			},
			13
		),
	},
	{
		id: 'charlottes-room',
		title: 'Charlotte’s Room',
		italianTitle: 'La camera di Charlotte',
		theme: 'People and possessives',
		domain: 'family',
		zone: 'Family floor',
		anchors: anchors(
			{
				id: 'charlottes-room',
				label: 'Whose room?',
				italian: 'Questa è la camera di Charlotte.',
				english: 'This is Charlotte’s room.',
				situation: 'Identify the room as Charlotte’s.',
				acceptedItalian: ['È la camera di Charlotte.'],
				communicativeFunction: 'locate',
				tenseFocus: 'present',
			},
			{
				id: 'book-is-hers',
				label: 'Her book',
				italian: 'Questo libro è suo.',
				english: 'This book is hers.',
				situation: 'Say that this book belongs to her.',
				acceptedItalian: ['Questo è il suo libro.', 'Il libro è suo.'],
				communicativeFunction: 'locate',
				tenseFocus: 'present',
			},
			14
		),
	},
	{
		id: 'junk-room',
		title: 'Junk Room',
		italianTitle: 'Il ripostiglio',
		theme: 'Objects and finding things',
		domain: 'home',
		zone: 'Family floor',
		anchors: anchors(
			{
				id: 'find-charger',
				label: 'The charger',
				italian: 'Non trovo il caricatore.',
				english: 'I can’t find the charger.',
				situation: 'Say that you cannot find the charger.',
				acceptedItalian: ['Non riesco a trovare il caricatore.'],
				communicativeFunction: 'locate',
				tenseFocus: 'present',
			},
			{
				id: 'look-in-box',
				label: 'The box',
				italian: 'Guarda nella scatola.',
				english: 'Look in the box.',
				situation: 'Tell someone to look in the box.',
				acceptedItalian: ['Cerca nella scatola.'],
				communicativeFunction: 'request',
				tenseFocus: 'imperative',
			},
			15
		),
	},
	{
		id: 'nursery',
		title: 'Nursery',
		italianTitle: 'La cameretta',
		theme: 'Children, animals and quiet routines',
		domain: 'family',
		zone: 'Family floor',
		anchors: anchors(
			{
				id: 'baby-sleeping',
				label: 'Sleeping',
				italian: 'Il bambino sta dormendo.',
				english: 'The baby is sleeping.',
				situation: 'Explain that the baby is sleeping.',
				acceptedItalian: ['Il bimbo sta dormendo.', 'Il bambino dorme.'],
				communicativeFunction: 'narrate',
				tenseFocus: 'present',
			},
			{
				id: 'speak-quietly',
				label: 'Quietly',
				italian: 'Parla piano, per favore.',
				english: 'Speak quietly, please.',
				situation: 'Ask someone to speak quietly.',
				acceptedItalian: ['Per favore, parla piano.', 'Parla a bassa voce, per favore.'],
				communicativeFunction: 'request',
				tenseFocus: 'imperative',
			},
			16
		),
	},
	{
		id: 'anns-bedroom',
		title: 'Ann’s Bedroom',
		italianTitle: 'La camera di Ann',
		theme: 'Family routines',
		domain: 'family',
		zone: 'Family floor',
		anchors: anchors(
			{
				id: 'ann-getting-ready',
				label: 'Getting ready',
				italian: 'Ann si sta preparando.',
				english: 'Ann is getting ready.',
				situation: 'Explain that Ann is getting ready.',
				acceptedItalian: ['Ann si prepara.', 'Ann si sta vestendo.'],
				communicativeFunction: 'narrate',
				tenseFocus: 'present',
			},
			{
				id: 'her-bag',
				label: 'Her bag',
				italian: 'La sua borsa è sulla sedia.',
				english: 'Her bag is on the chair.',
				situation: 'Tell Ann where her bag is.',
				acceptedItalian: ['La borsa è sulla sedia.', 'La borsa di Ann è sulla sedia.'],
				communicativeFunction: 'locate',
				tenseFocus: 'present',
			},
			17
		),
	},
	{
		id: 'master-bedroom',
		title: 'Master Bedroom',
		italianTitle: 'La camera principale',
		theme: 'Sleep and daily routines',
		domain: 'home',
		zone: 'Private floor',
		anchors: anchors(
			{
				id: 'going-to-bed',
				label: 'Bedtime',
				italian: 'Sono stanco, vado a letto.',
				english: 'I’m tired, I’m going to bed.',
				situation: 'Explain that you are tired and are going to bed.',
				acceptedItalian: ['Sono stanco e vado a letto.'],
				communicativeFunction: 'give-reason',
				tenseFocus: 'present',
			},
			{
				id: 'what-time-up',
				label: 'Getting up',
				italian: 'A che ora ti alzi?',
				english: 'What time do you get up?',
				situation: 'Ask someone what time they get up.',
				acceptedItalian: ['Tu a che ora ti alzi?'],
				communicativeFunction: 'ask-back',
				tenseFocus: 'present',
			},
			18
		),
	},
	{
		id: 'dressing-room',
		title: 'Dressing Room',
		italianTitle: 'La cabina armadio',
		theme: 'Clothes and colours',
		domain: 'shopping',
		zone: 'Private floor',
		anchors: anchors(
			{
				id: 'blue-jacket',
				label: 'The blue jacket',
				italian: 'Metto la giacca blu.',
				english: 'I’m putting on the blue jacket.',
				situation: 'Say that you are putting on the blue jacket.',
				acceptedItalian: ['Mi metto la giacca blu.', 'Indosso la giacca blu.'],
				communicativeFunction: 'narrate',
				tenseFocus: 'present',
			},
			{
				id: 'shoes-suit',
				label: 'The shoes',
				italian: 'Queste scarpe mi stanno bene?',
				english: 'Do these shoes suit me?',
				situation: 'Ask whether these shoes suit you.',
				acceptedItalian: ['Mi stanno bene queste scarpe?'],
				communicativeFunction: 'ask-back',
				tenseFocus: 'present',
			},
			19
		),
	},
	{
		id: 'peloton-room',
		title: 'Peloton Room',
		italianTitle: 'La palestra',
		theme: 'Sport and frequency',
		domain: 'sport',
		zone: 'Private floor',
		anchors: anchors(
			{
				id: 'three-times-week',
				label: 'Three times',
				italian: 'Mi alleno tre volte alla settimana.',
				english: 'I train three times a week.',
				situation: 'Say how often you train each week.',
				acceptedItalian: ['Mi alleno tre volte a settimana.'],
				communicativeFunction: 'narrate',
				tenseFocus: 'present',
			},
			{
				id: 'need-break',
				label: 'A break',
				italian: 'Ho bisogno di una pausa.',
				english: 'I need a break.',
				situation: 'Say that you need a break.',
				acceptedItalian: ['Mi serve una pausa.', 'Devo fare una pausa.'],
				communicativeFunction: 'request',
				tenseFocus: 'present',
			},
			20
		),
	},
	{
		id: 'main-bathroom',
		title: 'Main Bathroom',
		italianTitle: 'Il bagno principale',
		theme: 'Body, health and reflexive verbs',
		domain: 'health',
		zone: 'Private floor',
		anchors: anchors(
			{
				id: 'brush-teeth',
				label: 'Teeth',
				italian: 'Mi lavo i denti.',
				english: 'I brush my teeth.',
				situation: 'Describe brushing your teeth.',
				acceptedItalian: ['Mi sto lavando i denti.'],
				communicativeFunction: 'narrate',
				tenseFocus: 'present',
			},
			{
				id: 'back-hurts',
				label: 'The back',
				italian: 'Mi fa male la schiena.',
				english: 'My back hurts.',
				situation: 'Explain that your back hurts.',
				acceptedItalian: ['Ho mal di schiena.'],
				communicativeFunction: 'narrate',
				tenseFocus: 'present',
			},
			21
		),
	},
	{
		id: 'nanny-nards-room',
		title: 'Nanny Nard’s Room',
		italianTitle: 'La camera di Nanny Nard',
		theme: 'Care and offering help',
		domain: 'family',
		zone: 'Private floor',
		anchors: anchors(
			{
				id: 'bring-tea',
				label: 'A cup of tea',
				italian: 'Le porto una tazza di tè.',
				english: 'I’ll bring her a cup of tea.',
				situation: 'Say that you will bring her a cup of tea.',
				acceptedItalian: ['Le porterò una tazza di tè.', 'Porto a lei una tazza di tè.'],
				communicativeFunction: 'offer',
				tenseFocus: 'present',
			},
			{
				id: 'need-anything',
				label: 'Offer help',
				italian: 'Hai bisogno di qualcosa?',
				english: 'Do you need anything?',
				situation: 'Ask whether she needs anything.',
				acceptedItalian: ['Ti serve qualcosa?', 'Vuoi qualcosa?'],
				communicativeFunction: 'offer',
				tenseFocus: 'present',
			},
			22
		),
	},
	{
		id: 'ensuite',
		title: 'Ensuite',
		italianTitle: 'Il bagno privato',
		theme: 'Personal care and position',
		domain: 'health',
		zone: 'Private floor',
		anchors: anchors(
			{
				id: 'quick-shower',
				label: 'A quick shower',
				italian: 'Faccio una doccia veloce.',
				english: 'I’m having a quick shower.',
				situation: 'Say that you are having a quick shower.',
				acceptedItalian: ['Mi faccio una doccia veloce.'],
				communicativeFunction: 'narrate',
				tenseFocus: 'present',
			},
			{
				id: 'towel-behind-door',
				label: 'The towel',
				italian: 'L’asciugamano è dietro la porta.',
				english: 'The towel is behind the door.',
				situation: 'Tell someone where the towel is.',
				acceptedItalian: ["L'asciugamano è dietro la porta."],
				communicativeFunction: 'locate',
				tenseFocus: 'present',
			},
			23
		),
	},
]

export type MemoryAnchorRef = {
	roomIndex: number
	anchorIndex: number
	room: MemoryRoom
	anchor: MemoryAnchor
}

export const memoryAnchorRefs: MemoryAnchorRef[] = memoryRooms.flatMap(
	(room, roomIndex) =>
		room.anchors.map((anchor, anchorIndex) => ({
			roomIndex,
			anchorIndex,
			room,
			anchor,
		}))
)

export function memoryExerciseId(roomId: string, anchorId: string) {
	return `memory-house:${roomId}:${anchorId}`
}

export function memoryCueForLevel(anchor: MemoryAnchor, level: CefrLevel) {
	return level === 'A1' || level === 'A2' ? anchor.english : anchor.situation
}

function difficultyForLevel(level: CefrLevel): ExerciseDifficulty {
	if (level === 'A1') return 1
	if (level === 'A2') return 2
	if (level === 'B1') return 3
	if (level === 'B2') return 4
	return 5
}

export function memoryAnchorExercise(
	room: MemoryRoom,
	anchor: MemoryAnchor,
	level: CefrLevel
): Exercise {
	return {
		id: memoryExerciseId(room.id, anchor.id),
		type: 'sentence',
		sceneId: `memory-house-${room.id}`,
		promptEnglish: memoryCueForLevel(anchor, level),
		targetItalian: anchor.italian,
		acceptedItalian: [anchor.italian, ...anchor.acceptedItalian],
		hints: [anchor.label, anchor.italian.split(/\s+/).slice(0, 2).join(' ')],
		tags: ['memory-house', room.theme.toLowerCase(), anchor.tenseFocus],
		phraseFamily: `Memory House: ${room.title}`,
		difficulty: difficultyForLevel(level),
		cefrLevel: level,
		phase: 'produce',
		action: actionForFunction(anchor.communicativeFunction),
		communicativeGoal: anchor.situation,
		spokenCue: anchor.situation,
		repairPrompts: [anchor.english, anchor.situation],
		strand: 'output',
		roundFocus: 'topics',
		construction: anchor.tenseFocus,
		frameId: `memory-${room.id}-${anchor.id}`,
		tenseFocus: anchor.tenseFocus,
		vocabDomain: room.domain,
		communicativeFunction: anchor.communicativeFunction,
		maxWords: 10,
		utilityScore: 95,
	}
}

export type MemoryAnchorStatus = 'new' | 'due' | 'learning' | 'strong'

export function memoryStatus(
	state: ExerciseState | undefined,
	now = Date.now()
): MemoryAnchorStatus {
	if (!state || state.correctCount + state.wrongCount === 0) return 'new'
	if (state.nextDueAt && new Date(state.nextDueAt).getTime() <= now) return 'due'
	if (state.correctCount >= 3 && state.intervalDays >= 7) return 'strong'
	return 'learning'
}

const memoryIntervals = [1, 3, 7, 14, 30, 60, 90]

export function scheduleMemoryAnchorReview(
	state: ExerciseState,
	communicative: boolean,
	now = new Date()
): ExerciseState {
	const intervalDays = communicative
		? memoryIntervals[Math.min(Math.max(0, state.correctCount - 1), memoryIntervals.length - 1)]
		: 0
	return {
		...state,
		intervalDays,
		nextDueAt: new Date(now.getTime() + intervalDays * 24 * 60 * 60 * 1000).toISOString(),
		archived: state.correctCount >= 7 && intervalDays >= 90 ? 1 : 0,
	}
}

export function dueMemoryAnchors(
	states: Map<string, ExerciseState>,
	now = Date.now()
) {
	return memoryAnchorRefs.filter(({ room, anchor }) => {
		const state = states.get(memoryExerciseId(room.id, anchor.id))
		return memoryStatus(state, now) === 'due'
	})
}

export function atlasPosition(index: number) {
	return {
		column: index % 6,
		row: Math.floor(index / 6),
	}
}

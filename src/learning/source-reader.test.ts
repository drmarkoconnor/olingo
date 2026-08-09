import { describe, expect, it } from 'vitest'
import {
	extractArticleJson,
	extractArticleText,
} from '../../netlify/functions/source-reader'

describe('newspaper source extraction', () => {
	it('prefers structured article text over page chrome', () => {
		const html = `
			<html>
				<head>
					<meta property="og:description" content="A shorter description that should not win." />
					<script type="application/ld+json">
						{
							"@type": "NewsArticle",
							"articleBody": "Milano apre una nuova biblioteca di quartiere. Lo spazio offre libri, incontri e attivita per le famiglie della zona.",
							"description": "Una biblioteca apre a Milano."
						}
					</script>
				</head>
				<body><nav>Unrelated navigation</nav></body>
			</html>
		`

		expect(extractArticleText(html)).toContain('Milano apre una nuova biblioteca')
		expect(extractArticleText(html)).not.toContain('Unrelated navigation')
		expect(extractArticleText(html)).not.toContain('should not win')
	})

	it('uses the page description when structured article text is unavailable', () => {
		const description =
			'La squadra prepara la partita di domenica e invita i tifosi a raggiungere lo stadio con i mezzi pubblici.'
		const html = `<meta name="description" content="${description}">`

		expect(extractArticleText(html)).toBe(description)
	})

	it('extracts article content from a JSON news response', () => {
		const content =
			'Il museo prolunga gli orari durante il fine settimana. I visitatori possono entrare fino alle dieci di sera e partecipare a visite guidate.'

		expect(extractArticleJson({ data: { content } })).toBe(content)
	})
})

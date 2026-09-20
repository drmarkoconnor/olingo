import type { CefrLevel } from '@/learning/content'
import type { CourseAttempt } from '@/learning/course-progress'
import { conversationGarden, type ConversationGardenStage } from '@/learning/conversation-guidance'
import './conversation-garden.css'

function Plant({ stage }: { stage: ConversationGardenStage }) {
  const grown = stage !== 'roots'
  return <svg className={`conversation-garden__plant conversation-garden__plant--${stage}`} viewBox="0 0 100 108" aria-hidden="true" focusable="false">
    <ellipse className="conversation-garden__soil" cx="50" cy="89" rx="34" ry="9" />
    <path className="conversation-garden__root" d="M50 85v15m0-9-10 7m10-5 11 6" />
    <path className="conversation-garden__stem" d={grown ? 'M50 86V36' : 'M50 86V69'} />
    <path className="conversation-garden__leaf" d={grown ? 'M50 66C29 69 23 56 25 50c17 0 26 6 25 16Z' : 'M50 75C39 78 34 70 36 65c10 0 15 4 14 10Z'} />
    <path className="conversation-garden__leaf" d={grown ? 'M50 54C70 55 78 43 74 36c-17 1-25 8-24 18Z' : 'M50 69C61 72 67 63 64 59c-10 1-15 4-14 10Z'} />
    {stage === 'established' && <>
      <path className="conversation-garden__leaf" d="M50 43C33 43 29 31 33 26c12 1 18 7 17 17Z" />
      <path className="conversation-garden__stem" d="M50 37V23" />
      <g className="conversation-garden__flower"><ellipse cx="50" cy="13" rx="7" ry="10" /><ellipse cx="40" cy="22" rx="10" ry="7" /><ellipse cx="60" cy="22" rx="10" ry="7" /><ellipse cx="50" cy="30" rx="7" ry="10" /><circle className="conversation-garden__flower-centre" cx="50" cy="22" r="6" /></g>
    </>}
  </svg>
}

export default function ConversationGarden({ level, attempts, onChooseLesson, now = new Date() }: {
  level: CefrLevel
  attempts: CourseAttempt[]
  onChooseLesson?: (lessonId: string) => void
  now?: Date | string
}) {
  const garden = conversationGarden(level, attempts, now)
  return <section className="conversation-garden" aria-label={`${level} conversation garden`}>
    <header className="conversation-garden__heading"><div><p className="conversation-garden__eyebrow">Your {level} garden</p><h3>Language grows with use.</h3></div><p>{garden.establishedCount} of 12 areas with delayed spoken evidence{garden.reviewCount > 0 ? ` · ${garden.reviewCount} ready for attention` : ''}</p></header>
    <p className="conversation-garden__intro">Each bed is an area of conversation. Choose one to practise; a review marker is an invitation to return, never lost progress.</p>
    <ul className="conversation-garden__beds">
      {garden.beds.map(bed => <li key={bed.strandId}>
        {onChooseLesson ? <button type="button" className="conversation-garden__bed" onClick={() => onChooseLesson(bed.lessonId)} aria-label={`${bed.title}. ${bed.stageLabel}.${bed.reviewNeeded ? ' Ready for review.' : ''} Practise this area.`}>
          <Plant stage={bed.stage} /><span className="conversation-garden__name">{bed.title}</span><span className="conversation-garden__stage">{bed.stageLabel}</span>{bed.reviewNeeded && <span className="conversation-garden__review">↻ {bed.reviewDue ? 'Review due' : 'A little tending'}</span>}
        </button> : <div className="conversation-garden__bed"><Plant stage={bed.stage} /><span className="conversation-garden__name">{bed.title}</span><span className="conversation-garden__stage">{bed.stageLabel}</span>{bed.reviewNeeded && <span className="conversation-garden__review">↻ {bed.reviewDue ? 'Review due' : 'A little tending'}</span>}</div>}
        <details className="conversation-garden__evidence"><summary>Growth evidence</summary><p>{bed.evidenceLabel}</p>{bed.reviewReason && <p>{bed.reviewReason}</p>}</details>
      </li>)}
    </ul>
    <dl className="conversation-garden__legend"><div><dt>Roots</dt><dd>Ready to explore, or early practice.</dd></div><div><dt>Growing</dt><dd>Successful unassisted speech is taking shape.</dd></div><div><dt>Established</dt><dd>All goals retrieved in changed situations and on separate days.</dd></div></dl>
    <p className="conversation-garden__note">{garden.note}</p>
  </section>
}

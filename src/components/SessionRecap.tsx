import { Link } from 'react-router-dom'
import { conversationRecap, type ConversationRecap } from '@/learning/conversation-guidance'
import { useLearningHistory } from './LearningHistory'

export function RecapDetails({ recap }: { recap: ConversationRecap }) {
 return <>
  <p className="eyebrow">Your last conversation · {new Date(recap.atISO).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</p>
  <h3>{recap.title}</h3>
  <p>{recap.level} · {recap.completed ? 'Episode completed' : `${recap.answered} of ${recap.totalTurns} turns answered`} · {recap.spoken} recorded answers.</p>
  {recap.acceptedPoints.length > 0 && <><p><strong>What worked</strong></p><ul>{recap.acceptedPoints.map(point => <li lang="it" key={point}>{point}</li>)}</ul></>}
  <p><strong>Carry forward</strong></p><ul>{recap.targets.map(target => <li key={target}>{target}</li>)}</ul>
 </>
}
export default function SessionRecap() {
 const { attempts, documents, ready } = useLearningHistory()
 const runTitles = Object.fromEntries(documents.filter(item => item.kind === 'run' && typeof item.payload.title === 'string').map(item => [item.id, item.payload.title as string]))
 const recap = conversationRecap(attempts, { runTitles })
 if (!ready || !recap) return null
 return <section className="course-recommendation"><RecapDetails recap={recap} /><Link className="btn btn-primary" to="/conversations">Continue my conversation pathway</Link></section>
}

import { apiFetch } from '@/lib/api'
import { courseLessons } from './conversation-course'
import type { CourseTurn } from './conversation-course'
import type { GeneratedConversationEpisode, GeneratedConversationTurn, GenerateConversationRequest, GenerateConversationResponse } from './generated-conversation'

export function isConversationEpisode(value: unknown): value is GeneratedConversationEpisode {
 if (!value || typeof value !== 'object') return false
 const episode = value as GeneratedConversationEpisode
 const lesson = courseLessons.find(item => item.id === episode.lessonId)
 return Boolean(lesson && episode.level === lesson.level && typeof episode.id === 'string' && typeof episode.title === 'string' && typeof episode.context === 'string' &&
  Array.isArray(episode.turns) && episode.turns.length === 3 && episode.turns.every((turn, index) => validTurn(turn, lesson.turns[index].id)))
}
function validTurn(value: unknown, id: string): value is GeneratedConversationTurn {
 if (!value || typeof value !== 'object') return false
 const turn = value as GeneratedConversationTurn
 return turn.id === id && ['npcLine', 'instruction', 'example', 'hint'].every(key => typeof turn[key as keyof GeneratedConversationTurn] === 'string' && Boolean(turn[key as keyof GeneratedConversationTurn].trim()))
}
export async function generateConversation(body: GenerateConversationRequest, userId: string): Promise<GenerateConversationResponse> {
 if (!userId) throw new Error('Sign in before generating a conversation.')
 const controller = new AbortController()
 const timeout = setTimeout(() => controller.abort(), 55_000)
 try {
  const response = await apiFetch('/api/generate-conversation', { method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json', 'X-Olingo-User': userId }, body: JSON.stringify(body) })
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new Error(data?.error || 'A fresh conversation could not be prepared. Retry, or choose an authored episode.')
  if (data?.provider !== 'openai') throw new Error('The conversation response could not be verified.')
  if (body.mode === 'episode' && isConversationEpisode(data.episode) && data.episode.lessonId === body.lessonId) return data
  const lesson = courseLessons.find(item => item.id === body.lessonId)
  if (body.mode === 'next-turn' && lesson && body.turnIndex && data.episodeId === body.episodeId && data.lessonId === body.lessonId && validTurn(data.turn, lesson.turns[body.turnIndex].id)) return data
  throw new Error('The conversation was incomplete. Retry, or use an authored episode.')
 } catch (cause) {
  if (cause instanceof Error && cause.name === 'AbortError') throw new Error('Preparing the conversation took too long. Your current answer is saved; retry when ready.')
  throw cause
 } finally { clearTimeout(timeout) }
}
export function generatedCourseTurn(episode: GeneratedConversationEpisode, index: number): CourseTurn {
 const turn = episode.turns[index]
 return { ...turn, context: episode.context, transferContext: episode.context, transferInstruction: turn.instruction, transferExample: turn.example }
}

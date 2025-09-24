import { Word } from '@/storage/db';

type Props = {
  card: { word: Word } & Record<string, any>;
  flipped: boolean;
  onFlip: () => void;
};

function posClass(pos?: string){
  if (!pos) return '';
  if (pos.includes('noun')) return 'pos-pill pos-noun';
  if (pos.includes('verb')) return 'pos-pill pos-verb';
  if (pos.includes('adj')) return 'pos-pill pos-adj';
  if (pos.includes('coll')) return 'pos-pill pos-coll';
  return 'pos-pill';
}

export default function Flashcard({ card, flipped, onFlip }: Props){
  const { word } = card;
  return (
    <div className="card" onClick={!flipped ? onFlip : undefined} style={{ cursor: 'pointer' }}>
      <div style={{display:'flex',flexDirection:'column',gap:12, alignItems:'center'}}>
        <div className={posClass(word.pos)}>{word.pos || 'word'}</div>
        {!flipped ? (
          <h2 className="word">{word.italian}</h2>
        ) : (
          <div>
            <h3 className="translation">{word.english}</h3>
            {word.category && <div style={{marginTop:8, color:'#94a3b8'}}>Category: {word.category}</div>}
          </div>
        )}
      </div>
    </div>
  );
}

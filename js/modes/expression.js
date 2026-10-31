// 악상 객관식: 셈여림·빠르기말·헤어핀·아티큘레이션 중 하나를 가리고 고른다.

import { h, shuffle, sample, fragmentBox, noteEl, listenButton, quizFrame, emptyNote } from '../ui.js';

const DYNAMICS = ['ppp', 'pp', 'p', 'mp', 'mf', 'f', 'ff', 'fff', 'sf', 'sfz', 'fp'];
const WEDGE = { crescendo: '크레셴도 ( < )', diminuendo: '디미누엔도 ( > )' };
const ARTICULATION = { staccato: '스타카토', accent: '악센트', tenuto: '테누토', 'strong-accent': '마르카토', staccatissimo: '스타카티시모' };
const WORD_POOL = ['cresc.', 'dim.', 'rit.', 'a tempo', 'leggiero', 'marcato', 'dolce', 'espressivo', 'Presto', 'Allegro', 'Più mosso', 'Meno mosso'];
const IGNORED_WORDS = /cambio/i;

const quizzable = (mk) => {
  if (mk.kind === 'words') return !IGNORED_WORDS.test(mk.value);
  if (mk.kind === 'articulation') return mk.value in ARTICULATION;
  return true;
};

const labelOf = (mk) => {
  if (mk.kind === 'wedge') return WEDGE[mk.value];
  if (mk.kind === 'articulation') return ARTICULATION[mk.value];
  return mk.value;
};

function options(score, mk) {
  let pool;
  if (mk.kind === 'dynamics') {
    const i = DYNAMICS.indexOf(mk.value);
    const near = DYNAMICS.filter((d) => d !== mk.value).sort((x, y) => Math.abs(DYNAMICS.indexOf(x) - i) - Math.abs(DYNAMICS.indexOf(y) - i));
    pool = shuffle(near.slice(0, 5));
  } else if (mk.kind === 'wedge') {
    return shuffle([WEDGE.crescendo, WEDGE.diminuendo, 'sf', '표시 없음']);
  } else if (mk.kind === 'articulation') {
    pool = shuffle(Object.values(ARTICULATION).filter((v) => v !== ARTICULATION[mk.value]));
  } else {
    const fromPiece = new Set(score.measures.flatMap((m) => m.marks).filter((x) => x.kind === 'words' && !IGNORED_WORDS.test(x.value)).map((x) => x.value));
    fromPiece.delete(mk.value);
    pool = [...shuffle([...fromPiece]), ...shuffle(WORD_POOL.filter((w) => w !== mk.value && !fromPiece.has(w)))];
  }
  return shuffle([labelOf(mk), ...pool.slice(0, 3)]);
}

function blankMark(doc, mk) {
  const el = doc.querySelector(`[data-mid="${mk.mid}"]`);
  if (!el) return;
  if (mk.kind === 'articulation') {
    const list = el.parentElement;
    el.remove();
    if (!list.children.length) list.remove();
    return;
  }
  for (const dt of [...el.children].filter((c) => c.tagName === 'direction-type')) dt.remove();
  const dt = doc.createElement('direction-type');
  const words = doc.createElement('words');
  words.textContent = '?';
  dt.append(words);
  el.insertBefore(dt, el.firstChild);
  el.querySelector('sound')?.remove();
}

export function mountExpression(root, ctx) {
  const score = ctx.score;
  const { from, to } = ctx.range();

  const inRange = [];
  for (let i = from; i <= to; i++) inRange.push(...score.measures[i].marks.filter(quizzable));
  if (!inRange.length) {
    emptyNote(root, '이 구간에는 악상 기호가 없습니다. 연습 구간을 넓혀 주세요.');
    return;
  }

  // 종류를 먼저 골라 아티큘레이션만 나오는 일을 막고, 그 안에서 약한 마디를 우선한다.
  const kind = sample([...new Set(inRange.map((x) => x.kind))]);
  const ofKind = inRange.filter((x) => x.kind === kind);
  const weights = ofKind.map((x) => ctx.progress.weight(x.m));
  let r = Math.random() * weights.reduce((p, c) => p + c, 0);
  const mk = ofKind.find((_, i) => (r -= weights[i]) <= 0) ?? ofKind[0];

  const pad = matchMedia('(max-width: 720px)').matches ? 0 : 1;
  const a = Math.max(from, mk.m - pad);
  const b = Math.min(to, mk.m + pad);
  const answer = labelOf(mk);

  const ui = quizFrame(root, ctx, {
    title: '악상 고르기',
    prompt: mk.kind === 'articulation'
      ? '빨간 음표에 붙어야 할 아티큘레이션은 무엇일까요?'
      : '빨간 ? 자리에 들어갈 악상은 무엇일까요?',
  });

  const sheetHolder = h('div', {});
  const sheet = fragmentBox(score, a, b, { scale: 46, transform: (doc) => blankMark(doc, mk) });
  sheetHolder.append(sheet);
  ui.body.append(sheetHolder);

  requestAnimationFrame(() => {
    if (mk.kind === 'articulation') noteEl(sheet, mk.noteId)?.classList.add('mark-target');
    for (const t of sheet.querySelectorAll('text')) {
      if (t.textContent.trim() === '?') t.classList.add('q-mark');
    }
  });

  const choices = h('div', { class: 'choices', role: 'group' });
  for (const text of options(score, mk)) {
    const btn = h('button', {
      class: 'choice',
      onClick: () => {
        const ok = text === answer;
        for (const c of choices.children) {
          c.disabled = true;
          if (c.textContent === answer) c.classList.add('right');
        }
        if (!ok) btn.classList.add('wrong');
        ctx.progress.record(mk.m, ok ? 1 : 0);
        ui.say(`${ok ? '정답입니다.' : '아쉽습니다.'} ${score.measures[mk.m].number}마디의 악상은 ${answer}입니다.`, ok ? 'good' : 'bad');
        const original = fragmentBox(score, a, b, { scale: 46 });
        if (mk.kind === 'articulation') requestAnimationFrame(() => noteEl(original, mk.noteId)?.classList.add('mark-right'));
        sheetHolder.replaceChildren(original);
        ui.actions.replaceChildren(ui.nextButton(), listenButton(score, a, b, '▶ 이 구간 듣기'));
      },
    }, text);
    choices.append(btn);
  }
  ui.body.append(choices);
  ui.actions.append(listenButton(score, a, b, '▶ 듣기'));
}

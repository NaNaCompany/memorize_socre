// 한 손 악보를 보여 주고, 짝이 되는 반대 손을 4지선다로 고른다.

import { h, shuffle, fragmentBox, quizFrame, segmented, emptyNote } from '../ui.js';
import { playRange } from '../audio.js';

const NAME = { 1: '오른손', 2: '왼손' };

const handSig = (m, hand) => m.notes.filter((n) => !n.rest && n.hand === hand).map((n) => `${n.pos.toFixed(3)}:${n.midi}`).sort().join('|');
const hasBoth = (m) => handSig(m, 1) && handSig(m, 2);

export function mountHands(root, ctx) {
  const score = ctx.score;
  const { from, to } = ctx.range();
  const dir = ctx.prefs['hands.dir'] ?? 'rl';
  const show = dir === 'rl' ? 1 : 2;
  const pick = show === 1 ? 2 : 1;

  let target = -1;
  for (let tries = 0; tries < 30 && target < 0; tries++) {
    const i = ctx.progress.pickStart(from, to, 1);
    if (hasBoth(score.measures[i])) target = i;
  }
  if (target < 0) {
    emptyNote(root, '이 구간에는 양손이 모두 있는 마디가 없습니다. 연습 구간을 넓혀 주세요.');
    return;
  }

  // 보기: 정답 마디의 반대 손 하나와, 곡 전체에서 임의로 뽑은 서로 다른 세 마디의 반대 손.
  const answerSig = handSig(score.measures[target], pick);
  const seen = new Set([answerSig]);
  const others = [];
  for (const m of shuffle(score.measures.map((_, i) => i))) {
    const sig = handSig(score.measures[m], pick);
    if (!sig || seen.has(sig) || !handSig(score.measures[m], show)) continue;
    seen.add(sig);
    others.push(m);
    if (others.length === 3) break;
  }
  if (others.length < 3) {
    emptyNote(root, '보기를 만들 만큼 서로 다른 마디가 곡에 없습니다.');
    return;
  }

  const ui = quizFrame(root, ctx, {
    title: '짝이 되는 손 고르기',
    prompt: `${NAME[show]} 악보입니다. 이 마디와 함께 연주되는 ${NAME[pick]}은 어느 것일까요?`,
    controls: segmented([['rl', '오른손 → 왼손'], ['lr', '왼손 → 오른손']], dir, (v) => {
      ctx.setPref('hands.dir', v);
      ctx.next();
    }),
  });

  const question = h('div', { class: 'stem-sheet' }, fragmentBox(score, target, target, { scale: 44, hand: show, noTime: true }));
  ui.body.append(question);

  const grid = h('div', { class: 'sheet-choices compact' });
  shuffle([target, ...others]).forEach((m, i) => {
    const btn = h('button', {
      class: 'sheet-choice', 'aria-label': `${i + 1}번 보기`, 'data-measure': m,
      onClick: () => {
        const ok = m === target || handSig(score.measures[m], pick) === answerSig;
        for (const c of grid.children) {
          c.disabled = true;
          if (handSig(score.measures[+c.dataset.measure], pick) === answerSig) c.classList.add('right');
        }
        if (!ok) btn.classList.add('wrong');
        ctx.progress.record(target, ok ? 1 : 0);
        ui.say(`${ok ? '정답입니다.' : '아쉽습니다.'} ${score.measures[target].number}마디의 ${NAME[pick]}입니다.`, ok ? 'good' : 'bad');
        question.replaceChildren(fragmentBox(score, target, target, { scale: 44 }));
        ui.actions.replaceChildren(ui.nextButton(), listen('▶ 양손 듣기', {}));
      },
    }, h('span', { class: 'choice-num' }, i + 1), fragmentBox(score, m, m, { scale: 34, hand: pick, noTime: true }));
    grid.append(btn);
  });
  ui.body.append(grid);

  function listen(label, mute) {
    const btn = h('button', {
      class: 'btn ghost',
      onClick: () => {
        btn.classList.add('on');
        playRange(score, target, target, { speed: 0.85, mute, onEnd: () => btn.classList.remove('on') });
      },
    }, label);
    return btn;
  }
  ui.actions.append(listen(`▶ ${NAME[show]}만 듣기`, { [pick]: true }));
}

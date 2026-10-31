// 음표 빈칸: 가려진 자리의 음을 건반으로 답한다. 그 자리에 화음이 있으면 화음 전체를 가리고 모든 음을 고른다.

import { h, shuffle, fragmentBox, blankNote, hideBlankedLedgers, revealNote, pianoKeys, listenButton, quizFrame, segmented, emptyNote } from '../ui.js';

const bare = (name) => name.replace(/-?\d+$/, '');

// 같은 시각·같은 오선·같은 성부의 음 묶음이 한 칸이다. 붙임줄이 걸린 칸은 빼고, 너무 큰 화음도 뺀다.
function slotsOf(measure) {
  const groups = new Map();
  for (const n of measure.notes) {
    if (n.rest || n.grace) continue;
    const key = `${n.part}:${n.staff}:${n.voice}:${n.q.toFixed(4)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(n);
  }
  return [...groups.values()]
    .filter((g) => g.every((n) => !n.tieStart && !n.tieStop))
    .map((notes) => {
      const byPc = new Map();
      for (const n of notes) if (!byPc.has(n.midi % 12)) byPc.set(n.midi % 12, bare(n.name));
      return { notes, q: notes[0].q, pcs: [...byPc.keys()], names: byPc };
    })
    .filter((s) => s.pcs.length <= 6);
}

export function mountBlank(root, ctx) {
  const score = ctx.score;
  const { from, to } = ctx.range();
  const howMany = ctx.prefs['blank.count'] ?? 1;

  let target = -1;
  let pool = [];
  for (let tries = 0; tries < 30 && pool.length < howMany; tries++) {
    target = ctx.progress.pickStart(from, to, 1);
    pool = slotsOf(score.measures[target]);
  }
  if (pool.length < howMany) {
    emptyNote(root, '이 구간에는 가릴 수 있는 음표가 부족합니다. 연습 구간을 넓혀 주세요.');
    return;
  }

  // 여러 칸이면 서로 다른 박에서 고른다.
  const picked = [];
  for (const s of shuffle(pool)) {
    if (picked.every((p) => p.q !== s.q)) picked.push(s);
    if (picked.length === howMany) break;
  }
  for (const s of shuffle(pool)) {
    if (picked.length === howMany) break;
    if (!picked.includes(s)) picked.push(s);
  }
  picked.sort((a, b) => a.q - b.q || a.notes[0].hand - b.notes[0].hand);

  // 좁은 화면에서는 앞뒤 마디를 빼고 음표를 크게 보여 준다.
  const pad = matchMedia('(max-width: 720px)').matches ? 0 : 1;
  const a = Math.max(from, target - pad);
  const b = Math.min(to, target + pad);

  const ui = quizFrame(root, ctx, {
    title: '음표 빈칸',
    prompt: '',
    controls: segmented([[1, '1칸'], [2, '2칸']], howMany, (v) => {
      ctx.setPref('blank.count', v);
      ctx.next();
    }),
  });

  const sheet = fragmentBox(score, a, b, { scale: 46 });
  ui.body.append(sheet);

  const midis = picked.flatMap((s) => s.notes.map((n) => n.midi));
  let low = Math.max(21, Math.min(...midis) - 4 - Math.floor(Math.random() * 5));
  let high = Math.min(108, Math.max(...midis) + 4 + Math.floor(Math.random() * 5));
  if (high - low < 15) high = Math.min(108, low + 15);
  if (high - low < 15) low = Math.max(21, high - 15);

  let index = 0;
  let total = 0;
  const log = [];
  const markers = [];
  const chosen = new Map(); // 음이름 번호 → 누른 건반

  const confirm = h('button', { class: 'btn primary', disabled: true, onClick: () => submit() }, '확인');

  function setPrompt() {
    const slot = picked[index];
    const n = slot.pcs.length;
    const doubled = slot.notes.length > n ? ' 옥타브로 겹친 음은 하나로 셉니다.' : '';
    ui.promptEl.textContent = n === 1
      ? '? 자리에 들어갈 음을 건반에서 누르세요. 음 이름만 맞으면 정답이고, 옥타브는 달라도 됩니다.'
      : `? 자리에는 화음이 들어 있습니다. ${n}개 음을 모두 눌러 고른 뒤 확인을 누르세요.${doubled} 다시 누르면 선택이 풀리고, 옥타브는 상관없습니다.`;
    confirm.hidden = n === 1;
    confirm.disabled = true;
    confirm.textContent = `확인 (0/${n})`;
  }

  const piano = pianoKeys(low, high, (midi, key) => {
    if (index >= picked.length) return;
    const pc = midi % 12;
    const n = picked[index].pcs.length;
    if (n === 1) {
      chosen.clear();
      chosen.set(pc, key);
      submit();
      return;
    }
    if (chosen.get(pc) === key) {
      chosen.delete(pc);
      key.classList.remove('picked');
    } else {
      chosen.get(pc)?.classList.remove('picked');
      chosen.set(pc, key);
      key.classList.add('picked');
    }
    confirm.disabled = chosen.size !== n;
    confirm.textContent = `확인 (${chosen.size}/${n})`;
  });

  function submit() {
    const slot = picked[index];
    const expected = new Set(slot.pcs);
    const hit = [...chosen.keys()].filter((pc) => expected.has(pc));
    const miss = [...chosen.keys()].filter((pc) => !expected.has(pc));
    const value = Math.max(0, (hit.length - miss.length) / expected.size);
    for (const [pc, key] of chosen) {
      key.classList.remove('picked');
      key.classList.add(expected.has(pc) ? 'right' : 'wrong');
    }
    for (const n of slot.notes) {
      if (!chosen.has(n.midi % 12)) piano.querySelector(`[data-midi="${n.midi}"]`)?.classList.add('answer');
      revealNote(sheet, n.id, chosen.has(n.midi % 12) ? 'mark-right' : 'mark-wrong');
    }
    markers[index]?.remove();
    total += value;
    const label = picked.length > 1 ? `${index + 1}번: ` : '';
    const answer = slot.pcs.map((pc) => slot.names.get(pc)).join(' ');
    log.push(`${label}${value === 1 ? `${answer} 정답` : `정답은 ${answer}`}`);
    chosen.clear();
    index++;
    if (index === picked.length) {
      finish();
      return;
    }
    ui.say(`${log.join(' · ')} · 다음 칸을 답하세요.`, value === 1 ? 'good' : 'bad');
    markers[index]?.classList.add('current');
    setPrompt();
    setTimeout(() => {
      for (const el of piano.querySelectorAll('.right,.wrong,.answer')) el.classList.remove('right', 'wrong', 'answer');
    }, 900);
  }

  function finish() {
    const value = total / picked.length;
    ctx.progress.record(target, value);
    confirm.hidden = true;
    ui.say(`${log.join(' · ')} (${score.measures[target].number}마디)`, value === 1 ? 'good' : 'bad');
    ui.actions.replaceChildren(ui.nextButton(), listenButton(score, a, b, '▶ 이 구간 듣기'));
  }

  ui.body.append(piano);
  ui.actions.append(confirm, listenButton(score, a, b, '▶ 소리 힌트'));
  setPrompt();

  // 그려진 뒤에야 위치를 잴 수 있다.
  requestAnimationFrame(() => {
    picked.forEach((slot, i) => {
      const n = slot.pcs.length;
      const text = `${picked.length > 1 ? `${i + 1}` : '?'}${n > 1 ? `×${n}` : ''}`;
      slot.notes.forEach((note, k) => {
        const marker = blankNote(sheet, note.id, k === 0 ? text : undefined);
        if (k === 0) markers[i] = marker;
      });
    });
    hideBlankedLedgers(sheet);
    markers[0]?.classList.add('current');
    if (!markers.every(Boolean)) ui.say('일부 음표 위치를 찾지 못했습니다. 다음 문제로 넘어가 주세요.', 'bad');
  });
}

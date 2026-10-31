// 진도: 마디별 숙련도 지도와 구간별 요약.

import { h } from '../ui.js';

const color = (s) => (s === null ? 'var(--line)' : `hsl(${Math.round(s * 130)} 58% ${s > 0.5 ? 40 : 48}%)`);

export function mountDashboard(root, ctx) {
  const { score, progress } = ctx;
  const st = progress.stats();
  root.replaceChildren();

  const stat = (value, label) => h('div', { class: 'stat' }, h('b', {}, value), h('span', {}, label));
  const grid = h('div', { class: 'heatmap', role: 'list' });
  score.measures.forEach((m, i) => {
    const s = progress.mastery(i);
    grid.append(h('button', {
      // 노란빛이 도는 중간 숙련도에서는 흰 글자가 안 보여 어두운 글자로 바꾼다.
      class: 'cell', style: `background:${color(s)};${s === null ? '' : `color:${s > 0.38 && s < 0.72 ? '#1f2a0c' : '#fff'}`}`, role: 'listitem',
      title: s === null ? `${m.number}마디: 아직 안 풀었음` : `${m.number}마디: 숙련도 ${Math.round(s * 100)}%`,
      onClick: () => ctx.open('view', { measure: i }),
    }, m.number));
  });

  const sections = h('div', { class: 'section-bars' });
  for (const sec of score.sections) {
    let sum = 0;
    for (let i = sec.from; i <= sec.to; i++) sum += progress.mastery(i) ?? 0;
    const avg = sum / (sec.to - sec.from + 1);
    sections.append(h('button', {
      class: 'section-bar',
      onClick: () => { ctx.setRange(sec.from, sec.to); ctx.open('practice'); },
    },
    h('span', {}, `${sec.label}`, h('small', {}, ` ${score.measures[sec.from].number}–${score.measures[sec.to].number}마디`)),
    h('span', { class: 'bar' }, h('i', { style: `width:${Math.round(avg * 100)}%` })),
    h('b', {}, `${Math.round(avg * 100)}%`)));
  }

  root.append(
    h('div', { class: 'quiz-head' }, h('div', {}, h('h2', {}, '진도'), h('p', { class: 'quiz-prompt' }, '기록은 이 브라우저에만 저장됩니다. 마디를 누르면 악보로, 구간을 누르면 그 구간 연습으로 이동합니다.'))),
    h('div', { class: 'stats' },
      stat(`${Math.round(st.avg * 100)}%`, '곡 전체 숙련도'),
      stat(`${st.seen} / ${score.measures.length}`, '풀어 본 마디'),
      stat(`${st.total}`, '푼 문제'),
      stat(`${Math.round(st.accuracy * 100)}%`, '정답률'),
      stat(`${st.streak}일`, '연속 연습'),
      stat(`${st.due}`, '복습할 마디')),
    h('h3', {}, '마디별 숙련도'), grid,
    h('h3', {}, '구간별 숙련도'), sections,
    h('div', { class: 'quiz-actions' }, h('button', {
      class: 'btn danger',
      onClick: () => {
        if (!confirm('이 곡의 진도를 모두 지울까요? 되돌릴 수 없습니다.')) return;
        progress.reset();
        mountDashboard(root, ctx);
      },
    }, '이 곡 진도 초기화')),
  );
}

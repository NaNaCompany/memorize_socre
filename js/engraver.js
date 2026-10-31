// Verovio 래퍼. 구간 조각은 결과를 캐시해 같은 마디를 다시 그리지 않는다.

let tk = null;
const cache = new Map();

export const engraverReady = new Promise((resolve, reject) => {
  const start = () => { tk = new window.verovio.toolkit(); resolve(); };
  if (!window.verovio) { reject(new Error('Verovio를 불러오지 못했습니다.')); return; }
  // 모듈 스크립트가 실행될 때 이미 초기화가 끝났을 수 있다.
  if (window.verovio.module.calledRun) start();
  else window.verovio.module.onRuntimeInitialized = start;
});

const BASE = {
  footer: 'none', header: 'none', svgViewBox: true, svgRemoveXlink: true,
  pageMarginTop: 30, pageMarginBottom: 30, pageMarginLeft: 30, pageMarginRight: 30,
  adjustPageHeight: true, inputFrom: 'musicxml', mnumInterval: 1,
};

export function engraveFragment(xml, { scale = 42, key } = {}) {
  const cacheKey = key && `${key}@${scale}`;
  if (cacheKey && cache.has(cacheKey)) return cache.get(cacheKey);
  // 마디 오른쪽으로 삐져나오는 빠르기말·글자가 잘리지 않게 오른쪽 여백을 넉넉히 둔다.
  tk.setOptions({ ...BASE, pageMarginRight: 90, scale, breaks: 'none', adjustPageWidth: true, pageWidth: 60000, pageHeight: 60000 });
  if (!tk.loadData(xml)) throw new Error('악보를 그리지 못했습니다.');
  const svg = tk.renderToSVG(1);
  if (cacheKey) {
    if (cache.size > 400) cache.clear();
    cache.set(cacheKey, svg);
  }
  return svg;
}

export function engraveAll(xml, { widthPx, scale = 40 }) {
  const pageWidth = Math.max(800, Math.round((widthPx * 100) / scale));
  tk.setOptions({ ...BASE, scale, breaks: 'auto', adjustPageWidth: false, pageWidth, pageHeight: 60000 / 8, spacingSystem: 14 });
  if (!tk.loadData(xml)) throw new Error('악보를 그리지 못했습니다.');
  const pages = [];
  for (let i = 1, n = tk.getPageCount(); i <= n; i++) pages.push(tk.renderToSVG(i));
  return pages;
}

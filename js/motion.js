// Pause animated previews without reading or transmitting score data.
const media = matchMedia('(prefers-reduced-motion: reduce)');
const control = document.getElementById('motion-toggle');
let choice;
try { choice = localStorage.getItem('score-background-paused'); } catch {}
let paused = choice === null || choice === undefined ? media.matches : choice === 'true';
function apply() {
  document.body.classList.toggle('motion-paused', paused);
  document.body.classList.toggle('motion-enabled', !paused);
  control.textContent = paused ? '애니메이션 재생' : '애니메이션 일시정지';
  control.setAttribute('aria-pressed', String(paused));
  for (const image of document.querySelectorAll('img[data-motion-src]')) {
    const src = paused ? image.dataset.stillSrc : image.dataset.motionSrc;
    if (image.getAttribute('src') !== src) image.setAttribute('src', src);
  }
}
control.addEventListener('click', () => {
  paused = !paused;
  choice = String(paused);
  try { localStorage.setItem('score-background-paused', choice); } catch {}
  apply();
});
media.addEventListener('change', () => { if (choice === null || choice === undefined) { paused = media.matches; apply(); } });
new MutationObserver(apply).observe(document.getElementById('main'), {childList:true,subtree:true});
apply();

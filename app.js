// Mountain Villa motion layer. Identity: "the window" (see MOTION.md).
// One scroll engine (GSAP ScrollTrigger), Lenis on fine pointers only, reveals tied to position over short
// bands and reversible, the trigger element never moves, reduced motion = plain render.
import { mountBooking } from '/mountain-villa-preview/booking.js';
const html = document.documentElement;
const readyFailsafe = setTimeout(() => html.classList.add('ready'), 4000);
const { gsap, ScrollTrigger, SplitText, DrawSVGPlugin } = window;
gsap.registerPlugin(ScrollTrigger, SplitText, DrawSVGPlugin);
ScrollTrigger.config({ ignoreMobileResize: true });
gsap.ticker.lagSmoothing(0);

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const touchMQ = matchMedia('(hover: none) and (pointer: coarse)');
const fineMQ = matchMedia('(hover: hover) and (pointer: fine)');
const isTouch = () => touchMQ.matches;
const isFine = () => fineMQ.matches && !touchMQ.matches;
const SCRUB = () => (isTouch() ? 0.35 : true);
const wide = () => innerWidth >= 1024;
const photos = JSON.parse($('#photographs').textContent);
const menu = $('#menu'), menuToggle = $('.menu-toggle'), menuClose = $('.menu-close');
const lightbox = $('#lightbox'), header = $('.site-header'), veil = $('.route-veil'), loader = $('.loader');
let main = $('#main'), context, arrivalTimeline, headerTrigger, pageCleanup = () => {};
let splits = [];
let lenis, lenisTick, scrollGeneration = 0;
let locked = null, overlayTrigger = null, menuWanted = false;
let galleryIndex = 0, gallerySequence = 0, galleryClosing = false;
let navigationSequence = 0, navigationController, navigationPending = false;
let currentKey = history.state?.villaKey || crypto.randomUUID();
const positions = new Map([[currentKey, history.state?.villaY || 0]]);
const pageCache = new Map([[location.pathname, document.documentElement.outerHTML]]);
history.scrollRestoration = 'manual';
history.replaceState({ ...history.state, villaKey: currentKey, villaY: scrollY }, '');
html.classList.toggle('motion-on', !reduced.matches);

// ---------- scrolling ----------
function setScroll(y) {
  if (lenis) {
    // A fixed-body overlay or a route swap can leave the cached limit stale until the observer catches up.
    lenis.resize();
    lenis.scrollTo(y, { immediate: true, force: true });
  } else window.scrollTo({ top: y, behavior: 'instant' });
}
function refresh() {
  if (locked) return; // a fixed body measures the page as one viewport tall
  ScrollTrigger.refresh();
}
async function configureScrolling() {
  const generation = ++scrollGeneration;
  if (lenisTick) gsap.ticker.remove(lenisTick);
  lenis?.destroy(); lenis = null; lenisTick = null;
  if (!isFine() || reduced.matches) return;
  try {
    const { default: Lenis } = await import('/mountain-villa-preview/vendor/lenis.mjs');
    if (generation !== scrollGeneration || !isFine() || reduced.matches) return;
    lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 1.1, smoothWheel: true, syncTouch: false, autoRaf: false, allowNestedScroll: true });
    lenis.on('scroll', ScrollTrigger.update);
    lenisTick = time => lenis.raf(time * 1000);
    gsap.ticker.add(lenisTick);
    if (locked) lenis.stop();
  } catch { /* native scrolling is the full fallback */ }
}
function lockScroll(trigger) {
  if (locked) return;
  overlayTrigger = trigger;
  const y = scrollY;
  const scrollbar = innerWidth - html.clientWidth;
  locked = { y, css: document.body.style.cssText };
  lenis?.stop();
  Object.assign(document.body.style, { position: 'fixed', top: `-${y}px`, left: '0', right: '0', overflow: 'hidden', paddingRight: `${scrollbar}px` });
}
function unlockScroll(returnFocus = true) {
  if (!locked) return;
  const saved = locked; locked = null;
  document.body.style.cssText = saved.css;
  lenis?.start(); setScroll(saved.y);
  if (returnFocus && overlayTrigger?.isConnected) overlayTrigger.focus({ preventScroll: true });
  overlayTrigger = null;
  updateTheme();
  refresh();
}
function updateTheme() {
  $('meta[name="theme-color"]').content = menu.open || lightbox.open || ($('#book')?.open && !matchMedia('(min-width: 768px)').matches) ? (menu.open || lightbox.open ? '#243c32' : '#ffffff') : (!header.classList.contains('on-light') ? '#243c32' : '#ffffff');
}
// Header: transparent over the hero, a white bar once the hero has passed. Driven by the hero's own trigger.
function setupHeader() {
  headerTrigger?.kill(); headerTrigger = null;
  const hero = $('.hero', main);
  if (!hero) { header.classList.add('on-light'); updateTheme(); return; }
  header.classList.remove('on-light');
  headerTrigger = ScrollTrigger.create({
    trigger: hero, start: 'top top', end: () => `bottom ${header.offsetHeight + 1}px`, refreshPriority: -1,
    onLeave: () => { header.classList.add('on-light'); updateTheme(); },
    onEnterBack: () => { header.classList.remove('on-light'); updateTheme(); },
    onRefresh: self => { header.classList.toggle('on-light', self.progress >= 1); updateTheme(); }
  });
}

// ---------- menu: the forest panel slides down, the page sinks, the links rise through masks ----------
function finishMenuClose() {
  if (menuWanted || !menu.open) return;
  menu.close();
  gsap.set('#page-wrap', { clearProps: 'transform' });
  unlockScroll();
}
const menuTimeline = gsap.timeline({ paused: true, onReverseComplete: finishMenuClose })
  .fromTo(menu, { yPercent: -100 }, { yPercent: 0, duration: 1.1, ease: 'expo.inOut' }, 0)
  .fromTo('#page-wrap', { y: 0 }, { y: 60, duration: 1.1, ease: 'expo.inOut' }, 0)
  .fromTo('#menu .mask-in', { yPercent: 110 }, { yPercent: 0, duration: 0.9, stagger: 0.06, ease: 'power4.out' }, 0.45)
  .fromTo('#menu .menu-photo-in', { clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0% 0)', duration: 1, ease: 'expo.out' }, 0.5)
  .fromTo('#menu .menu-photo-in img', { scale: 1.15 }, { scale: 1, duration: 1.5, ease: 'power3.out' }, 0.5)
  .fromTo(['#menu .menu-top', '#menu .menu-bottom', '#menu .menu-photo > span'], { opacity: 0 }, { opacity: 1, duration: 0.6, ease: 'power2.out' }, 0.6);
// The fromTo above rendered translate(0,0) on #page-wrap at build time. An ancestor with ANY transform becomes the
// containing block for position:fixed descendants, which un-pins every ScrollTrigger pin inside the page. Clear it at rest.
gsap.set('#page-wrap', { clearProps: 'transform' });

function setMenu(open, viaKey = false, trigger = menuToggle) {
  menuWanted = open;
  const plain = viaKey || reduced.matches;
  gsap.to($$('.burger i', menuToggle), { rotation: i => (open ? (i ? -45 : 45) : 0), y: i => (open ? (i ? -4 : 4) : 0), duration: plain ? 0 : 0.35, ease: 'power3.out', overwrite: true });
  menuToggle.setAttribute('aria-expanded', String(open));
  if (open) {
    if (lightbox.open) closeGallery(true, false);
    if (!menu.open) { lockScroll(trigger); menu.showModal(); menu.scrollTop = 0; }
    if (plain) menuTimeline.progress(1).pause();
    else menuTimeline.timeScale(1).play();
    // pointer open: the panel itself; keyboard open: the first link (focus-guard rule)
    (viaKey ? $('nav a', menu) : menu).focus({ preventScroll: true });
  } else if (plain) { menuTimeline.progress(0).pause(); finishMenuClose(); }
  else menuTimeline.timeScale(1.6).reverse();
  updateTheme();
}
menuToggle.addEventListener('click', e => setMenu(!menuWanted, e.detail === 0));
menuClose.addEventListener('click', e => setMenu(!menuWanted, e.detail === 0));
menu.addEventListener('cancel', e => { e.preventDefault(); setMenu(false, true); });
menu.addEventListener('click', e => { if (e.target === menu || e.target.classList.contains('menu-layout')) setMenu(false); });
function containFocus(event, dialog) {
  if (event.key !== 'Tab') return;
  const controls = $$('a[href],button:not([disabled]),[tabindex="0"]', dialog).filter(el => el.getClientRects().length);
  const first = controls[0], last = controls.at(-1);
  if (!first) return;
  if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog)) { event.preventDefault(); first.focus(); }
}
menu.addEventListener('keydown', e => containFocus(e, menu));

// ---------- reveals ----------
// Lines rise through masks. SplitText makes the lines; each gets a mask with accent headroom (style.css .ln-mask).
function splitLines(el) {
  const split = new SplitText(el, { type: 'lines', linesClass: 'ln' });
  splits.push(split);
  split.lines.forEach(line => {
    const mask = document.createElement('span');
    mask.className = 'ln-mask';
    line.replaceWith(mask); mask.appendChild(line);
  });
  return split.lines;
}
// A photograph arrives through a rising window: the anchor is the trigger and never moves; the two wrappers do.
function wrapWindow(el) {
  if ($('.rv-out', el)) return $('.rv-in', el);
  const img = $('img', el);
  if (!img) return null;
  const out = document.createElement('div'); out.className = 'rv-out';
  const inn = document.createElement('div'); inn.className = 'rv-in';
  inn.appendChild(img); out.appendChild(inn); el.prepend(out);
  return inn;
}
function initPageMotion({ arrival = 'none' } = {}) {
  context?.revert(); pageCleanup();
  splits.forEach(s => s.revert()); splits = [];
  arrivalTimeline = null;
  const cleanups = [];
  const motion = !reduced.matches;
  context = gsap.context(() => {
    if (!motion) return;
    const hero = $('.hero', main);
    // arrival: the hero settles from a slight enlargement while the headline rises through its line masks
    if (hero) {
      const h1 = $('[data-hero-lines]', hero);
      const lines = h1 ? splitLines(h1) : [];
      arrivalTimeline = gsap.timeline({ paused: true })
        .fromTo('.hero-arrival', { scale: 1.12 }, { scale: 1, duration: 2.4, ease: 'power3.out', immediateRender: true, clearProps: 'transform' }, 0)
        .fromTo(lines, { yPercent: 110 }, { yPercent: 0, duration: 1.25, stagger: 0.12, ease: 'power4.out', immediateRender: true }, 0.35)
        .fromTo('.hero-copy .eyebrow', { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', immediateRender: true, clearProps: 'all' }, 0.7);
      gsap.to('.hero-image', { scale: 1.12, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: SCRUB() } });
      // fromTo: a to() would record the CSS pre-ready opacity 0 as its start value and animate 0 -> 0
      gsap.fromTo('.hero-copy', { y: 0, opacity: 1 }, { y: -70, opacity: 0, ease: 'none', immediateRender: false, scrollTrigger: { trigger: hero, start: 'top top', end: '60% top', scrub: SCRUB() } });
    } else if (arrival !== 'none') {
      arrivalTimeline = gsap.timeline({ paused: true })
        .fromTo(main, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out', immediateRender: true, clearProps: 'all' });
    }
    $$('[data-lines]', main).forEach(el => {
      const lines = splitLines(el);
      gsap.fromTo(lines, { yPercent: 110 }, {
        yPercent: 0, ease: 'none', stagger: 0.16,
        scrollTrigger: { trigger: el, start: 'top 92%', end: 'clamp(top 62%)', scrub: SCRUB(), invalidateOnRefresh: true }
      });
    });
    $$('[data-fade]', main).forEach(el => {
      gsap.fromTo(el, { opacity: 0.12, y: 24 }, { opacity: 1, y: 0, ease: 'none', scrollTrigger: { trigger: el, start: 'top 95%', end: 'clamp(top 72%)', scrub: SCRUB(), invalidateOnRefresh: true } });
    });
    $$('[data-stagger]', main).forEach(el => {
      gsap.fromTo(el.children, { opacity: 0.12, y: 16 }, { opacity: 1, y: 0, ease: 'none', stagger: 0.12, scrollTrigger: { trigger: el, start: 'top 92%', end: 'clamp(top 58%)', scrub: SCRUB(), invalidateOnRefresh: true } });
    });
    $$('[data-win]', main).forEach(el => {
      const inn = wrapWindow(el);
      if (!inn) return;
      const out = inn.parentElement;
      const big = el.classList.contains('win-big') || el.classList.contains('stay-page-picture');
      gsap.timeline({ scrollTrigger: { trigger: el, start: 'top 100%', end: `clamp(top ${big ? (isTouch() ? 58 : 42) : (isTouch() ? 70 : 55)}%)`, scrub: SCRUB(), invalidateOnRefresh: true } })
        .fromTo(out, { yPercent: 100 }, { yPercent: 0, ease: 'none' }, 0)
        .fromTo(inn, { yPercent: -100 }, { yPercent: 0, ease: 'none' }, 0)
        .fromTo(inn, { scale: 1.12 }, { scale: 1, ease: 'power1.out' }, 0);
    });
    const mm = gsap.matchMedia();
    mm.add('(min-width: 1024px)', () => {
      $$('[data-parallax]', main).forEach(el => {
        gsap.fromTo($('img', el), { yPercent: -8 }, { yPercent: 8, ease: 'none', scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: SCRUB(), invalidateOnRefresh: true } });
      });
      // the footer rises from under the page
      const footer = $('.site-footer');
      const rise = gsap.fromTo(footer, { yPercent: -28 }, { yPercent: 0, ease: 'none', scrollTrigger: { trigger: main, start: 'bottom bottom', end: 'max', scrub: SCRUB(), invalidateOnRefresh: true } });
      const onFocus = () => { rise.scrollTrigger?.disable(false); gsap.set(footer, { yPercent: 0 }); };
      const onBlur = e => { if (!footer.contains(e.relatedTarget)) rise.scrollTrigger?.enable(); };
      footer.addEventListener('focusin', onFocus); footer.addEventListener('focusout', onBlur);
      return () => { footer.removeEventListener('focusin', onFocus); footer.removeEventListener('focusout', onBlur); };
    });
    // the journey: a pinned horizontal track, desktop fine pointer only (touch keeps the native snap rail)
    const journey = $('[data-journey]', main);
    if (journey && isFine() && wide()) {
      journey.classList.add('is-pinned');
      const track = $('.journey-track', journey), bar = $('.journey-bar i', journey);
      const distance = () => Math.max(0, track.scrollWidth - track.clientWidth);
      const st = { trigger: journey, start: 'top top', end: () => `+=${distance()}`, pin: true, anticipatePin: 1, scrub: SCRUB(), invalidateOnRefresh: true, refreshPriority: 1 };
      gsap.to(track, { x: () => -distance(), ease: 'none', scrollTrigger: st });
      gsap.fromTo(bar, { scaleX: 0 }, { scaleX: 1, ease: 'none', scrollTrigger: { trigger: journey, start: 'top top', end: () => `+=${distance()}`, scrub: SCRUB(), invalidateOnRefresh: true } });
      cleanups.push(() => journey.classList.remove('is-pinned'));
    }
  }, main);

  // the snap rail's arrows (touch, narrow windows, reduced motion)
  const rail = $('.journey-track', main);
  if (rail && !$('.journey.is-pinned', main)) {
    const prev = $('[data-rail-prev]', main), next = $('[data-rail-next]', main);
    const update = () => { prev.disabled = rail.scrollLeft < 5; next.disabled = rail.scrollLeft >= rail.scrollWidth - rail.clientWidth - 5; };
    const move = (direction, e) => rail.scrollBy({ left: direction * (rail.firstElementChild.getBoundingClientRect().width + parseFloat(getComputedStyle(rail).gap)), behavior: reduced.matches || e.detail === 0 ? 'instant' : 'smooth' });
    prev.addEventListener('click', e => move(-1, e)); next.addEventListener('click', e => move(1, e));
    rail.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update); ro.observe(rail);
    cleanups.push(() => ro.disconnect()); update();
  }
  // gallery filters
  function filterPhotos(button, updateURL = true) {
    $$('[data-filter]', main).forEach(b => b.setAttribute('aria-pressed', String(b === button)));
    let count = 0;
    $$('.gallery-grid > figure', main).forEach(figure => {
      figure.hidden = button.dataset.filter !== 'all' && figure.dataset.category !== button.dataset.filter;
      if (!figure.hidden) count++;
    });
    $('#photo-count', main).textContent = `${count} photographs`;
    if (updateURL) {
      const url = new URL(location.href);
      if (button.dataset.filter === 'all') url.searchParams.delete('view'); else url.searchParams.set('view', button.dataset.filter);
      history.replaceState(history.state, '', url.pathname + url.search);
    }
    refresh();
  }
  $$('[data-filter]', main).forEach(button => button.addEventListener('click', () => filterPhotos(button)));
  const selectedFilter = new URL(location.href).searchParams.get('view');
  const selectedButton = $$('[data-filter]', main).find(b => b.dataset.filter === selectedFilter);
  if (selectedButton) filterPhotos(selectedButton, false);
  // the questions: an animated accordion (CSS grid rows), open state on the item
  $$('.faq-q', main).forEach(q => q.addEventListener('click', () => {
    const item = q.closest('.faq-item'), open = !item.classList.contains('open');
    item.classList.toggle('open', open); q.setAttribute('aria-expanded', String(open));
    gsap.delayedCall(0.6, refresh);
  }));
  // tabbing into a hidden window or line must show it
  const onFocusIn = e => {
    const win = e.target.closest('[data-win]');
    if (win) { const inn = $('.rv-in', win); if (inn) gsap.set([inn, inn.parentElement], { yPercent: 0, scale: 1 }); }
  };
  main.addEventListener('focusin', onFocusIn);
  cleanups.push(() => main.removeEventListener('focusin', onFocusIn));
  // images decoding after the first measure grow the page: one refresh per load burst
  let loadFrame = 0;
  const onLoad = () => { cancelAnimationFrame(loadFrame); loadFrame = requestAnimationFrame(refresh); };
  main.addEventListener('load', onLoad, true);
  cleanups.push(() => { cancelAnimationFrame(loadFrame); main.removeEventListener('load', onLoad, true); });

  pageCleanup = () => cleanups.forEach(fn => fn());
  setupHeader(); updateCurrentLinks();
  html.classList.add('ready'); clearTimeout(readyFailsafe);
  refresh();
  if (arrival === 'play') arrivalTimeline?.play();
}
function updateCurrentLinks() {
  $$('[data-menu-route]').forEach(a => (a.dataset.menuRoute === location.pathname ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
}

// ---------- the loader: first visit only; the mark draws, the name rises, the plate lifts onto the settling hero ----------
async function runLoader() {
  const markPath = $('.mark-path', loader);
  const heroImage = $('.hero-image', main);
  const waits = [document.fonts.ready];
  if (heroImage) waits.push(heroImage.decode().catch(() => {}));
  const floor = new Promise(r => setTimeout(r, 900));
  const ceiling = new Promise(r => setTimeout(r, 2600));
  gsap.set(markPath, { drawSVG: '0%' });
  const plate = gsap.timeline()
    .to(markPath, { drawSVG: '100%', duration: 1.3, ease: 'power2.inOut' }, 0)
    .fromTo('.ld-name', { yPercent: 110 }, { yPercent: 0, duration: 1, ease: 'power4.out' }, 0.45)
    .fromTo('.ld-place', { yPercent: 110 }, { yPercent: 0, duration: 0.9, ease: 'power4.out' }, 0.65);
  await Promise.race([Promise.all([...waits, floor, plate.then()]), ceiling]);
  try { sessionStorage.setItem('mv-seen', '1'); } catch { /* storage blocked: the plate shows each visit */ }
  gsap.delayedCall(0.3, () => arrivalTimeline?.play());
  gsap.fromTo(header, { opacity: 0, y: -12 }, { opacity: 1, y: 0, duration: 1, delay: 0.55, ease: 'power3.out', clearProps: 'all' });
  await gsap.to(loader, { yPercent: -100, duration: 1.05, ease: 'expo.inOut' }).then();
  html.classList.remove('loading');
  gsap.set(loader, { clearProps: 'all' });
}

// ---------- gallery ----------
function tween(target, options) {
  return new Promise(resolve => gsap.to(target, { ...options, onComplete: resolve, onInterrupt: resolve }));
}
async function showGalleryImage(index, instant = false) {
  galleryIndex = (index + photos.length) % photos.length;
  const token = ++gallerySequence;
  const p = photos[galleryIndex], displayed = $('#lightbox-image');
  $('#lightbox-count').textContent = `${String(galleryIndex + 1).padStart(2, '0')} / ${photos.length}`;
  $('#lightbox-caption').textContent = `Loading ${p.title}…`;
  $('#gallery-error').hidden = true;
  const image = new Image();
  image.src = `/images/${p.id}-1920.webp`;
  try {
    await image.decode();
    if (token !== gallerySequence || !lightbox.open) return;
    if (!instant && !reduced.matches && displayed.getAttribute('src')) await tween(displayed, { opacity: 0, y: -8, duration: 0.16, ease: 'power2.out', overwrite: true });
    if (token !== gallerySequence || !lightbox.open) return;
    displayed.src = image.src; displayed.alt = p.alt;
    displayed.width = image.naturalWidth; displayed.height = image.naturalHeight;
    $('#lightbox-caption').textContent = p.title;
    if (instant || reduced.matches) gsap.set(displayed, { opacity: 1, y: 0, scale: 1 });
    else gsap.fromTo(displayed, { opacity: 0, y: 12, scale: 1.02 }, { opacity: 1, y: 0, scale: 1, duration: 0.36, ease: 'power3.out', overwrite: true });
  } catch {
    if (token !== gallerySequence || !lightbox.open) return;
    $('#lightbox-caption').textContent = p.title;
    $('#gallery-error').hidden = false;
  }
}
function openGallery(id, trigger, viaKey) {
  if (menu.open) setMenu(false, true);
  galleryClosing = false;
  lockScroll(trigger);
  if (!lightbox.open) lightbox.showModal();
  updateTheme();
  gsap.killTweensOf(lightbox);
  if (!viaKey && !reduced.matches) gsap.fromTo(lightbox, { opacity: 0, scale: 0.985 }, { opacity: 1, scale: 1, duration: 0.3, ease: 'power3.out' });
  else gsap.set(lightbox, { opacity: 1, scale: 1 });
  (viaKey ? $('[data-gallery-close]') : lightbox).focus({ preventScroll: true });
  showGalleryImage(photos.findIndex(p => p.id === id), true);
}
async function closeGallery(instant = false, returnFocus = true) {
  if (!lightbox.open || galleryClosing) return;
  galleryClosing = true; ++gallerySequence;
  gsap.killTweensOf($('#lightbox-image'));
  if (!instant && !reduced.matches) await tween(lightbox, { opacity: 0, duration: 0.25, ease: 'power2.out', overwrite: true });
  lightbox.close(); galleryClosing = false;
  $('#lightbox-image').removeAttribute('src');
  unlockScroll(returnFocus);
}
$('[data-gallery-close]').addEventListener('click', e => closeGallery(e.detail === 0));
$('[data-gallery-prev]').addEventListener('click', e => showGalleryImage(galleryIndex - 1, e.detail === 0));
$('[data-gallery-next]').addEventListener('click', e => showGalleryImage(galleryIndex + 1, e.detail === 0));
$('[data-gallery-retry]').addEventListener('click', () => showGalleryImage(galleryIndex, true));
lightbox.addEventListener('cancel', e => { e.preventDefault(); closeGallery(true); });
lightbox.addEventListener('keydown', e => {
  containFocus(e, lightbox);
  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); showGalleryImage(galleryIndex + (e.key === 'ArrowRight' ? 1 : -1), true); }
});
let touchStart;
$('.lightbox-stage').addEventListener('pointerdown', e => { if (e.pointerType === 'touch') touchStart = { x: e.clientX, y: e.clientY }; });
$('.lightbox-stage').addEventListener('pointerup', e => {
  if (!touchStart) return;
  const dx = e.clientX - touchStart.x, dy = e.clientY - touchStart.y; touchStart = null;
  if (Math.abs(dx) > 50 && Math.abs(dy) < 65) showGalleryImage(galleryIndex + (dx < 0 ? 1 : -1));
});
$('.lightbox-stage').addEventListener('pointercancel', () => { touchStart = null; });

// ---------- the booking sheet: SNDR Bókun's request flow, drawer from the right (phone: sheet from the bottom) ----------
const book = $('#book'), bookBar = $('.bk-bar', book), bookBg = $('.bk-bg', book);
const bookPhone = () => !matchMedia('(min-width: 768px)').matches;
const booking = mountBooking(book, { min: 2, max: 10, onStep: () => { bookBar.scrollTop = 0; } });
function openBooking(trigger, viaKey = false) {
  if (menu.open) setMenu(false, true);
  if (lightbox.open) closeGallery(true, false);
  booking.prepare();
  if (booking.step === 'done') booking.reset(); // a sent request never greets the next open
  // two houses, one sheet: the page decides which house the request starts on, the guest can change it
  const house = trigger?.dataset.house || (location.pathname.startsWith('/mountain-villa-preview/villa-ii/') ? 'Villa II' : location.pathname.startsWith('/mountain-villa-preview/villa/') ? 'Villa I' : '');
  if (house) $('select[name="house"]', book).value = house;
  $('.bk-sub', book).textContent = `${house ? `Mountain Villa ${house.slice(6)}` : 'Mountain Villa'}, Flúðir · the whole house`;
  lockScroll(trigger);
  if (!book.open) book.showModal();
  updateTheme();
  gsap.killTweensOf([bookBar, bookBg]);
  const from = bookPhone() ? { yPercent: 100, xPercent: 0 } : { xPercent: 100, yPercent: 0 };
  if (!viaKey && !reduced.matches) {
    gsap.fromTo(bookBar, from, { xPercent: 0, yPercent: 0, duration: 0.55, ease: 'expo.out' });
    gsap.fromTo(bookBg, { opacity: 0 }, { opacity: 1, duration: 0.4, ease: 'power2.out' });
  } else { gsap.set(bookBar, { xPercent: 0, yPercent: 0 }); gsap.set(bookBg, { opacity: 1 }); }
  // pointer open: the sheet itself; keyboard open: the first selectable day (focus-guard rule)
  (viaKey ? booking.firstDay() || bookBar : bookBar).focus({ preventScroll: true });
}
async function closeBooking(instant = false) {
  if (!book.open) return;
  gsap.killTweensOf([bookBar, bookBg]);
  if (!instant && !reduced.matches) {
    const to = bookPhone() ? { yPercent: 100 } : { xPercent: 100 };
    await Promise.all([tween(bookBar, { ...to, duration: 0.3, ease: 'power2.out' }), tween(bookBg, { opacity: 0, duration: 0.25, ease: 'power2.out' })]);
  }
  book.close();
  unlockScroll();
}
book.addEventListener('cancel', e => { e.preventDefault(); closeBooking(true); });
$$('[data-book-close]', book).forEach(el => el.addEventListener('click', e => closeBooking(e.detail === 0)));
book.addEventListener('keydown', e => containFocus(e, book));
document.addEventListener('click', e => {
  const trigger = e.target.closest('[data-book]');
  if (!trigger) return;
  e.preventDefault(); openBooking(trigger, e.detail === 0);
});

// ---------- routes: the veil rises from the bottom while the mark draws, then lifts away over the new page ----------
const veilMark = $('.mark-path', veil);
function hideVeil() { gsap.set(veil, { visibility: 'hidden', clipPath: 'inset(100% 0 0 0)', yPercent: 0 }); }
async function navigate(url, { pop = false, key, y = 0, viaKey = false } = {}) {
  const token = ++navigationSequence;
  navigationPending = true;
  navigationController?.abort();
  navigationController = new AbortController();
  const instant = reduced.matches || viaKey || pop;
  positions.set(currentKey, locked ? locked.y : scrollY);
  if (menu.open) setMenu(false, true);
  if (lightbox.open) await closeGallery(true, false);
  if (book.open) await closeBooking(true);
  gsap.killTweensOf([veil, veilMark]);
  $('#route-status').textContent = 'Loading page…';
  try {
    const covering = instant ? null : (() => {
      const lifted = Number(gsap.getProperty(veil, 'yPercent')) < 0;
      gsap.set(veil, { visibility: 'visible' });
      if (lifted) return tween(veil, { yPercent: 0, clipPath: 'inset(0% 0 0 0)', duration: 0.4, ease: 'power2.out' });
      gsap.set(veilMark, { drawSVG: '0%' });
      gsap.to(veilMark, { drawSVG: '100%', duration: 0.7, ease: 'power2.inOut', delay: 0.2 });
      return tween(veil, { clipPath: 'inset(0% 0 0 0)', duration: 0.65, ease: 'expo.inOut' });
    })();
    let htmlText = pageCache.get(url.pathname);
    if (!htmlText) {
      const response = await fetch(url.pathname, { signal: navigationController.signal });
      if (!response.ok) throw new Error('Page request failed');
      htmlText = await response.text(); pageCache.set(url.pathname, htmlText);
    }
    if (token !== navigationSequence) return;
    const nextDocument = new DOMParser().parseFromString(htmlText, 'text/html');
    const next = nextDocument.querySelector('main');
    if (!next) throw new Error('Page content missing');
    await covering;
    if (token !== navigationSequence) return;
    context?.revert(); pageCleanup(); context = null;
    splits.forEach(s => s.revert()); splits = [];
    main.replaceWith(next); main = next;
    document.title = nextDocument.title;
    document.body.dataset.page = url.pathname;
    if (!pop) {
      currentKey = crypto.randomUUID();
      history.pushState({ villaKey: currentKey, villaY: 0 }, '', url.pathname + url.search + url.hash);
    } else currentKey = key;
    positions.set(currentKey, y);
    setScroll(y);
    initPageMotion({ arrival: instant || y > 0 ? 'none' : 'defer' });
    main.focus({ preventScroll: true });
    if (url.hash) $(url.hash)?.scrollIntoView({ behavior: 'instant' });
    if (!instant) {
      gsap.delayedCall(0.25, () => { if (token === navigationSequence) arrivalTimeline?.play(); });
      await tween(veil, { yPercent: -100, duration: 0.85, ease: 'expo.inOut', overwrite: true });
    }
    if (token !== navigationSequence) return;
    hideVeil();
    navigationPending = false;
    $('#route-status').textContent = document.title;
  } catch (error) {
    if (error.name === 'AbortError' || token !== navigationSequence) return;
    navigationPending = false;
    location.assign(url.href); // the full document is the fallback: every link is a real link
  }
}
document.addEventListener('click', e => {
  const anchor = e.target.closest('a[href]');
  if (!anchor || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0 || anchor.target === '_blank' || anchor.hasAttribute('download')) return;
  if (anchor.dataset.photo) { e.preventDefault(); openGallery(anchor.dataset.photo, anchor, e.detail === 0); return; }
  const url = new URL(anchor.href);
  if (url.origin !== location.origin) return;
  if (url.pathname === location.pathname) {
    if (navigationPending) {
      ++navigationSequence; navigationController?.abort(); navigationPending = false;
      gsap.killTweensOf([veil, veilMark]); hideVeil();
      arrivalTimeline?.progress(1);
      $('#route-status').textContent = document.title;
    }
    if (menu.open) { e.preventDefault(); setMenu(false, e.detail === 0); }
    if (!url.hash) {
      e.preventDefault();
      if (lenis && e.detail !== 0 && scrollY < innerHeight * 2.5) lenis.scrollTo(0, { duration: 1.1 }); else setScroll(0);
    } else if (lenis) {
      e.preventDefault();
      const target = $(url.hash);
      if (target) lenis.scrollTo(target.getBoundingClientRect().top + scrollY - header.offsetHeight - 20, { immediate: e.detail === 0 });
    }
    return;
  }
  if (!['/mountain-villa-preview/', '/mountain-villa-preview/villa/', '/mountain-villa-preview/villa-ii/', '/mountain-villa-preview/slow-days/', '/mountain-villa-preview/gallery/', '/mountain-villa-preview/stay/'].includes(url.pathname)) return;
  e.preventDefault(); navigate(url, { viaKey: e.detail === 0 });
});
addEventListener('popstate', e => {
  const key = e.state?.villaKey || crypto.randomUUID();
  navigate(new URL(location.href), { pop: true, key, y: positions.get(key) ?? e.state?.villaY ?? 0 });
});
let scrollSave;
addEventListener('scroll', () => {
  if (locked) return;
  positions.set(currentKey, scrollY);
  clearTimeout(scrollSave);
  scrollSave = setTimeout(() => history.replaceState({ ...history.state, villaKey: currentKey, villaY: scrollY }, ''), 180);
}, { passive: true });
addEventListener('pagehide', () => {
  history.replaceState({ ...history.state, villaKey: currentKey, villaY: locked ? locked.y : scrollY }, '');
});
addEventListener('pageshow', e => {
  if (e.persisted) { html.classList.remove('loading'); gsap.set(loader, { clearProps: 'all' }); hideVeil(); setScroll(history.state?.villaY || 0); refresh(); }
});
// a real width change re-splits every line and re-measures the journey (iOS toolbar resizes change only the height)
let lastWidth = innerWidth, resizeTimer;
addEventListener('resize', () => {
  if (innerWidth === lastWidth) return;
  lastWidth = innerWidth;
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { if (!locked) initPageMotion({ arrival: 'none' }); }, 160);
});
reduced.addEventListener('change', () => {
  html.classList.toggle('motion-on', !reduced.matches);
  if (menu.open) setMenu(menuWanted, true);
  if (lightbox.open) {
    gsap.killTweensOf([lightbox, $('#lightbox-image')]);
    gsap.set(lightbox, { opacity: 1, scale: 1 });
    gsap.set($('#lightbox-image'), { opacity: 1, y: 0, scale: 1 });
  }
  if (html.classList.contains('loading')) { html.classList.remove('loading'); gsap.set(loader, { clearProps: 'all' }); }
  configureScrolling(); initPageMotion({ arrival: 'none' });
});
touchMQ.addEventListener('change', configureScrolling);

// ---------- boot ----------
configureScrolling();
const firstVisit = html.classList.contains('loading') && !reduced.matches;
initPageMotion({ arrival: firstVisit ? 'defer' : 'play' });
if (firstVisit) runLoader();
document.fonts.ready.then(() => refresh());
if (location.hash === '#book') setTimeout(() => openBooking(menuToggle, false), 600);

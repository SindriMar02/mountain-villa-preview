/* Mountain Villa (fork of Klettar, Twin Villas pattern): intro, door open into each house's own
   page, scroll flow (Lenis + GSAP ScrollTrigger, vendored, optional: the page
   works without them), reveals, and the dates that deep-link into the
   SNDR request flow. Runs on index.html, villa-i.html and villa-ii.html. */
(() => {
  document.documentElement.classList.add('app-ready');
  /* Cross-document view transitions (styles.css @view-transition): when the
     browser skips one, as iOS Safari does on Back into the bfcache, its
     promises reject. Nothing is wrong; handle them so they are not reported
     as unhandled rejections (Codex iOS audit, 22 Oct 2026: 2 of 2 Back trials). */
  const quiet = (e) => {
    const vt = e.viewTransition;
    if (vt) ['ready', 'finished', 'updateCallbackDone'].forEach((k) => vt[k] && vt[k].catch(() => {}));
  };
  window.addEventListener('unhandledrejection', (e) => { if (e.reason && e.reason.name === 'AbortError') e.preventDefault(); });
  window.addEventListener('pageswap', quiet);
  window.addEventListener('pagereveal', quiet);
  const hero = document.querySelector('.hero');
  const doors = document.querySelector('.doors');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const raf2 = (fn) => requestAnimationFrame(() => requestAnimationFrame(fn));

  /* ---------- MOTION: Lenis + GSAP ScrollTrigger ----------
     Every effect has a job and none pins or hijacks the scroll (Sindri's
     simple-and-navigable rule): the wheel is smoothed on desktop only (phones
     keep native scrolling; Lenis on touch broke iOS Safari's toolbar on Dæli);
     leaving the doors, the photos sink slower than the page while the type
     lifts away faster; full-bleed photos settle from a slight zoom to their
     whole frame; offset photos drift against the text; the other building's
     photo moves inside its door; anchor jumps glide. Triggers are never the
     elements that move (a moved trigger fires late). Reduced motion: none. */
  const G = window.gsap;
  const ST = window.ScrollTrigger;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  let lenis = null;
  if (!reduce.matches && G && ST) {
    G.registerPlugin(ST);
    // iOS collapses its URL bar as a scroll starts; a refresh mid-fling kills
    // the momentum, so height-only resizes on touch never reach ScrollTrigger.
    ST.config({ ignoreMobileResize: true });
    if (fine && window.Lenis) {
      lenis = new window.Lenis({ lerp: 0.085, wheelMultiplier: 1, autoRaf: false });
      lenis.on('scroll', ST.update);
      G.ticker.add((t) => lenis.raf(t * 1000));
    }
    G.ticker.lagSmoothing(0);
    // Native scroll events on iOS arrive out of step with rendering: a small lag.
    const SCRUB = fine ? true : 0.35;
    const vh = () => window.innerHeight;
    const leave = (trigger) => ({ trigger, start: 'top top', end: 'bottom top', scrub: SCRUB, invalidateOnRefresh: true });

    if (hero && doors) {
      // As the hero leaves: the wordmark lifts and fades (Aurora Hills), the photographs drift.
      const mark = hero.querySelector('.hero-mark');
      // fromTo, never to(): with invalidateOnRefresh a to() re-reads its start on every refresh, so a
      // resize (or the bfcache refresh on Back) while scrolled down made the faded state the new start
      // and the name never came back at the top (Sindri, 22 Oct: "wordmark disappears scrolling back up").
      if (mark) G.fromTo(mark, { y: 0, opacity: 1 }, { y: -110, opacity: 0.06, ease: 'none', scrollTrigger: leave(hero) });
    }
    const opener = document.querySelector('.door--opener');
    if (opener) {
      G.fromTo(opener.querySelector('.door-media'), { yPercent: 0 }, { yPercent: 22, ease: 'none', scrollTrigger: leave(opener) });
    }
    document.querySelectorAll('.bleed-frame').forEach((frame) => {
      G.fromTo(frame.querySelector('img'), { scale: 1.12 }, {
        scale: 1, ease: 'none',
        scrollTrigger: { trigger: frame, start: 'top bottom', end: 'center center', scrub: SCRUB },
      });
    });
    document.querySelectorAll('.px-drift').forEach((fig) => {
      G.fromTo(fig, { y: () => vh() * 0.1 }, {
        y: () => -vh() * 0.06, ease: 'none',
        scrollTrigger: { trigger: fig.parentElement, start: 'top bottom', end: 'bottom top', scrub: SCRUB, invalidateOnRefresh: true },
      });
    });
    // Photo windows (the diptych, the ritual frames): the picture drifts inside its stationary frame.
    document.querySelectorAll('.dip-media, .trip-media').forEach((win) => {
      const im = win.querySelector('img'); if (!im) return;
      G.fromTo(im, { yPercent: -5 }, { yPercent: 5, ease: 'none',
        scrollTrigger: { trigger: win, start: 'top bottom', end: 'bottom top', scrub: SCRUB, invalidateOnRefresh: true } });
    });
    const next = document.querySelector('.door--next');
    if (next) {
      G.fromTo(next.querySelector('.door-media'), { yPercent: -9 }, {
        yPercent: 9, ease: 'none',
        scrollTrigger: { trigger: next, start: 'top bottom', end: 'bottom top', scrub: SCRUB },
      });
    }
    // Fonts and late images change heights after the first measure.
    if (document.fonts) document.fonts.ready.then(() => ST.refresh());
    window.addEventListener('load', () => ST.refresh());
  }

  /* Anchor jumps (Check dates, back to the doors, the skip link) glide through
     Lenis. Measure again first: lazy images may have changed the height since
     Lenis last looked, and a stale height clamps the jump short. */
  if (lenis) {
    document.querySelectorAll('a[href^="#"]').forEach((a) => {
      a.addEventListener('click', (e) => {
        const id = a.getAttribute('href');
        const target = id === '#top' ? null : document.querySelector(id);
        if (id.length < 2 || (id !== '#top' && !target)) return;
        e.preventDefault();
        lenis.resize();
        // Keyboard activation (Enter, the skip link) lands at once: keyboard
        // actions never wait on an animation. Pointer clicks glide.
        const kb = e.detail === 0;
        const land = () => {
          const h = target && (target.matches('[tabindex="-1"]') ? target : target.querySelector('[tabindex="-1"]'));
          if (h) h.focus({ preventScroll: true });
        };
        lenis.scrollTo(target || 0, { immediate: kb, duration: 1.3, offset: -80, onComplete: land });
        if (kb) land();
      });
    });
  } else if (!reduce.matches) {
    /* Touch: the page runs scroll-behavior:auto once scripts run (a smooth html scroll makes every
       ScrollTrigger refresh measure from the wrong place), so pointer taps on same-page links glide
       here; scroll-margin-top keeps the bar clear. Keyboard activation lands at once. */
    document.querySelectorAll('a[href^="#"]').forEach((a) => {
      a.addEventListener('click', (e) => {
        const id = a.getAttribute('href');
        const target = id === '#top' ? document.body : document.querySelector(id);
        if (id.length < 2 || !target || e.detail === 0) return;
        e.preventDefault();
        if (id === '#top') window.scrollTo({ top: 0, behavior: 'smooth' });
        else target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        history.pushState(null, '', id);
      });
    });
  }

  /* ---------- INTRO (home only) ----------
     Cold load, once per session (the boot script in <head> sets html.no-slate
     on repeat visits, reduced motion and ?nointro). Two veils cover the
     photographs; they part once both door photographs have decoded and the
     fonts are ready, never sooner than 450 ms and never later than 1 400 ms.
     The veils are removed from the DOM afterwards (a parked full-screen layer
     tints iOS Safari's toolbar). */
  const ready = () => {
    if (!hero || hero.classList.contains('is-ready')) return;
    hero.classList.add('is-ready');
    const veil = hero.querySelector('.veil');
    if (veil) setTimeout(() => veil.remove(), 1400);
  };
  const intro = hero && !document.documentElement.classList.contains('no-slate');
  if (hero && (!intro || reduce.matches)) {
    ready();
  } else if (hero) {
    try { sessionStorage.setItem('mv-intro', '1'); } catch (_) { /* no storage: it plays each visit */ }
    const imgs = [...hero.querySelectorAll('.door-media img')];
    const decoded = Promise.all(imgs.map((img) => img.decode().catch(() => {})));
    const fonts = (document.fonts && document.fonts.ready) ? document.fonts.ready.catch(() => {}) : Promise.resolve();
    Promise.race([
      Promise.all([decoded, fonts, new Promise((r) => setTimeout(r, 450))]),
      new Promise((r) => setTimeout(r, 1400)),
    ]).then(ready);
  }

  /* ---------- OPEN (home only) ----------
     Clicking a door grows it to the full hero, then loads that building's
     page, which opens on the same picture with the same type at the same size
     (a cross-document view transition crossfades the two identical frames).
     Keyboard (Enter = click with detail 0), reduced motion and modified clicks
     are plain links: no animation to wait for. */
  if (doors) {
    let busy = false;
    let lastDoor = null;
    const reset = () => {
      doors.classList.add('is-resetting');
      doors.classList.remove('is-opening');
      doors.querySelectorAll('.is-opened').forEach((d) => d.classList.remove('is-opened'));
      raf2(() => { doors.classList.remove('is-resetting'); busy = false; });
    };

    doors.addEventListener('click', (e) => {
      const door = e.target.closest('[data-door]');
      if (!door || busy) return;
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (reduce.matches || e.detail === 0) return;   // the browser follows the link
      e.preventDefault();
      busy = true;
      lastDoor = door;
      if (lenis) lenis.stop();   // no scrolling while the door opens
      door.classList.add('is-opened');
      doors.classList.add('is-opening');
      let done = false;
      const go = () => {
        if (done) return;
        done = true;
        door.removeEventListener('transitionend', onEnd);
        try { sessionStorage.setItem('mv-arrive', '1'); } catch (_) { /* no storage */ }
        location.assign(door.href);
      };
      const onEnd = (ev) => { if (ev.target === door && ev.propertyName === 'flex-grow') go(); };
      door.addEventListener('transitionend', onEnd);
      setTimeout(go, 1000);   // safety net
    });

    // Back from a building's page restores this one from the back/forward
    // cache with the door still opened: snap it shut before it is seen, and
    // hand focus back to the door that was chosen.
    window.addEventListener('pageshow', (e) => {
      if (!e.persisted) return;
      reset();
      if (lenis) lenis.start();
      if (ST) ST.refresh();
      // No focus restore: WebKit then paints the door in its :focus-visible (expanded) state after
      // a pointer-opened Back (Codex iOS audit 22 Oct 19:40). Keyboard opens never animate, so
      // the browser's own focus restoration covers them.
    });
  }

  /* ---------- PROOF BAND: the values count up once, as the band reveals ---------- */
  const stats = document.querySelector('.ledger');
  if (stats && 'IntersectionObserver' in window && !reduce.matches) {
    const nums = [...stats.querySelectorAll('[data-n]')];
    const run = () => nums.forEach((el) => {
      const to = parseFloat(el.dataset.n), d = +(el.dataset.d || 0), t0 = performance.now(), T = 1100;
      const f = (now) => { const p = Math.min(1, (now - t0) / T), e = 1 - Math.pow(1 - p, 3); el.textContent = (to * e).toFixed(d); if (p < 1) requestAnimationFrame(f); };
      requestAnimationFrame(f);
    });
    const io = new IntersectionObserver(([en]) => { if (en.isIntersecting) { io.disconnect(); run(); } }, { threshold: .5 });
    io.observe(stats);
  }

  /* ---------- MAP: the road from the houses draws to the place you point at ----------
     Real OSRM road geometry per place (pathLength=1, dashoffset 1 -> 0). The km list
     rows are buttons (keyboard + touch), the dots are pointer-only (the canvas is
     aria-hidden; the list is the accessible path). Idle tour: when the map scrolls in,
     the Golden Circle draws itself one road at a time until the visitor points. */
  const map = document.querySelector('.map--region');
  const placesEl = document.querySelector('.places');
  if (map && placesEl) {
    const routes = new Map([...map.querySelectorAll('.m-route')].map((r) => [r.dataset.to, r]));
    const pts = new Map([...map.querySelectorAll('.map-pt[data-place]')].map((p) => [p.dataset.place, p]));
    const svg = map.querySelector('.m-routes')?.ownerSVGElement;
    if (svg) {
      const vb = svg.viewBox.baseVal;
      const fit = () => { const r = svg.getBoundingClientRect(); map.style.setProperty('--k', (Math.max(r.width / vb.width, r.height / vb.height, 1) * 1.02).toFixed(3)); };
      fit(); if ('ResizeObserver' in window) new ResizeObserver(fit).observe(svg);
    }
    const btns = [...placesEl.querySelectorAll('.place[data-place]')];
    const coarse = matchMedia('(hover:none)').matches;
    let sel = null, tourT = 0, touched = false;
    const set = (k) => {
      if (k === sel) return;
      if (sel) { routes.get(sel)?.classList.remove('is-on'); pts.get(sel)?.classList.remove('is-on'); }
      btns.forEach((b) => b.classList.toggle('is-on', b.dataset.place === k));
      sel = k;
      map.classList.toggle('has-sel', !!k); placesEl.classList.toggle('has-sel', !!k);
      if (k) { routes.get(k)?.classList.add('is-on'); pts.get(k)?.classList.add('is-on'); }
    };
    const stopTour = () => { touched = true; clearTimeout(tourT); };
    btns.forEach((b) => {
      b.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') { stopTour(); set(b.dataset.place); } });
      b.addEventListener('focus', () => { stopTour(); set(b.dataset.place); });
      b.addEventListener('click', () => { stopTour(); set(coarse && sel === b.dataset.place ? null : b.dataset.place); });
    });
    pts.forEach((p, k) => {
      p.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') { stopTour(); set(k); } });
      p.addEventListener('click', () => { stopTour(); set(k); });
    });
    placesEl.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') set(null); });
    placesEl.addEventListener('click', (e) => { if (e.target.closest('.places-tabs')) { stopTour(); set(null); } });
    map.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') set(null); });
    const TOUR = ['geysir', 'gullfoss', 'thingvellir', 'selfoss', 'hjalparfoss', 'haifoss', 'fridheimar', 'skalholt'];
    if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion:reduce)').matches) {
      let i = 0;
      const step = () => { if (touched) return; set(TOUR[i % TOUR.length]); i += 1; tourT = setTimeout(step, 2800); };
      const io = new IntersectionObserver(([en]) => { if (en.isIntersecting) { io.disconnect(); tourT = setTimeout(step, 500); } }, { threshold: .5 });
      io.observe(map);
    }
  }

  /* ---------- PLACES ON A PHONE: one group at a time ----------
     Under 900px the four groups (Nearby, Golden Circle, Waterfalls, Getting here) share one
     two-column grid under the map, chosen by the tab row; from 900px every group shows. */
  const ptabs = document.querySelector('.places-tabs');
  if (ptabs) {
    const groups = [...ptabs.parentElement.querySelectorAll('.places-group')];
    const pick = (i) => {
      ptabs.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.g === i)));
      groups.forEach((g, j) => g.classList.toggle('is-shown', j === i));
    };
    ptabs.addEventListener('click', (e) => { const b = e.target.closest('button[data-g]'); if (b) { pick(+b.dataset.g); b.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } });
    pick(0);
  }

  /* ---------- SAFARI TINT (iOS 26): the status bar and the toolbar take the body colour ----------
     The page ground lives on <main>; <body> carries the tint: dark while the photographs of the
     first screen or the footer are in view, the light ground in between. The solid bar is opaque,
     so the status bar matches it once the bar turns solid. */
  {
    const dark = [hero, document.querySelector('.door--opener'), document.querySelector('.door--next'), document.querySelector('.foot')].filter(Boolean);
    if (dark.length && 'IntersectionObserver' in window) {
      const on = new Set();
      const io = new IntersectionObserver((es) => {
        es.forEach((en) => (en.isIntersecting ? on.add(en.target) : on.delete(en.target)));
        document.documentElement.classList.toggle('tint-dark', on.size > 0);
      }, { threshold: 0, rootMargin: '-82% 0px 0px 0px' });
      dark.forEach((el) => io.observe(el));
    }
  }

  /* ---------- REVIEW STREAM: the cards flow left, paused while pointed at or focused;
     the track holds two identical halves, so -50% loops without a seam; speed 36 px/s. */
  document.querySelectorAll('.stream').forEach((s) => {
    const track = s.querySelector('.stream-track');
    if (!track) return;
    const size = () => { const w = track.scrollWidth / 2; s.style.setProperty('--stream-d', (w / 36).toFixed(1) + 's'); };
    size(); addEventListener('resize', size, { passive: true });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(size).catch(() => {});
    const why = new Set();
    const pause = (on, r = 'hover') => { on ? why.add(r) : why.delete(r); s.classList.toggle('is-paused', why.size > 0); };
    const ctl = s.parentElement.querySelector('.stream-ctl');
    if (ctl) ctl.addEventListener('click', () => { const on = ctl.getAttribute('aria-pressed') !== 'true'; ctl.setAttribute('aria-pressed', String(on)); ctl.textContent = on ? 'Play' : 'Pause'; pause(on, 'user'); });
    s.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') pause(true); });
    s.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') pause(false); });
    /* a finger holds the card still to read it; the stream moves on two seconds after release */
    let resume = 0;
    s.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') { clearTimeout(resume); pause(true, 'touch'); } });
    const letGo = (e) => { if (e.pointerType !== 'mouse') { clearTimeout(resume); resume = setTimeout(() => pause(false, 'touch'), 2000); } };
    s.addEventListener('pointerup', letGo); s.addEventListener('pointercancel', letGo);
    s.addEventListener('focusin', () => pause(true, 'focus')); s.addEventListener('focusout', () => pause(false, 'focus'));
    if ('IntersectionObserver' in window) new IntersectionObserver(([en]) => s.classList.toggle('is-flowing', en.isIntersecting), { threshold: 0 }).observe(s);
    else s.classList.add('is-flowing');
  });

  /* ---------- REVIEWS: one verbatim sentence at a time ----------
     Words leave upward through their .tw masks, the next rise in (28 ms stagger);
     the hairline fills over 7 s, then the next review. Arrows, ArrowLeft/Right,
     swipe; paused while pointed at or focused. Reduced motion: a cut, no timer. */
  const rq = document.querySelector('.rq');
  const rqData = document.getElementById('rq-data');
  if (rq && rqData) {
    const data = JSON.parse(rqData.textContent);
    const q = rq.querySelector('.rq-q'), who = rq.querySelector('.rq-who'), idx = rq.querySelector('.rq-i'), line = rq.querySelector('.rq-line');
    const reduced = matchMedia('(prefers-reduced-motion:reduce)').matches;
    let i = 0, timer = 0, busy = false, held = false, seen = false;
    const esc = (t) => t.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    const words = (t) => t.split(' ').map((w, n) => `<span class="tw" style="--i:${n}"><span>${esc(w)}</span></span>`).join(' ');
    const fill = (r) => {
      q.innerHTML = words('\u201c' + r.q + '\u201d'); q.dataset.len = r.q.length > 110 ? 'l' : 's';
      who.innerHTML = [r.who, r.where, r.house].map((x) => `<span>${esc(x)}</span>`).join('<span class="rq-sep">\u00b7</span>');
    };
    const arm = () => {
      clearTimeout(timer); line.classList.remove('is-timing'); void line.offsetWidth;
      if (reduced || held || !seen) return;
      line.classList.add('is-timing'); timer = setTimeout(() => go(1), 7000);
    };
    const go = (d) => {
      if (busy) return; busy = true;
      i = (i + d + data.length) % data.length; idx.textContent = String(i + 1).padStart(2, '0');
      clearTimeout(timer); line.classList.remove('is-timing');
      if (reduced) { fill(data[i]); busy = false; arm(); return; }
      rq.classList.add('is-out');
      setTimeout(() => {
        fill(data[i]); rq.classList.remove('is-out'); rq.classList.add('is-enter'); void q.offsetWidth; rq.classList.remove('is-enter');
        setTimeout(() => { busy = false; }, 700); arm();
      }, 460);
    };
    rq.querySelector('.rq-next').addEventListener('click', () => go(1));
    rq.querySelector('.rq-prev').addEventListener('click', () => go(-1));
    rq.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') { e.preventDefault(); go(1); } if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); } });
    const hold = (on) => { held = on; arm(); };
    rq.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') hold(true); });
    rq.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') hold(false); });
    rq.addEventListener('focusin', () => hold(true));
    rq.addEventListener('focusout', (e) => { if (!rq.contains(e.relatedTarget)) hold(false); });
    let x0 = null;
    rq.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') x0 = e.clientX; });
    rq.addEventListener('pointerup', (e) => { if (x0 === null) return; const dx = e.clientX - x0; x0 = null; if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1); });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([en]) => { seen = en.isIntersecting; arm(); }, { threshold: .4 }).observe(rq);
    } else { seen = true; arm(); }
  }

  /* ---------- BOOKING: the SNDR Bókun sheet ----------
     The family's range calendar (assets/vendor/sndr-booking.js): two months from
     768px, one on a phone, arrival then departure, a guests stepper, details, a
     request the hosts confirm. Opens from every [data-book] (the bar, the stay
     cards, "check dates for both"); the chosen house closes the nights its
     Airbnb calendar showed as taken (assets/vendor/taken.js) and sets the cap
     (10 in a house, 20 for both). Pointer open focuses the sheet itself,
     keyboard open the first selectable day (focus-guard rule). Preview: the
     request is never sent. */
  const book = document.getElementById('book');
  if (book && window.mountBooking) {
    const NAME = { v1: 'Mountain Villa', v2: 'Mountain Villa II', both: 'Both houses' };
    const TAKEN = window.MV_TAKEN || { v1: [], v2: [] };
    const sets = { v1: new Set(TAKEN.v1), v2: new Set(TAKEN.v2) };
    sets.both = new Set([...sets.v1, ...sets.v2]);
    const bar = book.querySelector('.bk-bar');
    const sub = book.querySelector('#bk-sub');
    const houseBtns = [...book.querySelectorAll('.bk-house button')];
    let house = 'v1';
    const booking = window.mountBooking(book, { min: 2, max: 10, guests: 4, taken: (k) => sets.v1.has(k), onStep: (step) => { bar.scrollTop = 0; book.dataset.step = step; } });
    const setHouse = (h) => {
      house = sets[h] ? h : 'v1';
      houseBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.house === house)));
      sub.textContent = house === 'both' ? 'Both houses, Flúðir · Up to 20 guests' : `${NAME[house]}, Flúðir · The whole house`;
      booking.setHouse(house === 'both' ? 20 : 10, (k) => sets[house].has(k));
    };
    houseBtns.forEach((b) => b.addEventListener('click', () => { if (b.dataset.house !== house) setHouse(b.dataset.house); }));
    let opener = null;
    const openBooking = (trigger, viaKey) => {
      booking.prepare();
      if (booking.step === 'done') booking.reset();
      const h = trigger && trigger.dataset.house;
      if (h && h !== house) setHouse(h);
      opener = trigger;
      if (lenis) lenis.stop();
      document.documentElement.classList.add('bk-open');
      if (!book.open) book.showModal();
      (viaKey ? booking.firstDay() || bar : bar).focus({ preventScroll: true });
    };
    const closeBooking = () => {
      if (!book.open) return;
      book.close();
      document.documentElement.classList.remove('bk-open');
      if (lenis) lenis.start();
      if (opener && opener.focus) opener.focus({ preventScroll: true });
    };
    book.addEventListener('cancel', (e) => { e.preventDefault(); closeBooking(); });
    book.querySelectorAll('[data-book-close]').forEach((el) => el.addEventListener('click', closeBooking));
    document.addEventListener('click', (e) => {
      const t = e.target.closest('[data-book]');
      if (!t) return;
      e.preventDefault();
      openBooking(t, e.detail === 0);
    });
    setHouse('v1');
  }

  /* ---------- BAR: brand hides on the home hero, bar goes solid after 120 px ----------
     Two sentinels and IntersectionObserver, so no scroll listener. */
  const bar = document.querySelector('.bar');
  if (bar && 'IntersectionObserver' in window) {
    const solidS = document.createElement('i'); solidS.style.cssText = 'position:absolute;top:120px;left:0;width:1px;height:1px;pointer-events:none';
    document.body.appendChild(solidS);
    new IntersectionObserver(([en]) => bar.classList.toggle('is-solid', !en.isIntersecting), { threshold: 0 }).observe(solidS);
    /* The name hands over between the seam and the bar: the bar's name shows whenever the big
       wordmark is not wholly in view below the bar. (It used to hide at a fixed 62vh, which on the
       way back up left a stretch with no name at all: the big one was still above the screen.) */
    const wmBig = hero && hero.querySelector('.wm');
    if (bar.classList.contains('is-home') && wmBig) {
      bar.classList.add('is-brand-out');
      new IntersectionObserver(([en]) => bar.classList.toggle('is-brand-out', en.isIntersecting && en.intersectionRatio > 0.98),
        { rootMargin: `-${bar.offsetHeight + 8}px 0px 0px 0px`, threshold: [0, 0.5, 0.98, 1] }).observe(wmBig);
    }
  }

  /* ---------- CHAPTER REVEALS ---------- */
  const rv = document.querySelectorAll('.rv');
  if (reduce.matches || !('IntersectionObserver' in window)) {
    rv.forEach((el) => el.classList.add('is-in'));
  } else {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        en.target.classList.add('is-in');
        io.unobserve(en.target);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.01 });
    rv.forEach((el) => io.observe(el));
  }

  /* ---------- STAY: the SNDR stay picker + request ----------
     Two months, arrival then departure (assets/vendor/staypicker.js, the
     picker the other SNDR builds carry). On the homepage the guest also picks
     a house, or both; on a house page it is fixed. Nights the house's Airbnb
     calendar showed as taken on 22 Oct 2026 are struck through
     (assets/vendor/taken.js; in production SNDR Bókun keeps them in sync).
     Then the guest's details, and a request the hosts confirm with a pay
     link. This preview sends nothing. */
  const NAME = { v1: 'Mountain Villa', v2: 'Mountain Villa II', both: 'both houses' };
  const TAKEN = window.MV_TAKEN || { v1: [], v2: [] };
  const sets = { v1: new Set(TAKEN.v1), v2: new Set(TAKEN.v2) };
  sets.both = new Set([...sets.v1, ...sets.v2]);
  const cal = document.getElementById('stayCal');
  const go = document.getElementById('stayGo');
  const sum = document.getElementById('staySum');
  const req = document.getElementById('stayReq');
  const done = document.getElementById('stayDone');
  const note = document.getElementById('stayNote');
  if (cal && go && sum && req && window.createStayPicker) {
    const KEY = 'mv-stay';
    const opts = [...document.querySelectorAll('.stay-opt')];
    let which = cal.dataset.key;
    let saved = null;
    try { saved = JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch (_) { /* no storage */ }
    if (opts.length && saved && sets[saved.k]) which = saved.k;   // only the homepage lets you switch
    const asDate = (s) => (s ? new Date(s + 'T00:00:00') : null);
    const L = {
      months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
      weekdays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      checkIn: 'Arrival', checkOut: 'Departure', pickDate: 'Pick a date', afterCheckIn: 'After arrival',
      night: 'night', nights: 'nights', prevMonth: 'Previous month', nextMonth: 'Next month', taken: 'booked',
      empty: '', minStay: (d) => `Two nights at least: the earliest departure is ${d}.`, chosen: () => '',
      crosses: (d) => `The house is booked from ${d}. Choose a departure on or before that day, or a new arrival.`,
    };
    let picker;
    let step = 'dates';
    /* Guests: up to ten in one house, twenty in both. Price: what the stay costs booked direct, from
       the Airbnb totals read on 22 Oct 2026 less 5%, per night (Mountain Villa showed one price in
       November and June; Mountain Villa II €881 in winter, €1,113 in summer). An estimate the hosts
       confirm, said so on the page. */
    const MAX = { v1: 10, v2: 10, both: 20 };
    const RATE = { v1: () => 2369 / 3, v2: (d) => (d.getMonth() >= 4 && d.getMonth() <= 8 ? 3339 / 3 : 2644 / 3) };
    const nEl = document.getElementById('stayN'), gnote = document.getElementById('stayGnote');
    const price = document.getElementById('stayPrice');
    const minus = document.querySelector('.stay-minus'), plus = document.querySelector('.stay-plus');
    let guests = 6;
    const eur = (n) => '€' + Math.round(n).toLocaleString('en-GB');
    const quote = (r) => {
      let airbnb = 0;
      for (let d = r.start; d < r.end; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
        airbnb += which === 'both' ? RATE.v1(d) + RATE.v2(d) : RATE[which](d);
      }
      return { airbnb, direct: airbnb * 0.95 };
    };
    const paintGuests = () => {
      guests = Math.min(Math.max(guests, 1), MAX[which]);
      nEl.textContent = String(guests);
      minus.disabled = guests <= 1; plus.disabled = guests >= MAX[which];
      gnote.textContent = guests >= MAX[which] ? (which === 'both' ? 'Both houses sleep twenty.' : 'Each house sleeps ten. For more, choose both houses.') : '';
    };
    minus.addEventListener('click', () => { guests--; paintGuests(); sync(); });
    plus.addEventListener('click', () => { guests++; paintGuests(); sync(); });
    const short = (d) => `${d.getDate()} ${L.months[d.getMonth()].slice(0, 3)}`;
    const label = (t) => { go.querySelector('.stay-go-t').textContent = t; };
    const sync = () => {
      const r = picker.get();
      if (r.start && r.end) {
        sum.textContent = `${r.nights} nights in ${NAME[which]}, ${short(r.start)} to ${short(r.end)}, ${guests} ${guests === 1 ? 'guest' : 'guests'}.`;
        const q = quote(r);
        price.hidden = false;
        price.innerHTML = `<span class="stay-price-v">${eur(q.direct)}</span><span class="stay-price-l">booking direct, about ${eur(q.direct / r.nights)} a night<br><s>${eur(q.airbnb)} on Airbnb</s>. The hosts confirm the exact price.</span>`;
        go.disabled = false;
        label(step === 'details' ? 'Send the request' : 'Request these dates');
      } else {
        sum.textContent = r.start
          ? `Arriving ${picker.fmtLong(r.start)}. Now choose your departure.`
          : 'Choose your arrival, then your departure.';
        go.disabled = true; price.hidden = true;
        step = 'dates'; req.hidden = true;
        label('Choose your dates');
      }
      try {
        sessionStorage.setItem(KEY, JSON.stringify({
          k: opts.length ? which : (saved && saved.k) || which,
          s: r.start ? picker.key(r.start) : null,
          e: r.end ? picker.key(r.end) : null,
        }));
      } catch (_) { /* private mode: the stay just doesn't carry over */ }
    };
    const mountPicker = (s, e) => {
      cal.textContent = '';
      picker = window.createStayPicker({
        mount: cal, prefix: 'kl-stay', minStay: 2, L, onChange: sync,
        taken: (d) => sets[which].has(picker ? picker.key(d) : d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')),
        start: s, end: e,
      });
    };
    mountPicker(saved && asDate(saved.s), saved && asDate(saved.e));
    const mark = () => opts.forEach((b) => {
      const on = b.dataset.key === which;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', String(on));
    });
    // a different house has different booked nights: keep the dates only if that house has them free
    opts.forEach((b) => b.addEventListener('click', () => {
      if (which === b.dataset.key) return;
      const r = picker.get();
      which = b.dataset.key; mark(); paintGuests();
      let free = !!(r.start && r.end);
      for (let d = r.start; free && d < r.end; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) if (sets[which].has(picker.key(d))) free = false;
      mountPicker(r.start, free ? r.end : null);
      sync();
    }));
    go.addEventListener('click', () => {
      if (step === 'dates') {
        step = 'details'; req.hidden = false; label('Send the request');
        req.querySelector('input').focus({ preventScroll: false });
        return;
      }
      const bad = [...req.querySelectorAll('[required]')].find((f) => !f.checkValidity());
      const err = document.getElementById('stayErr');
      if (bad) {
        bad.setAttribute('aria-invalid', 'true'); bad.focus();
        err.textContent = bad.name === 'email' ? 'Add an email address the hosts can reply to, like name@example.com.'
          : bad.name === 'guests' ? 'Add how many guests are coming, from 1 to 20.' : 'Add your name so the hosts know who is asking.';
        return;
      }
      err.textContent = '';
      req.hidden = true; go.hidden = true; note.hidden = true; done.hidden = false;
      done.focus({ preventScroll: true });
    });
    req.addEventListener('input', (e) => e.target.removeAttribute('aria-invalid'));
    document.querySelectorAll('[data-pick]').forEach((a) => a.addEventListener('click', () => {
      const b = opts.find((o) => o.dataset.key === a.dataset.pick);
      if (b && which !== b.dataset.key) b.click();
    }));
    mark();
    paintGuests();
    sync();
    window.addEventListener('pageshow', (e) => {
      if (!e.persisted) return;
      try { saved = JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch (_) { return; }
      if (opts.length && saved && sets[saved.k]) which = saved.k;
      mountPicker(saved && asDate(saved.s), saved && asDate(saved.e));
      mark();
      sync();
    });
  }
})();

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
      G.to(doors, { yPercent: 28, ease: 'none', scrollTrigger: leave(hero) });
      doors.querySelectorAll('.door-top').forEach((el) => {
        G.to(el, { y: () => -vh() * 0.12, ease: 'none', scrollTrigger: leave(hero) });
      });
    }
    const opener = document.querySelector('.door--opener');
    if (opener) {
      G.to(opener.querySelector('.door-media'), { yPercent: 22, ease: 'none', scrollTrigger: leave(opener) });
      G.to(opener.querySelector('.door-top'), { y: () => -vh() * 0.12, ease: 'none', scrollTrigger: leave(opener) });
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
        lenis.scrollTo(target || 0, { immediate: kb, duration: 1.3, onComplete: land });
        if (kb) land();
      });
    });
  }

  /* ---------- INTRO (home only) ----------
     The curtain parts once both door photographs are decoded, but never later
     than 2.2s and never sooner than the seam has had time to draw. */
  const ready = () => {
    if (!hero || hero.classList.contains('is-ready')) return;
    hero.classList.add('is-ready');
    const curtain = hero.querySelector('.curtain');
    // Removed from the DOM afterwards: a parked full-screen layer is what tints
    // iOS Safari's toolbar long after it is invisible.
    if (curtain) setTimeout(() => curtain.remove(), 1600);
  };
  /* The loading slate (first visit of a session): it lifts after the mark has
     risen and the hairline has filled (1.6 s), or when both door photographs
     are decoded if that is later, but never later than 2.6 s. The doors start
     their own entrance under the lift. Removed from the DOM after: a parked
     full-screen layer tints iOS Safari's toolbar. */
  const slate = document.querySelector('.slate');
  const slateOn = slate && !document.documentElement.classList.contains('no-slate') && getComputedStyle(slate).display !== 'none';
  if (slate && !slateOn) slate.remove();
  if (hero && slateOn) {
    try { sessionStorage.setItem('mv-intro', '1'); } catch (_) { /* no storage: it plays each visit */ }
    const imgs = [...hero.querySelectorAll('.door-media img')];
    const decoded = Promise.all(imgs.map((img) => img.decode().catch(() => {})));
    Promise.race([
      Promise.all([decoded, new Promise((r) => setTimeout(r, 1600))]),
      new Promise((r) => setTimeout(r, 2600)),
    ]).then(() => {
      slate.classList.add('is-lifting');
      setTimeout(ready, 120);
      setTimeout(() => slate.remove(), 900);
    });
  } else if (hero) {
    if (reduce.matches) {
      ready();
    } else {
      const imgs = [...hero.querySelectorAll('.door-media img')];
      const decoded = Promise.all(imgs.map((img) => img.decode().catch(() => {})));
      const minWait = new Promise((r) => setTimeout(r, 650));
      Promise.race([
        Promise.all([decoded, minWait]),
        new Promise((r) => setTimeout(r, 2200)),
      ]).then(ready);
    }
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
        location.assign(door.href);
      };
      const onEnd = (ev) => { if (ev.target === door && ev.propertyName === 'flex-grow') go(); };
      door.addEventListener('transitionend', onEnd);
      setTimeout(go, 1000);   // safety net if transitionend never fires
    });

    // Back from a building's page restores this one from the back/forward
    // cache with the door still opened: snap it shut before it is seen, and
    // hand focus back to the door that was chosen.
    window.addEventListener('pageshow', (e) => {
      if (!e.persisted) return;
      reset();
      if (lenis) lenis.start();
      if (ST) ST.refresh();
      if (lastDoor) lastDoor.focus({ preventScroll: true });
    });
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

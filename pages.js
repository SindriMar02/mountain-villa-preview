/* Mountain Villas, 4 Nov 2026: what the new pages add on top of app.js (loaded after it, on every page).
   - THE MENU (below 1200 px): one button in the bar opens the page list under it.
   - PAGE HEADS: the photo settles once decoded; as the head leaves, the photo sinks and the type lifts.
   - REVIEWS: the house filter, with ?house=v1|v2 deep links from the villa pages.
   - QUESTIONS: the accordion. Without JS every answer stays open (the HTML ships them open), and the
     answers are never removed from the DOM (crawlers run no JS; FAQPage carries the same text).
   Motion values: MOTION.md, "4 Nov 2026 (pages)". Reduced motion: no drift, instant swaps. */
(() => {
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const lenis = () => window.MV_LENIS || null;
  const G = window.gsap, ST = window.ScrollTrigger;

  /* ---------- THE MENU ----------
     focus-guard rule: a pointer open focuses the panel (nothing highlighted), a keyboard open the first
     link; Escape, the button and a tap outside the list close it; focus returns to the button. Tab stays
     between the button and the panel while it is open. */
  const btn = document.querySelector('.bar-menu');
  const menu = document.getElementById('site-menu');
  if (btn && menu) {
    const label = btn.querySelector('.bar-menu-l');
    const items = () => [...menu.querySelectorAll('a[href], button')];
    let open = false, t = 0;
    const set = (on, viaKey = false, restore = true) => {
      if (on === open) return;
      open = on; clearTimeout(t);
      btn.setAttribute('aria-expanded', String(on));
      if (label) label.textContent = on ? 'Close' : 'Menu';
      root.classList.toggle('menu-open', on);
      if (on) {
        menu.hidden = false;
        if (lenis()) lenis().stop();
        // one forced style pass with the closed clip, then open: the wipe runs, and the panel is
        // already visible (focusable) when focus moves into it (focus on a visibility:hidden panel is ignored)
        void menu.offsetWidth;
        menu.classList.add('is-open');
        (viaKey ? items()[0] : menu).focus({ preventScroll: true });
      } else {
        menu.classList.remove('is-open');
        if (lenis()) lenis().start();
        t = setTimeout(() => { if (!open) menu.hidden = true; }, reduce.matches ? 160 : 380);
        if (restore) btn.focus({ preventScroll: true });
      }
    };
    btn.addEventListener('click', (e) => set(!open, e.detail === 0));
    // a tap on the panel's empty ground (not the list) closes; Book a stay closes first, then the sheet opens
    menu.addEventListener('click', (e) => {
      if (e.target.closest('[data-book]')) { set(false, false, false); return; }
      if (e.target.closest('a[href]')) { set(false, false, false); return; }
      if (!e.target.closest('.menu-in')) set(false);
    });
    document.addEventListener('keydown', (e) => {
      if (!open) return;
      if (e.key === 'Escape') { e.preventDefault(); set(false); return; }
      if (e.key !== 'Tab') return;
      const list = items(), first = list[0], last = list[list.length - 1];
      const a = document.activeElement;
      if (!e.shiftKey && (a === last)) { e.preventDefault(); btn.focus(); }
      else if (!e.shiftKey && (a === btn || a === menu)) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && (a === first || a === menu)) { e.preventDefault(); btn.focus(); }
      else if (e.shiftKey && a === btn) { e.preventDefault(); last.focus(); }
    });
    matchMedia('(min-width: 1200px)').addEventListener('change', (m) => { if (m.matches) set(false, false, false); });
    window.addEventListener('pageshow', () => { if (open) set(false, false, false); });
  }

  /* ---------- PAGE HEADS ---------- */
  const head = document.querySelector('.pg-head');
  if (head) {
    const im = head.querySelector('.pg-media img');
    const done = () => head.classList.add('is-loaded');
    if (im && im.complete && im.naturalWidth) done();
    else if (im) { (im.decode ? im.decode() : Promise.resolve()).then(done, done); setTimeout(done, 2500); }
    if (G && ST && !reduce.matches) {
      const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
      const sc = () => ({ trigger: head, start: 'top top', end: 'bottom top', scrub: fine ? true : 0.35, invalidateOnRefresh: true });
      // fromTo, never to(): a refresh mid-page must not record the scrolled state as the start
      G.fromTo(head.querySelector('.pg-media'), { yPercent: 0 }, { yPercent: 18, ease: 'none', scrollTrigger: sc() });
      G.fromTo(head.querySelector('.pg-text'), { y: 0, opacity: 1 }, { y: -70, opacity: 0.15, ease: 'none', scrollTrigger: sc() });
    }
  }

  const relayout = () => { if (ST) ST.refresh(); if (lenis()) lenis().resize(); };

  /* ---------- REVIEWS: the house filter ----------
     Out (.16 s), swap, in (cards rise in turn, the first twelve staggered). A press during the out phase
     replaces the pending swap with the latest choice; the count line is read out (aria-live). */
  const rf = document.querySelector('.rw-filter');
  const list = document.querySelector('.rw-list');
  if (rf && list) {
    const cards = [...list.querySelectorAll('.rw-card')];
    const count = document.querySelector('.rw-count');
    const NAME = { all: 'both houses', v1: 'Mountain Villa', v2: 'Mountain Villa II' };
    let cur = 'all', tOut = 0, tIn = 0;
    const apply = (f) => {
      let n = 0;
      cards.forEach((c) => {
        const on = f === 'all' || c.dataset.h === f;
        c.hidden = !on;
        if (on) { c.style.setProperty('--i', String(Math.min(n, 12))); n += 1; }
      });
      if (count) count.textContent = `${n} reviews · ${NAME[f]}`;
      rf.querySelectorAll('button[data-f]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.f === f)));
    };
    const choose = (f, animate) => {
      if (!NAME[f] || f === cur) return;
      cur = f; clearTimeout(tOut); clearTimeout(tIn);
      if (!animate || reduce.matches) { apply(f); relayout(); return; }
      rf.querySelectorAll('button[data-f]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.f === f)));
      list.classList.remove('is-in'); list.classList.add('is-out');
      tOut = setTimeout(() => {
        apply(cur);
        list.classList.remove('is-out'); void list.offsetWidth; list.classList.add('is-in');
        relayout();
        tIn = setTimeout(() => list.classList.remove('is-in'), 1000);
      }, 170);
    };
    // the address carries the filter (?house=v1|v2), so a filtered list can be shared and Back keeps it
    const toUrl = (f) => { try { const u = new URL(location.href); if (f === 'all') u.searchParams.delete('house'); else u.searchParams.set('house', f); history.replaceState(history.state, '', u); } catch (_) { /* file:// */ } };
    rf.addEventListener('click', (e) => { const b = e.target.closest('button[data-f]'); if (b) { choose(b.dataset.f, true); toUrl(cur); } });
    const q = new URLSearchParams(location.search).get('house');
    if (q === 'v1' || q === 'v2') choose(q, false);
  }

  /* ---------- QUESTIONS: the accordion ----------
     Several can be open. Arrow up/down, Home and End move between the questions. A #q-<id> link opens
     its question (and the page glides there through app.js's anchor handler). */
  const qas = [...document.querySelectorAll('.qa')];
  if (qas.length) {
    const qb = (q) => q.querySelector('.qa-q button');
    const setQ = (q, on) => {
      qb(q).setAttribute('aria-expanded', String(on));
      q.classList.toggle('is-open', on);
      const a = q.querySelector('.qa-a');
      if (a && 'inert' in a) a.inert = !on;
    };
    const fromHash = () => {
      const id = decodeURIComponent(location.hash.slice(1));
      const q = id && document.getElementById(id);
      if (q && q.classList.contains('qa')) { setQ(q, true); return q; }
      return null;
    };
    qas.forEach((q) => setQ(q, false));
    fromHash();
    root.classList.add('qa-ready');
    requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('qa-live')));
    const btns = qas.map(qb);
    btns.forEach((b, i) => {
      b.addEventListener('click', () => {
        const on = b.getAttribute('aria-expanded') !== 'true';
        setQ(qas[i], on); setTimeout(relayout, 420);
        // an opened question puts its #q-id in the address (replaceState: no history entry, no jump)
        try { const u = new URL(location.href); u.hash = on ? qas[i].id : ''; history.replaceState(history.state, '', u.hash ? u : u.pathname + u.search); } catch (_) { /* file:// */ }
      });
      b.addEventListener('keydown', (e) => {
        const to = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: btns.length - 1 }[e.key];
        if (to === undefined) return;
        e.preventDefault();
        btns[(to + btns.length) % btns.length].focus();
      });
    });
    window.addEventListener('hashchange', () => { if (fromHash()) setTimeout(relayout, 420); });
  }
})();

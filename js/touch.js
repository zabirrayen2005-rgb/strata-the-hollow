// Strata — touch controls for phones and tablets.
// Left side of the screen: virtual joystick. Right side: drag to look. Buttons: E, light, run, pause.
(function () {
  'use strict';
  window.TouchInit = function (C, getStory) {
    const coarse = window.matchMedia && matchMedia('(pointer: coarse)').matches;
    const force = /[?&]touch=1/.test(location.search);
    if (!(coarse && navigator.maxTouchPoints > 0) && !force) return;

    C.setDragMode(true);
    document.body.classList.add('touch');
    const root = C.$('touch'); root.style.display = 'block';
    const stick = C.$('stick'), nub = C.$('nub');
    const R = 56;                       // joystick radius in px
    let moveId = null, lookId = null, ox = 0, oy = 0, lx = 0, ly = 0;

    function setStick(dx, dy) {
      const d = Math.hypot(dx, dy), k = d > R ? R / d : 1;
      dx *= k; dy *= k; nub.style.transform = `translate(${dx}px, ${dy}px)`;
      C.touchIn.s = dx / R; C.touchIn.f = -dy / R;
    }
    root.addEventListener('pointerdown', e => {
      const btn = e.target.closest('button');
      if (btn) {
        e.preventDefault();
        const a = btn.dataset.a;
        if (a === 'use') { C.key.KeyE = true; const s = getStory(); if (s && C.state === 'play') s.interact(); }
        if (a === 'light') C.flash();
        if (a === 'run') { C.touchIn.run = !C.touchIn.run; btn.classList.toggle('on', C.touchIn.run); }
        if (a === 'pause') C.pause();
        if (a === 'phone' && C.phone && (C.phone.isOpen || C.phoneCanOpen())) C.phone.toggle();
        return;
      }
      if (C.state !== 'play') return;
      const s = getStory(); if (s && s.busy()) { e.preventDefault(); s.interact(); return; }
      if (e.clientX < innerWidth * 0.42 && moveId === null) {
        moveId = e.pointerId; ox = e.clientX; oy = e.clientY;
        stick.style.left = (ox - 70) + 'px'; stick.style.top = (oy - 70) + 'px'; stick.style.opacity = 1; setStick(0, 0);
      } else if (lookId === null) { lookId = e.pointerId; lx = e.clientX; ly = e.clientY; }
      try { root.setPointerCapture(e.pointerId); } catch (err) {}
    });
    root.addEventListener('pointermove', e => {
      if (e.pointerId === moveId) setStick(e.clientX - ox, e.clientY - oy);
      else if (e.pointerId === lookId) { C.look((e.clientX - lx) * .0055, (e.clientY - ly) * .0055); lx = e.clientX; ly = e.clientY; }
    });
    const end = e => {
      if (e.target.closest && e.target.closest('button[data-a="use"]')) C.key.KeyE = false;
      if (e.pointerId === moveId) { moveId = null; setStick(0, 0); stick.style.opacity = .35; }
      if (e.pointerId === lookId) lookId = null;
    };
    root.addEventListener('pointerup', end);
    root.addEventListener('pointercancel', end);
    addEventListener('pointerup', () => { C.key.KeyE = false; });
  };
})();

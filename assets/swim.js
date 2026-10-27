/* Turtle Tower Defense site: realistic fish swimming (desktop only, off with reduced motion).
   Each fish follows a smooth wandering path inside its water zone (.swim-zone, which clips at the water edges):
   mostly horizontal travel, slow depth changes, body tilts with its heading, tail animation speeds up / slows with speed,
   gentle glides. Fish leave one side and later re-enter (often from the other side) instead of flipping in place.
   Sardines school loosely behind a leader. */
(function(){
  var mqWide = window.matchMedia('(min-width:900px)'), mqCalm = window.matchMedia('(prefers-reduced-motion: reduce)');
  var fish = [], running = false, last = 0, raf = 0;
  function rnd(a,b){ return a + Math.random()*(b-a); }
  // smooth 1-D noise in [-1,1]: sum of slow sines with random phases/frequencies
  function noise(f){ var p=[rnd(0,6.28),rnd(0,6.28),rnd(0,6.28)], w=[f, f*1.73, f*2.91];
    return function(t){ return (Math.sin(t*w[0]+p[0])*0.6 + Math.sin(t*w[1]+p[1])*0.3 + Math.sin(t*w[2]+p[2])*0.1); }; }
  function setup(){
    fish = [];
    document.querySelectorAll('.swim-zone').forEach(function(zone){
      var leaders = {};
      zone.querySelectorAll('.swimmer').forEach(function(el){
        if (getComputedStyle(el).display === 'none') return;
        var vis = el.dataset.vis.split(',').map(Number), strip = el.querySelector('.fs-strip');
        var f = { el: el, zone: zone, vis: vis, base: +el.dataset.speed, strip: strip, anim: null,
          dir: Math.random() < 0.5 ? 1 : -1, x: 0, y: 0, ang: 0, wait: 0, rate: 1,
          nSpeed: noise(rnd(0.10,0.18)), nDepth: noise(rnd(0.035,0.06)), follow: null, lead: !!el.dataset.lead };
        if (el.dataset.follow) { var o = el.dataset.follow.split(',').map(Number); f.follow = { dx:o[0], dy:o[1], nx:noise(rnd(0.08,0.14)), ny:noise(rnd(0.06,0.1)) }; }
        if (f.lead) leaders[zone] = f;
        fish.push(f);
      });
      fish.forEach(function(f){ if (f.follow && f.zone === zone) f.leader = fish.filter(function(g){ return g.zone===zone && g.lead; })[0]; });
    });
    measure();
    fish.forEach(function(f){ // start spread across the zone
      if (f.follow) return;
      f.x = rnd(-0.1, 0.9) * f.W; f.y = f.ymid + f.yamp * f.nDepth(0);
    });
  }
  function measure(){
    fish.forEach(function(f){
      f.W = f.zone.clientWidth; f.H = f.zone.clientHeight;
      f.w = f.el.offsetWidth; f.h = f.el.offsetHeight;
      // keep the visible fish (plus room for a ~9 degree tilt) fully inside the zone
      var m = 0.08 * f.h + 3, ymin = m - f.vis[0]*f.h, ymax = f.H - m - f.vis[1]*f.h;
      if (ymax < ymin) { ymin = ymax = (ymin + ymax) / 2; }
      f.ymin = ymin; f.ymax = ymax; f.ymid = (ymin+ymax)/2; f.yamp = (ymax-ymin)/2;
      if (f.strip && !f.anim) { var a = f.strip.getAnimations(); f.anim = a.length ? a[0] : null; }
    });
  }
  function respawn(f){
    f.dir = Math.random() < 0.6 ? -f.dir : f.dir;      // usually come back the other way
    f.x = f.dir > 0 ? -f.w - 10 : f.W + 10;
    f.y = f.ymid + f.yamp * rnd(-0.8, 0.8);
    f.wait = rnd(1.5, 6);
  }
  function step(t, dt){
    fish.forEach(function(f){
      var L = f.leader;
      if (f.follow && L) {                                  // loose schooling: trail the leader with drifting offsets
        f.dir = L.dir; f.wait = L.wait;
        var tx = L.x + f.dir * (f.follow.dx + 14 * f.follow.nx(t)) + (L.w - f.w) / 2;
        var ty = L.y + f.follow.dy + 10 * f.follow.ny(t) + (L.h - f.h) / 2;
        ty = Math.max(f.ymin, Math.min(f.ymax, ty));
        var px = f.x, py = f.y;
        f.x += (tx - f.x) * Math.min(1, dt * 2.2); f.y += (ty - f.y) * Math.min(1, dt * 1.5);
        f.v = Math.abs(f.x - px) / Math.max(dt, 1e-3); f.vy = (f.y - py) / Math.max(dt, 1e-3);
      } else {
        if (f.wait > 0) { f.wait -= dt; f.v = f.base; f.vy = 0; }
        else {
          // speed wanders between a slow glide and a quick burst
          f.v = f.base * (1 + 0.42 * f.nSpeed(t));
          var ty = f.ymid + f.yamp * f.nDepth(t), py = f.y;
          f.y += (ty - f.y) * Math.min(1, dt * 0.5);
          f.vy = (f.y - py) / Math.max(dt, 1e-3);
          f.x += f.dir * f.v * dt;
          if ((f.dir > 0 && f.x > f.W + 12) || (f.dir < 0 && f.x < -f.w - 12)) respawn(f);
        }
      }
      // body follows its heading (small angles only)
      var target = Math.atan2(f.vy, Math.max(f.v, 8)) * 57.3;
      target = Math.max(-9, Math.min(9, target));
      f.ang += (target - f.ang) * Math.min(1, dt * 3);
      var y = Math.max(f.ymin, Math.min(f.ymax, f.y));
      f.el.style.transform = 'translate3d(' + f.x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0) scaleX(' + f.dir + ') rotate(' + f.ang.toFixed(2) + 'deg)';
      f.el.style.visibility = f.wait > 0 && !f.follow ? 'hidden' : '';
      // tail beat tracks speed
      if (f.anim) { var r = Math.max(0.45, Math.min(1.9, f.v / f.base)); if (Math.abs(r - f.rate) > 0.04) { f.rate = r; f.anim.playbackRate = r; } }
    });
  }
  function loop(ts){
    var t = ts / 1000, dt = Math.min(0.05, last ? t - last : 0.016); last = t;
    step(t, dt); raf = requestAnimationFrame(loop);
  }
  function start(){
    if (running || !mqWide.matches || mqCalm.matches) return;
    document.documentElement.classList.add('js-swim');
    running = true; last = 0; setup(); raf = requestAnimationFrame(loop);
  }
  function stop(){
    if (!running) return;
    running = false; cancelAnimationFrame(raf);
    document.documentElement.classList.remove('js-swim');
    fish.forEach(function(f){ f.el.style.transform = ''; f.el.style.visibility = ''; if (f.anim) f.anim.playbackRate = 1; });
  }
  function check(){ (mqWide.matches && !mqCalm.matches) ? start() : stop(); }
  [mqWide, mqCalm].forEach(function(m){ m.addEventListener ? m.addEventListener('change', check) : m.addListener(check); });
  window.addEventListener('resize', function(){ if (running) measure(); });
  check();
})();

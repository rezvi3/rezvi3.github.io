/**
 * Particle Background Engine v5 — Cosmic Gas & Flickering Stars
 * -------------------------------------------------------------
 * Brownian-motion gas particles with twinkling star nodes,
 * constellation line bridges, elastic boundary rebounds,
 * spatial-grid acceleration, and interactive mouse force field.
 */
(function () {
  'use strict';

  var CONFIG = {
    // Visual
    PARTICLE_SIZE_MIN: 1.0,
    PARTICLE_SIZE_MAX: 2.9,
    PARTICLE_OPACITY_MIN: 0.40,
    PARTICLE_OPACITY_MAX: 0.85,
    LINE_OPACITY: 0.06,
    LINE_MAX_DIST: 120,
    LINE_WIDTH: 0.35,

    // Star flicker specs
    STAR_RATIO: 0.38,          // ~38% of particles flicker like stars
    STAR_SIZE_MIN: 1.5,
    STAR_SIZE_MAX: 3.5,

    // Gas physics
    SPEED_INIT_MIN: 14,
    SPEED_INIT_MAX: 40,
    BROWNIAN_FORCE: 120,       // random acceleration (px/s²)
    DAMPING: 0.988,            // friction damping
    MAX_SPEED: 70,
    WALL_BOUNCE: 0.92,         // elasticity on wall hit

    // Particle-particle soft repulsion
    REPULSE_RADIUS: 28,
    REPULSE_FORCE: 320,

    // Mouse interaction
    MOUSE_RADIUS: 180,
    MOUSE_FORCE: 260,          // push force
    MOUSE_HEAT_RADIUS: 260,    // agitation zone near cursor
    MOUSE_HEAT_BOOST: 1.4,
    MOUSE_BRIGHTEN: 0.45,
    MOUSE_SIZE_BOOST: 1.4,
    MOUSE_LERP: 0.11,

    // Click burst
    BURST_COUNT: 14,
    BURST_SPEED: 140,
    BURST_LIFETIME: 1.5,

    // Particle count — balanced & uncluttered
    DENSITY_DESKTOP: 55,
    DENSITY_MOBILE: 28,
    MOBILE_BREAKPOINT: 768,
    MAX_PARTICLES: 115,
    MIN_PARTICLES: 28,

    RESIZE_DEBOUNCE_MS: 200,
    CELL_SIZE: 140,
  };

  // ── Reduced motion ─────────────────────────────────────────────────────
  var prefersRM = window.matchMedia('(prefers-reduced-motion: reduce)');
  var reducedMotion = prefersRM.matches;
  prefersRM.addEventListener('change', function (e) {
    reducedMotion = e.matches;
    if (reducedMotion) {
      particles.forEach(function (p) { p.vx *= 0.05; p.vy *= 0.05; });
    }
  });

  // ── Canvas setup ───────────────────────────────────────────────────────
  var canvas = document.createElement('canvas');
  canvas.id = 'particle-bg';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.insertBefore(canvas, document.body.firstChild);
  var ctx = canvas.getContext('2d');

  // ── State ──────────────────────────────────────────────────────────────
  var W = 0, H = 0, dpr = 1;
  var particles = [];
  var bursts = [];
  var rawMX = -9999, rawMY = -9999, mouseIn = false;
  var sMX = -9999, sMY = -9999;

  // Spatial grid
  var gridCols = 0, gridRows = 0;
  var grid = [];

  function rand(a, b) { return Math.random() * (b - a) + a; }
  var TWO_PI = Math.PI * 2;

  function calcCount() {
    var diag = Math.sqrt(W * W + H * H);
    var d = W < CONFIG.MOBILE_BREAKPOINT ? CONFIG.DENSITY_MOBILE : CONFIG.DENSITY_DESKTOP;
    return Math.max(CONFIG.MIN_PARTICLES, Math.min(CONFIG.MAX_PARTICLES, Math.round((diag / 1000) * d)));
  }

  // ── Spatial grid helpers ───────────────────────────────────────────────
  function rebuildGrid() {
    gridCols = Math.ceil(W / CONFIG.CELL_SIZE) + 1;
    gridRows = Math.ceil(H / CONFIG.CELL_SIZE) + 1;
    var total = gridCols * gridRows;
    while (grid.length < total) grid.push([]);
    grid.length = total;
  }

  function clearGrid() {
    for (var i = 0, n = gridCols * gridRows; i < n; i++) {
      grid[i].length = 0;
    }
  }

  function gridIndex(x, y) {
    var c = (x / CONFIG.CELL_SIZE) | 0;
    var r = (y / CONFIG.CELL_SIZE) | 0;
    if (c < 0) c = 0; if (c >= gridCols) c = gridCols - 1;
    if (r < 0) r = 0; if (r >= gridRows) r = gridRows - 1;
    return r * gridCols + c;
  }

  // ── Particle factory ──────────────────────────────────────────────────
  function makeParticle(x, y) {
    var isStar = Math.random() < CONFIG.STAR_RATIO;
    var angle = rand(0, TWO_PI);
    var speed = rand(CONFIG.SPEED_INIT_MIN, CONFIG.SPEED_INIT_MAX);
    if (isStar) speed *= 0.65; // stars drift a bit more calmly
    if (reducedMotion) speed *= 0.05;

    var baseSize = isStar ? rand(CONFIG.STAR_SIZE_MIN, CONFIG.STAR_SIZE_MAX)
                          : rand(CONFIG.PARTICLE_SIZE_MIN, CONFIG.PARTICLE_SIZE_MAX);

    return {
      x: x !== undefined ? x : rand(10, W - 10),
      y: y !== undefined ? y : rand(10, H - 10),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      baseSize: baseSize,
      size: baseSize,
      baseOp: isStar ? rand(0.5, 0.85) : rand(CONFIG.PARTICLE_OPACITY_MIN, CONFIG.PARTICLE_OPACITY_MAX),
      opacity: 0,
      isStar: isStar,
      // Multi-harmonic star twinkle parameters
      starSpeed: rand(1.6, 4.2),
      starPhase: rand(0, TWO_PI),
      starHarmonic: rand(0.25, 0.55),
      starMinOp: rand(0.12, 0.28),
      starMaxOp: rand(0.85, 1.0),
      flickerVal: 0,
    };
  }

  function makeBurst(x, y) {
    var a = rand(0, TWO_PI);
    var s = rand(CONFIG.BURST_SPEED * 0.3, CONFIG.BURST_SPEED);
    return {
      x: x, y: y,
      vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      size: rand(0.8, 2.2),
      life: CONFIG.BURST_LIFETIME,
      maxLife: CONFIG.BURST_LIFETIME,
    };
  }

  // ── Resize ─────────────────────────────────────────────────────────────
  var resizeTimer = null;
  function resize() {
    dpr = window.devicePixelRatio || 1;
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    rebuildGrid();
    var t = calcCount();
    while (particles.length < t) particles.push(makeParticle());
    while (particles.length > t) particles.pop();
  }
  window.addEventListener('resize', function () {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, CONFIG.RESIZE_DEBOUNCE_MS);
  }, { passive: true });
  resize();

  var isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  var isTouchScrolling = false;
  var touchScrollTimer = null;

  window.addEventListener('scroll', function () {
    if (isTouchDevice) {
      mouseIn = false;
      isTouchScrolling = true;
      if (touchScrollTimer) clearTimeout(touchScrollTimer);
      touchScrollTimer = setTimeout(function () {
        isTouchScrolling = false;
      }, 100);
    }
  }, { passive: true });

  document.addEventListener('mousemove', function (e) {
    rawMX = e.clientX; rawMY = e.clientY; mouseIn = true;
  }, { passive: true });
  document.addEventListener('mouseleave', function () { mouseIn = false; }, { passive: true });
  document.addEventListener('touchmove', function (e) {
    if (!isTouchScrolling && e.touches && e.touches[0]) {
      rawMX = e.touches[0].clientX; rawMY = e.touches[0].clientY; mouseIn = true;
    }
  }, { passive: true });
  document.addEventListener('touchend', function () { mouseIn = false; }, { passive: true });
  document.addEventListener('click', function (e) {
    if (reducedMotion) return;
    for (var i = 0; i < CONFIG.BURST_COUNT; i++) bursts.push(makeBurst(e.clientX, e.clientY));
  }, { passive: true });

  // ── Visibility ─────────────────────────────────────────────────────────
  var tabVisible = true;
  document.addEventListener('visibilitychange', function () {
    tabVisible = !document.hidden;
    if (tabVisible) lastTime = performance.now();
  });

  // ── Render loop ────────────────────────────────────────────────────────
  var lastTime = performance.now();
  var elapsed = 0;

  function animate(now) {
    requestAnimationFrame(animate);
    if (!tabVisible) return;

    var dt = (now - lastTime) / 1000;
    lastTime = now;
    if (dt > 0.1) dt = 0.016;
    elapsed += dt;

    // Lerp mouse
    if (mouseIn) {
      sMX += (rawMX - sMX) * CONFIG.MOUSE_LERP;
      sMY += (rawMY - sMY) * CONFIG.MOUSE_LERP;
    } else {
      sMX = -9999; sMY = -9999;
    }

    var i, j, k, p, p2, dx, dy, dist;
    var len = particles.length;
    var maxSpd = CONFIG.MAX_SPEED;
    var damping = Math.pow(CONFIG.DAMPING, dt * 60);
    var brownF = CONFIG.BROWNIAN_FORCE;
    var repR = CONFIG.REPULSE_RADIUS;
    var repF = CONFIG.REPULSE_FORCE;
    var mouseR = CONFIG.MOUSE_RADIUS;
    var heatR = CONFIG.MOUSE_HEAT_RADIUS;
    var lineMax = CONFIG.LINE_MAX_DIST;

    // ── Build spatial grid ──
    clearGrid();
    for (i = 0; i < len; i++) {
      grid[gridIndex(particles[i].x, particles[i].y)].push(i);
    }

    // ── Update particles ──
    for (i = 0; i < len; i++) {
      p = particles[i];

      if (!reducedMotion) {
        // Brownian motion — gentle random acceleration
        var bAngle = rand(0, TWO_PI);
        var bMag = rand(0, brownF) * dt;
        p.vx += Math.cos(bAngle) * bMag;
        p.vy += Math.sin(bAngle) * bMag;

        // Damping
        p.vx *= damping;
        p.vy *= damping;

        // Speed cap
        var spd = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        if (spd > maxSpd) {
          var sc = maxSpd / spd;
          p.vx *= sc;
          p.vy *= sc;
        }
      }

      // Soft particle-particle repulsion
      if (!reducedMotion) {
        var col = (p.x / CONFIG.CELL_SIZE) | 0;
        var row = (p.y / CONFIG.CELL_SIZE) | 0;
        for (var dr = -1; dr <= 1; dr++) {
          for (var dc = -1; dc <= 1; dc++) {
            var nr = row + dr, nc = col + dc;
            if (nr < 0 || nr >= gridRows || nc < 0 || nc >= gridCols) continue;
            var cell = grid[nr * gridCols + nc];
            for (k = 0; k < cell.length; k++) {
              j = cell[k];
              if (j <= i) continue;
              p2 = particles[j];
              dx = p.x - p2.x; dy = p.y - p2.y;
              dist = Math.sqrt(dx * dx + dy * dy);
              if (dist < repR && dist > 0.5) {
                var overlap = (1 - dist / repR);
                var force = repF * overlap * dt;
                var nx = dx / dist, ny = dy / dist;
                p.vx += nx * force;
                p.vy += ny * force;
                p2.vx -= nx * force;
                p2.vy -= ny * force;
              }
            }
          }
        }
      }

      // Move
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Elastic wall bounce
      if (p.x < p.baseSize) { p.x = p.baseSize; p.vx = Math.abs(p.vx) * CONFIG.WALL_BOUNCE; }
      else if (p.x > W - p.baseSize) { p.x = W - p.baseSize; p.vx = -Math.abs(p.vx) * CONFIG.WALL_BOUNCE; }
      if (p.y < p.baseSize) { p.y = p.baseSize; p.vy = Math.abs(p.vy) * CONFIG.WALL_BOUNCE; }
      else if (p.y > H - p.baseSize) { p.y = H - p.baseSize; p.vy = -Math.abs(p.vy) * CONFIG.WALL_BOUNCE; }

      // Mouse interaction
      var extraBright = 0, sizeBoost = 0;
      if (mouseIn && !reducedMotion) {
        dx = p.x - sMX; dy = p.y - sMY;
        dist = Math.sqrt(dx * dx + dy * dy);

        // Strong push
        if (dist < mouseR && dist > 0.5) {
          var f = (1 - dist / mouseR);
          f = f * f;
          var ang = Math.atan2(dy, dx);
          p.vx += Math.cos(ang) * CONFIG.MOUSE_FORCE * f * dt;
          p.vy += Math.sin(ang) * CONFIG.MOUSE_FORCE * f * dt;
          extraBright = CONFIG.MOUSE_BRIGHTEN * f;
          sizeBoost = CONFIG.MOUSE_SIZE_BOOST * f;
        }

        // Agitation / heat zone near cursor
        if (dist < heatR) {
          var hf = (1 - dist / heatR) * CONFIG.MOUSE_HEAT_BOOST;
          var curSpd = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
          if (curSpd > 0.1) {
            var boost = 1 + hf * dt * 2.5;
            p.vx *= boost;
            p.vy *= boost;
          }
        }
      }

      // Calculate target opacity & star flicker
      var tOp;
      if (p.isStar) {
        // Multi-harmonic star twinkle wave
        var w1 = Math.sin(elapsed * p.starSpeed + p.starPhase);
        var w2 = Math.sin(elapsed * (p.starSpeed * 2.2) + p.starPhase * 1.6) * p.starHarmonic;
        var norm = (w1 + w2) / (1 + p.starHarmonic); // -1 to 1
        norm = (norm + 1) * 0.5; // 0 to 1
        p.flickerVal = Math.pow(norm, 2.2); // sharp sparkling peak
        var starOp = p.starMinOp + (p.starMaxOp - p.starMinOp) * p.flickerVal;
        tOp = Math.min(1, starOp + extraBright);
      } else {
        p.flickerVal = 0;
        tOp = Math.min(1, Math.max(0.12, p.baseOp + extraBright));
      }

      p.opacity += (tOp - p.opacity) * 0.15;
      var tSize = p.baseSize + sizeBoost;
      p.size += (tSize - p.size) * 0.14;
    }

    // ── Clear ──
    ctx.clearRect(0, 0, W, H);

    // ── Lines (via spatial grid) ──
    ctx.lineWidth = CONFIG.LINE_WIDTH;
    for (i = 0; i < len; i++) {
      p = particles[i];
      var pCol = (p.x / CONFIG.CELL_SIZE) | 0;
      var pRow = (p.y / CONFIG.CELL_SIZE) | 0;
      for (var dr2 = -1; dr2 <= 1; dr2++) {
        for (var dc2 = -1; dc2 <= 1; dc2++) {
          var nr2 = pRow + dr2, nc2 = pCol + dc2;
          if (nr2 < 0 || nr2 >= gridRows || nc2 < 0 || nc2 >= gridCols) continue;
          var cell2 = grid[nr2 * gridCols + nc2];
          for (k = 0; k < cell2.length; k++) {
            j = cell2[k];
            if (j <= i) continue;
            p2 = particles[j];
            dx = p.x - p2.x; dy = p.y - p2.y;
            if (dx > lineMax || dx < -lineMax || dy > lineMax || dy < -lineMax) continue;
            dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < lineMax) {
              ctx.moveTo(p.x, p.y);
              ctx.lineTo(p2.x, p2.y);
            }
          }
        }
      }
    }
    ctx.strokeStyle = 'rgba(255,255,255,' + CONFIG.LINE_OPACITY + ')';
    ctx.stroke();

    // ── Draw particles & star sparkles ──
    for (i = 0; i < len; i++) {
      p = particles[i];

      // Star-specific sparkle effects
      if (p.isStar) {
        // Soft corona halo when twinkling bright
        if (p.flickerVal > 0.45) {
          var haloR = p.size * (2.2 + p.flickerVal * 2.2);
          ctx.beginPath();
          ctx.arc(p.x, p.y, haloR, 0, TWO_PI);
          ctx.fillStyle = 'rgba(255,255,255,' + (p.opacity * 0.12 * p.flickerVal).toFixed(3) + ')';
          ctx.fill();
        }

        // Crisp 4-point diffraction spike on peak twinkle
        if (p.flickerVal > 0.72 && p.size >= 1.3) {
          var spike = p.size * (1.8 + p.flickerVal * 1.5);
          ctx.strokeStyle = 'rgba(255,255,255,' + (p.opacity * 0.35 * p.flickerVal).toFixed(3) + ')';
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(p.x - spike, p.y);
          ctx.lineTo(p.x + spike, p.y);
          ctx.moveTo(p.x, p.y - spike);
          ctx.lineTo(p.x, p.y + spike);
          ctx.stroke();
        }
      } else if (p.size > p.baseSize + 0.25) {
        // Mouse push halo
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 3.2, 0, TWO_PI);
        ctx.fillStyle = 'rgba(255,255,255,' + (p.opacity * 0.06).toFixed(3) + ')';
        ctx.fill();
      }

      // Core particle dot
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, TWO_PI);
      ctx.fillStyle = 'rgba(255,255,255,' + p.opacity.toFixed(3) + ')';
      ctx.fill();
    }

    // ── Bursts ──
    for (i = bursts.length - 1; i >= 0; i--) {
      var b = bursts[i];
      b.life -= dt;
      if (b.life <= 0) { bursts.splice(i, 1); continue; }
      b.vx *= (1 - 1.8 * dt); b.vy *= (1 - 1.8 * dt);
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.x < 0) { b.x = 0; b.vx = Math.abs(b.vx); }
      if (b.x > W) { b.x = W; b.vx = -Math.abs(b.vx); }
      if (b.y < 0) { b.y = 0; b.vy = Math.abs(b.vy); }
      if (b.y > H) { b.y = H; b.vy = -Math.abs(b.vy); }

      var lr = b.life / b.maxLife;
      var al = Math.min(1, lr < 0.7 ? lr / 0.7 : 1) * lr;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.size * lr * 3, 0, TWO_PI);
      ctx.fillStyle = 'rgba(255,255,255,' + (al * 0.08).toFixed(3) + ')';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.size * lr, 0, TWO_PI);
      ctx.fillStyle = 'rgba(255,255,255,' + (al * 0.9).toFixed(3) + ')';
      ctx.fill();
    }
  }

  requestAnimationFrame(animate);
})();

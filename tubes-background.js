/**
 * Tubes Interactive 3D Background Controller v2.0
 * -------------------------------------------------------------
 * High-performance 3D WebGL background featuring neon tubes that follow
 * cursor / touch movement across the screen with responsive spring physics.
 * 
 * Works without ES module restrictions (supports file:// and http/https).
 * Listens on window for 100% reliable cursor tracking with zero dead zones.
 */
(function () {
  'use strict';

  var PALETTES = [
    {
      name: 'Cyberpunk Neon',
      tubes: ['#f967fb', '#53bc28', '#6958d5'],
      lights: ['#83f36e', '#fe8a2e', '#ff008a', '#60aed5']
    },
    {
      name: 'Electric Synthwave',
      tubes: ['#ff007f', '#7928ca', '#00dfd8'],
      lights: ['#ff4d4d', '#f9cb28', '#7928ca', '#0070f3']
    },
    {
      name: 'Emerald Aurora',
      tubes: ['#00f2fe', '#4facfe', '#00f076'],
      lights: ['#43e97b', '#38f9d7', '#00c6ff', '#0072ff']
    },
    {
      name: 'Solar Flare',
      tubes: ['#ff4e50', '#f9d423', '#ff8008'],
      lights: ['#ff9900', '#ff5e36', '#ff0844', '#ffb199']
    },
    {
      name: 'Cosmic Violet',
      tubes: ['#9b51e0', '#e056fd', '#686de0'],
      lights: ['#be2edd', '#4834d4', '#e056fd', '#22a6b3']
    },
    {
      name: 'Quantum Matrix',
      tubes: ['#05ffa1', '#00b4d8', '#7209b7'],
      lights: ['#00f5d4', '#7b2cbf', '#4361ee', '#4cc9f0']
    },
    {
      name: 'Tokyo Cyber',
      tubes: ['#ff2a5f', '#00f0ff', '#ffe600'],
      lights: ['#ff0055', '#00e5ff', '#ffea00', '#9900ff']
    }
  ];

  var paletteIndex = 0;
  var tubesApp = null;
  var isInitialized = false;

  var pointerWorldTarget = { x: 0, y: 0 };
  var lastPointerClient = { x: null, y: null };
  var hasInteracted = false;
  var isPointerInWindow = false;

  var lastPointerMoveTime = 0;
  var IDLE_DELAY = 1800; // ms of inactivity before lemniscate begins
  var lemniscateBlend = 1.0; // Starts at 1.0 so initial page loads with the visible lemniscate

  function randomHex() {
    var letters = '56789ABCDEF';
    var color = '#';
    for (var i = 0; i < 6; i++) {
      color += letters[Math.floor(Math.random() * letters.length)];
    }
    return color;
  }

  function getRandomPalette(countTubes, countLights) {
    var tubes = [];
    var lights = [];
    for (var i = 0; i < countTubes; i++) tubes.push(randomHex());
    for (var j = 0; j < countLights; j++) lights.push(randomHex());
    return { name: 'Procedural Neon', tubes: tubes, lights: lights };
  }

  function setupDOM() {
    var existingWrap = document.getElementById('tubes-bg-wrap');
    if (existingWrap) return existingWrap.querySelector('canvas');

    var wrap = document.createElement('div');
    wrap.id = 'tubes-bg-wrap';
    wrap.setAttribute('aria-hidden', 'true');
    wrap.className = 'tubes-bg-wrap';

    var canvas = document.createElement('canvas');
    canvas.id = 'tubes-canvas';
    canvas.className = 'tubes-canvas';
    wrap.appendChild(canvas);

    var scrim = document.createElement('div');
    scrim.className = 'tubes-ambient-scrim';
    scrim.setAttribute('aria-hidden', 'true');

    if (document.body.firstChild) {
      document.body.insertBefore(scrim, document.body.firstChild);
      document.body.insertBefore(wrap, scrim);
    } else {
      document.body.appendChild(wrap);
      document.body.appendChild(scrim);
    }

    return canvas;
  }

  function randomizeColors() {
    if (!tubesApp || !tubesApp.tubes) return;

    var palette;
    if (Math.random() > 0.35) {
      paletteIndex = (paletteIndex + 1) % PALETTES.length;
      palette = PALETTES[paletteIndex];
    } else {
      palette = getRandomPalette(3, 4);
    }

    try {
      tubesApp.tubes.setColors(palette.tubes);
      tubesApp.tubes.setLightsColors(palette.lights);
    } catch (e) {
      console.warn('Failed to update tube colors:', e);
    }
  }

  function updatePointer(clientX, clientY) {
    lastPointerClient.x = clientX;
    lastPointerClient.y = clientY;
    lastPointerMoveTime = performance.now();
    hasInteracted = true;
    isPointerInWindow = true;

    if (!tubesApp || !tubesApp.three || !tubesApp.three.size) return;

    var size = tubesApp.three.size;
    var wW = size.wWidth || 4;
    var wH = size.wHeight || 3;

    // Convert client coordinates to normalized device coordinates [-1, 1]
    var ndcX = (clientX / window.innerWidth) * 2 - 1;
    var ndcY = -(clientY / window.innerHeight) * 2 + 1;

    // Project onto 3D world space at camera focus plane (z=0)
    pointerWorldTarget.x = ndcX * (wW * 0.5);
    pointerWorldTarget.y = ndcY * (wH * 0.5);
  }

  function checkIsMobile() {
    return (typeof window !== 'undefined') && (
      window.innerWidth <= 768 ||
      ('ontouchstart' in window) ||
      (navigator.maxTouchPoints > 0) ||
      (window.matchMedia && window.matchMedia('(hover: none) and (pointer: coarse)').matches)
    );
  }

  function initTubesEngine() {
    if (isInitialized) return;

    var TubesCursor = window.TubesCursor;
    if (typeof TubesCursor !== 'function') {
      // Retry in 50ms if script is still loading
      setTimeout(initTubesEngine, 50);
      return;
    }

    var canvas = setupDOM();
    if (!canvas) return;

    var isMobile = checkIsMobile();
    var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var initial = PALETTES[0];

    try {
      tubesApp = TubesCursor(canvas, {
        bloom: {
          threshold: 0,
          strength: isMobile ? 1.05 : 1.5,
          radius: isMobile ? 0.28 : 0.5
        },
        tubes: {
          count: isMobile ? 8 : 16,
          minRadius: isMobile ? 0.005 : 0.005,
          maxRadius: isMobile ? 0.032 : 0.05,
          colors: initial.tubes,
          lights: {
            intensity: prefersReduced ? 100 : (isMobile ? 140 : 220),
            colors: initial.lights
          }
        }
      });

      isInitialized = true;

      // Optimize rendering and install continuous, fluid 3D cursor steering & idle lemniscate
      if (tubesApp && tubesApp.three && tubesApp.tubes) {
        var updatePixelRatio = function () {
          var isMob = checkIsMobile();
          // Mobile GPUs benefit from 1.0 DPR for native 60-120fps glide and cool thermals
          tubesApp.three.minPixelRatio = 1;
          tubesApp.three.maxPixelRatio = isMob ? 1.0 : Math.min(window.devicePixelRatio || 1, 1.5);
          tubesApp.three.resize();
        };

        updatePixelRatio();

        tubesApp.three.onBeforeRender = function (time) {
          var size = tubesApp.three.size;
          var wW = (size && size.wWidth) || 4;
          var wH = (size && size.wHeight) || 3;
          var screenRatio = (size && size.ratio) || (window.innerWidth / (window.innerHeight || 1));

          var now = performance.now();
          var isIdle = !hasInteracted || !isPointerInWindow || ((now - lastPointerMoveTime) > IDLE_DELAY);

          if (isIdle) {
            // Smoothly ramp blend weight towards 1.0 (flowing into visible lemniscate)
            if (lemniscateBlend < 1) {
              lemniscateBlend += (1 - lemniscateBlend) * 0.035;
              if (lemniscateBlend > 0.995) lemniscateBlend = 1;
            }
          } else {
            // Smoothly ease blend weight down to 0.0 (responsive cursor tracking)
            if (lemniscateBlend > 0) {
              lemniscateBlend += (0 - lemniscateBlend) * 0.14;
              if (lemniscateBlend < 0.005) lemniscateBlend = 0;
            }
          }

          // Aspect-ratio-adaptive 3D Lemniscate of Gerono (Horizontal infinity loop with true spatial depth)
          var isPortrait = screenRatio < 1.0;
          var isTablet = screenRatio >= 1.0 && screenRatio < 1.35;

          // On mobile portrait, span 78% of the screen width for bold, vivid presence
          var lemWidth = isPortrait ? (wW * 0.39) : (isTablet ? (wW * 0.32) : (wW * 0.28));
          // Preserve the golden ~1.9:1 infinity proportion across all device ratios and orientations
          var lemHeight = lemWidth * 0.52;
          var lemDepth = isPortrait ? 0.35 : 0.45;

          // Slow, fluid cinematic speed (~9.6s per complete figure-eight cycle)
          var lemSpeed = 0.65;
          var t = time.elapsed * lemSpeed;

          // x = a * cos(t)
          // y = b * sin(2t)
          // z = c * sin(t) (passes in front at z > 0, loops back behind at z < 0)
          var lemX = lemWidth * Math.cos(t);
          var lemY = lemHeight * Math.sin(2 * t);
          var lemZ = lemDepth * Math.sin(t);

          // Continuous interpolation between cursor target and 3D lemniscate (zero snapping)
          var targetX = pointerWorldTarget.x * (1 - lemniscateBlend) + lemX * lemniscateBlend;
          var targetY = pointerWorldTarget.y * (1 - lemniscateBlend) + lemY * lemniscateBlend;
          var targetZ = 0 * (1 - lemniscateBlend) + lemZ * lemniscateBlend;

          // Responsive 3D spring-physics tracking
          tubesApp.tubes.target.x += (targetX - tubesApp.tubes.target.x) * 0.28;
          tubesApp.tubes.target.y += (targetY - tubesApp.tubes.target.y) * 0.28;
          tubesApp.tubes.target.z += (targetZ - tubesApp.tubes.target.z) * 0.28;

          tubesApp.tubes.update(time);
        };

        tubesApp.three.onAfterResize = function () {
          if (lastPointerClient.x !== null) {
            updatePointer(lastPointerClient.x, lastPointerClient.y);
          }
        };
      }

      window.TubesBackground = {
        app: tubesApp,
        randomizeColors: randomizeColors,
        palettes: PALETTES
      };

    } catch (err) {
      console.warn('Tubes 3D initialization error:', err);
    }
  }

  // Global cursor and touch tracking on window (100% uninterrupted by UI layers)
  var touchStartY = 0;
  var isTouchScrolling = false;

  window.addEventListener('pointermove', function (e) {
    if (e.pointerType === 'touch') return; // Handled specifically below to avoid touch-scroll thrashing
    updatePointer(e.clientX, e.clientY);
  }, { passive: true });

  window.addEventListener('touchstart', function (e) {
    if (e.touches && e.touches[0]) {
      touchStartY = e.touches[0].clientY;
      isTouchScrolling = false;
      updatePointer(e.touches[0].clientX, e.touches[0].clientY);
    }
  }, { passive: true });

  window.addEventListener('touchmove', function (e) {
    if (e.touches && e.touches[0]) {
      var dy = Math.abs(e.touches[0].clientY - touchStartY);
      if (dy > 12) {
        isTouchScrolling = true;
      }
      // When scrolling through content on mobile, keep the lemniscate gliding gracefully
      if (!isTouchScrolling) {
        updatePointer(e.touches[0].clientX, e.touches[0].clientY);
      }
    }
  }, { passive: true });

  // When fingers lift on mobile, smoothly return to idle lemniscate
  window.addEventListener('touchend', function () {
    isTouchScrolling = false;
    lastPointerMoveTime = performance.now();
  }, { passive: true });

  window.addEventListener('touchcancel', function () {
    isTouchScrolling = false;
    lastPointerMoveTime = performance.now();
  }, { passive: true });

  document.addEventListener('mouseleave', function () {
    isPointerInWindow = false;
  });

  document.addEventListener('mouseenter', function () {
    if (hasInteracted) {
      isPointerInWindow = true;
      lastPointerMoveTime = performance.now();
    }
  });

  // Handle mobile screen orientation change smoothly
  window.addEventListener('orientationchange', function () {
    setTimeout(function () {
      if (tubesApp && tubesApp.three) {
        var isMob = checkIsMobile();
        tubesApp.three.maxPixelRatio = isMob ? 1.0 : Math.min(window.devicePixelRatio || 1, 1.5);
        tubesApp.three.resize();
      }
      if (lastPointerClient.x !== null) {
        updatePointer(lastPointerClient.x, lastPointerClient.y);
      }
    }, 120);
  }, { passive: true });

  // Click anywhere on non-interactive regions to randomize neon palette
  document.addEventListener('click', function (e) {
    if (!isInitialized || !tubesApp) return;

    var interactive = e.target.closest('a, button, input, textarea, select, .video-progress-container, .video-controls, .play-pause-btn, .sound-toggle-btn');
    if (!interactive) {
      randomizeColors();
    }
  });

  // Start initialization
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTubesEngine);
  } else {
    initTubesEngine();
  }
})();

/**
 * Smooth Inertia Scroll Controller
 * -------------------------------------------------------------
 * Powered by Lenis for buttery smooth momentum scrolling across the entire page.
 * Eliminates browser scroll stutter and delivers fluid 60-120fps glide.
 */
(function () {
  'use strict';

  function initSmoothScroll() {
    if (typeof window.Lenis !== 'function') return;

    var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    var lenis = new window.Lenis({
      lerp: 0.1, // Responsive linear-interpolation momentum: 0ms input lag, silky deceleration
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 1.0,
      touchMultiplier: 1.0,
      syncTouch: false, // Let mobile touch use native high-refresh-rate hardware momentum
      autoRaf: true,    // Optimized native internal RAF loop
    });

    window.lenis = lenis;

    // Direct header state synchronization without polling or layout thrashing
    var header = document.querySelector('.header');
    if (header) {
      lenis.on('scroll', function (e) {
        var isScrolled = e.scroll > 25;
        if (isScrolled !== header.classList.contains('is-scrolled')) {
          if (isScrolled) {
            header.classList.add('is-scrolled');
          } else {
            header.classList.remove('is-scrolled');
          }
        }
      });
    }

    // Smooth anchor navigation with custom header offset
    document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
      anchor.addEventListener('click', function (e) {
        var href = this.getAttribute('href');
        if (!href || href === '#') return;

        var target = document.querySelector(href);
        if (target) {
          e.preventDefault();
          // Close mobile menu if open
          if (document.body.classList.contains('menu-open')) {
            document.body.classList.remove('menu-open');
          }

          lenis.scrollTo(target, {
            offset: -75,
            duration: 0.9,
            easing: function (t) {
              return Math.min(1, 1.001 - Math.pow(2, -10 * t));
            }
          });
        }
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSmoothScroll);
  } else {
    initSmoothScroll();
  }
})();

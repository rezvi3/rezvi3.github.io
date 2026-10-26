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

    // Use native 1:1 hardware scroll for mouse wheel & touch (zero latency)
    // while keeping buttery-smooth programmatic anchor jumps with custom offset
    var lenis = new window.Lenis({
      duration: 0.7,
      easing: function (t) {
        return Math.min(1, 1.001 - Math.pow(2, -10 * t));
      },
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: false, // Native 1:1 hardware scroll eliminates artificial wheel lag completely
      syncTouch: false,   // Native high-refresh-rate 120Hz mobile touch
      autoRaf: true,
    });

    window.lenis = lenis;

    // Direct header state synchronization without polling or layout thrashing
    var header = document.querySelector('.header');
    if (header) {
      window.addEventListener('scroll', function () {
        var isScrolled = window.scrollY > 25;
        if (isScrolled !== header.classList.contains('is-scrolled')) {
          if (isScrolled) {
            header.classList.add('is-scrolled');
          } else {
            header.classList.remove('is-scrolled');
          }
        }
      }, { passive: true });
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
            duration: 0.8,
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

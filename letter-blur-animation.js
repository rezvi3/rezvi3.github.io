/**
 * Letter Blur Animation Engine
 * -------------------------------------------------------------
 * Splits H3 heading components into words and individual letters,
 * animating each letter with a complex staggered transition:
 * - Fades in (opacity: 0 -> 1)
 * - Slides up (translateY: 24px -> 0)
 * - Reduces blur (filter: blur(14px) -> blur(0px))
 * 
 * Styled with Tailwind-compatible utility classes, tight letter tracking,
 * responsive typography, and smooth glowing color transitions.
 * Fully accessible with screen-reader aria-label preservation.
 * Optimized for Lenis smooth momentum scrolling & mobile touch viewports.
 */
(function () {
  'use strict';

  function splitAndAnimateHeading(heading) {
    if (!heading || heading.dataset.splitInitialized) return;

    var originalText = heading.textContent.trim();
    if (!originalText) return;

    // Preserve semantic accessibility
    if (!heading.getAttribute('aria-label')) {
      heading.setAttribute('aria-label', originalText);
    }

    var baseDelay = parseFloat(heading.dataset.delay || '0.06');
    var stagger = parseFloat(heading.dataset.stagger || '0.02');

    // Split text into words to prevent awkward line breaks on mobile
    var words = originalText.split(/\s+/);
    heading.innerHTML = '';
    heading.classList.add('blur-slide-heading');

    var globalCharIndex = 0;

    words.forEach(function (word, wordIdx) {
      var wordSpan = document.createElement('span');
      wordSpan.className = 'blur-slide-word';
      wordSpan.setAttribute('aria-hidden', 'true');

      // Split word into characters
      for (var i = 0; i < word.length; i++) {
        var char = word[i];
        var charSpan = document.createElement('span');
        charSpan.className = 'blur-slide-char';
        charSpan.textContent = char;
        charSpan.style.setProperty('--char-idx', globalCharIndex);
        charSpan.style.setProperty('--base-delay', baseDelay + 's');
        charSpan.style.setProperty('--char-stagger', stagger + 's');

        wordSpan.appendChild(charSpan);
        globalCharIndex++;
      }

      heading.appendChild(wordSpan);

      // Add a clean space between words
      if (wordIdx < words.length - 1) {
        var spaceSpan = document.createElement('span');
        spaceSpan.className = 'blur-slide-space';
        spaceSpan.setAttribute('aria-hidden', 'true');
        spaceSpan.innerHTML = '&nbsp;';
        heading.appendChild(spaceSpan);
      }
    });

    heading.classList.add('is-animating');
    heading.dataset.splitInitialized = 'true';
  }

  function initObserver() {
    var headings = Array.from(document.querySelectorAll('.blur-slide-heading, [data-animate="letter-blur"], .hero-banner-h3, .section-banner-h3'));

    headings.forEach(function (h) {
      splitAndAnimateHeading(h);
    });

    var unrevealedCount = headings.length;

    function revealHeading(h) {
      if (!h || h.classList.contains('is-revealed')) return;
      h.classList.add('is-revealed');
      unrevealedCount--;

      // Auto-cleanup will-change once all letters finish animation to preserve mobile GPU memory
      var chars = h.querySelectorAll('.blur-slide-char');
      var lastChar = chars[chars.length - 1];
      if (lastChar) {
        var onEnd = function () {
          h.classList.add('animation-completed');
          lastChar.removeEventListener('transitionend', onEnd);
        };
        lastChar.addEventListener('transitionend', onEnd);
      }
    }

    if ('IntersectionObserver' in window) {
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            revealHeading(entry.target);
            observer.unobserve(entry.target);
          }
        });
      }, {
        root: null,
        rootMargin: '0px 0px -40px 0px',
        threshold: 0.1
      });

      headings.forEach(function (h) {
        // Immediate reveal ONLY for hero banner or elements with explicit immediate flag
        if (h.classList.contains('hero-banner-h3') || h.classList.contains('profile-name') || h.dataset.immediate === 'true') {
          requestAnimationFrame(function () {
            requestAnimationFrame(function () {
              revealHeading(h);
            });
          });
        } else {
          observer.observe(h);
        }
      });
    } else {
      headings.forEach(function (h) {
        revealHeading(h);
      });
    }

    // Global helper to replay animation on demand
    window.replayLetterAnimation = function (selectorOrEl) {
      var el = typeof selectorOrEl === 'string' ? document.querySelector(selectorOrEl) : selectorOrEl;
      if (!el) return;
      el.classList.remove('is-revealed', 'animation-completed');
      void el.offsetWidth; // force reflow
      revealHeading(el);
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initObserver);
  } else {
    initObserver();
  }
})();

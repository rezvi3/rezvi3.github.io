(function () {
  'use strict';

  // 1. Entrance animation handling & auto cleanup
  var appearElements = document.querySelectorAll('.appear');
  function markAllIn() {
    appearElements.forEach(function (el) {
      el.classList.add('is-in');
    });
  }

  appearElements.forEach(function (el) {
    el.addEventListener('animationend', function () {
      el.classList.add('is-in');
    }, { once: true });
  });

  // Safety timer to clear all animation calculations after entrance finishes
  setTimeout(markAllIn, 1600);

  // 2. Background Video — REMOVED (replaced by particles.js canvas background)

  // 3. Mobile Navigation Drawer & Burger Controller
  var burger = document.getElementById('burger-toggle');
  var backdrop = document.getElementById('menu-backdrop');
  var nav = document.getElementById('site-nav');
  var headerEl = document.querySelector('.header');

  function openMenu() {
    if (headerEl && nav) {
      var headerBottom = headerEl.getBoundingClientRect().bottom;
      nav.style.top = Math.max(56, Math.round(headerBottom + 8)) + 'px';
    }
    document.body.classList.add('menu-open');
    if (burger) {
      burger.setAttribute('aria-expanded', 'true');
      burger.setAttribute('aria-label', 'Close menu');
    }
  }

  function closeMenu() {
    document.body.classList.remove('menu-open');
    if (nav) {
      nav.style.top = '';
    }
    if (burger) {
      burger.setAttribute('aria-expanded', 'false');
      burger.setAttribute('aria-label', 'Open menu');
    }
  }

  function toggleMenu(e) {
    if (e) {
      e.stopPropagation();
    }
    if (document.body.classList.contains('menu-open')) {
      closeMenu();
    } else {
      openMenu();
    }
  }

  if (burger) {
    burger.addEventListener('click', toggleMenu);
  }
  if (backdrop) {
    backdrop.addEventListener('click', closeMenu);
  }

  // 4. Smooth Anchor Link Navigation with Header Offset
  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener('click', function (e) {
      var targetId = this.getAttribute('href');
      if (targetId === '#') return;
      var targetEl = document.querySelector(targetId);
      if (targetEl) {
        e.preventDefault();
        closeMenu();
        // Native compositor-driven smooth scroll (honors scroll-padding-top: 80px)
        targetEl.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && document.body.classList.contains('menu-open')) {
      closeMenu();
    }
  });

  // 5. Desktop resize watcher (matches 1024px mobile breakpoint)
  var desktopMedia = window.matchMedia('(min-width: 1025px)');
  desktopMedia.addEventListener('change', function (e) {
    if (e.matches) {
      closeMenu();
    }
  });

  // 6. Zero-Jank Header State Controller
  var header = document.querySelector('.header');
  var isScrolled = false;
  var scrollTicking = false;

  function onScrollTick() {
    var nowScrolled = window.scrollY > 25;
    if (nowScrolled !== isScrolled) {
      isScrolled = nowScrolled;
      if (isScrolled) {
        header.classList.add('is-scrolled');
      } else {
        header.classList.remove('is-scrolled');
      }
    }
    scrollTicking = false;
  }

  window.addEventListener('scroll', function () {
    if (!scrollTicking) {
      window.requestAnimationFrame(onScrollTick);
      scrollTicking = true;
    }
  }, { passive: true });

  onScrollTick();

  // 7. Dynamic Scroll-Driven Reveal Observer (Smooth Stagger & GPU Optimized)
  var revealElements = document.querySelectorAll('.scroll-reveal');
  if ('IntersectionObserver' in window) {
    var revealObserver = new IntersectionObserver(function (entries, observer) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          observer.unobserve(entry.target);
        }
      });
    }, {
      root: null,
      rootMargin: '100px 0px 100px 0px',
      threshold: 0
    });

    revealElements.forEach(function (el) {
      revealObserver.observe(el);
    });
  } else {
    revealElements.forEach(function (el) {
      el.classList.add('revealed');
    });
  }

  // Safety fallback: guarantee all cards are visible even if observer is throttled
  setTimeout(function () {
    document.querySelectorAll('.scroll-reveal:not(.revealed)').forEach(function (el) {
      el.classList.add('revealed');
    });
  }, 1000);

  // 8. Video Editing Showcase Preview Controller (Starts at 23s)
  var editVideo = document.querySelector('.edit-preview-video');
  var playPauseBtn = document.querySelector('.play-pause-btn');
  var soundToggleBtn = document.querySelector('.sound-toggle-btn');
  var progressContainer = document.querySelector('.video-progress-container');
  var progressBar = document.querySelector('.video-progress-bar');
  var START_TIME = 23;

  if (editVideo) {
    editVideo.muted = true;
    editVideo.defaultMuted = true;

    function ensureStartPoint() {
      if (editVideo.currentTime < START_TIME || isNaN(editVideo.currentTime)) {
        try {
          editVideo.currentTime = START_TIME;
        } catch (e) {}
      }
    }

    editVideo.addEventListener('loadedmetadata', ensureStartPoint);
    editVideo.addEventListener('canplay', ensureStartPoint, { once: true });
    if (editVideo.readyState >= 1) {
      ensureStartPoint();
    }

    // Dynamic playback tracking & loop back to 23s
    editVideo.addEventListener('timeupdate', function () {
      if (editVideo.duration) {
        var duration = editVideo.duration;
        // Loop back when reaching end of video
        if (editVideo.currentTime >= duration - 0.25) {
          editVideo.currentTime = START_TIME;
          editVideo.play().catch(function () {});
        }

        // Update progress bar
        var previewTotal = Math.max(1, duration - START_TIME);
        var currentProgress = Math.max(0, editVideo.currentTime - START_TIME);
        var percent = Math.min(100, Math.max(0, (currentProgress / previewTotal) * 100));
        if (progressBar) {
          progressBar.style.width = percent + '%';
        }
      }
    });

    editVideo.addEventListener('ended', function () {
      editVideo.currentTime = START_TIME;
      editVideo.play().catch(function () {});
    });

    // Play/Pause State Controller
    function updatePlayPauseUI(isPlaying) {
      if (!playPauseBtn) return;
      var iconPause = playPauseBtn.querySelector('.icon-pause');
      var iconPlay = playPauseBtn.querySelector('.icon-play');
      if (isPlaying) {
        if (iconPause) iconPause.style.display = 'block';
        if (iconPlay) iconPlay.style.display = 'none';
        playPauseBtn.setAttribute('aria-label', 'Pause video');
      } else {
        if (iconPause) iconPause.style.display = 'none';
        if (iconPlay) iconPlay.style.display = 'block';
        playPauseBtn.setAttribute('aria-label', 'Play video');
      }
    }

    function togglePlayPause() {
      if (editVideo.paused) {
        if (editVideo.currentTime < START_TIME || (editVideo.duration && editVideo.currentTime >= editVideo.duration - 0.3)) {
          editVideo.currentTime = START_TIME;
        }
        var p = editVideo.play();
        if (p && typeof p.catch === 'function') {
          p.catch(function () {});
        }
      } else {
        editVideo.pause();
      }
    }

    editVideo.addEventListener('play', function () { updatePlayPauseUI(true); });
    editVideo.addEventListener('pause', function () { updatePlayPauseUI(false); });

    if (playPauseBtn) {
      playPauseBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        togglePlayPause();
      });
    }

    editVideo.addEventListener('click', function (e) {
      e.stopPropagation();
      togglePlayPause();
    });

    // Sound / Audio Controller
    function updateSoundUI(isMuted) {
      if (!soundToggleBtn) return;
      var iconMuted = soundToggleBtn.querySelector('.icon-muted');
      var iconUnmuted = soundToggleBtn.querySelector('.icon-unmuted');
      var soundLabel = soundToggleBtn.querySelector('.sound-label');
      if (isMuted) {
        if (iconMuted) iconMuted.style.display = 'block';
        if (iconUnmuted) iconUnmuted.style.display = 'none';
        if (soundLabel) soundLabel.textContent = 'Audio';
        soundToggleBtn.setAttribute('aria-label', 'Unmute audio');
      } else {
        if (iconMuted) iconMuted.style.display = 'none';
        if (iconUnmuted) iconUnmuted.style.display = 'block';
        if (soundLabel) soundLabel.textContent = 'Mute';
        soundToggleBtn.setAttribute('aria-label', 'Mute audio');
      }
    }

    if (soundToggleBtn) {
      soundToggleBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        editVideo.muted = !editVideo.muted;
        updateSoundUI(editVideo.muted);
        if (!editVideo.muted && editVideo.paused) {
          editVideo.play().catch(function () {});
        }
      });
    }

    // Seek via Progress Bar (Click & Touch Drag Scrubbing for Android/Mobile)
    if (progressContainer) {
      function seekByClientX(clientX) {
        if (!editVideo.duration) return;
        var rect = progressContainer.getBoundingClientRect();
        var clickX = clientX - rect.left;
        var width = rect.width;
        var ratio = Math.max(0, Math.min(1, clickX / width));
        var duration = editVideo.duration;
        var previewTotal = duration - START_TIME;
        var newTime = START_TIME + (ratio * previewTotal);
        editVideo.currentTime = newTime;
      }

      progressContainer.addEventListener('click', function (e) {
        e.stopPropagation();
        seekByClientX(e.clientX);
        if (editVideo.paused) {
          editVideo.play().catch(function () {});
        }
      });

      var isScrubbing = false;
      progressContainer.addEventListener('touchstart', function (e) {
        if (e.touches && e.touches[0]) {
          isScrubbing = true;
          seekByClientX(e.touches[0].clientX);
        }
      }, { passive: true });

      window.addEventListener('touchmove', function (e) {
        if (isScrubbing && e.touches && e.touches[0]) {
          seekByClientX(e.touches[0].clientX);
        }
      }, { passive: true });

      window.addEventListener('touchend', function () {
        if (isScrubbing) {
          isScrubbing = false;
          if (editVideo.paused) {
            editVideo.play().catch(function () {});
          }
        }
      }, { passive: true });
    }

    // Autoplay muted when visible in viewport
    if ('IntersectionObserver' in window) {
      var videoObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            if (editVideo.currentTime < START_TIME) {
              editVideo.currentTime = START_TIME;
            }
            if (editVideo.paused) {
              editVideo.play().catch(function () {});
            }
          } else {
            if (!editVideo.paused) {
              editVideo.pause();
            }
          }
        });
      }, { threshold: 0.15 });
      videoObserver.observe(editVideo);
    }
  }
})();
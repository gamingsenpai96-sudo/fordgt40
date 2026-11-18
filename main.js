/* ============================================================
   Ford GT40 — Go Like Hell  |  Cinematic Native Video Engine
   ============================================================
   - Direct hardware-accelerated HTML5 Video playback (Zero lag)
   - "SCROLL TO BEGIN" prompt displayed on initial site visit
   - Smooth unmuted native video audio playback on first interaction
   - Pauses on the final heroic forward stance with headlights ablaze
   - Staggered entrance for hero typography, HUD specs, & navigation chips
   - Seamless unlocked scrolling into Slide 2 Showroom & Slide 3 Game
   ============================================================ */

(() => {
  'use strict';

  // ---- Config ----
  const VIDEO_PAUSE_TIME          = 9.85;  // Seconds: Exact moment car settles into heroic stance
  const LANDING_TRANSITION_HEIGHT = 800;   // Scroll track for smooth parallax exit into story

  // ---- DOM Elements ----
  const heroVideo         = document.getElementById('hero-car-video');
  const heroVideoWrap     = document.getElementById('hero-video-wrap');
  const scrollStartCue    = document.getElementById('scroll-start-cue');
  const preloader         = document.getElementById('preloader');
  const percentEl         = document.getElementById('preloader-percent');
  const overlay           = document.getElementById('overlay');
  const scrollSpacer      = document.getElementById('scroll-spacer');
  const progressFill      = document.getElementById('scroll-progress-fill');
  const soundBtn          = document.getElementById('sound-btn');
  const soundBtnText      = document.getElementById('sound-btn-text');
  const soundSvgMuted     = document.getElementById('sound-svg-muted');
  const soundSvgOn        = document.getElementById('sound-svg-on');
  const engineIndicator   = document.getElementById('engine-indicator');
  const indicatorText     = engineIndicator ? engineIndicator.querySelector('.engine-indicator-text') : null;
  const landingContinueHint = document.getElementById('landing-continue-hint');
  const storyContainer    = document.getElementById('story-container');

  // ---- State ----
  let videoStarted   = false;
  let videoFinished  = false;
  let storyUnlocked  = false;
  let isSoundActive  = true;

  // ---- Creative Engine State ----
  let lenisInstance        = null;
  let webAudioCtx          = null;
  let audioAnalyser        = null;
  let audioDataArray       = null;
  let audioSourceConnected = false;
  const eqBars             = document.querySelectorAll('.eq-bar');

  // =================================================================
  //  Live Web Audio Equalizer & Real-Time Spectrum
  // =================================================================

  function initWebAudioVisualizer() {
    if (!heroVideo || audioSourceConnected) return;
    try {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtxClass) return;
      webAudioCtx = new AudioCtxClass();
      const source = webAudioCtx.createMediaElementSource(heroVideo);
      audioAnalyser = webAudioCtx.createAnalyser();
      audioAnalyser.fftSize = 64; // High response rate, 32 frequency buckets
      source.connect(audioAnalyser);
      audioAnalyser.connect(webAudioCtx.destination);
      audioDataArray = new Uint8Array(audioAnalyser.frequencyBinCount);
      audioSourceConnected = true;
      renderAudioVisualizer();
    } catch (e) {
      console.warn('Web Audio visualizer fallback:', e);
    }
  }

  function renderAudioVisualizer() {
    requestAnimationFrame(renderAudioVisualizer);
    if (!heroVideo || heroVideo.paused || heroVideo.muted || !audioAnalyser || !eqBars || eqBars.length === 0) return;
    audioAnalyser.getByteFrequencyData(audioDataArray);

    for (let i = 0; i < eqBars.length; i++) {
      const val = audioDataArray[i * 2 + 1] || 0;
      const barH = Math.max(3, Math.min(16, (val / 255) * 16));
      eqBars[i].style.height = `${barH}px`;
    }
  }

  // =================================================================
  //  Victory Celebration Confetti & Rolling Odometer Numbers
  // =================================================================

  function triggerVictoryConfetti() {
    if (typeof confetti === 'function') {
      confetti({
        particleCount: 90,
        spread: 80,
        origin: { y: 0.75 },
        colors: ['#38bdf8', '#ff3b20', '#ffffff', '#ffd700', '#1e293b']
      });
    }
  }

  function animateSpecNumbers() {
    const specNums = document.querySelectorAll('.spec-num');
    specNums.forEach((el) => {
      const target = parseFloat(el.getAttribute('data-target') || '0');
      const decimals = parseInt(el.getAttribute('data-decimals') || '0', 10);
      const hasComma = el.getAttribute('data-comma') === 'true';
      const duration = 1200;
      const startTime = performance.now();

      function step(now) {
        const elapsed = now - startTime;
        const progress = Math.min(1, elapsed / duration);
        const ease = 1 - Math.pow(1 - progress, 3);
        const current = target * ease;

        if (hasComma) {
          el.textContent = Math.round(current).toLocaleString();
        } else {
          el.textContent = current.toFixed(decimals);
        }

        if (progress < 1) {
          requestAnimationFrame(step);
        } else {
          if (hasComma) {
            el.textContent = target.toLocaleString();
          } else {
            el.textContent = target.toFixed(decimals);
          }
        }
      }
      requestAnimationFrame(step);
    });
  }

  // =================================================================
  //  Engine Indicator & Sound Management
  // =================================================================

  function setIndicator(text, active = true) {
    if (!engineIndicator) return;
    if (active) {
      if (indicatorText) indicatorText.textContent = text;
      engineIndicator.classList.add('active');
    } else {
      engineIndicator.classList.remove('active');
    }
  }

  function updateSoundUI() {
    if (!soundBtn || !heroVideo) return;
    if (!heroVideo.muted && heroVideo.volume > 0.05) {
      soundBtn.classList.remove('pulsing');
      soundBtn.classList.add('unmuted');
      if (soundSvgMuted) soundSvgMuted.style.display = 'none';
      if (soundSvgOn) soundSvgOn.style.display = 'block';
      if (soundBtnText) soundBtnText.textContent = 'GT40 AUDIO: ACTIVE';
    } else {
      soundBtn.classList.remove('unmuted');
      if (soundSvgMuted) soundSvgMuted.style.display = 'block';
      if (soundSvgOn) soundSvgOn.style.display = 'none';
      if (soundBtnText) soundBtnText.textContent = 'AUDIO MUTED';
    }
  }

  function toggleSound(e) {
    if (e) e.stopPropagation();
    if (!heroVideo) return;

    if (heroVideo.muted) {
      heroVideo.muted = false;
      heroVideo.volume = 1.0;
      isSoundActive = true;
    } else {
      heroVideo.muted = true;
      isSoundActive = false;
    }
    updateSoundUI();
  }

  if (soundBtn) {
    soundBtn.addEventListener('click', toggleSound);
  }

  // =================================================================
  //  Hero Video Playback & Pause Controller
  // =================================================================

  function startHeroVideo() {
    if (videoStarted || !heroVideo) return;
    videoStarted = true;

    // Fade out initial "SCROLL TO BEGIN" prompt smoothly
    if (scrollStartCue) {
      scrollStartCue.classList.add('cue-hidden');
    }

    // Initialize real-time acoustic spectrum visualizer
    initWebAudioVisualizer();

    // Try playing unmuted with full native video audio
    heroVideo.muted = false;
    heroVideo.volume = 1.0;

    const playPromise = heroVideo.play();
    if (playPromise !== undefined) {
      playPromise.then(() => {
        isSoundActive = true;
        updateSoundUI();
        setIndicator('FORD 7.0L V8 • IGNITION', true);
      }).catch((err) => {
        console.warn('Browser required muted fallback first:', err);
        heroVideo.muted = true;
        heroVideo.play().catch(() => {});
        updateSoundUI();
        if (soundBtn) {
          soundBtn.classList.add('pulsing');
          if (soundBtnText) soundBtnText.textContent = '⚡ CLICK FOR SOUND';
        }
        setIndicator('FORD 7.0L V8 • IGNITION', true);
      });
    }
  }

  function finishHeroSequence() {
    if (videoFinished) return;
    videoFinished = true;
    videoStarted = true;

    if (scrollStartCue) {
      scrollStartCue.classList.add('cue-hidden');
      scrollStartCue.style.display = 'none';
    }

    if (heroVideo) {
      heroVideo.pause();
      // Ensure we stay pinned at the settled frame
      try {
        if (heroVideo.currentTime < VIDEO_PAUSE_TIME) {
          heroVideo.currentTime = VIDEO_PAUSE_TIME;
        }
      } catch (e) {}
    }

    setIndicator('FORD 7.0L V8 • IDLE', true);

    // Reveal overlay typography, specs, and bottom chips
    showOverlay();

    // Unlock scrolling into Slide 2 Showroom & Slide 3 Game
    unlockStory();
  }
  window.finishHeroSequence = finishHeroSequence;

  if (heroVideo) {
    heroVideo.addEventListener('timeupdate', () => {
      const ct = heroVideo.currentTime;
      const duration = heroVideo.duration || 10.0;

      // Update right progress bar
      if (progressFill && duration > 0) {
        const pct = Math.min(100, Math.max(0, (ct / duration) * 100));
        progressFill.style.height = `${pct}%`;
      }

      if (!videoFinished) {
        if (ct >= 0.5 && ct < 3.2) {
          setIndicator('FORD 7.0L V8 • IGNITION', true);
        } else if (ct >= 3.2 && ct < 7.2) {
          setIndicator('FORD 7.0L V8 • ACCELERATING', true);
        } else if (ct >= 7.2 && ct < VIDEO_PAUSE_TIME) {
          setIndicator('FORD 7.0L V8 • 485 BHP FULL THROTTLE', true);
        }

        // Pause car when forward movement is complete
        if (ct >= VIDEO_PAUSE_TIME) {
          finishHeroSequence();
        }
      }
    });

    heroVideo.addEventListener('ended', () => {
      finishHeroSequence();
    });
  }

  // =================================================================
  //  UI Overlay & Story Unlock Architecture
  // =================================================================

  function showOverlay() {
    if (!overlay) return;
    overlay.classList.remove('hidden');
    document.querySelectorAll('.animate-in').forEach((el) => {
      const delay = parseInt(el.dataset.delay, 10) || 0;
      setTimeout(() => el.classList.add('visible'), delay);
    });
    // Trigger digital rolling odometer animation for specs
    setTimeout(animateSpecNumbers, 480);
  }

  function hideOverlay() {
    if (!overlay) return;
    overlay.classList.add('hidden');
    document.querySelectorAll('.animate-in').forEach((el) => {
      el.classList.remove('visible');
    });
  }

  function unlockStory() {
    if (storyUnlocked) return;
    storyUnlocked = true;
    window.__storyUnlocked = true;

    if (storyContainer) {
      storyContainer.classList.add('unlocked');
    }

    setTimeout(() => {
      if (window.gt40ExplodedViewer && typeof window.gt40ExplodedViewer.onResize === 'function') {
        window.gt40ExplodedViewer.onResize();
      }
    }, 50);

    if (landingContinueHint) {
      setTimeout(() => {
        landingContinueHint.classList.add('visible');
      }, 400);
    }
  }

  // =================================================================
  //  Scroll & Gesture Handlers
  // =================================================================

  function setupStartInterceptors() {
    // 1. Wheel Listener: First downward scroll fires the video
    window.addEventListener('wheel', (e) => {
      if (!videoStarted && e.deltaY > 0) {
        startHeroVideo();
      }
    }, { passive: true });

    // 2. Touch Swipe Listener (Mobile / Trackpad)
    let touchStartY = 0;
    window.addEventListener('touchstart', (e) => {
      touchStartY = e.touches[0].clientY;
      // Any touch interaction also unlocks sound if muted
      if (heroVideo && heroVideo.muted && isSoundActive) {
        heroVideo.muted = false;
        updateSoundUI();
      }
    }, { passive: true });

    window.addEventListener('touchend', (e) => {
      if (!videoStarted) {
        const deltaY = touchStartY - e.changedTouches[0].clientY;
        if (deltaY > 20) {
          startHeroVideo();
        }
      }
    }, { passive: true });

    // 3. Click / Tap Listeners: Cue or hero area
    if (scrollStartCue) {
      scrollStartCue.addEventListener('click', (e) => {
        e.stopPropagation();
        startHeroVideo();
      });
    }

    if (heroVideoWrap) {
      heroVideoWrap.addEventListener('click', () => {
        if (!videoStarted) {
          startHeroVideo();
        }
      });
    }

    // 4. Keyboard Listener (ArrowDown, PageDown, Space, Enter)
    window.addEventListener('keydown', (e) => {
      if (!videoStarted && ['ArrowDown', 'PageDown', ' ', 'Enter'].includes(e.key)) {
        e.preventDefault();
        startHeroVideo();
      }
    });

    // 5. Landing Continue Hint Click ("SCROLL DOWN FOR MORE")
    if (landingContinueHint) {
      landingContinueHint.addEventListener('click', (e) => {
        e.preventDefault();
        if (!videoFinished) finishHeroSequence();
        const target = document.querySelector('#slide-2-showroom') || document.querySelector('#story');
        if (target) {
          if (lenisInstance) {
            lenisInstance.scrollTo(target, { duration: 1.4 });
          } else {
            target.scrollIntoView({ behavior: 'smooth' });
          }
        } else {
          window.scrollBy({ top: window.innerHeight * 0.85, behavior: 'smooth' });
        }
      });
    }

    // 6. Navigation Chips
    document.querySelectorAll('.bottom-nav a').forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        if (!videoFinished) finishHeroSequence();
        const href = link.getAttribute('href');
        const target = document.querySelector(href);
        if (target) {
          if (href === '#slide-2-showroom') {
            triggerVictoryConfetti();
          }
          setTimeout(() => {
            if (lenisInstance) {
              lenisInstance.scrollTo(target, { duration: 1.4 });
            } else {
              target.scrollIntoView({ behavior: 'smooth' });
            }
          }, 50);
        }
      });
    });
  }

  // =================================================================
  //  Scroll Handler: Smooth Parallax & Audio Fade into Slide 2
  // =================================================================

  let ticking = false;

  function onScroll() {
    if (ticking) return;
    ticking = true;

    requestAnimationFrame(() => {
      const scrollY = window.scrollY;

      // Case A: User scrolled before starting video -> start it now!
      if (!videoStarted && scrollY > 5) {
        startHeroVideo();
      }

      // Case B: Video still playing -> finish sequence if user intentionally scrolls down
      if (videoStarted && !videoFinished && scrollY > 80) {
        finishHeroSequence();
      }

      // Case C: Video finished -> smooth parallax push & audio fade as user enters Slide 2
      if (videoFinished) {
        const fadeDistance = window.innerHeight * 0.75;
        const fade = Math.max(0, 1 - scrollY / fadeDistance);
        const push = Math.min(scrollY * 0.65, window.innerHeight * 1.1);

        if (heroVideoWrap) {
          heroVideoWrap.style.transform = `translateY(-${push}px)`;
          heroVideoWrap.style.opacity = fade;
        }

        if (overlay) {
          overlay.style.transform = `translateY(-${push}px)`;
          overlay.style.opacity = fade;
        }

        // Smoothly fade video volume down as user scrolls into Slide 2 Showroom
        if (heroVideo && !heroVideo.muted && isSoundActive) {
          heroVideo.volume = Math.max(0, Math.min(1, fade));
        }

        // Hide/Show indicator as user leaves Slide 1
        if (scrollY > fadeDistance * 1.1) {
          if (engineIndicator) engineIndicator.classList.remove('active');
        } else {
          if (engineIndicator) engineIndicator.classList.add('active');
        }
      }

      ticking = false;
    });
  }

  function observeSections() {
    const sections = document.querySelectorAll('.content-section');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view');
          }
        });
      },
      { threshold: 0.15 }
    );
    sections.forEach((s) => observer.observe(s));
  }

  // =================================================================
  //  Slide 2: Showroom Split & Audio Synthesizer & Experience Modals
  // =================================================================

  // Preload authentic recorded audio for Ford GT40 and Ferrari 330 P3
  let fordRevAudio = null;
  let ferrariRevAudio = null;

  function initRevAudioElements() {
    if (!fordRevAudio) {
      fordRevAudio = new Audio();
      fordRevAudio.preload = 'auto';
      // Support m4a and wav
      const canM4A = fordRevAudio.canPlayType('audio/mp4');
      fordRevAudio.src = canM4A ? 'assets/audio/ford-rev.m4a' : 'assets/audio/ford-rev.wav';
    }
    if (!ferrariRevAudio) {
      ferrariRevAudio = new Audio();
      ferrariRevAudio.preload = 'auto';
      const canM4A = ferrariRevAudio.canPlayType('audio/mp4');
      ferrariRevAudio.src = canM4A ? 'assets/audio/ferrari-rev.m4a' : 'assets/audio/ferrari-rev.wav';
    }
  }

  let audioSynthCtx = null;
  function getSynthCtx() {
    if (!audioSynthCtx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        audioSynthCtx = new AudioCtx();
      }
    }
    if (audioSynthCtx && audioSynthCtx.state === 'suspended') {
      audioSynthCtx.resume().catch(() => {});
    }
    return audioSynthCtx;
  }

  function playClickSound() {
    try {
      const ctx = getSynthCtx();
      if (!ctx) return;
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(900, t);
      osc.frequency.exponentialRampToValueAtTime(140, t + 0.04);
      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.05);
    } catch (e) {}
  }

  function playFordV8Rev() {
    try {
      initRevAudioElements();
      if (ferrariRevAudio && !ferrariRevAudio.paused) {
        ferrariRevAudio.pause();
        ferrariRevAudio.currentTime = 0;
      }
      if (fordRevAudio) {
        fordRevAudio.currentTime = 0;
        fordRevAudio.play().catch(() => playFordV8Synth());
      } else {
        playFordV8Synth();
      }
    } catch (e) {
      playFordV8Synth();
    }
  }

  function playFerrariV12Rev() {
    try {
      initRevAudioElements();
      if (fordRevAudio && !fordRevAudio.paused) {
        fordRevAudio.pause();
        fordRevAudio.currentTime = 0;
      }
      if (ferrariRevAudio) {
        ferrariRevAudio.currentTime = 0;
        ferrariRevAudio.play().catch(() => playFerrariV12Synth());
      } else {
        playFerrariV12Synth();
      }
    } catch (e) {
      playFerrariV12Synth();
    }
  }

  function playFordV8Synth() {
    try {
      const ctx = getSynthCtx();
      if (!ctx) return;
      const t = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(48, t);
      osc1.frequency.exponentialRampToValueAtTime(140, t + 0.6);
      osc1.frequency.exponentialRampToValueAtTime(52, t + 1.8);

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(96, t);
      osc2.frequency.exponentialRampToValueAtTime(280, t + 0.6);
      osc2.frequency.exponentialRampToValueAtTime(104, t + 1.8);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(320, t);
      filter.frequency.exponentialRampToValueAtTime(950, t + 0.6);
      filter.frequency.exponentialRampToValueAtTime(350, t + 1.8);

      gain.gain.setValueAtTime(0.01, t);
      gain.gain.linearRampToValueAtTime(0.55, t + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 2.0);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(t);
      osc2.start(t);
      osc1.stop(t + 2.1);
      osc2.stop(t + 2.1);
    } catch (e) {
      console.warn('Ford synth audio error:', e);
    }
  }

  function playFerrariV12Synth() {
    try {
      const ctx = getSynthCtx();
      if (!ctx) return;
      const t = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(160, t);
      osc1.frequency.exponentialRampToValueAtTime(580, t + 0.5);
      osc1.frequency.exponentialRampToValueAtTime(220, t + 1.7);

      osc2.type = 'sawtooth';
      osc2.frequency.setValueAtTime(320, t);
      osc2.frequency.exponentialRampToValueAtTime(1160, t + 0.5);
      osc2.frequency.exponentialRampToValueAtTime(440, t + 1.7);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, t);
      filter.frequency.exponentialRampToValueAtTime(2800, t + 0.5);
      filter.frequency.exponentialRampToValueAtTime(900, t + 1.7);

      gain.gain.setValueAtTime(0.01, t);
      gain.gain.linearRampToValueAtTime(0.48, t + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 1.9);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(t);
      osc2.start(t);
      osc1.stop(t + 2.0);
      osc2.stop(t + 2.0);
    } catch (e) {
      console.warn('Ferrari synth audio error:', e);
    }
  }

  function openExperienceModal(type) {
    const modalId = type === 'ford' ? 'ford-modal' : 'ferrari-modal';
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeExperienceModal(modalId) {
    const modals = modalId ? [document.getElementById(modalId)] : Array.from(document.querySelectorAll('.exp-modal'));
    modals.forEach((m) => {
      if (m) m.classList.remove('open');
    });
    document.body.style.overflow = '';
  }

  function setupShowroomSplit() {
    const container = document.getElementById('showroom-split-container');
    const fordHalf = document.getElementById('showroom-half-ford');
    const ferrariHalf = document.getElementById('showroom-half-ferrari');

    if (!container || !fordHalf || !ferrariHalf) return;

    fordHalf.addEventListener('mouseenter', () => {
      container.classList.remove('hover-ferrari');
      container.classList.add('hover-ford');
    });

    ferrariHalf.addEventListener('mouseenter', () => {
      container.classList.remove('hover-ford');
      container.classList.add('hover-ferrari');
    });

    container.addEventListener('mouseleave', () => {
      container.classList.remove('hover-ford', 'hover-ferrari');
    });

    const handleFordAction = () => {
      playFordV8Rev();
      openExperienceModal('ford');
    };
    fordHalf.addEventListener('click', handleFordAction);
    fordHalf.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleFordAction();
      }
    });

    const handleFerrariAction = () => {
      playFerrariV12Rev();
      openExperienceModal('ferrari');
    };
    ferrariHalf.addEventListener('click', handleFerrariAction);
    ferrariHalf.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleFerrariAction();
      }
    });
  }

  function setupExperienceModals() {
    // Close buttons
    document.querySelectorAll('[data-close-modal]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const modalId = btn.getAttribute('data-close-modal');
        closeExperienceModal(modalId);
      });
    });

    // Close on Escape key
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeExperienceModal();
      }
    });

    // Rev buttons
    const fordRevBtn = document.getElementById('btn-modal-ford-rev');
    if (fordRevBtn) {
      fordRevBtn.addEventListener('click', () => playFordV8Rev());
    }
    const ferrariRevBtn = document.getElementById('btn-modal-ferrari-rev');
    if (ferrariRevBtn) {
      ferrariRevBtn.addEventListener('click', () => playFerrariV12Rev());
    }

    // Tab switching inside modals
    document.querySelectorAll('.subnav-pill').forEach((pill) => {
      pill.addEventListener('click', () => {
        const group = pill.getAttribute('data-tab-group');
        const tab = pill.getAttribute('data-tab');
        if (!group || !tab) return;

        // Update pills
        document.querySelectorAll(`.subnav-pill[data-tab-group="${group}"]`).forEach((p) => {
          p.classList.remove('active', `active-${group}`);
        });
        pill.classList.add('active', `active-${group}`);

        // Update panels
        const modal = document.getElementById(`${group}-modal`);
        if (modal) {
          modal.querySelectorAll('.exp-tab-content').forEach((panel) => {
            panel.classList.remove('active');
          });
          const targetPanel = document.getElementById(`${group}-tab-${tab}`);
          if (targetPanel) {
            targetPanel.classList.add('active');
          }
        }
      });
    });

    // Quick jump cards
    document.querySelectorAll('[data-jump-tab]').forEach((card) => {
      card.addEventListener('click', () => {
        const group = card.getAttribute('data-tab-group');
        const tab = card.getAttribute('data-jump-tab');
        if (!group || !tab) return;

        const pill = document.querySelector(`.subnav-pill[data-tab-group="${group}"][data-tab="${tab}"]`);
        if (pill) {
          pill.click();
        }
      });
    });
  }

  // =================================================================
  //  Interactive Deck Handlers: Ignition, Specs Unit & Showroom Drag
  // =================================================================

  function setupHeroIgnition() {
    const btnMaster = document.getElementById('hero-btn-master');
    const btnFuel = document.getElementById('hero-btn-fuel');
    const btnStart = document.getElementById('hero-btn-start');
    const btnThrottle = document.getElementById('hero-btn-throttle');

    if (btnMaster) {
      btnMaster.addEventListener('click', (e) => {
        e.stopPropagation();
        btnMaster.classList.toggle('active');
        playClickSound();
        const active = btnMaster.classList.contains('active');
        setIndicator(active ? 'MASTER POWER: ENGAGED' : 'MASTER POWER: OFF', true);
      });
    }

    if (btnFuel) {
      btnFuel.addEventListener('click', (e) => {
        e.stopPropagation();
        btnFuel.classList.toggle('active');
        playClickSound();
        const active = btnFuel.classList.contains('active');
        setIndicator(active ? 'TWIN HOLLEY FUEL PUMPS: PRESSURIZED' : 'FUEL PUMPS: OFF', true);
      });
    }

    if (btnStart) {
      btnStart.addEventListener('click', (e) => {
        e.stopPropagation();
        playClickSound();

        const masterActive = btnMaster && btnMaster.classList.contains('active');
        const fuelActive = btnFuel && btnFuel.classList.contains('active');

        if (!masterActive || !fuelActive) {
          setIndicator('IGNITION ABORT: ENGAGE MASTER & FUEL PUMPS', true);
          return;
        }

        if (!videoStarted) {
          startHeroVideo();
        } else {
          playFordV8Rev();
          setIndicator('FORD 7.0L V8 • 485 BHP IGNITION FIRED', true);
        }
      });
    }

    if (btnThrottle) {
      let isThrottling = false;
      const startThrottle = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (isThrottling) return;
        isThrottling = true;
        btnThrottle.classList.add('revving');
        setIndicator('FORD 7.0L V8 • 7,000 RPM FULL THROTTLE', true);
        playFordV8Rev();
      };
      const endThrottle = (e) => {
        if (!isThrottling) return;
        isThrottling = false;
        btnThrottle.classList.remove('revving');
        setIndicator('FORD 7.0L V8 • IDLE 850 RPM', true);
      };

      btnThrottle.addEventListener('mousedown', startThrottle);
      btnThrottle.addEventListener('mouseup', endThrottle);
      btnThrottle.addEventListener('mouseleave', endThrottle);
      btnThrottle.addEventListener('touchstart', startThrottle, { passive: false });
      btnThrottle.addEventListener('touchend', endThrottle, { passive: false });
    }
  }

  function setupSpecsUnitToggle() {
    const toggle = document.getElementById('specs-unit-toggle');
    if (!toggle) return;
    const buttons = toggle.querySelectorAll('.unit-toggle-btn');
    const specList = document.querySelector('.specs-list');
    if (!specList) return;

    buttons.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const unit = btn.getAttribute('data-unit');
        buttons.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        playClickSound();

        if (unit === 'metric') {
          specList.innerHTML = `
            <div class="spec-row">
              <dt>ENGINE</dt>
              <dd><span class="spec-num" data-target="7.0" data-decimals="1">0.0</span>L FE V8</dd>
            </div>
            <div class="spec-row">
              <dt>POWER</dt>
              <dd><span class="spec-num" data-target="485" data-decimals="0">0</span> BHP</dd>
            </div>
            <div class="spec-row">
              <dt>WEIGHT</dt>
              <dd><span class="spec-num" data-target="1080" data-decimals="0" data-comma="true">0</span> KG</dd>
            </div>
            <div class="spec-row">
              <dt>TOP SPEED</dt>
              <dd><span class="spec-num" data-target="330" data-decimals="0">0</span> KM/H</dd>
            </div>
          `;
        } else {
          specList.innerHTML = `
            <div class="spec-row">
              <dt>ENGINE</dt>
              <dd><span class="spec-num" data-target="427" data-decimals="0">0</span> CU IN V8</dd>
            </div>
            <div class="spec-row">
              <dt>POWER</dt>
              <dd><span class="spec-num" data-target="485" data-decimals="0">0</span> BHP</dd>
            </div>
            <div class="spec-row">
              <dt>WEIGHT</dt>
              <dd><span class="spec-num" data-target="2380" data-decimals="0" data-comma="true">0</span> LBS</dd>
            </div>
            <div class="spec-row">
              <dt>TOP SPEED</dt>
              <dd><span class="spec-num" data-target="205" data-decimals="0">0</span> MPH</dd>
            </div>
          `;
        }
        animateSpecNumbers();
      });
    });
  }

  function setupShowroomDeck() {
    const duelFord = document.getElementById('btn-duel-ford');
    const duelFerrari = document.getElementById('btn-duel-ferrari');
    const dragLaunch = document.getElementById('btn-drag-launch');
    const dragFordBar = document.getElementById('drag-ford-bar');
    const dragFerrariBar = document.getElementById('drag-ferrari-bar');
    const dragFordStat = document.getElementById('drag-ford-stat');
    const dragFerrariStat = document.getElementById('drag-ferrari-stat');

    if (duelFord) {
      duelFord.addEventListener('click', (e) => {
        e.stopPropagation();
        playFordV8Rev();
      });
    }

    if (duelFerrari) {
      duelFerrari.addEventListener('click', (e) => {
        e.stopPropagation();
        playFerrariV12Rev();
      });
    }

    if (dragLaunch && dragFordBar && dragFerrariBar) {
      let isRacing = false;

      dragLaunch.addEventListener('click', (e) => {
        e.stopPropagation();
        if (isRacing) return;
        isRacing = true;

        dragLaunch.classList.add('racing');
        dragLaunch.innerHTML = '<span class="launch-icon">⚡</span><span>SPRINTING AT LE MANS...</span>';

        playFordV8Rev();

        const fordDot = dragFordBar.querySelector('.drag-car-dot');
        const ferrariDot = dragFerrariBar.querySelector('.drag-car-dot');

        const raceDuration = 5500; // 5.5s simulation for high intensity
        const startTime = performance.now();

        function updateSprint(now) {
          const elapsed = now - startTime;
          const t = Math.min(1, elapsed / raceDuration);

          const fordProg = Math.min(1, Math.pow(t, 1.25));
          const ferrariProg = Math.min(1, Math.pow(t, 1.4) * 0.94);

          const fordSpeed = Math.round(t * 205);
          const ferrariSpeed = Math.round(t * 193);

          if (fordDot) fordDot.style.left = `${fordProg * 100}%`;
          if (ferrariDot) ferrariDot.style.left = `${ferrariProg * 100}%`;

          const curSeconds = (t * 10.8).toFixed(1);

          if (dragFordStat) {
            dragFordStat.textContent = `${curSeconds}s • ${fordSpeed} MPH`;
          }
          if (dragFerrariStat) {
            dragFerrariStat.textContent = `${curSeconds}s • ${ferrariSpeed} MPH`;
          }

          if (t < 1) {
            requestAnimationFrame(updateSprint);
          } else {
            if (fordDot) fordDot.style.left = '100%';
            if (ferrariDot) ferrariDot.style.left = '92%';

            if (dragFordStat) {
              dragFordStat.innerHTML = '<strong style="color: #4ade80;">10.8s • 205 MPH 🏆 1ST</strong>';
            }
            if (dragFerrariStat) {
              dragFerrariStat.innerHTML = '<span style="color: #f87171;">11.4s • 193 MPH (+0.6s)</span>';
            }

            triggerVictoryConfetti();

            setTimeout(() => {
              dragLaunch.classList.remove('racing');
              dragLaunch.innerHTML = '<span class="launch-icon">🏁</span><span>RE-RUN DRAG SPRINT</span>';
              isRacing = false;
            }, 1800);
          }
        }

        requestAnimationFrame(updateSprint);
      });
    }
  }

  // =================================================================
  //  Creative Engines: Lenis, Vanilla-Tilt, Cursor, Particles
  // =================================================================

  function initLenis() {
    if (typeof Lenis !== 'undefined') {
      try {
        lenisInstance = new Lenis({
          duration: 1.25,
          easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
          smoothWheel: true,
          syncTouch: false
        });

        lenisInstance.on('scroll', () => {
          onScroll();
        });

        function raf(time) {
          lenisInstance.raf(time);
          requestAnimationFrame(raf);
        }
        requestAnimationFrame(raf);
      } catch (e) {
        console.warn('Lenis init error:', e);
      }
    }
  }

  // =================================================================
  //  GSAP, ScrollTrigger & Continuous Motion Design Architecture
  // =================================================================

  function initGSAPMotionDesign() {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') {
      console.warn('GSAP or ScrollTrigger not loaded.');
      return;
    }

    gsap.registerPlugin(ScrollTrigger);

    // 1. Synchronize Lenis and ScrollTrigger for buttery 120Hz scrubbing
    if (lenisInstance) {
      lenisInstance.on('scroll', ScrollTrigger.update);
      gsap.ticker.add((time) => {
        lenisInstance.raf(time * 1000);
      });
      gsap.ticker.lagSmoothing(0);
    }

    // 2. Continuous Telemetry Wayfinder Tracker & Needle
    const wayfinder = document.getElementById('telemetry-wayfinder');
    const needle = document.getElementById('wayfinder-needle');
    const nodes = document.querySelectorAll('.wayfinder-node');

    const sections = [
      { id: 'hero-video-wrap', index: 0 },
      { id: 'slide-2-showroom', index: 1 },
      { id: 'game-section', index: 2 },
      { id: 'exploded-section', index: 3 },
      { id: 'cockpit-sim-section', index: 4 },
      { id: 'circuit-section', index: 5 },
      { id: 'race-clock-section', index: 6 },
      { id: 'story', index: 7 }
    ];

    function setActiveWayfinder(idx) {
      nodes.forEach((n, i) => {
        n.classList.toggle('active', i === idx);
      });
      if (needle && nodes[idx]) {
        const nodeTop = nodes[idx].offsetTop;
        needle.style.transform = `translateY(${nodeTop - 18}px)`;
      }
    }

    sections.forEach((sec, idx) => {
      const el = document.getElementById(sec.id);
      if (!el) return;
      ScrollTrigger.create({
        trigger: el,
        start: 'top 60%',
        end: 'bottom 40%',
        onEnter: () => setActiveWayfinder(idx),
        onEnterBack: () => setActiveWayfinder(idx)
      });
    });

    // Wayfinder interactive click navigation
    nodes.forEach((node, idx) => {
      node.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = node.dataset.target;
        const targetEl = document.querySelector(targetId);
        if (targetEl) {
          if (!videoFinished) finishHeroSequence();
          if (lenisInstance) {
            lenisInstance.scrollTo(targetEl, { duration: 1.4, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)) });
          } else {
            targetEl.scrollIntoView({ behavior: 'smooth' });
          }
          setActiveWayfinder(idx);
        }
      });
    });

    // 3. Kinetic Showroom Car Faceoff Stagger
    const fordCar = document.querySelector('.split-half-ford .showroom-car-cutout');
    const ferrariCar = document.querySelector('.split-half-ferrari .showroom-car-cutout');
    if (fordCar && ferrariCar) {
      gsap.fromTo(fordCar, 
        { x: -100, opacity: 0 },
        { 
          x: 0, opacity: 1, duration: 1.3, ease: 'power3.out',
          scrollTrigger: {
            trigger: '#slide-2-showroom',
            start: 'top 80%',
            toggleActions: 'play none none reverse'
          }
        }
      );
      gsap.fromTo(ferrariCar, 
        { x: 100, opacity: 0 },
        { 
          x: 0, opacity: 1, duration: 1.3, ease: 'power3.out',
          scrollTrigger: {
            trigger: '#slide-2-showroom',
            start: 'top 80%',
            toggleActions: 'play none none reverse'
          }
        }
      );
    }

    // 4. 3D Game Simulator Viewport Materialization
    const gameContainer = document.getElementById('game-container');
    if (gameContainer) {
      gsap.fromTo(gameContainer,
        { scale: 0.94, opacity: 0.5, y: 30 },
        {
          scale: 1.0, opacity: 1.0, y: 0, duration: 1.2, ease: 'power2.out',
          scrollTrigger: {
            trigger: '#game-section',
            start: 'top 75%',
            toggleActions: 'play none none reverse'
          }
        }
      );
    }

    // 5. 3D Exploded Technical Breakdown Materialization
    const explodedContainer = document.getElementById('exploded-container');
    if (explodedContainer) {
      gsap.fromTo(explodedContainer,
        { scale: 0.94, opacity: 0.5, y: 30 },
        {
          scale: 1.0, opacity: 1.0, y: 0, duration: 1.2, ease: 'power2.out',
          scrollTrigger: {
            trigger: '#exploded-section',
            start: 'top 75%',
            toggleActions: 'play none none reverse'
          }
        }
      );
    }

    // 6. Continuous Timeline Bead Animation
    const timelineBead = document.getElementById('timeline-glow-bead');
    const timelineWrap = document.querySelector('.chronicles-timeline-wrap');
    if (timelineBead && timelineWrap) {
      ScrollTrigger.create({
        trigger: timelineWrap,
        start: 'top 70%',
        end: 'bottom 80%',
        scrub: 0.3,
        onUpdate: (self) => {
          const totalHeight = timelineWrap.offsetHeight - 160;
          timelineBead.style.transform = `translateY(${self.progress * totalHeight}px)`;
        }
      });
    }

    // 7. Staggered Chronicle Cards Reveal
    const chronicleCards = document.querySelectorAll('.chronicle-card');
    chronicleCards.forEach((card) => {
      gsap.fromTo(card,
        { opacity: 0, y: 40, scale: 0.98 },
        {
          opacity: 1, y: 0, scale: 1.0, duration: 0.9, ease: 'power3.out',
          scrollTrigger: {
            trigger: card,
            start: 'top 85%',
            toggleActions: 'play none none reverse'
          }
        }
      );
    });

    // 8. Streamline Laser Pulses along Flow Bridges
    document.querySelectorAll('.velocity-bridge').forEach((bridge) => {
      gsap.fromTo(bridge.querySelector('.bridge-telemetry-badge'),
        { opacity: 0, y: 15, scale: 0.95 },
        {
          opacity: 1, y: 0, scale: 1, duration: 0.8, ease: 'back.out(1.5)',
          scrollTrigger: {
            trigger: bridge,
            start: 'top 90%',
            toggleActions: 'play none none reverse'
          }
        }
      );
    });
  }

  function initVanillaTilt() {
    if (typeof VanillaTilt !== 'undefined') {
      try {
        VanillaTilt.init(document.querySelectorAll('[data-tilt]'), {
          max: 10,
          speed: 400,
          glare: true,
          'max-glare': 0.22,
          perspective: 1000
        });
      } catch (e) {
        console.warn('VanillaTilt init error:', e);
      }
    }
  }

  function initCustomCursor() {
    const cursor = document.getElementById('custom-cursor');
    const label = document.getElementById('cursor-label');
    if (!cursor || window.matchMedia('(hover: none) or (pointer: coarse)').matches) return;

    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let cursorX = mouseX;
    let cursorY = mouseY;
    let isMoving = false;

    window.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      if (!isMoving) {
        cursor.classList.add('active');
        isMoving = true;
      }
    }, { passive: true });

    document.addEventListener('mouseleave', () => {
      cursor.classList.remove('active');
      isMoving = false;
    });

    function updateCursorLoop() {
      cursorX += (mouseX - cursorX) * 0.18;
      cursorY += (mouseY - cursorY) * 0.18;
      cursor.style.transform = `translate3d(${cursorX}px, ${cursorY}px, 0)`;
      requestAnimationFrame(updateCursorLoop);
    }
    requestAnimationFrame(updateCursorLoop);

    const hoverElements = document.querySelectorAll('[data-cursor], a, button, [role="button"]');
    hoverElements.forEach((el) => {
      el.addEventListener('mouseenter', () => {
        const customText = el.getAttribute('data-cursor');
        if (customText && label) {
          label.textContent = customText;
          cursor.classList.add('has-label');
        }
        if (el.classList.contains('split-half-ford') || el.classList.contains('sound-banner')) {
          cursor.classList.add('hovering-red');
        } else {
          cursor.classList.add('hovering');
        }
      });
      el.addEventListener('mouseleave', () => {
        cursor.classList.remove('hovering', 'hovering-red', 'has-label');
      });
    });
  }

  async function initParticles() {
    if (typeof tsParticles === 'undefined') return;
    try {
      const container = await tsParticles.load('tsparticles', {
        fullScreen: { enable: false },
        fpsLimit: 60,
        particles: {
          number: { value: 32, density: { enable: true, value_area: 850 } },
          color: { value: ['#ff4422', '#ff8833', '#38bdf8', '#ffffff'] },
          shape: { type: 'circle' },
          opacity: {
            value: 0.45,
            random: true,
            anim: { enable: true, speed: 0.6, opacity_min: 0.1, sync: false }
          },
          size: {
            value: 2.2,
            random: true,
            anim: { enable: true, speed: 1.2, size_min: 0.5, sync: false }
          },
          move: {
            enable: true,
            speed: 1.2,
            direction: 'top-right',
            random: true,
            straight: false,
            out_mode: 'out',
            bounce: false
          }
        },
        interactivity: {
          detect_on: 'canvas',
          events: {
            onhover: { enable: true, mode: 'repulse' },
            resize: true
          },
          modes: {
            repulse: { distance: 75, duration: 0.4 }
          }
        },
        retina_detect: false
      });

      if (container && 'IntersectionObserver' in window) {
        const heroEl = document.getElementById('hero-container');
        if (heroEl) {
          const obs = new IntersectionObserver((entries) => {
            entries.forEach((e) => {
              if (e.isIntersecting) {
                container.play();
              } else {
                container.pause();
              }
            });
          }, { threshold: 0.05 });
          obs.observe(heroEl);
        }
      }
    } catch (e) {
      console.warn('tsParticles init error:', e);
    }
  }

  function dismissPreloader() {
    if (preloader) {
      if (percentEl) percentEl.textContent = '100%';
      preloader.classList.add('done');
      setTimeout(() => {
        preloader.style.display = 'none';
      }, 600);
    }
  }

  function init() {
    // Spacer height keeps story cleanly below the 100vh viewport
    function updateSpacer() {
      if (scrollSpacer) {
        scrollSpacer.style.height = `${window.innerHeight}px`;
      }
    }
    updateSpacer();
    window.addEventListener('resize', updateSpacer);

    // Instant fast dismiss: No 120 frames to download anymore!
    dismissPreloader();

    // Creative Frontend Engines Initialization
    initLenis();
    initGSAPMotionDesign();
    initVanillaTilt();
    initCustomCursor();
    initParticles();

    setupStartInterceptors();
    setupHeroIgnition();
    setupSpecsUnitToggle();
    setupShowroomSplit();
    setupShowroomDeck();
    setupExperienceModals();

    window.addEventListener('scroll', onScroll, { passive: true });
    observeSections();
    onScroll();

    if (window.location.search.includes('preview=end')) {
      if (scrollStartCue) scrollStartCue.classList.add('cue-hidden');
      if (heroVideo) {
        heroVideo.currentTime = VIDEO_PAUSE_TIME;
        heroVideo.pause();
      }
      finishHeroSequence();
      document.querySelectorAll('.animate-in').forEach(el => el.classList.add('visible'));
    }

    window.unlockStory = unlockStory;
    window.lenisInstance = lenisInstance;

    if (window.location.hash) {
      const hash = window.location.hash;
      if (hash === '#ford' || hash.startsWith('#ford-')) {
        unlockStory();
        openExperienceModal('ford');
        const tabPart = hash.replace('#ford-', '').replace('#ford', '');
        if (tabPart) {
          const pill = document.querySelector(`.subnav-pill[data-tab-group="ford"][data-tab="${tabPart}"]`);
          if (pill) pill.click();
        }
      } else if (hash === '#ferrari' || hash.startsWith('#ferrari-')) {
        unlockStory();
        openExperienceModal('ferrari');
        const tabPart = hash.replace('#ferrari-', '').replace('#ferrari', '');
        if (tabPart) {
          const pill = document.querySelector(`.subnav-pill[data-tab-group="ferrari"][data-tab="${tabPart}"]`);
          if (pill) pill.click();
        }
      } else {
        const target = document.querySelector(hash);
        if (target) {
          unlockStory();
          setTimeout(() => {
            target.scrollIntoView();
          }, 150);
        }
      }
    }
  }

  init();
})();

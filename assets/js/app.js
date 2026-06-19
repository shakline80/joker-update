/**
 * Joker Box — Single-page game controller
 *
 * Game flow:
 *   Home → Height Reward → Magic Box → Flip Cards → Claim Win → Home
 *
 * Navigation:
 *   Links use data-screen="screen-id" to switch screens.
 *   Add data-with-sound="true" to enable video audio (user gesture required).
 *
 * Flip card win stages (after all 5 cards are flipped):
 *   winStage 1 → first tap anywhere advances
 *   winStage 2 → second tap opens Claim Win screen
 */

document.addEventListener('DOMContentLoaded', () => {

  // --- Screen IDs (must match index.html main#id values) ---
  const SCREENS = {
    home: 'screen-home',
    heightReward: 'screen-height-reward',
    magicBox: 'screen-magic-box',
    flipCard: 'screen-flip-card',
    claimWin: 'screen-claim-win',
  };

  const MAGIC_PLAYBACK_RATE = 4.0; // Magic box videos play 4× faster

  // --- State ---
  let currentScreen = SCREENS.home;
  let winStage = 0;           // Flip-card progress after all cards are revealed
  let magicSequenceId = 0;    // Cancels magic video chain when user skips or leaves
  let autoAdvanceTimer = null; // Auto-advance from flip cards to claim win

  // --- DOM references ---
  const cardSound = document.getElementById('cardSound');
  const winSound = document.getElementById('winSound');
  const jokerButtons = document.querySelectorAll('.select-joker button');
  const openButton = document.querySelector('.open-button');
  const flipCardScreen = document.getElementById(SCREENS.flipCard);

  /** Cancel any pending auto-advance timer. */
  function clearAutoAdvance() {
    if (autoAdvanceTimer !== null) {
      clearTimeout(autoAdvanceTimer);
      autoAdvanceTimer = null;
    }
  }

  /** Pause every video/audio so nothing keeps playing in the background. */
  function pauseAllMedia() {
    clearAutoAdvance();
    document.querySelectorAll('video').forEach(video => {
      video.pause();
      video.onended = null;
    });

    [cardSound, winSound].forEach(audio => {
      if (!audio) return;
      audio.pause();
      audio.currentTime = 0;
    });
  }

  /** Bump the sequence ID so in-flight magic video callbacks are ignored. */
  function abortMagicSequence() {
    magicSequenceId += 1;
  }

  /**
   * Show one game screen and hide the rest.
   * @param {string} screenId - Target screen element id
   * @param {{ withSound?: boolean }} options
   */
  function showScreen(screenId, options = {}) {
    if (screenId === currentScreen) return;

    abortMagicSequence();
    pauseAllMedia();

    document.querySelectorAll('.game-screen').forEach(screen => {
      screen.classList.remove('active');
    });

    const nextScreen = document.getElementById(screenId);
    if (!nextScreen) return;

    nextScreen.classList.add('active');
    currentScreen = screenId;

    // Bottom menu bar only visible on home screen
    document.body.classList.toggle('with-menubar', screenId === SCREENS.home);

    switch (screenId) {
      case SCREENS.home:
        resetGameState();
        break;
      case SCREENS.heightReward:
        initHeightRewardVideo(Boolean(options.withSound));
        break;
      case SCREENS.magicBox:
        startMagicSequence();
        break;
      case SCREENS.flipCard:
        winStage = 0;
        initFlipCardVideo(Boolean(options.withSound));
        break;
      case SCREENS.claimWin:
        playWinSound();
        nextScreen.querySelector('.video-win-bg')?.play().catch(() => {});
        break;
    }
  }

  /** Reset letters, cards, and magic videos when returning home. */
  function resetGameState() {
    winStage = 0;
    clearAutoAdvance();

    jokerButtons.forEach(btn => btn.classList.remove('selected'));
    openButton?.classList.remove('active');

    flipCardScreen?.querySelectorAll('.flip-card-single').forEach(card => {
      card.classList.remove('is-flipped');
    });

    document.querySelectorAll('#screen-magic-box .video-step').forEach(step => {
      step.classList.remove('active');
    });

    document.querySelectorAll('#screen-magic-box .video-bg').forEach(video => {
      video.currentTime = 0;
    });
  }

  /** Height Reward background loop — unmuted only when opened from Joker Box tap. */
  function initHeightRewardVideo(withSound) {
    const video = document.getElementById('myVideo');
    if (!video) return;

    video.muted = !withSound;
    video.currentTime = 0;
    video.play().catch(() => {});
  }

  /** Play step-1 → step-2 → step-3, then go to flip cards. */
  function startMagicSequence() {
    const sequenceId = magicSequenceId + 1;
    magicSequenceId = sequenceId;

    const steps = document.querySelectorAll('#screen-magic-box .video-step');
    const videos = document.querySelectorAll('#screen-magic-box .video-bg');

    function playStep(index) {
      if (sequenceId !== magicSequenceId || currentScreen !== SCREENS.magicBox) return;

      steps.forEach(step => step.classList.remove('active'));
      steps[index]?.classList.add('active');

      const video = videos[index];
      if (!video) return;

      video.currentTime = 0;
      video.playbackRate = MAGIC_PLAYBACK_RATE;
      video.play().catch(() => {});

      video.onended = () => {
        if (sequenceId !== magicSequenceId) return;

        if (index < videos.length - 1) {
          playStep(index + 1);
        } else {
          showScreen(SCREENS.flipCard);
        }
      };
    }

    videos.forEach(video => {
      video.playbackRate = MAGIC_PLAYBACK_RATE;
    });

    playStep(0);
  }

  /** Flip card background video — sound enabled when user taps magic wrapper. */
  function initFlipCardVideo(withSound) {
    const video = document.getElementById('myVideoTwo');
    if (!video) return;

    video.muted = !withSound;
    video.currentTime = 0;
    video.play().catch(() => {});

    // Browser may block sound until the next user click
    if (withSound) {
      video.play().catch(() => {
        const unmute = () => {
          video.muted = false;
          video.play().catch(() => {});
        };
        document.addEventListener('click', unmute, { once: true });
      });
    }
  }

  function checkAllFlipped() {
    const cards = flipCardScreen?.querySelectorAll('.flip-card-single') ?? [];
    return [...cards].every(card => card.classList.contains('is-flipped'));
  }

  function playWinSound() {
    if (!winSound) return;
    winSound.currentTime = 0;
    winSound.play().catch(() => {});
  }

  // --- Global click handler: navigation + flip-card win progression ---
  document.addEventListener('click', (e) => {

    // Any link with data-screen switches screens
    const navLink = e.target.closest('[data-screen]');
    if (navLink) {
      e.preventDefault();

      // OPEN NOW stays disabled until all J-O-K-E-R letters are selected
      if (navLink.classList.contains('open-button') && !navLink.classList.contains('active')) {
        return;
      }

      showScreen(navLink.dataset.screen, {
        withSound: navLink.dataset.withSound === 'true',
      });
      return;
    }

    // Tap magic video area → skip to flip cards with sound
    const magicWrapper = e.target.closest('.magic-wrapper');
    if (magicWrapper && currentScreen === SCREENS.magicBox) {
      e.preventDefault();
      showScreen(SCREENS.flipCard, { withSound: true });
      return;
    }
  });

  // Placeholder menu items (href="#") should not scroll the page
  document.querySelectorAll('a[href="#"]').forEach(link => {
    link.addEventListener('click', (e) => {
      if (!link.dataset.screen && !link.classList.contains('magic-wrapper')) {
        e.preventDefault();
      }
    });
  });

  // Height Reward — tap each J-O-K-E-R letter to unlock OPEN NOW
  jokerButtons.forEach(button => {
    button.addEventListener('click', () => {
      button.classList.toggle('selected');
      const allSelected = [...jokerButtons].every(btn => btn.classList.contains('selected'));
      openButton?.classList.toggle('active', allSelected);

      // Play the same card click sound as flip cards
      if (cardSound) {
        cardSound.currentTime = 0;
        cardSound.play().catch(() => {});
      }
    });
  });

  // Flip Card — tap a card once to reveal it
  flipCardScreen?.querySelectorAll('.flip-card-single').forEach(card => {
    card.addEventListener('click', (e) => {
      e.stopPropagation();

      if (card.classList.contains('is-flipped')) return;

      card.classList.add('is-flipped');

      if (cardSound) {
        cardSound.currentTime = 0;
        cardSound.play().catch(() => {});
      }

      // Once all cards are flipped, auto-advance to Claim Win after 5–10 seconds
      if (checkAllFlipped() && winStage === 0) {
        winStage = 1;
        const delay = Math.floor(Math.random() * 1000) + 3000; // random 3000–4000 ms
        autoAdvanceTimer = setTimeout(() => {
          if (currentScreen === SCREENS.flipCard) {
            showScreen(SCREENS.claimWin);
          }
        }, delay);
      }
    });
  });

  // History page tab filter (runs on history.html only)
  document.querySelectorAll('.tab-btn').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
    });
  });
});

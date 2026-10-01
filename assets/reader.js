/**
 * Das Kapital Chapter Reader - Core Client Script
 * Handles: Markdown & Math rendering, Dynamic TOC, Themes, Multi-Font Typography, Heading Anchors & Text-to-Speech
 */

// --- 1. Prevent Theme Flash / Load Preferences Early ---
(function() {
  const savedTheme = localStorage.getItem('deepseek_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);

  const savedFont = localStorage.getItem('capital_reader_font') || 'sans';
  document.documentElement.setAttribute('data-font', savedFont);
  if (document.body) document.body.setAttribute('data-font', savedFont);

  const savedSize = localStorage.getItem('capital_reader_size') || 'md';
  document.documentElement.setAttribute('data-size', savedSize);
  if (document.body) document.body.setAttribute('data-size', savedSize);
})();

// --- 2. Toast Notifications ---
function showToast(message) {
  let toast = document.getElementById('reader-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'reader-toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 2400);
}

// --- 3. Base64 Markdown Decoder Helper ---
function getDecodedMarkdown() {
  const el = document.getElementById('raw-markdown-b64');
  if (!el) return '';
  const b64 = el.textContent.trim();
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

// --- 4. Theme Management ---
const themes = ['dark', 'light', 'sepia'];
const themeLabels = {
  dark: '🌙 Dark',
  light: '☀️ Light',
  sepia: '📜 Sepia'
};

function cycleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = themes[(themes.indexOf(current) + 1) % themes.length];
  setTheme(next);
}

function setTheme(theme) {
  if (!themes.includes(theme)) return;
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('deepseek_theme', theme);
  const btn = document.getElementById('theme-btn');
  if (btn) btn.textContent = themeLabels[theme] || '🌙 Theme';
}

// --- 5. Typography Management (Bunch of Fonts & Sizes) ---
const fontSizes = ['sm', 'md', 'lg', 'xl', 'xxl'];

function setFont(fontKey) {
  document.body.setAttribute('data-font', fontKey);
  document.documentElement.setAttribute('data-font', fontKey);
  localStorage.setItem('capital_reader_font', fontKey);
  const select = document.getElementById('reader-font-select');
  if (select && select.value !== fontKey) select.value = fontKey;
}

function setFontSize(sizeKey) {
  if (!fontSizes.includes(sizeKey)) return;
  document.body.setAttribute('data-size', sizeKey);
  document.documentElement.setAttribute('data-size', sizeKey);
  localStorage.setItem('capital_reader_size', sizeKey);
}

function adjustFontSize(delta) {
  const current = document.body.getAttribute('data-size') || 'md';
  let idx = fontSizes.indexOf(current);
  if (idx === -1) idx = 1; // default 'md'
  const newIdx = Math.max(0, Math.min(fontSizes.length - 1, idx + delta));
  setFontSize(fontSizes[newIdx]);
  showToast(`Font Size: ${fontSizes[newIdx].toUpperCase()}`);
}

// --- 6. Text-to-Speech (TTS) Engine ---
const ttsEngine = {
  active: false,
  paused: false,
  items: [],
  currentIndex: 0,
  rate: 1.0,
  currentUtterance: null,
  selectedVoice: null,
  keepAliveTimer: null,

  init() {
    const ttsBtn = document.getElementById('tts-btn');
    const dock = document.getElementById('tts-dock');
    const playBtn = document.getElementById('tts-play-btn');
    const stopBtn = document.getElementById('tts-stop-btn');
    const speedSelect = document.getElementById('tts-speed-select');

    if (!('speechSynthesis' in window)) {
      if (ttsBtn) ttsBtn.style.display = 'none';
      return;
    }

    // Auto-detect and cache best Neural/Google female voice
    this.selectBestFemaleVoice();
    if ('onvoiceschanged' in window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = () => {
        this.selectBestFemaleVoice();
      };
    }

    if (dock && !document.getElementById('tts-close-btn')) {
      const closeBtn = document.createElement('button');
      closeBtn.id = 'tts-close-btn';
      closeBtn.className = 'tts-close-btn';
      closeBtn.setAttribute('aria-label', 'Close audio player');
      closeBtn.title = 'Close audio player';
      closeBtn.textContent = '✕';
      closeBtn.addEventListener('click', () => {
        dock.classList.remove('active');
        document.body.classList.remove('tts-active-mode');
      });
      dock.appendChild(closeBtn);
    }

    if (ttsBtn && dock) {
      ttsBtn.addEventListener('click', () => {
        dock.classList.toggle('active');
        if (dock.classList.contains('active')) {
          document.body.classList.add('tts-active-mode');
          if (!this.selectedVoice) this.selectBestFemaleVoice();
          if (!this.active) {
            this.prepareItems();
            const voiceLabel = this.selectedVoice ? ` • 🎙️ ${this.selectedVoice.name.replace(/(Microsoft|Google|Apple)\s*/gi, '').split('-')[0].trim()}` : '';
            this.updateStatus(`Click Play or tap any paragraph to listen${voiceLabel}`);
          }
        } else {
          document.body.classList.remove('tts-active-mode');
        }
      });
    }

    // Attach click and double-click listeners on #content to play from any specific paragraph/heading
    const content = document.getElementById('content');
    if (content) {
      // Tap/click paragraph to play from here when dock is active
      content.addEventListener('click', (e) => {
        if (e.target.closest('a, button, input, select, pre, code')) return;
        if (dock && dock.classList.contains('active')) {
          const targetEl = e.target.closest('h1, h2, h3, h4, p, li, blockquote');
          if (targetEl && content.contains(targetEl)) {
            this.playFromElement(targetEl);
          }
        }
      });

      // Double-click anywhere to open dock and immediately play from that paragraph
      content.addEventListener('dblclick', (e) => {
        if (e.target.closest('a, button, input, select, pre, code')) return;
        const targetEl = e.target.closest('h1, h2, h3, h4, p, li, blockquote');
        if (targetEl && content.contains(targetEl)) {
          if (dock && !dock.classList.contains('active')) {
            dock.classList.add('active');
            document.body.classList.add('tts-active-mode');
          }
          this.playFromElement(targetEl);
        }
      });
    }

    if (playBtn) {
      playBtn.addEventListener('click', () => {
        if (!this.active) {
          this.start();
        } else if (this.paused) {
          this.resume();
        } else {
          this.pause();
        }
      });
    }

    if (stopBtn) {
      stopBtn.addEventListener('click', () => {
        this.stop();
      });
    }

    if (speedSelect) {
      speedSelect.addEventListener('change', (e) => {
        this.rate = parseFloat(e.target.value) || 1.0;
        if (this.active && !this.paused) {
          // Restart current item at new rate
          window.speechSynthesis.cancel();
          this.speakCurrent();
        }
      });
    }
  },

  playFromElement(targetEl) {
    if (!this.items.length) {
      this.prepareItems();
    }
    let idx = this.items.indexOf(targetEl);
    if (idx === -1) {
      idx = this.items.findIndex(el => el === targetEl || el.contains(targetEl) || targetEl.contains(el));
    }
    if (idx !== -1) {
      this.currentIndex = idx;
      if (!this.active) {
        this.start();
      } else {
        this.paused = false;
        this.startKeepAlive();
        this.updatePlayButton('⏸️ Pause');
        window.speechSynthesis.cancel();
        this.speakCurrent();
      }
    }
  },

  selectBestFemaleVoice() {
    if (!('speechSynthesis' in window)) return null;
    const voices = window.speechSynthesis.getVoices();
    if (!voices || !voices.length) return null;

    const maleNames = ['david', 'mark', 'george', 'guy', 'ryan', 'oliver', 'thomas', 'brian', 'daniel', 'fred', 'alex', 'arthur', 'male'];
    const femaleNames = ['jenny', 'aria', 'sonia', 'libby', 'ava', 'michelle', 'samantha', 'karen', 'victoria', 'zira', 'hazel', 'susan', 'kate', 'serena', 'fiona', 'moira', 'tessa', 'ana'];

    let bestVoice = null;
    let highestScore = -1;

    voices.forEach(v => {
      const nameLower = v.name.toLowerCase();
      const langLower = (v.lang || '').toLowerCase();

      // Must be English
      if (!langLower.startsWith('en')) return;

      // Filter out male voices unless explicitly marked female
      const isMale = maleNames.some(m => nameLower.includes(m)) && !nameLower.includes('female');
      if (isMale) return;

      let score = 10;

      // Tier 1: Neural / Natural / Online Natural (Microsoft Edge / Azure)
      if (nameLower.includes('natural') || nameLower.includes('neural')) score += 100;
      // Tier 2: Google Wavenet / Google Neural voices (Chrome / Android)
      if (nameLower.includes('google')) score += 70;
      // Tier 3: Apple Enhanced / Premium voices (iOS / macOS)
      if (nameLower.includes('enhanced') || nameLower.includes('premium')) score += 50;

      // Explicit female indicator in name
      if (nameLower.includes('female')) score += 50;

      // Recognized female names
      if (femaleNames.some(f => nameLower.includes(f))) score += 40;

      // Online network services usually have higher neural fidelity
      if (v.localService === false) score += 15;

      // Standard English dialects
      if (langLower.includes('us') || langLower.includes('gb')) score += 5;

      if (score > highestScore) {
        highestScore = score;
        bestVoice = v;
      }
    });

    // Fallback: If no prioritized female voice detected, look for any English voice not explicitly male
    if (!bestVoice) {
      bestVoice = voices.find(v => {
        const n = v.name.toLowerCase();
        const l = (v.lang || '').toLowerCase();
        return l.startsWith('en') && !maleNames.some(m => n.includes(m));
      }) || voices.find(v => (v.lang || '').toLowerCase().startsWith('en')) || voices[0];
    }

    this.selectedVoice = bestVoice;
    return bestVoice;
  },

  startKeepAlive() {
    this.stopKeepAlive();
    this.keepAliveTimer = setInterval(() => {
      if (this.active && !this.paused && window.speechSynthesis.speaking) {
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      }
    }, 10000);
  },

  stopKeepAlive() {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
  },

  prepareItems() {
    const content = document.getElementById('content');
    if (!content) return;
    this.items = Array.from(content.querySelectorAll('h1, h2, h3, h4, p, li, blockquote')).filter(el => {
      if (el.classList.contains('heading-anchor') || el.closest('.heading-anchor')) return false;
      const clone = el.cloneNode(true);
      clone.querySelectorAll('.heading-anchor, [aria-hidden="true"]').forEach(c => c.remove());
      const txt = (clone.innerText || clone.textContent || '').replace(/#/g, '').trim();
      return txt.length > 2;
    });
    this.currentIndex = 0;
  },

  updateStatus(text) {
    const status = document.getElementById('tts-status');
    if (status) status.textContent = text;
  },

  updatePlayButton(text) {
    const playBtn = document.getElementById('tts-play-btn');
    if (playBtn) playBtn.innerHTML = text;
  },

  highlightCurrent() {
    this.items.forEach(el => el.classList.remove('speaking-active'));
    if (this.items[this.currentIndex]) {
      const activeEl = this.items[this.currentIndex];
      activeEl.classList.add('speaking-active');
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  },

  start() {
    if (!this.items.length) this.prepareItems();
    if (!this.items.length) return;
    this.active = true;
    this.paused = false;
    this.startKeepAlive();
    this.updatePlayButton('⏸️ Pause');
    this.speakCurrent();
  },

  speakCurrent() {
    if (!this.active || this.currentIndex >= this.items.length) {
      this.stop();
      return;
    }

    const currentEl = this.items[this.currentIndex];
    this.highlightCurrent();

    // Strip heading anchors and aria-hidden elements from spoken text
    const clone = currentEl.cloneNode(true);
    clone.querySelectorAll('.heading-anchor, [aria-hidden="true"]').forEach(el => el.remove());

    const rawText = clone.innerText || clone.textContent || '';
    const cleanText = rawText
      .replace(/#/g, '')
      .replace(/🔗/g, '')
      .replace(/https?:\/\/\S+/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanText) {
      this.currentIndex++;
      this.speakCurrent();
      return;
    }

    this.updateStatus(cleanText.substring(0, 50) + (cleanText.length > 50 ? '...' : ''));

    const utter = new SpeechSynthesisUtterance(cleanText);
    utter.rate = this.rate;

    if (!this.selectedVoice) {
      this.selectBestFemaleVoice();
    }
    if (this.selectedVoice) {
      utter.voice = this.selectedVoice;
      utter.lang = this.selectedVoice.lang || 'en-US';
    } else {
      utter.lang = 'en-US';
    }

    utter.onend = () => {
      if (this.active && !this.paused) {
        this.currentIndex++;
        this.speakCurrent();
      }
    };

    utter.onerror = (e) => {
      if (e.error !== 'canceled') {
        this.currentIndex++;
        this.speakCurrent();
      }
    };

    this.currentUtterance = utter;
    window.speechSynthesis.speak(utter);
  },

  pause() {
    if (!this.active) return;
    this.paused = true;
    this.stopKeepAlive();
    window.speechSynthesis.pause();
    this.updatePlayButton('▶️ Resume');
  },

  resume() {
    if (!this.active) return;
    this.paused = false;
    this.startKeepAlive();
    window.speechSynthesis.resume();
    this.updatePlayButton('⏸️ Pause');
  },

  stop() {
    this.active = false;
    this.paused = false;
    this.stopKeepAlive();
    document.body.classList.remove('tts-active-mode');
    window.speechSynthesis.cancel();
    this.items.forEach(el => el.classList.remove('speaking-active'));
    this.currentIndex = 0;
    this.updatePlayButton('▶️ Play');
    this.updateStatus('Stopped');
  }
};

// --- 7. Main Reader Initialization ---
window.addEventListener('DOMContentLoaded', () => {
  // Sync Theme Button Label
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
  setTheme(currentTheme);

  // Inject Favicon if not present
  if (!document.querySelector('link[rel="icon"]')) {
    const icon = document.createElement('link');
    icon.rel = 'icon';
    icon.type = 'image/svg+xml';
    icon.href = (window.location.pathname.includes('/Volume') ? '../../' : './') + 'assets/icon.svg';
    document.head.appendChild(icon);
  }

  // Inject Logo into Back Button if present
  const backBtn = document.querySelector('.back-button');
  if (backBtn && !backBtn.querySelector('.header-logo-icon')) {
    const logoImg = document.createElement('img');
    logoImg.className = 'header-logo-icon';
    logoImg.src = '../../assets/icon.svg';
    logoImg.alt = 'Das Kapital Logo';
    logoImg.style.width = '20px';
    logoImg.style.height = '20px';
    logoImg.style.borderRadius = '4px';
    logoImg.style.marginRight = '6px';
    logoImg.style.verticalAlign = 'middle';
    logoImg.style.objectFit = 'cover';
    backBtn.insertBefore(logoImg, backBtn.firstChild);
  }

  // Sync Typography Selector & Size
  const savedFont = localStorage.getItem('capital_reader_font') || 'sans';
  setFont(savedFont);

  const savedSize = localStorage.getItem('capital_reader_size') || 'md';
  setFontSize(savedSize);

  // Render Base64 Markdown (only if content element is empty, preserving pre-rendered HTML)
  const rawMarkdown = getDecodedMarkdown();
  const contentEl = document.getElementById('content');

  if (contentEl && (!contentEl.children || contentEl.children.length === 0) && rawMarkdown && rawMarkdown.trim().length > 100 && typeof marked !== 'undefined') {
    marked.setOptions({
      gfm: true,
      breaks: false,
    });
    contentEl.innerHTML = marked.parse(rawMarkdown);
  }

  // Render Math via KaTeX
  if (contentEl && typeof renderMathInElement !== 'undefined') {
    renderMathInElement(contentEl, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '\\[', right: '\\]', display: true },
        { left: '$', right: '$', display: false },
        { left: '\\(', right: '\\)', display: false }
      ],
      throwOnError: false
    });
  }

  // Wrap Tables for Smooth Horizontal Touch Scrolling on Mobile
  if (contentEl) {
    contentEl.querySelectorAll('table').forEach(table => {
      if (!table.parentElement.classList.contains('table-wrapper')) {
        const wrap = document.createElement('div');
        wrap.className = 'table-wrapper';
        table.parentNode.insertBefore(wrap, table);
        wrap.appendChild(table);
      }
    });
  }

  // Setup Mobile Off-Canvas TOC Drawer & Overlay
  const sidebar = document.querySelector('.sidebar');
  let closeDrawer = () => {};
  if (sidebar) {
    // Drawer Close Button inside Sidebar
    const brand = sidebar.querySelector('.sidebar-brand');
    let closeBtn = document.getElementById('sidebar-close-btn');
    if (!closeBtn && brand) {
      closeBtn = document.createElement('button');
      closeBtn.id = 'sidebar-close-btn';
      closeBtn.className = 'sidebar-close-btn';
      closeBtn.setAttribute('aria-label', 'Close Table of Contents');
      closeBtn.title = 'Close Table of Contents';
      closeBtn.textContent = '✕';
      brand.appendChild(closeBtn);
    }

    // Backdrop Overlay
    let backdrop = document.getElementById('sidebar-backdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.id = 'sidebar-backdrop';
      backdrop.className = 'sidebar-backdrop';
      document.body.appendChild(backdrop);
    }

    // Inject "📑 Contents" Button into Toolbar Actions
    const actions = document.querySelector('.toolbar .actions');
    let mobileTocBtn = document.getElementById('mobile-toc-btn');
    if (actions && !mobileTocBtn) {
      mobileTocBtn = document.createElement('button');
      mobileTocBtn.id = 'mobile-toc-btn';
      mobileTocBtn.className = 'btn btn-mobile-toc';
      mobileTocBtn.setAttribute('aria-label', 'Open Table of Contents');
      mobileTocBtn.title = 'Table of Contents';
      mobileTocBtn.innerHTML = '<span>📑</span> <span>Contents</span>';
      actions.insertBefore(mobileTocBtn, actions.firstChild);
    }

    function openDrawer() {
      sidebar.classList.add('open');
      if (backdrop) backdrop.classList.add('active');
      document.body.classList.add('drawer-open');
    }

    closeDrawer = function() {
      sidebar.classList.remove('open');
      if (backdrop) backdrop.classList.remove('active');
      document.body.classList.remove('drawer-open');
    };

    if (mobileTocBtn) mobileTocBtn.addEventListener('click', openDrawer);
    if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
    if (backdrop) backdrop.addEventListener('click', closeDrawer);
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeDrawer();
    });
  }

  // Populate Table of Contents and Heading Anchors
  const tocList = document.getElementById('toc-list');
  if (contentEl) {
    function slugify(text) {
      return text
        .toLowerCase()
        .replace(/[\u2022\u2013\u2014·]/g, '-')
        .replace(/[^\w\s-]/g, '')
        .trim()
        .replace(/[-\s]+/g, '-');
    }

    const slugCounts = Object.create(null);
    const headings = contentEl.querySelectorAll('h1, h2, h3, h4');
    headings.forEach((h, idx) => {
      if (!h.id || h.id.startsWith('sec-')) {
        let baseSlug = slugify(h.textContent.replace(/#+$/, ''));
        if (!baseSlug) baseSlug = 'sec-' + idx;
        if (slugCounts[baseSlug] !== undefined) {
          slugCounts[baseSlug]++;
          h.id = `${baseSlug}-${slugCounts[baseSlug]}`;
        } else {
          slugCounts[baseSlug] = 0;
          h.id = baseSlug;
        }
      }

      // Add Heading Permalinks (# / 🔗)
      const anchor = document.createElement('a');
      anchor.className = 'heading-anchor';
      anchor.href = '#' + h.id;
      anchor.title = 'Copy permalink to section';
      anchor.setAttribute('aria-hidden', 'true');
      anchor.textContent = '#';
      anchor.addEventListener('click', (e) => {
        e.preventDefault();
        const url = window.location.origin + window.location.pathname + '#' + h.id;
        history.pushState(null, '', '#' + h.id);
        if (navigator.clipboard) {
          navigator.clipboard.writeText(url).then(() => {
            showToast('Permalink copied to clipboard!');
          });
        } else {
          showToast('Anchor: #' + h.id);
        }
        h.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      h.appendChild(anchor);

      // Populate Table of Contents (levels 1, 2, 3)
      if (tocList && (h.tagName === 'H1' || h.tagName === 'H2' || h.tagName === 'H3')) {
        const li = document.createElement('li');
        const level = h.tagName.toLowerCase().replace('h', '');
        li.className = 'toc-item level-' + level;
        li.dataset.id = h.id;

        const a = document.createElement('a');
        a.href = '#' + h.id;
        a.textContent = h.textContent.replace(/^#+\s*/, '').replace(/#$/, '').trim();
        a.addEventListener('click', (e) => {
          e.preventDefault();
          closeDrawer();
          history.pushState(null, '', '#' + h.id);
          h.scrollIntoView({ behavior: 'smooth', block: 'start' });
          if (ttsEngine.active) {
            ttsEngine.playFromElement(h);
          }
        });

        li.appendChild(a);
        tocList.appendChild(li);
      }
    });

    // Deep linking scroll to initial hash if present
    if (window.location.hash) {
      try {
        const hashTarget = document.querySelector(window.location.hash);
        if (hashTarget) {
          setTimeout(() => {
            hashTarget.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 150);
        }
      } catch (err) {}
    }

    // Scrollspy for TOC
    const tocItems = document.querySelectorAll('.toc-item');
    if (tocItems.length > 0) {
      window.addEventListener('scroll', () => {
        let currentSec = '';
        headings.forEach(h => {
          const rect = h.getBoundingClientRect();
          if (rect.top <= 120) {
            currentSec = h.id;
          }
        });
        tocItems.forEach(item => {
          if (item.dataset.id === currentSec) {
            item.classList.add('active');
          } else {
            item.classList.remove('active');
          }
        });
      }, { passive: true });
    }
  }

  // Reading Progress Bar
  const progressBar = document.getElementById('reading-progress');
  if (progressBar) {
    window.addEventListener('scroll', () => {
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrolled = (window.scrollY / (docHeight || 1)) * 100;
      progressBar.style.width = Math.min(100, Math.max(0, scrolled)) + '%';
    }, { passive: true });
  }

  // Initialize TTS Engine
  ttsEngine.init();

  // Attach Font Change Listener
  const fontSelect = document.getElementById('reader-font-select');
  if (fontSelect) {
    fontSelect.value = localStorage.getItem('capital_reader_font') || 'sans';
    fontSelect.addEventListener('change', (e) => {
      setFont(e.target.value);
    });
  }

  // --- 8. Initialize Advanced GitHub Extensions ---
  initPaletteIntegration();
  initChapterNavigation();
  initMobileSettingsMenu();
  mountChapterSimulators();

  // Service Worker Registration for Offline Use (when served over http/https)
  if ('serviceWorker' in navigator && (window.location.protocol === 'http:' || window.location.protocol === 'https:')) {
    navigator.serviceWorker.register('../../sw.js').catch(() => {});
  }
});

/* ==========================================================================
   Advanced Extensions: Palette, Navigation & Simulators
   ========================================================================== */

// --- A. Universal Command Palette Integration in Reader ---
function initPaletteIntegration() {
  function loadScript(src, cb) {
    const s = document.createElement('script');
    s.src = src;
    s.onload = cb;
    document.body.appendChild(s);
  }

  if (!window.CAPITAL_CATALOG) {
    loadScript('../../assets/palette-data.js', () => {
      if (!window.openCommandPalette) {
        loadScript('../../assets/palette-engine.js');
      }
      if (typeof updateNavigationElements === 'function') {
        updateNavigationElements();
      }
    });
  } else if (!window.openCommandPalette) {
    loadScript('../../assets/palette-engine.js');
  }

  const actions = document.querySelector('.toolbar .actions');
  let paletteBtn = document.getElementById('reader-palette-btn');
  if (actions && !paletteBtn) {
    paletteBtn = document.createElement('button');
    paletteBtn.id = 'reader-palette-btn';
    paletteBtn.className = 'btn';
    paletteBtn.title = 'Command Palette (Ctrl+K)';
    paletteBtn.setAttribute('aria-label', 'Command Palette');
    paletteBtn.innerHTML = '<span>⌨️</span> <span>Jump</span>';
    paletteBtn.addEventListener('click', () => {
      if (typeof window.openCommandPalette === 'function') {
        window.openCommandPalette();
      }
    });
    actions.appendChild(paletteBtn);
  }
}

// --- B. Chapter Navigation System (Top Toolbar, Floating Thumb Pill & Keyboard Shortcuts) ---
function getAdjacentChapters() {
  const bottomNav = document.querySelector('.chapter-nav-bottom');
  let prev = null;
  let next = null;

  if (bottomNav) {
    const prevEl = bottomNav.querySelector('.chapter-nav-btn.prev');
    const nextEl = bottomNav.querySelector('.chapter-nav-btn.next');
    if (prevEl && prevEl.getAttribute('href')) {
      prev = {
        href: prevEl.getAttribute('href'),
        title: prevEl.querySelector('.nav-btn-title')?.textContent?.trim() || 'Previous Chapter'
      };
    }
    if (nextEl && nextEl.getAttribute('href')) {
      next = {
        href: nextEl.getAttribute('href'),
        title: nextEl.querySelector('.nav-btn-title')?.textContent?.trim() || 'Next Chapter'
      };
    }
  }

  // Fallback or complement from window.CAPITAL_CATALOG
  if ((!prev || !next) && window.CAPITAL_CATALOG && window.CAPITAL_CATALOG.chapters) {
    const chapters = window.CAPITAL_CATALOG.chapters;
    const path = decodeURIComponent(window.location.pathname).replace(/\\/g, '/').toLowerCase();
    const curIdx = chapters.findIndex(c => {
      const normHref = decodeURIComponent(c.href).replace(/\\/g, '/').toLowerCase();
      return path.endsWith(normHref) || path.split('/').slice(-3).join('/') === normHref;
    });

    if (curIdx !== -1) {
      if (!prev && curIdx > 0) {
        prev = {
          href: '../../' + chapters[curIdx - 1].href,
          title: `${chapters[curIdx - 1].volume} • ${chapters[curIdx - 1].title}: ${chapters[curIdx - 1].subtitle}`
        };
      }
      if (!next && curIdx < chapters.length - 1) {
        next = {
          href: '../../' + chapters[curIdx + 1].href,
          title: `${chapters[curIdx + 1].volume} • ${chapters[curIdx + 1].title}: ${chapters[curIdx + 1].subtitle}`
        };
      }
    }
  }

  return { prev, next };
}

function updateNavigationElements() {
  const { prev, next } = getAdjacentChapters();

  // 1. Top Prev Button
  const topPrev = document.getElementById('reader-top-prev-btn');
  if (topPrev) {
    if (prev && prev.href) {
      topPrev.setAttribute('href', prev.href);
      topPrev.classList.remove('disabled');
      topPrev.title = `Previous: ${prev.title} (← ArrowLeft)`;
      topPrev.style.pointerEvents = 'auto';
      topPrev.style.opacity = '1';
    } else {
      topPrev.removeAttribute('href');
      topPrev.classList.add('disabled');
      topPrev.title = 'First Chapter';
      topPrev.style.pointerEvents = 'none';
      topPrev.style.opacity = '0.35';
    }
  }

  // 2. Top Next Button
  const topNext = document.getElementById('reader-top-next-btn');
  if (topNext) {
    if (next && next.href) {
      topNext.setAttribute('href', next.href);
      topNext.classList.remove('disabled');
      topNext.title = `Next: ${next.title} (→ ArrowRight)`;
      topNext.style.pointerEvents = 'auto';
      topNext.style.opacity = '1';
    } else {
      topNext.removeAttribute('href');
      topNext.classList.add('disabled');
      topNext.title = 'Last Chapter';
      topNext.style.pointerEvents = 'none';
      topNext.style.opacity = '0.35';
    }
  }

  // 3. Floating Pill Buttons
  const floatNav = document.getElementById('floating-chapter-nav');
  if (floatNav) {
    const floatPrev = floatNav.querySelector('.float-nav-btn.prev');
    if (floatPrev) {
      if (prev && prev.href) {
        floatPrev.setAttribute('href', prev.href);
        floatPrev.classList.remove('disabled');
        floatPrev.title = `Previous: ${prev.title}`;
      } else {
        floatPrev.removeAttribute('href');
        floatPrev.classList.add('disabled');
      }
    }
    const floatNext = floatNav.querySelector('.float-nav-btn.next');
    if (floatNext) {
      if (next && next.href) {
        floatNext.setAttribute('href', next.href);
        floatNext.classList.remove('disabled');
        floatNext.title = `Next: ${next.title}`;
      } else {
        floatNext.removeAttribute('href');
        floatNext.classList.add('disabled');
      }
    }
  }
}

function initChapterNavigation() {
  const { prev, next } = getAdjacentChapters();

  // 1. Top Toolbar Navigation Buttons
  const actions = document.querySelector('.toolbar .actions');
  if (actions && !document.getElementById('reader-top-prev-btn')) {
    const mobileToc = document.getElementById('mobile-toc-btn');
    const navGroup = document.createElement('div');
    navGroup.className = 'top-nav-step-group';
    navGroup.style.display = 'inline-flex';
    navGroup.style.gap = '6px';
    navGroup.style.alignItems = 'center';

    const prevA = document.createElement('a');
    prevA.className = 'btn btn-nav-step prev' + (prev && prev.href ? '' : ' disabled');
    prevA.id = 'reader-top-prev-btn';
    if (prev && prev.href) {
      prevA.href = prev.href;
      prevA.title = `Previous: ${prev.title} (← ArrowLeft)`;
    } else {
      prevA.title = 'First Chapter';
    }
    prevA.innerHTML = '<span>← Prev</span>';
    navGroup.appendChild(prevA);

    const nextA = document.createElement('a');
    nextA.className = 'btn btn-nav-step next' + (next && next.href ? '' : ' disabled');
    nextA.id = 'reader-top-next-btn';
    if (next && next.href) {
      nextA.href = next.href;
      nextA.title = `Next: ${next.title} (→ ArrowRight)`;
    } else {
      nextA.title = 'Last Chapter';
    }
    nextA.innerHTML = '<span>Next →</span>';
    navGroup.appendChild(nextA);

    if (mobileToc && mobileToc.nextSibling) {
      actions.insertBefore(navGroup, mobileToc.nextSibling);
    } else if (mobileToc) {
      actions.appendChild(navGroup);
    } else {
      actions.insertBefore(navGroup, actions.firstChild);
    }
  }

  // 2. Floating Thumb Navigation Pill on Mobile
  if (!document.getElementById('floating-chapter-nav')) {
    const floatNav = document.createElement('div');
    floatNav.id = 'floating-chapter-nav';
    floatNav.className = 'floating-chapter-nav';
    floatNav.setAttribute('aria-label', 'Quick Chapter Navigation');

    floatNav.innerHTML = `
      <a ${prev && prev.href ? `href="${prev.href}"` : ''} class="float-nav-btn prev ${prev && prev.href ? '' : 'disabled'}" title="${prev ? `Previous: ${prev.title}` : 'First Chapter'}"><span class="float-nav-arrow">←</span> <span>Prev</span></a>
      <button type="button" class="float-nav-btn jump" id="float-nav-jump-btn" title="Jump to Chapter (Ctrl+K)"><span>🔍</span> <span>Jump</span></button>
      <button type="button" class="float-nav-btn toc" id="float-nav-toc-btn" title="Table of Contents"><span>📑</span> <span>TOC</span></button>
      <a ${next && next.href ? `href="${next.href}"` : ''} class="float-nav-btn next ${next && next.href ? '' : 'disabled'}" title="${next ? `Next: ${next.title}` : 'Last Chapter'}"><span>Next</span> <span class="float-nav-arrow">→</span></a>
    `;

    document.body.appendChild(floatNav);

    const floatJump = document.getElementById('float-nav-jump-btn');
    if (floatJump) {
      floatJump.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (typeof window.openCommandPalette === 'function') {
          window.openCommandPalette();
        }
      });
    }

    const floatToc = document.getElementById('float-nav-toc-btn');
    if (floatToc) {
      floatToc.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const mobileTocBtn = document.getElementById('mobile-toc-btn');
        if (mobileTocBtn) {
          mobileTocBtn.click();
        } else {
          const sidebar = document.querySelector('.sidebar');
          if (sidebar) sidebar.classList.add('open');
        }
      });
    }

    // Scroll auto-hide
    let lastScrollY = window.scrollY;
    let isNavHidden = false;
    window.addEventListener('scroll', () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY && currentScrollY > 160) {
        if (!isNavHidden) {
          floatNav.classList.add('nav-hidden');
          isNavHidden = true;
        }
      } else {
        if (isNavHidden) {
          floatNav.classList.remove('nav-hidden');
          isNavHidden = false;
        }
      }
      lastScrollY = currentScrollY;
    }, { passive: true });
  }

  // 3. Desktop Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea, select, [contenteditable="true"]')) return;
    if (e.ctrlKey || e.altKey || e.metaKey) return;

    const paletteBackdrop = document.getElementById('palette-backdrop');
    if (paletteBackdrop && paletteBackdrop.classList.contains('open')) return;

    const curNav = getAdjacentChapters();

    if (e.key === 'ArrowLeft' && curNav.prev && curNav.prev.href) {
      showToast(`Navigating to ${curNav.prev.title}`);
      window.location.href = curNav.prev.href;
    } else if (e.key === 'ArrowRight' && curNav.next && curNav.next.href) {
      showToast(`Navigating to ${curNav.next.title}`);
      window.location.href = curNav.next.href;
    }
  });

  // If catalog wasn't ready yet, poll briefly to update elements
  if (!window.CAPITAL_CATALOG) {
    const checkInterval = setInterval(() => {
      if (window.CAPITAL_CATALOG) {
        clearInterval(checkInterval);
        updateNavigationElements();
      }
    }, 250);
    setTimeout(() => clearInterval(checkInterval), 4000);
  }
}

// --- C. Mobile Streamlined Header Settings Menu ---
function initMobileSettingsMenu() {
  const actions = document.querySelector('.toolbar .actions');
  if (!actions || document.getElementById('reader-settings-wrapper')) return;

  const wrapper = document.createElement('div');
  wrapper.className = 'reader-settings-wrapper';
  wrapper.id = 'reader-settings-wrapper';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn';
  btn.id = 'reader-settings-btn';
  btn.title = 'Typography & Audio Settings';
  btn.setAttribute('aria-label', 'Typography & Audio Settings');
  btn.innerHTML = '⚙️';

  const popover = document.createElement('div');
  popover.className = 'reader-settings-popover';
  popover.id = 'reader-settings-popover';

  const currentFont = localStorage.getItem('capital_reader_font') || 'sans';

  popover.innerHTML = `
    <div class="reader-popover-title">Reading Settings</div>
    <div class="reader-popover-row">
      <span class="reader-popover-label">Font</span>
      <select id="mobile-font-select" class="font-select" style="max-width:140px;">
        <option value="sans" ${currentFont === 'sans' ? 'selected' : ''}>System Sans</option>
        <option value="georgia" ${currentFont === 'georgia' ? 'selected' : ''}>Georgia</option>
        <option value="garamond" ${currentFont === 'garamond' ? 'selected' : ''}>EB Garamond</option>
        <option value="charter" ${currentFont === 'charter' ? 'selected' : ''}>Charter</option>
        <option value="palatino" ${currentFont === 'palatino' ? 'selected' : ''}>Palatino</option>
        <option value="baskerville" ${currentFont === 'baskerville' ? 'selected' : ''}>Baskerville</option>
        <option value="times" ${currentFont === 'times' ? 'selected' : ''}>Times New Roman</option>
        <option value="humanist" ${currentFont === 'humanist' ? 'selected' : ''}>Humanist</option>
        <option value="dyslexic" ${currentFont === 'dyslexic' ? 'selected' : ''}>Dyslexic</option>
        <option value="mono" ${currentFont === 'mono' ? 'selected' : ''}>Monospace</option>
      </select>
    </div>
    <div class="reader-popover-row">
      <span class="reader-popover-label">Text Size</span>
      <div style="display:flex;gap:6px;">
        <button type="button" class="btn-size-step" id="mobile-size-dec" title="Decrease font size">A-</button>
        <button type="button" class="btn-size-step" id="mobile-size-inc" title="Increase font size">A+</button>
      </div>
    </div>
    <div class="reader-popover-row">
      <span class="reader-popover-label">Audio Reader</span>
      <button type="button" class="btn" id="mobile-tts-trigger" style="padding:5px 10px;font-size:0.78rem;">🔊 Listen</button>
    </div>
  `;

  wrapper.appendChild(btn);
  wrapper.appendChild(popover);
  actions.appendChild(wrapper);

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    popover.classList.toggle('open');
  });

  document.addEventListener('click', (e) => {
    if (!wrapper.contains(e.target)) {
      popover.classList.remove('open');
    }
  });

  const mobileFontSelect = document.getElementById('mobile-font-select');
  if (mobileFontSelect) {
    mobileFontSelect.addEventListener('change', (e) => {
      setFont(e.target.value);
    });
  }

  const mobileSizeDec = document.getElementById('mobile-size-dec');
  if (mobileSizeDec) {
    mobileSizeDec.addEventListener('click', (e) => {
      e.stopPropagation();
      adjustFontSize(-1);
    });
  }

  const mobileSizeInc = document.getElementById('mobile-size-inc');
  if (mobileSizeInc) {
    mobileSizeInc.addEventListener('click', (e) => {
      e.stopPropagation();
      adjustFontSize(1);
    });
  }

  const mobileTtsTrigger = document.getElementById('mobile-tts-trigger');
  if (mobileTtsTrigger) {
    mobileTtsTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const mainTts = document.getElementById('tts-btn');
      if (mainTts) mainTts.click();
      popover.classList.remove('open');
    });
  }
}

function getChapterInfo() {
  const title = document.title || '';
  const m = title.match(/Volume\s+(\d+)\s*[•·-]\s*Chapter\s+(\d+)/i);
  if (m) {
    return { volume: parseInt(m[1], 10), chapter: parseInt(m[2], 10) };
  }
  const path = window.location.pathname;
  const pm = path.match(/Volume%20(\d+)|Volume\s+(\d+)/i);
  const pch = path.match(/Chapter%20(\d+)|Chapter\s+(\d+)/i);
  if (pm && pch) {
    return {
      volume: parseInt(pm[1] || pm[2], 10),
      chapter: parseInt(pch[1] || pch[2], 10)
    };
  }
  return null;
}

function renderSimMath(target, texString) {
  if (!target) return;
  if (typeof texString === 'string') {
    const cleanTex = texString.trim().replace(/^(\$\$|\$)|(\$\$|\$)$/g, '').trim();
    if (typeof katex !== 'undefined' && katex.render) {
      try {
        katex.render(cleanTex, target, { displayMode: true, throwOnError: false });
        return;
      } catch (err) {
        console.warn('KaTeX render error:', err);
      }
    }
    target.innerHTML = '$$' + cleanTex + '$$';
  }
  if (typeof renderMathInElement !== 'undefined') {
    try {
      renderMathInElement(target, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '\\[', right: '\\]', display: true },
          { left: '$', right: '$', display: false },
          { left: '\\(', right: '\\)', display: false }
        ],
        throwOnError: false
      });
    } catch (e) {
      console.warn('renderMathInElement error:', e);
    }
  }
}

function createPresetsBar(presets, onApply) {
  const bar = document.createElement('div');
  bar.className = 'sim-presets-bar';
  bar.innerHTML = '<span class="sim-presets-label">⚡ Historical Presets:</span>';
  presets.forEach((p, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sim-preset-btn' + (p.active || idx === 0 ? ' active' : '');
    btn.textContent = p.label;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      bar.querySelectorAll('.sim-preset-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      onApply(p.values);
    });
    bar.appendChild(btn);
  });
  return bar;
}

function createProofDrawer(data) {
  const drawer = document.createElement('div');
  drawer.className = 'sim-proof-drawer collapsed';

  let mathStr = (data.mathHtml || '').trim();
  if (mathStr && !mathStr.startsWith('$') && !mathStr.startsWith('\\[')) {
    mathStr = '$$' + mathStr + '$$';
  }

  drawer.innerHTML = `
    <div class="sim-drawer-header">
      <span>📜 Why This Happens: Marx's Citation &amp; Proof</span>
      <span class="sim-drawer-toggle">▼</span>
    </div>
    <div class="sim-drawer-body">
      <div class="sim-proof-derivation">
        <strong>Mathematical Derivation:</strong>
        <div class="sim-formula-display" style="margin-top:0.4rem;">${mathStr}</div>
      </div>
      <div class="sim-proof-explanation">
        <strong>Dialectical &amp; Class Dynamics:</strong>
        <p style="margin:0.3rem 0 0 0;">${data.explanation}</p>
      </div>
      <div class="sim-quote-box">
        "${data.quote}"
        <span class="sim-quote-cite">— Karl Marx, <em>${data.citation}</em></span>
      </div>
    </div>
  `;

  function renderDrawerDerivation() {
    const formulaEl = drawer.querySelector('.sim-formula-display');
    if (formulaEl && !formulaEl.querySelector('.katex')) {
      const raw = formulaEl.textContent.trim();
      const clean = raw.replace(/^(\$\$|\$)|(\$\$|\$)$/g, '').trim();
      if (clean) {
        if (typeof katex !== 'undefined' && katex.render) {
          try {
            katex.render(clean, formulaEl, { displayMode: true, throwOnError: false });
          } catch (e) {
            console.warn('KaTeX render error in proof drawer:', e);
          }
        }
      }
    }
    if (typeof renderMathInElement !== 'undefined') {
      try {
        renderMathInElement(drawer, {
          delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '\\[', right: '\\]', display: true },
            { left: '$', right: '$', display: false },
            { left: '\\(', right: '\\)', display: false }
          ],
          throwOnError: false
        });
      } catch (e) {}
    }
  }

  // Pre-render derivation math if katex is available
  renderDrawerDerivation();

  const header = drawer.querySelector('.sim-drawer-header');
  header.addEventListener('click', (e) => {
    e.stopPropagation();
    drawer.classList.toggle('collapsed');
    if (!drawer.classList.contains('collapsed')) {
      renderDrawerDerivation();
    }
  });
  return drawer;
}

// 1. Cotton-Spinning Workshop Balance Sheet (Vol 1 Ch 7)
function buildCottonSpinningSimulator() {
  const card = document.createElement('div');
  card.className = 'interactive-simulator-card';
  card.innerHTML = `
    <div class="sim-header" onclick="this.parentElement.classList.toggle('collapsed')">
      <div class="sim-header-title">
        <span class="sim-badge">Vol 1 • Ch 7</span>
        <span>Cotton Mill Balance Sheet (Valorization Process)</span>
      </div>
      <span class="sim-toggle-icon">▼</span>
    </div>
    <div class="sim-content">
      <div class="sim-presets-slot"></div>
      <div class="sim-grid">
        <div class="sim-controls-pane">
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Working Day Length (T):</span>
              <span class="sim-val-display" id="cs-hours-val">12 hrs</span>
            </div>
            <input type="range" class="sim-slider" id="cs-hours" min="4" max="16" step="0.5" value="12">
          </div>
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Raw Cotton Spun:</span>
              <span class="sim-val-display" id="cs-cotton-val">20 lb</span>
            </div>
            <input type="range" class="sim-slider" id="cs-cotton" min="5" max="30" step="1" value="20">
          </div>
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Daily Wage (v, 1 Day Labour-Power):</span>
              <span class="sim-val-display" id="cs-wage-val">3s</span>
            </div>
            <input type="range" class="sim-slider" id="cs-wage" min="1" max="6" step="0.5" value="3">
          </div>
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Raw Cotton Price per lb:</span>
              <span class="sim-val-display" id="cs-price-val">1.0s / lb</span>
            </div>
            <input type="range" class="sim-slider" id="cs-price" min="0.5" max="2.0" step="0.1" value="1.0">
          </div>
        </div>
        <div class="sim-results-pane">
          <div class="sim-formula-display" id="cs-formula"></div>
          <div class="sim-ledger-grid">
            <div class="sim-ledger-col">
              <div class="sim-ledger-title">Capital Advanced (c + v)</div>
              <div class="sim-ledger-row"><span>Raw Cotton (c₁):</span><span class="sim-ledger-val" id="cs-leg-cotton">20.0s</span></div>
              <div class="sim-ledger-row"><span>Spindle Wear (c₂):</span><span class="sim-ledger-val" id="cs-leg-spindles">4.0s</span></div>
              <div class="sim-ledger-row"><span>Wages Paid (v):</span><span class="sim-ledger-val" id="cs-leg-wage">3.0s</span></div>
              <div class="sim-ledger-row total-row"><span>Total Advanced (K):</span><span class="sim-ledger-val" id="cs-leg-adv">27.0s</span></div>
            </div>
            <div class="sim-ledger-col">
              <div class="sim-ledger-title">Commodity Produced (W)</div>
              <div class="sim-ledger-row"><span>Cotton Preserved:</span><span class="sim-ledger-val" id="cs-leg-pcotton">20.0s</span></div>
              <div class="sim-ledger-row"><span>Spindle Transferred:</span><span class="sim-ledger-val" id="cs-leg-pspindle">4.0s</span></div>
              <div class="sim-ledger-row"><span>Living Labour Added:</span><span class="sim-ledger-val" id="cs-leg-living">6.0s</span></div>
              <div class="sim-ledger-row total-row"><span>Total Yarn Value (W):</span><span class="sim-ledger-val" id="cs-leg-val">30.0s</span></div>
            </div>
          </div>
          <div class="sim-status-banner" id="cs-status"></div>
        </div>
      </div>
      <div class="sim-proof-slot"></div>
    </div>
  `;

  const presets = [
    { label: "Marx's 1867 Case (12h Day)", values: { hours: 12, cotton: 20, wage: 3, price: 1.0 }, active: true },
    { label: "6h Breakeven (Zero Surplus)", values: { hours: 6, cotton: 10, wage: 3, price: 1.0 } },
    { label: "14h Overtime Crunch", values: { hours: 14, cotton: 24, wage: 3, price: 1.0 } },
    { label: "Cheapened Raw Cotton", values: { hours: 12, cotton: 20, wage: 3, price: 0.7 } }
  ];

  function applyPreset(v) {
    card.querySelector('#cs-hours').value = v.hours;
    card.querySelector('#cs-cotton').value = v.cotton;
    card.querySelector('#cs-wage').value = v.wage;
    card.querySelector('#cs-price').value = v.price;
    update();
  }

  card.querySelector('.sim-presets-slot').appendChild(createPresetsBar(presets, applyPreset));

  const proof = createProofDrawer({
    mathHtml: '$$W = (c_{\\text{cotton}} + c_{\\text{spindle}}) + v + s = 24\\text{s} + 3\\text{s} + 3\\text{s} = 30\\text{s} \\quad \\implies e = \\frac{s}{v} = \\frac{3\\text{s}}{3\\text{s}} = 100\\%$$',
    explanation: 'The capitalist purchases the use-value of labour-power for an entire 12-hour day by paying its daily exchange-value (3 shillings, the equivalent of 6 hours of subsistence labour). The 6 hours after mid-day cost the capitalist nothing, producing 3 shillings of pure surplus-value.',
    quote: "Our capitalist foresaw this state of things, and that was why he laughed... 3 shillings were converted into 6 shillings; a surplus-value of 3 shillings has been made. The trick has at last succeeded; money has been converted into capital.",
    citation: "Capital Vol. 1, Chapter 7, Section 2"
  });
  card.querySelector('.sim-proof-slot').appendChild(proof);

  function update() {
    const hours = parseFloat(card.querySelector('#cs-hours').value);
    const cotton = parseFloat(card.querySelector('#cs-cotton').value);
    const wage = parseFloat(card.querySelector('#cs-wage').value);
    const price = parseFloat(card.querySelector('#cs-price').value);

    const cCotton = cotton * price;
    const cSpindles = cotton * 0.2;
    const cTotal = cCotton + cSpindles;
    const v = wage;
    const kAdv = cTotal + v;
    const living = hours * 0.5;
    const wVal = cTotal + living;
    const surplus = wVal - kAdv;
    const rate = Math.round((surplus / v) * 100);

    card.querySelector('#cs-hours-val').textContent = hours + ' hrs';
    card.querySelector('#cs-cotton-val').textContent = cotton + ' lb';
    card.querySelector('#cs-wage-val').textContent = wage + 's';
    card.querySelector('#cs-price-val').textContent = price.toFixed(1) + 's / lb';

    card.querySelector('#cs-leg-cotton').textContent = cCotton.toFixed(1) + 's';
    card.querySelector('#cs-leg-spindles').textContent = cSpindles.toFixed(1) + 's';
    card.querySelector('#cs-leg-wage').textContent = v.toFixed(1) + 's';
    card.querySelector('#cs-leg-adv').textContent = kAdv.toFixed(1) + 's';

    card.querySelector('#cs-leg-pcotton').textContent = cCotton.toFixed(1) + 's';
    card.querySelector('#cs-leg-pspindle').textContent = cSpindles.toFixed(1) + 's';
    card.querySelector('#cs-leg-living').textContent = living.toFixed(1) + 's';
    card.querySelector('#cs-leg-val').textContent = wVal.toFixed(1) + 's';

    const statusEl = card.querySelector('#cs-status');
    if (surplus > 0.05) {
      statusEl.style.background = 'rgba(16, 185, 129, 0.15)';
      statusEl.style.color = '#10b981';
      statusEl.innerHTML = `✨ Surplus-Value: <strong>+${surplus.toFixed(1)}s</strong> (${rate}% rate). The capitalist smiles: 3s in wages yield 6s in living labour!`;
    } else if (Math.abs(surplus) <= 0.05) {
      statusEl.style.background = 'rgba(245, 158, 11, 0.15)';
      statusEl.style.color = '#f59e0b';
      statusEl.innerHTML = `⚖️ Breakeven (0s surplus): Day exactly equals necessary labour time. The capitalist frowns!`;
    } else {
      statusEl.style.background = 'rgba(239, 68, 68, 0.15)';
      statusEl.style.color = '#ef4444';
      statusEl.innerHTML = `⚠️ Deficit (${surplus.toFixed(1)}s): Working day is shorter than the worker's subsistence wage!`;
    }

    const form = card.querySelector('#cs-formula');
    const tex = `W = c + v + s = ${cTotal.toFixed(1)}\\text{s} + ${v.toFixed(1)}\\text{s} + ${surplus.toFixed(1)}\\text{s} = \\mathbf{${wVal.toFixed(1)}\\text{ shillings}} \\quad (e = ${rate}\\%)`;
    renderSimMath(form, tex);
  }

  ['cs-hours', 'cs-cotton', 'cs-wage', 'cs-price'].forEach(id => {
    card.querySelector('#' + id).addEventListener('input', () => {
      card.querySelectorAll('.sim-preset-btn').forEach(b => b.classList.remove('active'));
      update();
    });
  });

  update();
  return card;
}

// 2. Nassau Senior's "Last Hour" Fallacy Refuted (Vol 1 Ch 9)
function buildSeniorLastHourSimulator() {
  const card = document.createElement('div');
  card.className = 'interactive-simulator-card';
  card.innerHTML = `
    <div class="sim-header" onclick="this.parentElement.classList.toggle('collapsed')">
      <div class="sim-header-title">
        <span class="sim-badge">Vol 1 • Ch 9</span>
        <span>Nassau Senior's "Last Hour" Fallacy Refuted</span>
      </div>
      <span class="sim-toggle-icon">▼</span>
    </div>
    <div class="sim-content">
      <div class="sim-presets-slot"></div>
      <div class="sim-grid">
        <div class="sim-controls-pane">
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Working Day Duration (T):</span>
              <span class="sim-val-display" id="sn-day-val">11.5 hrs</span>
            </div>
            <input type="range" class="sim-slider" id="sn-day" min="8.0" max="14.0" step="0.5" value="11.5">
          </div>
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Necessary Labour Time (v):</span>
              <span class="sim-val-display" id="sn-nec-val">5.75 hrs (50%)</span>
            </div>
            <input type="range" class="sim-slider" id="sn-nec" min="3.0" max="7.0" step="0.25" value="5.75">
          </div>
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Senior's Bogus Last Hour Claim:</span>
              <span class="sim-val-display" id="sn-senior-val">Senior: Profit only in last 45 mins</span>
            </div>
            <input type="range" class="sim-slider" id="sn-claim" min="0.25" max="1.5" step="0.25" value="0.75">
          </div>
        </div>
        <div class="sim-results-pane">
          <div class="sim-formula-display" id="sn-formula"></div>
          <div class="sim-bar-wrapper">
            <div class="sim-bar-labels">
              <span>Senior's Fallacy vs Marx's Scientific Reality:</span>
              <span id="sn-cmp-lbl">Real Surplus: 5.75h | Senior's Myth: 0.75h</span>
            </div>
            <div class="sim-segmented-bar" style="height:26px;">
              <div class="sim-segment sim-seg-v" id="sn-bar-v" style="width:50%;">v: 5.75h</div>
              <div class="sim-segment sim-seg-s" id="sn-bar-s" style="width:50%;">Real Surplus s: 5.75h</div>
            </div>
          </div>
          <div class="sim-status-banner" id="sn-status"></div>
        </div>
      </div>
      <div class="sim-proof-slot"></div>
    </div>
  `;

  const presets = [
    { label: "Senior's 1837 Fallacy (11.5h Day)", values: { day: 11.5, nec: 5.75, claim: 0.75 }, active: true },
    { label: "10-Hour Factory Act Realized", values: { day: 10.0, nec: 5.75, claim: 0.75 } },
    { label: "Sweated 13h Day Fallacy", values: { day: 13.0, nec: 5.5, claim: 1.0 } }
  ];

  function applyPreset(v) {
    card.querySelector('#sn-day').value = v.day;
    card.querySelector('#sn-nec').value = v.nec;
    card.querySelector('#sn-claim').value = v.claim;
    update();
  }

  card.querySelector('.sim-presets-slot').appendChild(createPresetsBar(presets, applyPreset));

  const proof = createProofDrawer({
    mathHtml: '$$\\text{Marx: } s = T - v = 11.5\\text{h} - 5.75\\text{h} = \\mathbf{5.75\\text{ hrs}} \\quad \\text{vs} \\quad \\text{Senior\'s Dogma: } s = \\mathbf{0.75\\text{ hr (last hour)}}$$',
    explanation: 'Oxford Professor Nassau Senior claimed all net profit was produced strictly in the "last hour" of the 11.5-hour day, so the Ten Hours Act would bankrupt all factories. Marx showed Senior committed the elementary blunder of assuming raw cotton and spindle wear were produced by living labour in the mill during the first 10 hours! In reality, constant capital transfers value uniformly across every minute of the day.',
    quote: "Senior’s ‘last hour’... If the day is shortened from 11.5 to 10 hours, does constant capital vanish? No! Professor Senior simply forgot that raw cotton and spindles do not create themselves in the first ten hours.",
    citation: "Capital Vol. 1, Chapter 9, Section 3"
  });
  card.querySelector('.sim-proof-slot').appendChild(proof);

  function update() {
    const day = parseFloat(card.querySelector('#sn-day').value);
    let nec = parseFloat(card.querySelector('#sn-nec').value);
    if (nec >= day) { nec = day - 0.5; card.querySelector('#sn-nec').value = nec; }
    const claim = parseFloat(card.querySelector('#sn-claim').value);

    const realSurplus = day - nec;
    const realRate = Math.round((realSurplus / nec) * 100);

    card.querySelector('#sn-day-val').textContent = day + ' hrs';
    card.querySelector('#sn-nec-val').textContent = nec + ' hrs';
    card.querySelector('#sn-senior-val').textContent = `Senior's Bogus Profit Window: ${claim}h`;

    const vPct = Math.round((nec / day) * 100);
    const sPct = 100 - vPct;
    card.querySelector('#sn-bar-v').style.width = vPct + '%';
    card.querySelector('#sn-bar-v').textContent = `Necessary v: ${nec}h`;
    card.querySelector('#sn-bar-s').style.width = sPct + '%';
    card.querySelector('#sn-bar-s').textContent = `Real Surplus s: ${realSurplus.toFixed(2)}h`;

    card.querySelector('#sn-cmp-lbl').textContent = `Real Surplus: ${realSurplus.toFixed(2)}h | Senior's Fantasy: ${claim}h`;

    const statusEl = card.querySelector('#sn-status');
    if (day <= 10.0) {
      statusEl.style.background = 'rgba(16, 185, 129, 0.15)';
      statusEl.style.color = '#10b981';
      statusEl.innerHTML = `✅ Factory Act Passed (10h Day): Surplus-value is still <strong>${realSurplus.toFixed(2)}h</strong> (${realRate}% rate)! Senior's panic is exposed as bourgeois sophistry.`;
    } else {
      statusEl.style.background = 'rgba(239, 68, 68, 0.15)';
      statusEl.style.color = '#ef4444';
      statusEl.innerHTML = `⚠️ Senior's Delusion: Capitalist claims 10 hours merely pay for cotton/machines, and only the last ${claim}h generates profit!`;
    }

    const form = card.querySelector('#sn-formula');
    const tex = `\\text{Scientific Surplus: } s = ${day}\\text{h} - ${nec}\\text{h} = \\mathbf{${realSurplus.toFixed(2)}\\text{ hrs}} \\quad (e = \\mathbf{${realRate}\\%}) \\quad \\text{vs Senior: } s = ${claim}\\text{h}`;
    renderSimMath(form, tex);
  }

  ['sn-day', 'sn-nec', 'sn-claim'].forEach(id => {
    card.querySelector('#' + id).addEventListener('input', () => {
      card.querySelectorAll('.sim-preset-btn').forEach(b => b.classList.remove('active'));
      update();
    });
  });

  update();
  return card;
}

// 3. The Working Day & Factory Acts Inspector (Vol 1 Ch 10)
function buildWorkingDaySimulator() {
  const card = document.createElement('div');
  card.className = 'interactive-simulator-card';
  card.innerHTML = `
    <div class="sim-header" onclick="this.parentElement.classList.toggle('collapsed')">
      <div class="sim-header-title">
        <span class="sim-badge">Vol 1 • Ch 10</span>
        <span>The Working Day &amp; Factory Acts Inspector</span>
      </div>
      <span class="sim-toggle-icon">▼</span>
    </div>
    <div class="sim-content">
      <div class="sim-presets-slot"></div>
      <div class="sim-grid">
        <div class="sim-controls-pane">
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Statutory Working Shift:</span>
              <span class="sim-val-display" id="wd-shift-val">12 hrs</span>
            </div>
            <input type="range" class="sim-slider" id="wd-shift" min="6" max="18" step="0.5" value="12">
          </div>
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Necessary Labour Time (v):</span>
              <span class="sim-val-display" id="wd-nec-val">5 hrs</span>
            </div>
            <input type="range" class="sim-slider" id="wd-nec" min="3" max="8" step="0.5" value="5">
          </div>
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Illegal "Nibbled" Minutes (Meal Theft):</span>
              <span class="sim-val-display" id="wd-nibble-val">45 mins</span>
            </div>
            <input type="range" class="sim-slider" id="wd-nibble" min="0" max="120" step="15" value="45">
          </div>
        </div>
        <div class="sim-results-pane">
          <div class="sim-formula-display" id="wd-formula"></div>
          <div class="sim-bar-wrapper">
            <div class="sim-bar-labels">
              <span>24-Hour Physical Day Breakdown:</span>
              <span id="wd-rest-lbl">Rest: 11.25 hrs</span>
            </div>
            <div class="sim-segmented-bar">
              <div class="sim-segment sim-seg-v" id="wd-bar-v" style="width:21%;">v: 5h</div>
              <div class="sim-segment sim-seg-s" id="wd-bar-s" style="width:29%;">s: 7h</div>
              <div class="sim-segment sim-seg-danger" id="wd-bar-nibble" style="width:3%;">Nibble</div>
              <div class="sim-segment sim-seg-rest" id="wd-bar-rest" style="width:47%;">Sleep/Rest</div>
            </div>
          </div>
          <div class="sim-status-banner" id="wd-status"></div>
        </div>
      </div>
      <div class="sim-proof-slot"></div>
    </div>
  `;

  const presets = [
    { label: "Victorian Sweatshop (1840s)", values: { shift: 16, nec: 5, nibble: 75 } },
    { label: "1847 Ten Hours Act", values: { shift: 10, nec: 5, nibble: 15 }, active: true },
    { label: "Modern 8h Standard", values: { shift: 8, nec: 4, nibble: 0 } },
    { label: "18h Relay Shift", values: { shift: 18, nec: 5, nibble: 90 } }
  ];

  function applyPreset(v) {
    card.querySelector('#wd-shift').value = v.shift;
    card.querySelector('#wd-nec').value = v.nec;
    card.querySelector('#wd-nibble').value = v.nibble;
    update();
  }

  card.querySelector('.sim-presets-slot').appendChild(createPresetsBar(presets, applyPreset));

  const proof = createProofDrawer({
    mathHtml: '$$T = v + s_{\\text{legal}} + s_{\\text{nibbled}} = 24\\text{h} - \\text{Rest} \\implies e = \\frac{s + s_{\\text{nibbled}}}{v}$$',
    explanation: 'Absolute surplus-value is produced by physically stretching the working day beyond necessary labour-time. The Factory Acts were imposed by the state to curb capital’s vampire thirst, which threatened to physically destroy the reproduction of the working class.',
    quote: "Capital is dead labour, that, vampire-like, only lives by sucking living labour, and lives the more, the more labour it sucks... The nibbling and cribbling at meal-times... steals five minutes here and ten minutes there.",
    citation: "Capital Vol. 1, Chapter 10, Section 1 & 2"
  });
  card.querySelector('.sim-proof-slot').appendChild(proof);

  function update() {
    const shift = parseFloat(card.querySelector('#wd-shift').value);
    let nec = parseFloat(card.querySelector('#wd-nec').value);
    if (nec >= shift) { nec = shift - 0.5; card.querySelector('#wd-nec').value = nec; }
    const nibbleMins = parseFloat(card.querySelector('#wd-nibble').value);
    const nibbleHours = nibbleMins / 60;
    const totalWork = shift + nibbleHours;
    const surplus = totalWork - nec;
    const legalSurplus = Math.max(0, shift - nec);
    const sleep = Math.max(0, 24 - totalWork);
    const rate = Math.round((surplus / nec) * 100);

    card.querySelector('#wd-shift-val').textContent = shift + ' hrs';
    card.querySelector('#wd-nec-val').textContent = nec + ' hrs';
    card.querySelector('#wd-nibble-val').textContent = nibbleMins + ' mins';
    card.querySelector('#wd-rest-lbl').textContent = `Rest & Sleep: ${sleep.toFixed(2)} hrs`;

    card.querySelector('#wd-bar-v').style.width = ((nec / 24) * 100) + '%';
    card.querySelector('#wd-bar-v').textContent = `v: ${nec}h`;
    card.querySelector('#wd-bar-s').style.width = ((legalSurplus / 24) * 100) + '%';
    card.querySelector('#wd-bar-s').textContent = `s: ${legalSurplus.toFixed(1)}h`;
    card.querySelector('#wd-bar-nibble').style.width = ((nibbleHours / 24) * 100) + '%';
    card.querySelector('#wd-bar-nibble').textContent = nibbleMins > 0 ? `+${nibbleMins}m` : '';
    card.querySelector('#wd-bar-rest').style.width = ((sleep / 24) * 100) + '%';
    card.querySelector('#wd-bar-rest').textContent = `Sleep: ${sleep.toFixed(1)}h`;

    const statusEl = card.querySelector('#wd-status');
    if (sleep < 6) {
      statusEl.style.background = 'rgba(239, 68, 68, 0.15)';
      statusEl.style.color = '#ef4444';
      statusEl.innerHTML = `🚨 Biological Exhaustion: Only ${sleep.toFixed(1)}h rest! Factory Inspector reports premature deterioration of life.`;
    } else if (sleep < 8) {
      statusEl.style.background = 'rgba(245, 158, 11, 0.15)';
      statusEl.style.color = '#f59e0b';
      statusEl.innerHTML = `⚠️ Heavy Strain: ${sleep.toFixed(1)}h rest. Labour-power is being depleted faster than natural repair.`;
    } else {
      statusEl.style.background = 'rgba(16, 185, 129, 0.15)';
      statusEl.style.color = '#10b981';
      statusEl.innerHTML = `✅ Statutory Limit Maintained: ${sleep.toFixed(1)}h rest allows bodily reproduction of labour-power.`;
    }

    const form = card.querySelector('#wd-formula');
    const tex = `T = ${nec}\\text{h} + ${legalSurplus.toFixed(1)}\\text{h} + ${nibbleHours.toFixed(2)}\\text{h} = \\mathbf{${totalWork.toFixed(2)}\\text{ hrs}} \\quad (e = \\frac{${surplus.toFixed(2)}}{${nec}} = \\mathbf{${rate}\\%})`;
    renderSimMath(form, tex);
  }

  ['wd-shift', 'wd-nec', 'wd-nibble'].forEach(id => {
    card.querySelector('#' + id).addEventListener('input', () => {
      card.querySelectorAll('.sim-preset-btn').forEach(b => b.classList.remove('active'));
      update();
    });
  });

  update();
  return card;
}

// 4. Rate and Mass of Surplus-Value (Vol 1 Ch 11)
function buildMassOfSurplusValueSimulator() {
  const card = document.createElement('div');
  card.className = 'interactive-simulator-card';
  card.innerHTML = `
    <div class="sim-header" onclick="this.parentElement.classList.toggle('collapsed')">
      <div class="sim-header-title">
        <span class="sim-badge">Vol 1 • Ch 11</span>
        <span>Rate and Mass of Surplus-Value (M = s' · v · n)</span>
      </div>
      <span class="sim-toggle-icon">▼</span>
    </div>
    <div class="sim-content">
      <div class="sim-presets-slot"></div>
      <div class="sim-grid">
        <div class="sim-controls-pane">
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Workers Employed (n):</span>
              <span class="sim-val-display" id="ms-n-val">100 workers</span>
            </div>
            <input type="range" class="sim-slider" id="ms-n" min="10" max="500" step="10" value="100">
          </div>
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Rate of Surplus-Value (s / v):</span>
              <span class="sim-val-display" id="ms-rate-val">100%</span>
            </div>
            <input type="range" class="sim-slider" id="ms-rate" min="50" max="300" step="10" value="100">
          </div>
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Weekly Wage per Worker (v):</span>
              <span class="sim-val-display" id="ms-v-val">£20</span>
            </div>
            <input type="range" class="sim-slider" id="ms-v" min="10" max="60" step="5" value="20">
          </div>
        </div>
        <div class="sim-results-pane">
          <div class="sim-formula-display" id="ms-formula"></div>
          <div class="sim-bar-wrapper">
            <div class="sim-bar-labels">
              <span>Weekly Mass Extracted:</span>
              <span id="ms-mass-lbl">Mass (M): £2,000 / week</span>
            </div>
            <div class="sim-segmented-bar">
              <div class="sim-segment sim-seg-v" id="ms-bar-v" style="width:50%;">Total Wages: £2,000</div>
              <div class="sim-segment sim-seg-s" id="ms-bar-s" style="width:50%;">Total Profit Mass: £2,000</div>
            </div>
          </div>
          <div class="sim-status-banner" id="ms-status"></div>
        </div>
      </div>
      <div class="sim-proof-slot"></div>
    </div>
  `;

  const presets = [
    { label: "Small Workshop (10 Workers)", values: { n: 10, rate: 100, v: 20 } },
    { label: "Factory Mill (100 Workers)", values: { n: 100, rate: 100, v: 20 }, active: true },
    { label: "Sweated Super-Exploitation", values: { n: 50, rate: 250, v: 15 } },
    { label: "Gigantic Enterprise (500 Workers)", values: { n: 500, rate: 120, v: 25 } }
  ];

  function applyPreset(v) {
    card.querySelector('#ms-n').value = v.n;
    card.querySelector('#ms-rate').value = v.rate;
    card.querySelector('#ms-v').value = v.v;
    update();
  }

  card.querySelector('.sim-presets-slot').appendChild(createPresetsBar(presets, applyPreset));

  const proof = createProofDrawer({
    mathHtml: '$$M = \\frac{s}{v} \\times V = s\' \\times (v \\times n) = \\text{Rate} \\times \\text{Individual Wage} \\times \\text{Headcount}$$',
    explanation: 'The mass of surplus-value produced is determined by the rate of exploitation multiplied by the total variable capital advanced. A decrease in headcount ($n$) can only be compensated by an increase in rate ($s\'$) within rigid limits: because the working day cannot physically exceed 24 hours, capital cannot replace 100 workers with 2 workers, no matter how ferociously they are exploited.',
    quote: "The mass of surplus-value produced is determined by the rate of surplus-value multiplied by the variable capital advanced... There is an absolute limit to the compensation of a decrease in the number of labourers by an increase in the rate of surplus-value.",
    citation: "Capital Vol. 1, Chapter 11"
  });
  card.querySelector('.sim-proof-slot').appendChild(proof);

  function update() {
    const n = parseFloat(card.querySelector('#ms-n').value);
    const rate = parseFloat(card.querySelector('#ms-rate').value);
    const v = parseFloat(card.querySelector('#ms-v').value);

    const totalV = n * v;
    const massS = totalV * (rate / 100);

    card.querySelector('#ms-n-val').textContent = n + ' workers';
    card.querySelector('#ms-rate-val').textContent = rate + '%';
    card.querySelector('#ms-v-val').textContent = '£' + v;

    card.querySelector('#ms-mass-lbl').textContent = `Total Mass (M): £${Math.round(massS).toLocaleString()} / wk`;
    card.querySelector('#ms-bar-v').textContent = `Wages: £${Math.round(totalV).toLocaleString()}`;
    card.querySelector('#ms-bar-s').textContent = `Surplus: £${Math.round(massS).toLocaleString()}`;

    const statusEl = card.querySelector('#ms-status');
    statusEl.style.background = 'rgba(16, 185, 129, 0.15)';
    statusEl.style.color = '#10b981';
    statusEl.innerHTML = `🏭 Weekly Exploitation Mass: <strong>£${Math.round(massS).toLocaleString()}</strong> extracted across <strong>${n}</strong> workers ($s/v = ${rate}%$).`;

    const form = card.querySelector('#ms-formula');
    const tex = `M = s' \\cdot v \\cdot n = ${rate}\\% \\times \\text{\\pounds}${v} \\times ${n} = \\mathbf{\\text{\\pounds}${Math.round(massS).toLocaleString()}/\\text{week}}`;
    renderSimMath(form, tex);
  }

  ['ms-n', 'ms-rate', 'ms-v'].forEach(id => {
    card.querySelector('#' + id).addEventListener('input', () => {
      card.querySelectorAll('.sim-preset-btn').forEach(b => b.classList.remove('active'));
      update();
    });
  });

  update();
  return card;
}

// 5. Relative Surplus-Value & Automation Engine (Vol 1 Ch 12)
function buildRelativeSurplusValueSimulator() {
  const card = document.createElement('div');
  card.className = 'interactive-simulator-card';
  card.innerHTML = `
    <div class="sim-header" onclick="this.parentElement.classList.toggle('collapsed')">
      <div class="sim-header-title">
        <span class="sim-badge">Vol 1 • Ch 12</span>
        <span>The Concept of Relative Surplus-Value</span>
      </div>
      <span class="sim-toggle-icon">▼</span>
    </div>
    <div class="sim-content">
      <div class="sim-presets-slot"></div>
      <div class="sim-grid">
        <div class="sim-controls-pane">
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Working Day Length (Fixed T):</span>
              <span class="sim-val-display" id="rsv-day-val">10 hrs</span>
            </div>
            <input type="range" class="sim-slider" id="rsv-day" min="8" max="14" step="0.5" value="10">
          </div>
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Wage-Goods Productivity Multiplier (Π):</span>
              <span class="sim-val-display" id="rsv-prod-val">2.0x</span>
            </div>
            <input type="range" class="sim-slider" id="rsv-prod" min="1.0" max="5.0" step="0.25" value="2.0">
          </div>
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Machine Speed-Up / Intensification:</span>
              <span class="sim-val-display" id="rsv-speed-val">1.2x</span>
            </div>
            <input type="range" class="sim-slider" id="rsv-speed" min="1.0" max="2.0" step="0.1" value="1.2">
          </div>
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Innovator Super-Profit Multiplier:</span>
              <span class="sim-val-display" id="rsv-super-val">1.0x (Standard)</span>
            </div>
            <input type="range" class="sim-slider" id="rsv-super" min="1.0" max="3.0" step="0.25" value="1.0">
          </div>
        </div>
        <div class="sim-results-pane">
          <div class="sim-formula-display" id="rsv-formula"></div>
          <div class="sim-bar-wrapper">
            <div class="sim-bar-labels">
              <span>Necessary Time (v) vs Surplus Time (s):</span>
              <span id="rsv-split-lbl">v: 2.5h | s: 7.5h</span>
            </div>
            <div class="sim-segmented-bar">
              <div class="sim-segment sim-seg-v" id="rsv-bar-v" style="width:25%;">v: 2.5h</div>
              <div class="sim-segment sim-seg-s" id="rsv-bar-s" style="width:75%;">s: 7.5h</div>
            </div>
          </div>
          <div class="sim-status-banner" id="rsv-status"></div>
        </div>
      </div>
      <div class="sim-proof-slot"></div>
    </div>
  `;

  const presets = [
    { label: "Handicraft Baseline", values: { day: 10, prod: 1.0, speed: 1.0, super: 1.0 } },
    { label: "Steam Manufacture (2x)", values: { day: 10, prod: 2.0, speed: 1.2, super: 1.0 }, active: true },
    { label: "Robotic Automation (5x)", values: { day: 10, prod: 5.0, speed: 1.5, super: 1.0 } },
    { label: "Innovator Super-Profit", values: { day: 10, prod: 1.5, speed: 1.2, super: 2.5 } }
  ];

  function applyPreset(v) {
    card.querySelector('#rsv-day').value = v.day;
    card.querySelector('#rsv-prod').value = v.prod;
    card.querySelector('#rsv-speed').value = v.speed;
    card.querySelector('#rsv-super').value = v.super;
    update();
  }

  card.querySelector('.sim-presets-slot').appendChild(createPresetsBar(presets, applyPreset));

  const proof = createProofDrawer({
    mathHtml: '$$v = \\frac{v_0}{\\Pi} \\implies s = T - \\frac{v_0}{\\Pi} \\implies e = \\frac{s}{v} = \\Pi \\cdot \\frac{T}{v_0} - 1$$',
    explanation: 'Relative surplus-value does not extend the working day by even one minute. By raising productivity in industries producing wage-goods (bread, clothes, housing), the socially necessary labour required to reproduce the worker falls, expanding surplus labour automatically.',
    quote: "The increase of the productive power of labour cheapens the commodities, and by shortening necessary labour-time, lengthens surplus labour-time... The shortened working day does not produce relative surplus-value; it is the shortening of necessary labour-time that produces it.",
    citation: "Capital Vol. 1, Chapter 12"
  });
  card.querySelector('.sim-proof-slot').appendChild(proof);

  function update() {
    const day = parseFloat(card.querySelector('#rsv-day').value);
    const prod = parseFloat(card.querySelector('#rsv-prod').value);
    const speed = parseFloat(card.querySelector('#rsv-speed').value);
    const superLead = parseFloat(card.querySelector('#rsv-super').value);

    const baseNec = day * 0.5;
    const nec = baseNec / prod;
    const baseSurp = day - nec;
    const surpIntensified = baseSurp * speed;
    const superProfit = (superLead - 1.0) * 1.5;
    const totalSurp = surpIntensified + superProfit;
    const rate = Math.round((totalSurp / nec) * 100);

    card.querySelector('#rsv-day-val').textContent = day + ' hrs';
    card.querySelector('#rsv-prod-val').textContent = prod.toFixed(2) + 'x';
    card.querySelector('#rsv-speed-val').textContent = speed.toFixed(1) + 'x';
    card.querySelector('#rsv-super-val').textContent = superLead > 1 ? `${superLead.toFixed(1)}x (+${superProfit.toFixed(1)}h)` : '1.0x (Standard)';

    const vPct = Math.max(5, (nec / (nec + totalSurp)) * 100);
    const sPct = 100 - vPct;

    card.querySelector('#rsv-split-lbl').textContent = `v: ${nec.toFixed(2)}h | s: ${totalSurp.toFixed(2)}h`;
    card.querySelector('#rsv-bar-v').style.width = vPct + '%';
    card.querySelector('#rsv-bar-v').textContent = `v: ${nec.toFixed(1)}h`;
    card.querySelector('#rsv-bar-s').style.width = sPct + '%';
    card.querySelector('#rsv-bar-s').textContent = `s: ${totalSurp.toFixed(1)}h`;

    const statusEl = card.querySelector('#rsv-status');
    if (superLead > 1.0) {
      statusEl.style.background = 'rgba(234, 179, 8, 0.15)';
      statusEl.style.color = '#eab308';
      statusEl.innerHTML = `🏆 Temporary Super-Profit (+${superProfit.toFixed(1)}h): Innovator sells above individual value until competitors adopt the machinery!`;
    } else {
      statusEl.style.background = 'rgba(16, 185, 129, 0.15)';
      statusEl.style.color = '#10b981';
      statusEl.innerHTML = `⚡ Relative Surplus Gain: Necessary labour compressed from ${baseNec.toFixed(1)}h to ${nec.toFixed(1)}h without extending the clock!`;
    }

    const form = card.querySelector('#rsv-formula');
    const tex = `v = \\frac{${baseNec.toFixed(1)}\\text{h}}{${prod.toFixed(1)}\\times} = ${nec.toFixed(2)}\\text{h} \\implies s = ${totalSurp.toFixed(2)}\\text{h} \\quad (e = \\mathbf{${rate}\\%})`;
    renderSimMath(form, tex);
  }

  ['rsv-day', 'rsv-prod', 'rsv-speed', 'rsv-super'].forEach(id => {
    card.querySelector('#' + id).addEventListener('input', () => {
      card.querySelectorAll('.sim-preset-btn').forEach(b => b.classList.remove('active'));
      update();
    });
  });

  update();
  return card;
}

// 6. Co-operation & Combined Labour Power (Vol 1 Ch 13)
function buildCooperationSimulator() {
  const card = document.createElement('div');
  card.className = 'interactive-simulator-card';
  card.innerHTML = `
    <div class="sim-header" onclick="this.parentElement.classList.toggle('collapsed')">
      <div class="sim-header-title">
        <span class="sim-badge">Vol 1 • Ch 13</span>
        <span>Co-operation &amp; Social Productive Power of Combined Labour</span>
      </div>
      <span class="sim-toggle-icon">▼</span>
    </div>
    <div class="sim-content">
      <div class="sim-presets-slot"></div>
      <div class="sim-grid">
        <div class="sim-controls-pane">
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Co-operating Labourers (N):</span>
              <span class="sim-val-display" id="coop-n-val">50 workers</span>
            </div>
            <input type="range" class="sim-slider" id="coop-n" min="5" max="200" step="5" value="50">
          </div>
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Co-operative Synergy Multiplier:</span>
              <span class="sim-val-display" id="coop-syn-val">1.40x</span>
            </div>
            <input type="range" class="sim-slider" id="coop-syn" min="1.0" max="2.5" step="0.05" value="1.40">
          </div>
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Constant Capital Savings per Worker:</span>
              <span class="sim-val-display" id="coop-c-val">30% savings</span>
            </div>
            <input type="range" class="sim-slider" id="coop-c" min="0" max="50" step="5" value="30">
          </div>
        </div>
        <div class="sim-results-pane">
          <div class="sim-formula-display" id="coop-formula"></div>
          <div class="sim-bar-wrapper">
            <div class="sim-bar-labels">
              <span>Output Comparison (Combined vs Isolated Handcrafters):</span>
              <span id="coop-gain-lbl">+40% Social Productive Force</span>
            </div>
            <div class="sim-segmented-bar">
              <div class="sim-segment sim-seg-c" id="coop-bar-base" style="width:71%;">Base Artisan Output</div>
              <div class="sim-segment sim-seg-rent" id="coop-bar-syn" style="width:29%;">Cooperative Surplus</div>
            </div>
          </div>
          <div class="sim-status-banner" id="coop-status"></div>
        </div>
      </div>
      <div class="sim-proof-slot"></div>
    </div>
  `;

  const presets = [
    { label: "100 Isolated Artisans (No Synergy)", values: { n: 100, syn: 1.0, cSave: 0 } },
    { label: "Combined Workshop (50 Workers)", values: { n: 50, syn: 1.4, cSave: 30 }, active: true },
    { label: "Mass Dyke/Harvest Collective Sprint", values: { n: 150, syn: 2.0, cSave: 45 } }
  ];

  function applyPreset(v) {
    card.querySelector('#coop-n').value = v.n;
    card.querySelector('#coop-syn').value = v.syn;
    card.querySelector('#coop-c').value = v.cSave;
    update();
  }

  card.querySelector('.sim-presets-slot').appendChild(createPresetsBar(presets, applyPreset));

  const proof = createProofDrawer({
    mathHtml: '$$W_{\\text{combined}} = N \\cdot q_{\\text{isolated}} \\cdot \\text{Synergy} > \\sum_{i=1}^N W_{\\text{isolated}} \\implies \\Delta W = \\text{Free Gift of Social Labour to Capital}$$',
    explanation: 'When many workers labor together side by side, a new collective productive force emerges that costs the capitalist nothing beyond the purchase of individual labour-powers. Economies of scale in buildings, heating, and tools, combined with the stimulation of animal spirits and simultaneous multi-tasking, create a productive power inherent in collective labour.',
    quote: "Just as the offensive power of a squadron of cavalry is essentially different from the sum of the offensive powers of each individual horseman... so the social productive power developed by many labourers working together is a free gift of co-operation to capital.",
    citation: "Capital Vol. 1, Chapter 13"
  });
  card.querySelector('.sim-proof-slot').appendChild(proof);

  function update() {
    const n = parseFloat(card.querySelector('#coop-n').value);
    const syn = parseFloat(card.querySelector('#coop-syn').value);
    const cSave = parseFloat(card.querySelector('#coop-c').value);

    const baseOutput = n * 10;
    const combinedOutput = Math.round(baseOutput * syn);
    const freeGain = combinedOutput - baseOutput;
    const gainPct = Math.round((syn - 1) * 100);

    card.querySelector('#coop-n-val').textContent = n + ' workers';
    card.querySelector('#coop-syn-val').textContent = syn.toFixed(2) + 'x';
    card.querySelector('#coop-c-val').textContent = cSave + '% savings';

    const basePct = Math.round((1 / syn) * 100);
    card.querySelector('#coop-bar-base').style.width = basePct + '%';
    card.querySelector('#coop-bar-base').textContent = `Base: ${baseOutput} units`;
    card.querySelector('#coop-bar-syn').style.width = (100 - basePct) + '%';
    card.querySelector('#coop-bar-syn').textContent = freeGain > 0 ? `+${freeGain} Free Synergy` : '';

    card.querySelector('#coop-gain-lbl').textContent = `+${gainPct}% Social Productive Force (Shared Roof & Tools: ${cSave}% c saved)`;

    const statusEl = card.querySelector('#coop-status');
    statusEl.style.background = 'rgba(16, 185, 129, 0.15)';
    statusEl.style.color = '#10b981';
    statusEl.innerHTML = `🤝 Combined Power: <strong>${n}</strong> workers produce <strong>${combinedOutput} units</strong> (vs only ${baseOutput} if working separately). Capitalist pockets the difference as unpaid collective power!`;

    const form = card.querySelector('#coop-formula');
    const tex = `W_{\\text{combined}} = ${n} \\times 10 \\times ${syn.toFixed(2)} = \\mathbf{${combinedOutput}\\text{ units}} \\quad (+\\mathbf{${gainPct}\\%}\\text{ unpaid social force})`;
    renderSimMath(form, tex);
  }

  ['coop-n', 'coop-syn', 'coop-c'].forEach(id => {
    card.querySelector('#' + id).addEventListener('input', () => {
      card.querySelectorAll('.sim-preset-btn').forEach(b => b.classList.remove('active'));
      update();
    });
  });

  update();
  return card;
}

// 7. Division of Labour & Manufacture (Vol 1 Ch 14)
function buildManufactureDivisionLabourSimulator() {
  const card = document.createElement('div');
  card.className = 'interactive-simulator-card';
  card.innerHTML = `
    <div class="sim-header" onclick="this.parentElement.classList.toggle('collapsed')">
      <div class="sim-header-title">
        <span class="sim-badge">Vol 1 • Ch 14</span>
        <span>The Division of Labour &amp; Manufacture Detail Worker</span>
      </div>
      <span class="sim-toggle-icon">▼</span>
    </div>
    <div class="sim-content">
      <div class="sim-presets-slot"></div>
      <div class="sim-grid">
        <div class="sim-controls-pane">
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Detail Specialists in Workshop:</span>
              <span class="sim-val-display" id="dm-n-val">10 workers</span>
            </div>
            <input type="range" class="sim-slider" id="dm-n" min="2" max="30" step="1" value="10">
          </div>
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Operations Decomposed:</span>
              <span class="sim-val-display" id="dm-ops-val">18 operations</span>
            </div>
            <input type="range" class="sim-slider" id="dm-ops" min="1" max="25" step="1" value="18">
          </div>
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Specialized Tool Differentiation:</span>
              <span class="sim-val-display" id="dm-tools-val">High (Tailored hammers, shears)</span>
            </div>
            <input type="range" class="sim-slider" id="dm-tools" min="1" max="5" step="1" value="4">
          </div>
        </div>
        <div class="sim-results-pane">
          <div class="sim-formula-display" id="dm-formula"></div>
          <div class="sim-bar-wrapper">
            <div class="sim-bar-labels">
              <span>Adam Smith's Pin Factory Output Comparison:</span>
              <span id="dm-mult-lbl">240x Speedup</span>
            </div>
            <div class="sim-segmented-bar">
              <div class="sim-segment sim-seg-c" style="width:5%;">Artisan: 20</div>
              <div class="sim-segment sim-seg-rent" id="dm-bar-man" style="width:95%;">Manufacture: 48,000 Pins</div>
            </div>
          </div>
          <div class="sim-status-banner" id="dm-status"></div>
        </div>
      </div>
      <div class="sim-proof-slot"></div>
    </div>
  `;

  const presets = [
    { label: "Smith's Pin Manufacture (10 Men = 48k Pins)", values: { n: 10, ops: 18, tools: 4 }, active: true },
    { label: "Guild Handicraft (1 Artisan = 20 Pins)", values: { n: 1, ops: 1, tools: 1 } },
    { label: "Watchmaking Heterogeneous Manufacture", values: { n: 20, ops: 24, tools: 5 } }
  ];

  function applyPreset(v) {
    card.querySelector('#dm-n').value = v.n;
    card.querySelector('#dm-ops').value = v.ops;
    card.querySelector('#dm-tools').value = v.tools;
    update();
  }

  card.querySelector('.sim-presets-slot').appendChild(createPresetsBar(presets, applyPreset));

  const proof = createProofDrawer({
    mathHtml: '$$Q_{\\text{manufacture}} = N \\cdot q_0 \\cdot (\\text{Ops} \\times \\text{ToolSpec}) = 10 \\times 20 \\times 240 = \\mathbf{48,000\\text{ pins/day}}$$',
    explanation: 'Manufacture decomposes an entire craft into minute detail operations. The worker is converted into an automatic detail machine, repeating a single specialized gesture all day. While labour productivity skyrockets, the worker is intellectually and physically mutilated into a mere organ of the collective workshop.',
    quote: "Manufacture mutilates the worker, and artificially fosters in him one single dexterity at the expense of all his other faculties... The knowledge, judgment, and will of the craftsman are now required only for the workshop as a whole.",
    citation: "Capital Vol. 1, Chapter 14, Section 5"
  });
  card.querySelector('.sim-proof-slot').appendChild(proof);

  function update() {
    const n = parseFloat(card.querySelector('#dm-n').value);
    const ops = parseFloat(card.querySelector('#dm-ops').value);
    const tools = parseFloat(card.querySelector('#dm-tools').value);

    const speedup = Math.round(ops * tools * 3.33);
    const totalPins = Math.round(n * 20 * (speedup / 2));

    card.querySelector('#dm-n-val').textContent = n + ' specialists';
    card.querySelector('#dm-ops-val').textContent = ops + ' detail steps';
    card.querySelector('#dm-tools-val').textContent = tools > 3 ? 'High Specialization' : (tools > 1 ? 'Moderate' : 'Primitive');

    card.querySelector('#dm-mult-lbl').textContent = `${speedup}x Worker Speedup`;
    card.querySelector('#dm-bar-man').textContent = `Manufacture: ${totalPins.toLocaleString()} Pins`;

    const statusEl = card.querySelector('#dm-status');
    statusEl.style.background = 'rgba(234, 179, 8, 0.15)';
    statusEl.style.color = '#eab308';
    statusEl.innerHTML = `⚙️ Detail Alienation: <strong>${n}</strong> workers produce <strong>${totalPins.toLocaleString()} pins</strong>/day. Artisan independence destroyed; worker converted into a lifelong cog!`;

    const form = card.querySelector('#dm-formula');
    const tex = `Q = ${n} \\times 20 \\times ${Math.round(speedup/2)} = \\mathbf{${totalPins.toLocaleString()}\\text{ pins/day}} \\quad (${speedup}\\times\\text{ craft speedup})`;
    renderSimMath(form, tex);
  }

  ['dm-n', 'dm-ops', 'dm-tools'].forEach(id => {
    card.querySelector('#' + id).addEventListener('input', () => {
      card.querySelectorAll('.sim-preset-btn').forEach(b => b.classList.remove('active'));
      update();
    });
  });

  update();
  return card;
}

// 8. Machinery and Large-Scale Industry (Vol 1 Ch 15)
function buildMachineryLargeScaleIndustrySimulator() {
  const card = document.createElement('div');
  card.className = 'interactive-simulator-card';
  card.innerHTML = `
    <div class="sim-header" onclick="this.parentElement.classList.toggle('collapsed')">
      <div class="sim-header-title">
        <span class="sim-badge">Vol 1 • Ch 15</span>
        <span>Machinery &amp; Labour Displacement (The Adoption Limit)</span>
      </div>
      <span class="sim-toggle-icon">▼</span>
    </div>
    <div class="sim-content">
      <div class="sim-presets-slot"></div>
      <div class="sim-grid">
        <div class="sim-controls-pane">
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Machine Annual Depreciation Cost:</span>
              <span class="sim-val-display" id="mc-cost-val">£250 / yr</span>
            </div>
            <input type="range" class="sim-slider" id="mc-cost" min="100" max="800" step="25" value="250">
          </div>
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Workers Displaced by Machine (N):</span>
              <span class="sim-val-display" id="mc-n-val">6 workers</span>
            </div>
            <input type="range" class="sim-slider" id="mc-n" min="1" max="15" step="1" value="6">
          </div>
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Annual Wage per Worker (v):</span>
              <span class="sim-val-display" id="mc-wage-val">£50 / yr</span>
            </div>
            <input type="range" class="sim-slider" id="mc-wage" min="15" max="90" step="5" value="50">
          </div>
        </div>
        <div class="sim-results-pane">
          <div class="sim-formula-display" id="mc-formula"></div>
          <div class="sim-bar-wrapper">
            <div class="sim-bar-labels">
              <span>Capitalist Adoption Criterion (Machine Cost vs Wage Savings):</span>
              <span id="mc-save-lbl">Wage Savings: £300 vs Cost: £250</span>
            </div>
            <div class="sim-segmented-bar">
              <div class="sim-segment sim-seg-c" id="mc-bar-cost" style="width:45%;">Machine: £250</div>
              <div class="sim-segment sim-seg-rent" id="mc-bar-save" style="width:55%;">Net Savings: £50</div>
            </div>
          </div>
          <div class="sim-status-banner" id="mc-status"></div>
        </div>
      </div>
      <div class="sim-proof-slot"></div>
    </div>
  `;

  const presets = [
    { label: "Steam Power Loom (Displaces 6 Weavers)", values: { cost: 250, n: 6, wage: 50 }, active: true },
    { label: "Sweated Hand-Weavers Cheaper than Steam", values: { cost: 350, n: 6, wage: 20 } },
    { label: "High-Tech Robotics (Displaces 12 Workers)", values: { cost: 450, n: 12, wage: 60 } }
  ];

  function applyPreset(v) {
    card.querySelector('#mc-cost').value = v.cost;
    card.querySelector('#mc-n').value = v.n;
    card.querySelector('#mc-wage').value = v.wage;
    update();
  }

  card.querySelector('.sim-presets-slot').appendChild(createPresetsBar(presets, applyPreset));

  const proof = createProofDrawer({
    mathHtml: '$$\\text{Capitalist Condition: } K_{\\text{machine}} < N \\cdot v \\quad \\text{vs} \\quad \\text{Social Condition: } K_{\\text{machine}} < N \\cdot (v + s)$$',
    explanation: 'A machine is only introduced by a capitalist if its cost is LESS than the wages ($v$) of the workers it displaces—not less than the total value ($v + s$) they produce. Therefore, where wages are rock-bottom (sweatshops, child labour), capitalists refuse to adopt machines, and living humans are ruthlessly consumed in place of mechanical steel.',
    quote: "The use of machinery for the exclusive purpose of cheapening the product, is limited by the condition that less labour must be expended in producing the machine than is displaced by its employment. For capital, its use is still more limited: it pays not the labour employed, but the value of the labour-power employed.",
    citation: "Capital Vol. 1, Chapter 15, Section 2"
  });
  card.querySelector('.sim-proof-slot').appendChild(proof);

  function update() {
    const cost = parseFloat(card.querySelector('#mc-cost').value);
    const n = parseFloat(card.querySelector('#mc-n').value);
    const wage = parseFloat(card.querySelector('#mc-wage').value);

    const wageSavings = n * wage;
    const netSavings = wageSavings - cost;

    card.querySelector('#mc-cost-val').textContent = '£' + cost + ' / yr';
    card.querySelector('#mc-n-val').textContent = n + ' workers';
    card.querySelector('#mc-wage-val').textContent = '£' + wage + ' / yr';

    const statusEl = card.querySelector('#mc-status');
    if (netSavings > 0) {
      statusEl.style.background = 'rgba(16, 185, 129, 0.15)';
      statusEl.style.color = '#10b981';
      statusEl.innerHTML = `✅ Machine Adopted: Capitalist replaces ${n} living workers and pockets <strong>£${netSavings}</strong> net profit per year.`;
      const costPct = Math.round((cost / wageSavings) * 100);
      card.querySelector('#mc-bar-cost').style.width = costPct + '%';
      card.querySelector('#mc-bar-cost').textContent = `Cost: £${cost}`;
      card.querySelector('#mc-bar-save').style.width = (100 - costPct) + '%';
      card.querySelector('#mc-bar-save').textContent = `Profit: +£${netSavings}`;
    } else {
      statusEl.style.background = 'rgba(239, 68, 68, 0.15)';
      statusEl.style.color = '#ef4444';
      statusEl.innerHTML = `❌ Machine Rejected: Wages (£${wageSavings}) are cheaper than the machine (£${cost})! Capitalist continues sweating low-wage human flesh.`;
      card.querySelector('#mc-bar-cost').style.width = '100%';
      card.querySelector('#mc-bar-cost').textContent = `Machine Too Expensive (£${cost} vs £${wageSavings})`;
      card.querySelector('#mc-bar-save').style.width = '0%';
      card.querySelector('#mc-bar-save').textContent = '';
    }

    card.querySelector('#mc-save-lbl').textContent = `Wage Savings: £${wageSavings} vs Machine Cost: £${cost}`;

    const form = card.querySelector('#mc-formula');
    const tex = `K_{\\text{machine}} = \\text{\\pounds}${cost} \\quad \\text{vs} \\quad N \\cdot v = ${n} \\times \\text{\\pounds}${wage} = \\text{\\pounds}${wageSavings} \\implies \\text{Margin} = \\mathbf{\\text{\\pounds}${netSavings}}`;
    renderSimMath(form, tex);
  }

  ['mc-cost', 'mc-n', 'mc-wage'].forEach(id => {
    card.querySelector('#' + id).addEventListener('input', () => {
      card.querySelectorAll('.sim-preset-btn').forEach(b => b.classList.remove('active'));
      update();
    });
  });

  update();
  return card;
}

// 9. Absolute & Relative Surplus-Value: Formal vs Real Subsumption (Vol 1 Ch 16)
function buildAbsoluteAndRelativeSurplusValueSimulator() {
  const card = document.createElement('div');
  card.className = 'interactive-simulator-card';
  card.innerHTML = `
    <div class="sim-header" onclick="this.parentElement.classList.toggle('collapsed')">
      <div class="sim-header-title">
        <span class="sim-badge">Vol 1 • Ch 16</span>
        <span>Absolute and Relative Surplus-Value (Formal vs Real Subsumption)</span>
      </div>
      <span class="sim-toggle-icon">▼</span>
    </div>
    <div class="sim-content">
      <div class="sim-presets-slot"></div>
      <div class="sim-grid">
        <div class="sim-controls-pane">
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Subsumption Mode:</span>
              <span class="sim-val-display" id="sub-mode-val">Real Subsumption</span>
            </div>
            <select class="sim-slider" id="sub-mode" style="height:32px;background:var(--bg-card);color:var(--text-main);border:1px solid var(--border-color);border-radius:6px;padding:0 0.5rem;">
              <option value="formal">Formal Subsumption (Prolonging the Clock)</option>
              <option value="real" selected>Real Subsumption (Revolutionizing the Tech)</option>
            </select>
          </div>
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Working Day Hours (Absolute Lever):</span>
              <span class="sim-val-display" id="sub-day-val">10 hrs</span>
            </div>
            <input type="range" class="sim-slider" id="sub-day" min="8" max="16" step="0.5" value="10">
          </div>
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Technological Productivity (Relative Lever):</span>
              <span class="sim-val-display" id="sub-prod-val">2.0x</span>
            </div>
            <input type="range" class="sim-slider" id="sub-prod" min="1.0" max="4.0" step="0.25" value="2.0">
          </div>
        </div>
        <div class="sim-results-pane">
          <div class="sim-formula-display" id="sub-formula"></div>
          <div class="sim-bar-wrapper">
            <div class="sim-bar-labels">
              <span>Value Composition of Working Day:</span>
              <span id="sub-split-lbl">v: 2.5h | s: 7.5h</span>
            </div>
            <div class="sim-segmented-bar">
              <div class="sim-segment sim-seg-v" id="sub-bar-v" style="width:25%;">v: 2.5h</div>
              <div class="sim-segment sim-seg-s" id="sub-bar-s" style="width:75%;">s: 7.5h</div>
            </div>
          </div>
          <div class="sim-status-banner" id="sub-status"></div>
        </div>
      </div>
      <div class="sim-proof-slot"></div>
    </div>
  `;

  const presets = [
    { label: "Formal Subsumption (14h Handcraft)", values: { mode: "formal", day: 14, prod: 1.0 } },
    { label: "Real Subsumption (10h Automated)", values: { mode: "real", day: 10, prod: 2.5 }, active: true },
    { label: "Hyper-Modern Subsumption (8h @ 4x)", values: { mode: "real", day: 8, prod: 4.0 } }
  ];

  function applyPreset(v) {
    card.querySelector('#sub-mode').value = v.mode;
    card.querySelector('#sub-day').value = v.day;
    card.querySelector('#sub-prod').value = v.prod;
    update();
  }

  card.querySelector('.sim-presets-slot').appendChild(createPresetsBar(presets, applyPreset));

  const proof = createProofDrawer({
    mathHtml: '$$\\text{Formal Subsumption: } s = T - v_0 \\quad | \\quad \\text{Real Subsumption: } s = T - \\frac{v_0}{\\Pi}$$',
    explanation: 'Formal subsumption takes over existing artisanal labour processes as it finds them, extracting surplus-value purely by prolonging the working day (absolute surplus-value). Real subsumption completely revolutionizes the technical and social conditions of the labour process itself, subordinating the worker directly to machines and mass-producing relative surplus-value.',
    quote: "The production of absolute surplus-value turns exclusively upon the length of the working day; the production of relative surplus-value, on the other hand, revolutionizes out and out the technical processes of labour to reduce necessary labour time.",
    citation: "Capital Vol. 1, Chapter 16"
  });
  card.querySelector('.sim-proof-slot').appendChild(proof);

  function update() {
    const mode = card.querySelector('#sub-mode').value;
    const day = parseFloat(card.querySelector('#sub-day').value);
    const prod = parseFloat(card.querySelector('#sub-prod').value);

    let nec = 5.0;
    if (mode === 'real') {
      nec = 5.0 / prod;
    }
    const surplus = Math.max(0, day - nec);
    const rate = Math.round((surplus / nec) * 100);

    card.querySelector('#sub-mode-val').textContent = mode === 'formal' ? 'Formal Subsumption' : 'Real Subsumption';
    card.querySelector('#sub-day-val').textContent = day + ' hrs';
    card.querySelector('#sub-prod-val').textContent = prod.toFixed(2) + 'x';

    const vPct = Math.round((nec / day) * 100);
    card.querySelector('#sub-bar-v').style.width = vPct + '%';
    card.querySelector('#sub-bar-v').textContent = `v: ${nec.toFixed(1)}h`;
    card.querySelector('#sub-bar-s').style.width = (100 - vPct) + '%';
    card.querySelector('#sub-bar-s').textContent = `s: ${surplus.toFixed(1)}h`;

    const statusEl = card.querySelector('#sub-status');
    if (mode === 'formal') {
      statusEl.style.background = 'rgba(245, 158, 11, 0.15)';
      statusEl.style.color = '#f59e0b';
      statusEl.innerHTML = `⏳ Formal Subsumption: Traditional craft untouched; capital squeezes surplus exclusively by lengthening the physical clock (${day}h).`;
    } else {
      statusEl.style.background = 'rgba(16, 185, 129, 0.15)';
      statusEl.style.color = '#10b981';
      statusEl.innerHTML = `⚡ Real Subsumption: Production process revolutionized; necessary labour compressed to <strong>${nec.toFixed(2)}h</strong>, yielding <strong>${rate}%</strong> rate of exploitation!`;
    }

    const form = card.querySelector('#sub-formula');
    const tex = mode === 'formal'
      ? `s_{\\text{abs}} = ${day}\\text{h} - 5\\text{h} = \\mathbf{${surplus.toFixed(1)}\\text{ hrs}} \\quad (e = ${rate}\\%)`
      : `s_{\\text{rel}} = ${day}\\text{h} - \\frac{5\\text{h}}{${prod.toFixed(1)}\\times} = \\mathbf{${surplus.toFixed(2)}\\text{ hrs}} \\quad (e = \\mathbf{${rate}\\%})`;
    renderSimMath(form, tex);
  }

  ['sub-mode', 'sub-day', 'sub-prod'].forEach(id => {
    card.querySelector('#' + id).addEventListener('input', () => {
      card.querySelectorAll('.sim-preset-btn').forEach(b => b.classList.remove('active'));
      update();
    });
  });

  update();
  return card;
}

// 10. Changes of Magnitude in Price of Labour-Power & Surplus-Value (Vol 1 Ch 17)
function buildChangesOfMagnitudeSimulator() {
  const card = document.createElement('div');
  card.className = 'interactive-simulator-card';
  card.innerHTML = `
    <div class="sim-header" onclick="this.parentElement.classList.toggle('collapsed')">
      <div class="sim-header-title">
        <span class="sim-badge">Vol 1 • Ch 17</span>
        <span>Changes of Magnitude in Labour-Power &amp; Surplus-Value</span>
      </div>
      <span class="sim-toggle-icon">▼</span>
    </div>
    <div class="sim-content">
      <div class="sim-presets-slot"></div>
      <div class="sim-grid">
        <div class="sim-controls-pane">
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Length of Working Day (T):</span>
              <span class="sim-val-display" id="cm-t-val">10 hrs</span>
            </div>
            <input type="range" class="sim-slider" id="cm-t" min="6" max="14" step="0.5" value="10">
          </div>
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Labour Intensity (I):</span>
              <span class="sim-val-display" id="cm-i-val">1.0x (Normal)</span>
            </div>
            <input type="range" class="sim-slider" id="cm-i" min="0.8" max="2.0" step="0.1" value="1.0">
          </div>
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Labour Productivity (Π):</span>
              <span class="sim-val-display" id="cm-p-val">1.0x (Standard)</span>
            </div>
            <input type="range" class="sim-slider" id="cm-p" min="0.8" max="3.0" step="0.1" value="1.0">
          </div>
        </div>
        <div class="sim-results-pane">
          <div class="sim-formula-display" id="cm-formula"></div>
          <div class="sim-bar-wrapper">
            <div class="sim-bar-labels">
              <span>Value Created (T · I) vs Wage Value:</span>
              <span id="cm-res-lbl">v: 5.0h | s: 5.0h</span>
            </div>
            <div class="sim-segmented-bar">
              <div class="sim-segment sim-seg-v" id="cm-bar-v" style="width:50%;">v: 5.0h</div>
              <div class="sim-segment sim-seg-s" id="cm-bar-s" style="width:50%;">s: 5.0h</div>
            </div>
          </div>
          <div class="sim-status-banner" id="cm-status"></div>
        </div>
      </div>
      <div class="sim-proof-slot"></div>
    </div>
  `;

  const presets = [
    { label: "Case I: Pure Productivity Leap", values: { t: 10, i: 1.0, p: 2.0 }, active: true },
    { label: "Case II: Machine Speed-Up (Intensity)", values: { t: 10, i: 1.4, p: 1.0 } },
    { label: "Case III: Short Day Offset by Intensity", values: { t: 8, i: 1.3, p: 1.2 } },
    { label: "Case IV: Simultaneous Triple Variation", values: { t: 11, i: 1.2, p: 1.8 } }
  ];

  function applyPreset(v) {
    card.querySelector('#cm-t').value = v.t;
    card.querySelector('#cm-i').value = v.i;
    card.querySelector('#cm-p').value = v.p;
    update();
  }

  card.querySelector('.sim-presets-slot').appendChild(createPresetsBar(presets, applyPreset));

  const proof = createProofDrawer({
    mathHtml: '$$W = T \\cdot I \\quad | \\quad v = \\frac{v_0}{\\Pi} \\implies s = (T \\cdot I) - \\frac{v_0}{\\Pi}$$',
    explanation: 'Marx analyzes how three independent variables—Length of Day, Intensity of Labour, and Productivity of Labour—determine the price of labour-power and surplus-value. If productivity doubles while day length is unchanged, the value of labour-power falls by half, allowing real wages and surplus-value to expand simultaneously!',
    quote: "Three factors determine the value of labour-power and surplus-value: the length of the working day, the intensity of labour, and the productiveness of labour... A simultaneous variation in all three factors may cause the price of labour-power and surplus-value to vary in the same direction or in opposite directions.",
    citation: "Capital Vol. 1, Chapter 17"
  });
  card.querySelector('.sim-proof-slot').appendChild(proof);

  function update() {
    const t = parseFloat(card.querySelector('#cm-t').value);
    const i = parseFloat(card.querySelector('#cm-i').value);
    const p = parseFloat(card.querySelector('#cm-p').value);

    const totalValueHours = t * i;
    const vHours = 5.0 / p;
    const sHours = Math.max(0, totalValueHours - vHours);
    const rate = Math.round((sHours / vHours) * 100);

    card.querySelector('#cm-t-val').textContent = t + ' hrs';
    card.querySelector('#cm-i-val').textContent = i.toFixed(1) + 'x';
    card.querySelector('#cm-p-val').textContent = p.toFixed(1) + 'x';

    const vPct = Math.round((vHours / totalValueHours) * 100);
    card.querySelector('#cm-bar-v').style.width = vPct + '%';
    card.querySelector('#cm-bar-v').textContent = `v: ${vHours.toFixed(1)}h`;
    card.querySelector('#cm-bar-s').style.width = (100 - vPct) + '%';
    card.querySelector('#cm-bar-s').textContent = `s: ${sHours.toFixed(1)}h`;

    card.querySelector('#cm-res-lbl').textContent = `v: ${vHours.toFixed(2)}h | s: ${sHours.toFixed(2)}h (${rate}%)`;

    const statusEl = card.querySelector('#cm-status');
    statusEl.style.background = 'rgba(2, 132, 199, 0.15)';
    statusEl.style.color = '#0284c7';
    statusEl.innerHTML = `📊 Dialectical Result: Total value product is <strong>${totalValueHours.toFixed(1)} value-hours</strong>. Necessary labour is <strong>${vHours.toFixed(2)}h</strong>, yielding surplus of <strong>${sHours.toFixed(2)}h</strong>!`;

    const form = card.querySelector('#cm-formula');
    const tex = `W = ${t}\\text{h} \\times ${i}\\times = ${totalValueHours.toFixed(1)}\\text{h} \\quad | \\quad v = \\frac{5}{${p}} = ${vHours.toFixed(2)}\\text{h} \\implies s = \\mathbf{${sHours.toFixed(2)}\\text{ hrs}} \\quad (e = \\mathbf{${rate}\\%})`;
    renderSimMath(form, tex);
  }

  ['cm-t', 'cm-i', 'cm-p'].forEach(id => {
    card.querySelector('#' + id).addEventListener('input', () => {
      card.querySelectorAll('.sim-preset-btn').forEach(b => b.classList.remove('active'));
      update();
    });
  });

  update();
  return card;
}

// 11. Simple Reproduction & Worker Dependency (Vol 1 Ch 23)
function buildSimpleReproductionWorkerDependencySimulator() {
  const card = document.createElement('div');
  card.className = 'interactive-simulator-card';
  card.innerHTML = `
    <div class="sim-header" onclick="this.parentElement.classList.toggle('collapsed')">
      <div class="sim-header-title">
        <span class="sim-badge">Vol 1 • Ch 23</span>
        <span>Simple Reproduction &amp; The Dissolution of Initial Capital</span>
      </div>
      <span class="sim-toggle-icon">▼</span>
    </div>
    <div class="sim-content">
      <div class="sim-presets-slot"></div>
      <div class="sim-grid">
        <div class="sim-controls-pane">
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Capitalist's Original Advance (K₀):</span>
              <span class="sim-val-display" id="sr-k-val">£1,000</span>
            </div>
            <input type="range" class="sim-slider" id="sr-k" min="500" max="5000" step="250" value="1000">
          </div>
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Annual Surplus Extracted &amp; Consumed (s):</span>
              <span class="sim-val-display" id="sr-s-val">£200 / yr</span>
            </div>
            <input type="range" class="sim-slider" id="sr-s" min="100" max="1000" step="50" value="200">
          </div>
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Elapsed Years of Production (t):</span>
              <span class="sim-val-display" id="sr-t-val">Year 5</span>
            </div>
            <input type="range" class="sim-slider" id="sr-t" min="1" max="12" step="1" value="5">
          </div>
        </div>
        <div class="sim-results-pane">
          <div class="sim-formula-display" id="sr-formula"></div>
          <div class="sim-bar-wrapper">
            <div class="sim-bar-labels">
              <span>Origin of Current Capital (Original Wealth vs Capitalized Unpaid Labour):</span>
              <span id="sr-share-lbl">100% Capitalized Surplus</span>
            </div>
            <div class="sim-segmented-bar">
              <div class="sim-segment sim-seg-c" id="sr-bar-orig" style="width:0%;">Original Advance</div>
              <div class="sim-segment sim-seg-s" id="sr-bar-surp" style="width:100%;">Past Unpaid Labour: 100%</div>
            </div>
          </div>
          <div class="sim-status-banner" id="sr-status"></div>
        </div>
      </div>
      <div class="sim-proof-slot"></div>
    </div>
  `;

  const presets = [
    { label: "Marx's 5-Year Dissolution Case", values: { k: 1000, s: 200, t: 5 }, active: true },
    { label: "Year 2: Partial Dissolution (40%)", values: { k: 1000, s: 200, t: 2 } },
    { label: "Year 10: Complete Worker Production", values: { k: 2000, s: 200, t: 10 } }
  ];

  function applyPreset(v) {
    card.querySelector('#sr-k').value = v.k;
    card.querySelector('#sr-s').value = v.s;
    card.querySelector('#sr-t').value = v.t;
    update();
  }

  card.querySelector('.sim-presets-slot').appendChild(createPresetsBar(presets, applyPreset));

  const proof = createProofDrawer({
    mathHtml: '$$t^* = \\frac{K_0}{s} = \\frac{\\text{\\pounds}1,000}{\\text{\\pounds}200/\\text{yr}} = \\mathbf{5\\text{ years}} \\implies \\text{After Year } 5, \\text{Original Capital} = 0, \\text{ Capital} \\equiv \\sum s$$',
    explanation: 'Even without expanded accumulation, simple reproduction converts all capital into accumulated unpaid labour within $K_0 / s$ years. The capitalist has consumed the entire value of his original wealth, so whatever capital remains in his possession is 100% extracted surplus-value from past workers. Meanwhile, the worker consumes their wage, reproducing themselves as empty-handed proletarians bound to capital by invisible threads.',
    quote: "Apart from all accumulation, the mere continuity of the process of production, in other words simple reproduction, sooner or later, and of necessity, converts every capital into accumulated capital, or capitalized surplus-value... The capitalist's initial capital has vanished.",
    citation: "Capital Vol. 1, Chapter 23"
  });
  card.querySelector('.sim-proof-slot').appendChild(proof);

  function update() {
    const k = parseFloat(card.querySelector('#sr-k').value);
    const s = parseFloat(card.querySelector('#sr-s').value);
    const t = parseFloat(card.querySelector('#sr-t').value);

    const turnoverYears = k / s;
    const consumedSoFar = t * s;
    const surpShare = Math.min(100, Math.round((consumedSoFar / k) * 100));
    const origShare = 100 - surpShare;

    card.querySelector('#sr-k-val').textContent = '£' + k.toLocaleString();
    card.querySelector('#sr-s-val').textContent = '£' + s + ' / yr';
    card.querySelector('#sr-t-val').textContent = 'Year ' + t;

    card.querySelector('#sr-bar-orig').style.width = origShare + '%';
    card.querySelector('#sr-bar-orig').textContent = origShare > 10 ? `Original: ${origShare}%` : '';
    card.querySelector('#sr-bar-surp').style.width = surpShare + '%';
    card.querySelector('#sr-bar-surp').textContent = `Unpaid Labour: ${surpShare}%`;

    card.querySelector('#sr-share-lbl').textContent = `${surpShare}% Capitalized Unpaid Labour (${origShare}% Original)`;

    const statusEl = card.querySelector('#sr-status');
    if (t >= turnoverYears) {
      statusEl.style.background = 'rgba(239, 68, 68, 0.15)';
      statusEl.style.color = '#ef4444';
      statusEl.innerHTML = `⚖️ Total Dissolution Reached: In ${turnoverYears.toFixed(1)} years, the capitalist consumed £${k.toLocaleString()}. 100% of currently existing capital is worker's past unpaid labour!`;
    } else {
      statusEl.style.background = 'rgba(245, 158, 11, 0.15)';
      statusEl.style.color = '#f59e0b';
      statusEl.innerHTML = `⏳ Dissolving Original Advance: £${consumedSoFar} of original £${k} consumed. In ${(turnoverYears - t).toFixed(1)} more years, all original capital vanishes.`;
    }

    const form = card.querySelector('#sr-formula');
    const tex = `t^* = \\frac{K_0}{s} = \\frac{\\text{\\pounds}${k}}{\\text{\\pounds}${s}} = ${turnoverYears.toFixed(1)}\\text{ yrs} \\implies \\text{Year } ${t}\\text{: } \\mathbf{${surpShare}\\%}\\text{ of Capital is Past Unpaid Labour}`;
    renderSimMath(form, tex);
  }

  ['sr-k', 'sr-s', 'sr-t'].forEach(id => {
    card.querySelector('#' + id).addEventListener('input', () => {
      card.querySelectorAll('.sim-preset-btn').forEach(b => b.classList.remove('active'));
      update();
    });
  });

  update();
  return card;
}

// 12. Accumulation vs Luxury Consumption: The Faustian Conflict (Vol 1 Ch 24)
function buildAccumulationVsRevenueSimulator() {
  const card = document.createElement('div');
  card.className = 'interactive-simulator-card';
  card.innerHTML = `
    <div class="sim-header" onclick="this.parentElement.classList.toggle('collapsed')">
      <div class="sim-header-title">
        <span class="sim-badge">Vol 1 • Ch 24</span>
        <span>The Division of Surplus-Value: Accumulation vs Luxury Revenue</span>
      </div>
      <span class="sim-toggle-icon">▼</span>
    </div>
    <div class="sim-content">
      <div class="sim-presets-slot"></div>
      <div class="sim-grid">
        <div class="sim-controls-pane">
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Annual Surplus-Value Extracted (s):</span>
              <span class="sim-val-display" id="ar-s-val">£2,000 / yr</span>
            </div>
            <input type="range" class="sim-slider" id="ar-s" min="500" max="8000" step="250" value="2000">
          </div>
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Accumulation Rate (α Reinvested):</span>
              <span class="sim-val-display" id="ar-alpha-val">60%</span>
            </div>
            <input type="range" class="sim-slider" id="ar-alpha" min="10" max="90" step="5" value="60">
          </div>
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Compound Accumulation Horizon:</span>
              <span class="sim-val-display" id="ar-years-val">5 years</span>
            </div>
            <input type="range" class="sim-slider" id="ar-years" min="1" max="10" step="1" value="5">
          </div>
        </div>
        <div class="sim-results-pane">
          <div class="sim-formula-display" id="ar-formula"></div>
          <div class="sim-bar-wrapper">
            <div class="sim-bar-labels">
              <span>The Faustian Split in the Capitalist Breast:</span>
              <span id="ar-split-lbl">Accumulation: £1,200 | Luxury: £800</span>
            </div>
            <div class="sim-segmented-bar">
              <div class="sim-segment sim-seg-c" id="ar-bar-accum" style="width:60%;">Accumulation (ΔK): £1,200</div>
              <div class="sim-segment sim-seg-s" id="ar-bar-lux" style="width:40%;">Luxury Revenue: £800</div>
            </div>
          </div>
          <div class="sim-status-banner" id="ar-status"></div>
        </div>
      </div>
      <div class="sim-proof-slot"></div>
    </div>
  `;

  const presets = [
    { label: "Early Industrial Ascetic (80% Reinvested)", values: { s: 2000, alpha: 80, years: 5 } },
    { label: "Modern Corporate Monopoly (60% Reinvested)", values: { s: 2000, alpha: 60, years: 5 }, active: true },
    { label: "Decadent Luxury Spender (20% Reinvested)", values: { s: 2000, alpha: 20, years: 5 } }
  ];

  function applyPreset(v) {
    card.querySelector('#ar-s').value = v.s;
    card.querySelector('#ar-alpha').value = v.alpha;
    card.querySelector('#ar-years').value = v.years;
    update();
  }

  card.querySelector('.sim-presets-slot').appendChild(createPresetsBar(presets, applyPreset));

  const proof = createProofDrawer({
    mathHtml: '$$s = \\text{Accumulation } (\\alpha \\cdot s) + \\text{Revenue } ((1-\\alpha) \\cdot s) \\implies K_t = K_0 (1 + \\alpha \\cdot r)^t$$',
    explanation: 'Marx refutes Nassau Senior’s "Abstinence Theory," which praised the capitalist as a saintly ascetic abstaining from consumption. In reality, the capitalist’s breast experiences a Faustian conflict: "Two souls dwell within his breast: the one passion for accumulation, the other desire for enjoyment." Competitive pressure compels accumulation under penalty of economic extinction.',
    quote: "Accumulate, accumulate! That is Moses and the prophets! Accumulation for accumulation’s sake, production for production’s sake: by this formula classical economy expressed the historical mission of the bourgeoisie.",
    citation: "Capital Vol. 1, Chapter 24, Section 3"
  });
  card.querySelector('.sim-proof-slot').appendChild(proof);

  function update() {
    const s = parseFloat(card.querySelector('#ar-s').value);
    const alphaPct = parseFloat(card.querySelector('#ar-alpha').value);
    const alpha = alphaPct / 100;
    const years = parseFloat(card.querySelector('#ar-years').value);

    const accumAnnual = s * alpha;
    const luxAnnual = s * (1 - alpha);

    let k = 5000;
    for (let yr = 0; yr < years; yr++) {
      k += k * 0.15 * alpha;
    }

    card.querySelector('#ar-s-val').textContent = '£' + s.toLocaleString() + ' / yr';
    card.querySelector('#ar-alpha-val').textContent = alphaPct + '%';
    card.querySelector('#ar-years-val').textContent = years + ' years';

    card.querySelector('#ar-bar-accum').style.width = alphaPct + '%';
    card.querySelector('#ar-bar-accum').textContent = `Accum: £${Math.round(accumAnnual).toLocaleString()}`;
    card.querySelector('#ar-bar-lux').style.width = (100 - alphaPct) + '%';
    card.querySelector('#ar-bar-lux').textContent = `Luxury: £${Math.round(luxAnnual).toLocaleString()}`;

    card.querySelector('#ar-split-lbl').textContent = `Accumulation: £${Math.round(accumAnnual).toLocaleString()} (${alphaPct}%) | Luxury: £${Math.round(luxAnnual).toLocaleString()}`;

    const statusEl = card.querySelector('#ar-status');
    statusEl.style.background = 'rgba(16, 185, 129, 0.15)';
    statusEl.style.color = '#10b981';
    statusEl.innerHTML = `📈 5-Year Capital Compounding: At ${alphaPct}% reinvestment, enterprise stock expands from £5,000 to <strong>£${Math.round(k).toLocaleString()}</strong>!`;

    const form = card.querySelector('#ar-formula');
    const tex = `s = \\text{Accum } (\\text{\\pounds}${Math.round(accumAnnual).toLocaleString()}) + \\text{Revenue } (\\text{\\pounds}${Math.round(luxAnnual).toLocaleString()}) \\implies K_{${years}} = \\mathbf{\\text{\\pounds}${Math.round(k).toLocaleString()}}`;
    renderSimMath(form, tex);
  }

  ['ar-s', 'ar-alpha', 'ar-years'].forEach(id => {
    card.querySelector('#' + id).addEventListener('input', () => {
      card.querySelectorAll('.sim-preset-btn').forEach(b => b.classList.remove('active'));
      update();
    });
  });

  update();
  return card;
}
// 13. Accumulation & The Industrial Reserve Army (Vol 1 Ch 25)
function buildAccumulationReserveArmySimulator() {
  const card = document.createElement('div');
  card.className = 'interactive-simulator-card';
  card.innerHTML = `
    <div class="sim-header" onclick="this.parentElement.classList.toggle('collapsed')">
      <div class="sim-header-title">
        <span class="sim-badge">Vol 1 • Ch 25</span>
        <span>The General Law of Capitalist Accumulation (OCC &amp; Reserve Army)</span>
      </div>
      <span class="sim-toggle-icon">▼</span>
    </div>
    <div class="sim-content">
      <div class="sim-presets-slot"></div>
      <div class="sim-grid">
        <div class="sim-controls-pane">
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Organic Composition of Capital (c : v):</span>
              <span class="sim-val-display" id="ara-occ-val">4.0 : 1</span>
            </div>
            <input type="range" class="sim-slider" id="ara-occ" min="1.0" max="12.0" step="0.5" value="4.0">
          </div>
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Surplus Reinvestment Rate (α):</span>
              <span class="sim-val-display" id="ara-accum-val">60%</span>
            </div>
            <input type="range" class="sim-slider" id="ara-accum" min="10" max="90" step="5" value="60">
          </div>
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Total Capital Stock (K = c + v):</span>
              <span class="sim-val-display" id="ara-cap-val">£10,000</span>
            </div>
            <input type="range" class="sim-slider" id="ara-cap" min="5000" max="25000" step="1000" value="10000">
          </div>
        </div>
        <div class="sim-results-pane">
          <div class="sim-formula-display" id="ara-formula"></div>
          <div class="sim-bar-wrapper">
            <div class="sim-bar-labels">
              <span>Working Class Allocation:</span>
              <span id="ara-active-lbl">Active: 82% | Reserve Army: 18%</span>
            </div>
            <div class="sim-segmented-bar">
              <div class="sim-segment" id="ara-bar-active" style="background:#10b981;width:82%;">Active 82%</div>
              <div class="sim-segment" id="ara-bar-latent" style="background:#0284c7;width:8%;">Latent</div>
              <div class="sim-segment" id="ara-bar-stagnant" style="background:#f59e0b;width:6%;">Stagnant</div>
              <div class="sim-segment" id="ara-bar-pauper" style="background:#ef4444;width:4%;">Pauper</div>
            </div>
          </div>
          <div class="sim-status-banner" id="ara-status"></div>
        </div>
      </div>
      <div class="sim-proof-slot"></div>
    </div>
  `;

  const presets = [
    { label: "Early Industrial Boom (Tight Labour)", values: { occ: 2.0, accum: 70, cap: 10000 } },
    { label: "Intensive Mechanization Wave", values: { occ: 6.0, accum: 80, cap: 15000 }, active: true },
    { label: "Recession & Layoffs", values: { occ: 4.5, accum: 20, cap: 8000 } },
    { label: "Automated Monopoly", values: { occ: 10.0, accum: 65, cap: 20000 } }
  ];

  function applyPreset(v) {
    card.querySelector('#ara-occ').value = v.occ;
    card.querySelector('#ara-accum').value = v.accum;
    card.querySelector('#ara-cap').value = v.cap;
    update();
  }

  card.querySelector('.sim-presets-slot').appendChild(createPresetsBar(presets, applyPreset));

  const proof = createProofDrawer({
    mathHtml: '$$\\Delta K = \\alpha \\cdot s \\implies \\Delta v = \\frac{\\Delta K}{\\text{OCC} + 1} \\implies g_L = g_K - g_{\\text{OCC}}$$',
    explanation: 'The demand for labour is determined not by total capital, but by its variable component $v$. As organic composition ($c/v$) rises through mechanization, living labour is displaced, creating an industrial reserve army whose competition crushes wages.',
    quote: "The industrial reserve army, during the periods of stagnation and average prosperity, weighs down the active army of workers, and during the periods of over-production and paroxysm, holds its pretensions in check.",
    citation: "Capital Vol. 1, Chapter 25, Section 3"
  });
  card.querySelector('.sim-proof-slot').appendChild(proof);

  function update() {
    const occ = parseFloat(card.querySelector('#ara-occ').value);
    const accum = parseFloat(card.querySelector('#ara-accum').value);
    const cap = parseFloat(card.querySelector('#ara-cap').value);

    const v = cap / (occ + 1);
    const c = cap - v;

    const uRaw = (occ * 4.2) - (accum * 0.18);
    const uRate = Math.min(65, Math.max(4, uRaw));
    const activeRate = 100 - uRate;

    const latent = uRate * 0.45;
    const stagnant = uRate * 0.35;
    const pauper = uRate * 0.20;

    card.querySelector('#ara-occ-val').textContent = occ.toFixed(1) + ' : 1';
    card.querySelector('#ara-accum-val').textContent = accum + '%';
    card.querySelector('#ara-cap-val').textContent = '£' + cap.toLocaleString();

    card.querySelector('#ara-active-lbl').textContent = `Active: ${activeRate.toFixed(1)}% | Reserve Army: ${uRate.toFixed(1)}%`;
    card.querySelector('#ara-bar-active').style.width = activeRate + '%';
    card.querySelector('#ara-bar-active').textContent = `Active: ${Math.round(activeRate)}%`;
    card.querySelector('#ara-bar-latent').style.width = latent + '%';
    card.querySelector('#ara-bar-latent').textContent = latent > 5 ? 'Latent' : '';
    card.querySelector('#ara-bar-stagnant').style.width = stagnant + '%';
    card.querySelector('#ara-bar-stagnant').textContent = stagnant > 5 ? 'Stagnant' : '';
    card.querySelector('#ara-bar-pauper').style.width = pauper + '%';
    card.querySelector('#ara-bar-pauper').textContent = pauper > 4 ? 'Pauper' : '';

    const statusEl = card.querySelector('#ara-status');
    if (uRate < 8) {
      statusEl.style.background = 'rgba(234, 179, 8, 0.15)';
      statusEl.style.color = '#eab308';
      statusEl.innerHTML = `⚠️ Tight Labour Market (Reserve Army ${uRate.toFixed(1)}%): Wages begin to rise! Capital retaliates by introducing labour-saving machines.`;
    } else if (uRate > 25) {
      statusEl.style.background = 'rgba(239, 68, 68, 0.15)';
      statusEl.style.color = '#ef4444';
      statusEl.innerHTML = `🚨 Mass Unemployment (${uRate.toFixed(1)}% Reserve): Desperate competition forces wages below the value of labour-power.`;
    } else {
      statusEl.style.background = 'rgba(16, 185, 129, 0.15)';
      statusEl.style.color = '#10b981';
      statusEl.innerHTML = `⚖️ Structural Reserve (${uRate.toFixed(1)}%): The reserve army maintains discipline and keeps surplus-value flowing steadily.`;
    }

    const form = card.querySelector('#ara-formula');
    const tex = `\\text{OCC} = \\frac{c}{v} = \\frac{\\text{\\pounds}${Math.round(c)}}{\\text{\\pounds}${Math.round(v)}} = ${occ.toFixed(1)}:1 \\implies \\text{Reserve Army Rate } U = \\mathbf{${uRate.toFixed(1)}\\%}`;
    renderSimMath(form, tex);
  }

  ['ara-occ', 'ara-accum', 'ara-cap'].forEach(id => {
    card.querySelector('#' + id).addEventListener('input', () => {
      card.querySelectorAll('.sim-preset-btn').forEach(b => b.classList.remove('active'));
      update();
    });
  });

  update();
  return card;
}

// 14. The Three Circuits of Industrial Capital (Vol 2 Ch 1–4)
function buildThreeCircuitsSimulator() {
  const card = document.createElement('div');
  card.className = 'interactive-simulator-card';
  card.innerHTML = `
    <div class="sim-header" onclick="this.parentElement.classList.toggle('collapsed')">
      <div class="sim-header-title">
        <span class="sim-badge">Vol 2 • Ch 1–4</span>
        <span>The Three Circuits of Industrial Capital (M, P, C')</span>
      </div>
      <span class="sim-toggle-icon">▼</span>
    </div>
    <div class="sim-content">
      <div class="sim-presets-slot"></div>
      <div class="sim-grid">
        <div class="sim-controls-pane">
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Dominant Circuit Viewpoint:</span>
              <span class="sim-val-display" id="tc-view-val">Circuit of Money Capital</span>
            </div>
            <select class="sim-slider" id="tc-view" style="height:32px;background:var(--bg-card);color:var(--text-main);border:1px solid var(--border-color);border-radius:6px;padding:0 0.5rem;">
              <option value="m">1. Circuit of Money Capital (M — C ... P ... C' — M')</option>
              <option value="p">2. Circuit of Productive Capital (P ... C' — M' — C ... P)</option>
              <option value="c">3. Circuit of Commodity Capital (C' — M' — C ... P ... C')</option>
            </select>
          </div>
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Circulation Velocity / Metamorphosis Speed:</span>
              <span class="sim-val-display" id="tc-speed-val">1.0x (Normal)</span>
            </div>
            <input type="range" class="sim-slider" id="tc-speed" min="0.5" max="2.5" step="0.25" value="1.0">
          </div>
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Interruption / Bottleneck Hazard:</span>
              <span class="sim-val-display" id="tc-hazard-val">Smooth Flow</span>
            </div>
            <select class="sim-slider" id="tc-hazard" style="height:32px;background:var(--bg-card);color:var(--text-main);border:1px solid var(--border-color);border-radius:6px;padding:0 0.5rem;">
              <option value="none">None (Continuous Flow)</option>
              <option value="m">Liquidity Trap (Capital stuck as Money Hoard)</option>
              <option value="p">Production Interruption (Strike / Equipment Breakdown)</option>
              <option value="c">Realization Crisis (Unsold Commodity Glut)</option>
            </select>
          </div>
        </div>
        <div class="sim-results-pane">
          <div class="sim-formula-display" id="tc-formula"></div>
          <div class="sim-bar-wrapper">
            <div class="sim-bar-labels">
              <span>Metamorphosis Stages of Industrial Capital:</span>
              <span id="tc-stage-lbl">Money (M) → Production (P) → Commodities (C')</span>
            </div>
            <div class="sim-segmented-bar" style="height:26px;">
              <div class="sim-segment sim-seg-c" id="tc-bar-m" style="width:33%;">M: Money Stage</div>
              <div class="sim-segment sim-seg-v" id="tc-bar-p" style="width:34%;">P: Value Creation</div>
              <div class="sim-segment sim-seg-s" id="tc-bar-c" style="width:33%;">C': Realization</div>
            </div>
          </div>
          <div class="sim-status-banner" id="tc-status"></div>
        </div>
      </div>
      <div class="sim-proof-slot"></div>
    </div>
  `;

  const presets = [
    { label: "Circuit of Money Capital (Mercantile View)", values: { view: "m", speed: 1.0, hazard: "none" }, active: true },
    { label: "Circuit of Productive Capital (Industrial View)", values: { view: "p", speed: 1.25, hazard: "none" } },
    { label: "Realization Crisis (Inventory Glut)", values: { view: "c", speed: 0.5, hazard: "c" } },
    { label: "Liquidity Hoarding Panic", values: { view: "m", speed: 0.5, hazard: "m" } }
  ];

  function applyPreset(v) {
    card.querySelector('#tc-view').value = v.view;
    card.querySelector('#tc-speed').value = v.speed;
    card.querySelector('#tc-hazard').value = v.hazard;
    update();
  }

  card.querySelector('.sim-presets-slot').appendChild(createPresetsBar(presets, applyPreset));

  const proof = createProofDrawer({
    mathHtml: '$$\\text{Circuit I: } M - C(L, MP) \\dots P \\dots C\' - M\' \\quad | \\quad \\text{Circuit II: } P \\dots P \\quad | \\quad \\text{Circuit III: } C\' \\dots C\'$$',
    explanation: 'Capital is not a static thing, but a self-valorizing movement through three distinct metamorphoses. Money capital ($M$) transforms into productive capital ($P$), which transforms into commodity capital ($C\'$), which must be sold to return as $M\'$. A blockage in any single phase halts the entire social metabolism and produces a commercial crisis.',
    quote: "Industrial capital is the only mode of existence of capital in which not only the appropriation of surplus-value... but also its creation is a function of capital. Therefore it gives to production its capitalist character.",
    citation: "Capital Vol. 2, Chapter 4"
  });
  card.querySelector('.sim-proof-slot').appendChild(proof);

  function update() {
    const view = card.querySelector('#tc-view').value;
    const speed = parseFloat(card.querySelector('#tc-speed').value);
    const hazard = card.querySelector('#tc-hazard').value;

    card.querySelector('#tc-speed-val').textContent = speed.toFixed(2) + 'x';
    card.querySelector('#tc-view-val').textContent = view === 'm' ? '1. Money Capital' : (view === 'p' ? '2. Productive Capital' : '3. Commodity Capital');

    const statusEl = card.querySelector('#tc-status');
    if (hazard === 'c') {
      statusEl.style.background = 'rgba(239, 68, 68, 0.15)';
      statusEl.style.color = '#ef4444';
      statusEl.innerHTML = `⚠️ Realization Crisis: Capital stuck in commodity form ($C'$). Markets are glutted and goods cannot be converted into money ($M'$)!`;
    } else if (hazard === 'm') {
      statusEl.style.background = 'rgba(245, 158, 11, 0.15)';
      statusEl.style.color = '#f59e0b';
      statusEl.innerHTML = `🏦 Liquidity Panic: Capitalists hoard money ($M$) as cash instead of hiring workers or buying machines ($P$). Production grinds to a halt!`;
    } else if (hazard === 'p') {
      statusEl.style.background = 'rgba(239, 68, 68, 0.15)';
      statusEl.style.color = '#ef4444';
      statusEl.innerHTML = `⚙️ Production Breakdown: Strike or physical bottleneck inside the factory ($P$) prevents valorization.`;
    } else {
      statusEl.style.background = 'rgba(16, 185, 129, 0.15)';
      statusEl.style.color = '#10b981';
      statusEl.innerHTML = `✅ Continuous Metamorphosis: Flow operates smoothly at ${speed}x velocity. Capital expands continuously through all three circuits!`;
    }

    const form = card.querySelector('#tc-formula');
    let tex = '';
    if (view === 'm') {
      tex = `M - C \\begin{pmatrix} L \\\\ MP \\end{pmatrix} \\dots P \\dots C' - M' \\quad (M' = M + s)`;
    } else if (view === 'p') {
      tex = `P \\dots C' - M' - C \\begin{pmatrix} L \\\\ MP \\end{pmatrix} \\dots P \\quad (\\text{Reproduction of Productive Base})`;
    } else {
      tex = `C' - M' - C \\dots P \\dots C' \\quad (\\text{Total Social Commodity Product View})`;
    }
    renderSimMath(form, tex);
  }

  ['tc-view', 'tc-speed', 'tc-hazard'].forEach(id => {
    card.querySelector('#' + id).addEventListener('input', () => {
      card.querySelectorAll('.sim-preset-btn').forEach(b => b.classList.remove('active'));
      update();
    });
  });

  update();
  return card;
}

// 15. Alternating Capitals & Tying Up of Money-Capital (Vol 2 Ch 15)
function buildAlternatingCapitalsSimulator() {
  const card = document.createElement('div');
  card.className = 'interactive-simulator-card';
  card.innerHTML = `
    <div class="sim-header" onclick="this.parentElement.classList.toggle('collapsed')">
      <div class="sim-header-title">
        <span class="sim-badge">Vol 2 • Ch 15</span>
        <span>Alternating Capitals &amp; Tying Up of Money-Capital</span>
      </div>
      <span class="sim-toggle-icon">▼</span>
    </div>
    <div class="sim-content">
      <div class="sim-presets-slot"></div>
      <div class="sim-grid">
        <div class="sim-controls-pane">
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Working Period (tp):</span>
              <span class="sim-val-display" id="ac-tp-val">6 wks</span>
            </div>
            <input type="range" class="sim-slider" id="ac-tp" min="2" max="12" step="1" value="6">
          </div>
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Circulation Period (tc):</span>
              <span class="sim-val-display" id="ac-tc-val">3 wks</span>
            </div>
            <input type="range" class="sim-slider" id="ac-tc" min="1" max="12" step="1" value="3">
          </div>
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Weekly Advance Required:</span>
              <span class="sim-val-display" id="ac-w-val">£100 / wk</span>
            </div>
            <input type="range" class="sim-slider" id="ac-w" min="50" max="500" step="25" value="100">
          </div>
        </div>
        <div class="sim-results-pane">
          <div class="sim-formula-display" id="ac-formula"></div>
          <div class="sim-bar-wrapper">
            <div class="sim-bar-labels">
              <span>Capital I (In Production) vs Capital II (In Circulation):</span>
              <span id="ac-tot-lbl">Total Capital: £900</span>
            </div>
            <div class="sim-segmented-bar">
              <div class="sim-segment sim-seg-c" id="ac-bar-c1" style="width:67%;">Capital I: £600</div>
              <div class="sim-segment sim-seg-rent" id="ac-bar-c2" style="width:33%;">Capital II: £300</div>
            </div>
          </div>
          <div class="sim-status-banner" id="ac-status"></div>
        </div>
      </div>
      <div class="sim-proof-slot"></div>
    </div>
  `;

  const presets = [
    { label: "Marx's 6-Week Working / 3-Week Circulation Case", values: { tp: 6, tc: 3, w: 100 }, active: true },
    { label: "Long 9-Week Production / 6-Week Circulation", values: { tp: 9, tc: 6, w: 100 } },
    { label: "Fast Modern Logistics (3w / 1w)", values: { tp: 3, tc: 1, w: 100 } }
  ];

  function applyPreset(v) {
    card.querySelector('#ac-tp').value = v.tp;
    card.querySelector('#ac-tc').value = v.tc;
    card.querySelector('#ac-w').value = v.w;
    update();
  }

  card.querySelector('.sim-presets-slot').appendChild(createPresetsBar(presets, applyPreset));

  const proof = createProofDrawer({
    mathHtml: '$$K_{\\text{total}} = (t_p + t_c) \\cdot w = (6\\text{w} + 3\\text{w}) \\times \\text{\\pounds}100 = \\mathbf{\\text{\\pounds}900} \\quad | \\quad \\text{Released Capital } = t_c \\cdot w = \\text{\\pounds}300$$',
    explanation: 'To maintain production continuously, a second capital (Capital II) must be advanced to operate while Capital I is traveling in circulation. At the end of the circulation period, Capital I returns in liquid form while Capital II is still in the workshop, alternately releasing and tying up money-capital that pools in the banking system.',
    quote: "The magnitude of the advanced capital must be large enough to carry on production continuously... When circulation time is shorter than working time, a part of the money capital is alternately released and set free as idle loanable capital.",
    citation: "Capital Vol. 2, Chapter 15"
  });
  card.querySelector('.sim-proof-slot').appendChild(proof);

  function update() {
    const tp = parseFloat(card.querySelector('#ac-tp').value);
    const tc = parseFloat(card.querySelector('#ac-tc').value);
    const w = parseFloat(card.querySelector('#ac-w').value);

    const c1 = tp * w;
    const c2 = tc * w;
    const totalK = c1 + c2;

    card.querySelector('#ac-tp-val').textContent = tp + ' wks';
    card.querySelector('#ac-tc-val').textContent = tc + ' wks';
    card.querySelector('#ac-w-val').textContent = '£' + w + ' / wk';

    const c1Pct = Math.round((c1 / totalK) * 100);
    card.querySelector('#ac-bar-c1').style.width = c1Pct + '%';
    card.querySelector('#ac-bar-c1').textContent = `Capital I: £${c1}`;
    card.querySelector('#ac-bar-c2').style.width = (100 - c1Pct) + '%';
    card.querySelector('#ac-bar-c2').textContent = `Capital II: £${c2}`;

    card.querySelector('#ac-tot-lbl').textContent = `Total Capital Advanced: £${totalK}`;

    const statusEl = card.querySelector('#ac-status');
    statusEl.style.background = 'rgba(16, 185, 129, 0.15)';
    statusEl.style.color = '#10b981';
    statusEl.innerHTML = `🔄 Capital Release: While Capital I (£${c1}) is in transit, Capital II (£${c2}) keeps the plant running. On Week ${tp + tc}, £${c2} of money-capital is released!`;

    const form = card.querySelector('#ac-formula');
    const tex = `K_{\\text{total}} = (${tp}\\text{w} + ${tc}\\text{w}) \\times \\text{\\pounds}${w} = \\mathbf{\\text{\\pounds}${totalK}} \\quad (\\text{Alternating: } \\text{\\pounds}${c1} \\leftrightarrow \\text{\\pounds}${c2})`;
    renderSimMath(form, tex);
  }

  ['ac-tp', 'ac-tc', 'ac-w'].forEach(id => {
    card.querySelector('#' + id).addEventListener('input', () => {
      card.querySelectorAll('.sim-preset-btn').forEach(b => b.classList.remove('active'));
      update();
    });
  });

  update();
  return card;
}

// 16. Turnover of Variable Capital & Annual Rate of Surplus-Value (Vol 2 Ch 16)
function buildVariableCapitalTurnoverSimulator() {
  const card = document.createElement('div');
  card.className = 'interactive-simulator-card';
  card.innerHTML = `
    <div class="sim-header" onclick="this.parentElement.classList.toggle('collapsed')">
      <div class="sim-header-title">
        <span class="sim-badge">Vol 2 • Ch 16</span>
        <span>Turnover of Variable Capital &amp; Annual Exploitation Rate (S' = s' · n)</span>
      </div>
      <span class="sim-toggle-icon">▼</span>
    </div>
    <div class="sim-content">
      <div class="sim-presets-slot"></div>
      <div class="sim-grid">
        <div class="sim-controls-pane">
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Variable Capital Advanced (v per cycle):</span>
              <span class="sim-val-display" id="vt-v-val">£500</span>
            </div>
            <input type="range" class="sim-slider" id="vt-v" min="100" max="2000" step="100" value="500">
          </div>
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Annual Turnovers per Year (n):</span>
              <span class="sim-val-display" id="vt-n-val">10 turnovers</span>
            </div>
            <input type="range" class="sim-slider" id="vt-n" min="1" max="26" step="1" value="10">
          </div>
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Cycle Rate of Surplus-Value (s / v):</span>
              <span class="sim-val-display" id="vt-rate-val">100%</span>
            </div>
            <input type="range" class="sim-slider" id="vt-rate" min="50" max="200" step="10" value="100">
          </div>
        </div>
        <div class="sim-results-pane">
          <div class="sim-formula-display" id="vt-formula"></div>
          <div class="sim-bar-wrapper">
            <div class="sim-bar-labels">
              <span>Cycle Exploitation (100%) vs Annual Effective Exploitation (1000%):</span>
              <span id="vt-sann-lbl">Annual Rate: 1000%</span>
            </div>
            <div class="sim-segmented-bar">
              <div class="sim-segment sim-seg-c" id="vt-bar-v" style="width:10%;">v Adv: £500</div>
              <div class="sim-segment sim-seg-rent" id="vt-bar-s" style="width:90%;">Annual Surplus: £5,000</div>
            </div>
          </div>
          <div class="sim-status-banner" id="vt-status"></div>
        </div>
      </div>
      <div class="sim-proof-slot"></div>
    </div>
  `;

  const presets = [
    { label: "Marx's 10-Turnover Case (1000% Annual Rate)", values: { v: 500, n: 10, rate: 100 }, active: true },
    { label: "Slow Agrarian Year (1 Turnover = 100%)", values: { v: 5000, n: 1, rate: 100 } },
    { label: "Modern Fast-Logistics (26 Turnovers = 2600%)", values: { v: 200, n: 26, rate: 100 } }
  ];

  function applyPreset(v) {
    card.querySelector('#vt-v').value = v.v;
    card.querySelector('#vt-n').value = v.n;
    card.querySelector('#vt-rate').value = v.rate;
    update();
  }

  card.querySelector('.sim-presets-slot').appendChild(createPresetsBar(presets, applyPreset));

  const proof = createProofDrawer({
    mathHtml: '$$S\' = \\frac{S_{\\text{annual}}}{v_{\\text{advanced}}} = \\frac{n \\cdot s\' \\cdot v}{v} = n \\cdot s\' = 10 \\times 100\\% = \\mathbf{1000\\%}$$',
    explanation: 'The capitalist advances only £500 in wages per turnover, but because that £500 turns over 10 times a year, it sets in motion £5,000 of living labour. The real annual rate of surplus-value is therefore 10 times higher than the single-cycle rate, revealing velocity as a direct multiplier of capitalist exploitation.',
    quote: "The annual rate of surplus-value is equal to the real rate of surplus-value multiplied by the number of turnovers of the variable capital: S' = s' · n. The velocity of turnover acts as a substitute for volume of capital.",
    citation: "Capital Vol. 2, Chapter 16"
  });
  card.querySelector('.sim-proof-slot').appendChild(proof);

  function update() {
    const v = parseFloat(card.querySelector('#vt-v').value);
    const n = parseFloat(card.querySelector('#vt-n').value);
    const rate = parseFloat(card.querySelector('#vt-rate').value);

    const sAnnual = n * v * (rate / 100);
    const annualRate = n * rate;

    card.querySelector('#vt-v-val').textContent = '£' + v.toLocaleString();
    card.querySelector('#vt-n-val').textContent = n + ' turnovers / yr';
    card.querySelector('#vt-rate-val').textContent = rate + '%';

    card.querySelector('#vt-sann-lbl').textContent = `Annual Rate: ${annualRate}% (Annual Mass: £${Math.round(sAnnual).toLocaleString()})`;

    const statusEl = card.querySelector('#vt-status');
    statusEl.style.background = 'rgba(16, 185, 129, 0.15)';
    statusEl.style.color = '#10b981';
    statusEl.innerHTML = `🚀 Velocity Multiplier: Advancing only <strong>£${v}</strong> in wages extracts <strong>£${Math.round(sAnnual).toLocaleString()}</strong> in surplus-value annually! Effective exploitation rate is <strong>${annualRate}%</strong>.`;

    const form = card.querySelector('#vt-formula');
    const tex = `S' = n \\cdot s' = ${n} \\times ${rate}\\% = \\mathbf{${annualRate}\\%} \\implies S_{\\text{annual}} = \\mathbf{\\text{\\pounds}${Math.round(sAnnual).toLocaleString()}}`;
    renderSimMath(form, tex);
  }

  ['vt-v', 'vt-n', 'vt-rate'].forEach(id => {
    card.querySelector('#' + id).addEventListener('input', () => {
      card.querySelectorAll('.sim-preset-btn').forEach(b => b.classList.remove('active'));
      update();
    });
  });

  update();
  return card;
}

// 17. Accumulation & Expanded Reproduction (Vol 2 Ch 21)
function buildExpandedReproductionTableauSimulator() {
  const card = document.createElement('div');
  card.className = 'interactive-simulator-card';
  card.innerHTML = `
    <div class="sim-header" onclick="this.parentElement.classList.toggle('collapsed')">
      <div class="sim-header-title">
        <span class="sim-badge">Vol 2 • Ch 21</span>
        <span>Expanded Reproduction &amp; Multi-Year Accumulation Tableau</span>
      </div>
      <span class="sim-toggle-icon">▼</span>
    </div>
    <div class="sim-content">
      <div class="sim-presets-slot"></div>
      <div class="sim-grid">
        <div class="sim-controls-pane">
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Dept I Accumulation Share (α₁ Reinvested):</span>
              <span class="sim-val-display" id="er-alpha-val">50%</span>
            </div>
            <input type="range" class="sim-slider" id="er-alpha" min="20" max="80" step="5" value="50">
          </div>
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Year of Projection:</span>
              <span class="sim-val-display" id="er-yr-val">Year 2</span>
            </div>
            <input type="range" class="sim-slider" id="er-yr" min="1" max="4" step="1" value="2">
          </div>
        </div>
        <div class="sim-results-pane">
          <div class="sim-formula-display" id="er-formula"></div>
          <div class="sim-table-wrap">
            <table class="sim-table">
              <thead>
                <tr><th>Department</th><th>Constant c</th><th>Variable v</th><th>Surplus s</th><th>Total Product</th></tr>
              </thead>
              <tbody id="er-tbody"></tbody>
            </table>
          </div>
          <div class="sim-status-banner" id="er-status"></div>
        </div>
      </div>
      <div class="sim-proof-slot"></div>
    </div>
  `;

  const presets = [
    { label: "Marx's Classical Expanded Schema (50% Reinvested)", values: { alpha: 50, yr: 2 }, active: true },
    { label: "Year 3 Long-Term Expansion", values: { alpha: 50, yr: 3 } },
    { label: "High Heavy-Industry Push (70% Reinvested)", values: { alpha: 70, yr: 2 } }
  ];

  function applyPreset(v) {
    card.querySelector('#er-alpha').value = v.alpha;
    card.querySelector('#er-yr').value = v.yr;
    update();
  }

  card.querySelector('.sim-presets-slot').appendChild(createPresetsBar(presets, applyPreset));

  const proof = createProofDrawer({
    mathHtml: '$$\\text{Expanded Equilibrium: } I(v + \\Delta v + s_{\\text{consumption}}) = II(c + \\Delta c) \\implies \\text{Year } 1 \\to \\text{Year } 2 \\to \\text{Year } 3$$',
    explanation: 'In expanded reproduction, Department I produces more means of production than needed for mere replacement ($I(v+s) > II(c)$). The surplus is capitalized: 50% into constant capital and 50% into wages, forcing Department II to expand proportionally. Over 3 years, the total social product compounds from 9,000 to over 11,000 units!',
    quote: "Accumulation in Department I requires that II(c) shall be smaller than I(v + s), so that a part of the surplus-product of Department I can be used directly for accumulation in Department II.",
    citation: "Capital Vol. 2, Chapter 21"
  });
  card.querySelector('.sim-proof-slot').appendChild(proof);

  function update() {
    const alpha = parseFloat(card.querySelector('#er-alpha').value) / 100;
    const yr = parseInt(card.querySelector('#er-yr').value, 10);

    card.querySelector('#er-alpha-val').textContent = Math.round(alpha * 100) + '%';
    card.querySelector('#er-yr-val').textContent = 'Year ' + yr;

    let c1 = 4000, v1 = 1000, s1 = 1000;
    let c2 = 1500, v2 = 750, s2 = 750;

    for (let y = 1; y < yr; y++) {
      const accumS1 = s1 * alpha;
      const deltaC1 = accumS1 * 0.8;
      const deltaV1 = accumS1 * 0.2;
      c1 += deltaC1;
      v1 += deltaV1;
      s1 = v1;

      const deltaC2 = deltaV1 + (s1 - accumS1) - (c2 - v1);
      const deltaV2 = deltaC2 * 0.5;
      c2 += Math.max(50, deltaC2);
      v2 += Math.max(25, deltaV2);
      s2 = v2;
    }

    const w1 = c1 + v1 + s1;
    const w2 = c2 + v2 + s2;
    const totalW = w1 + w2;

    const tbody = card.querySelector('#er-tbody');
    tbody.innerHTML = `
      <tr><td>I. Means of Production</td><td>${Math.round(c1)}</td><td>${Math.round(v1)}</td><td>${Math.round(s1)}</td><td><strong>${Math.round(w1)}</strong></td></tr>
      <tr><td>II. Means of Consumption</td><td>${Math.round(c2)}</td><td>${Math.round(v2)}</td><td>${Math.round(s2)}</td><td><strong>${Math.round(w2)}</strong></td></tr>
      <tr style="font-weight:700;border-top:2px solid var(--border-color);"><td>Total Social Product:</td><td>${Math.round(c1+c2)}</td><td>${Math.round(v1+v2)}</td><td>${Math.round(s1+s2)}</td><td><strong>${Math.round(totalW)}</strong></td></tr>
    `;

    const statusEl = card.querySelector('#er-status');
    statusEl.style.background = 'rgba(16, 185, 129, 0.15)';
    statusEl.style.color = '#10b981';
    statusEl.innerHTML = `📈 Year ${yr} Expanded Production: Total social output expanded to <strong>${Math.round(totalW)}</strong> units (Compounding growth across Dept I & II)!`;

    const form = card.querySelector('#er-formula');
    const tex = `\\text{Year } ${yr}\\text{: } W_1 = ${Math.round(w1)}, \\quad W_2 = ${Math.round(w2)} \\implies W_{\\text{total}} = \\mathbf{${Math.round(totalW)}}`;
    renderSimMath(form, tex);
  }

  ['er-alpha', 'er-yr'].forEach(id => {
    card.querySelector('#' + id).addEventListener('input', () => {
      card.querySelectorAll('.sim-preset-btn').forEach(b => b.classList.remove('active'));
      update();
    });
  });

  update();
  return card;
}

// 18. Cost Price and Profit: Mystification of Surplus-Value (Vol 3 Ch 1)
function buildCostPriceMystificationSimulator() {
  const card = document.createElement('div');
  card.className = 'interactive-simulator-card';
  card.innerHTML = `
    <div class="sim-header" onclick="this.parentElement.classList.toggle('collapsed')">
      <div class="sim-header-title">
        <span class="sim-badge">Vol 3 • Ch 1</span>
        <span>Cost Price &amp; Profit: The Bourgeois Mystification (k = c + v)</span>
      </div>
      <span class="sim-toggle-icon">▼</span>
    </div>
    <div class="sim-content">
      <div class="sim-presets-slot"></div>
      <div class="sim-grid">
        <div class="sim-controls-pane">
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Constant Capital Consumed (c):</span>
              <span class="sim-val-display" id="cp-c-val">£400</span>
            </div>
            <input type="range" class="sim-slider" id="cp-c" min="100" max="800" step="50" value="400">
          </div>
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Variable Capital (Wages v):</span>
              <span class="sim-val-display" id="cp-v-val">£100</span>
            </div>
            <input type="range" class="sim-slider" id="cp-v" min="50" max="300" step="25" value="100">
          </div>
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Surplus-Value Rate (s / v):</span>
              <span class="sim-val-display" id="cp-rate-val">100%</span>
            </div>
            <input type="range" class="sim-slider" id="cp-rate" min="50" max="200" step="10" value="100">
          </div>
        </div>
        <div class="sim-results-pane">
          <div class="sim-formula-display" id="cp-formula"></div>
          <div class="sim-bar-wrapper">
            <div class="sim-bar-labels">
              <span>What it Costs the Capitalist (k) vs Value Produced (W):</span>
              <span id="cp-k-lbl">k = £500 | W = £600</span>
            </div>
            <div class="sim-segmented-bar">
              <div class="sim-segment sim-seg-c" id="cp-bar-k" style="width:83%;">Cost Price k: £500</div>
              <div class="sim-segment sim-seg-s" id="cp-bar-p" style="width:17%;">Profit p: £100</div>
            </div>
          </div>
          <div class="sim-status-banner" id="cp-status"></div>
        </div>
      </div>
      <div class="sim-proof-slot"></div>
    </div>
  `;

  const presets = [
    { label: "Marx's Classical Cost Price", values: { c: 400, v: 100, rate: 100 }, active: true },
    { label: "High Mechanization Mystification", values: { c: 600, v: 50, rate: 150 } },
    { label: "Labour-Intensive Branch", values: { c: 200, v: 200, rate: 100 } }
  ];

  function applyPreset(v) {
    card.querySelector('#cp-c').value = v.c;
    card.querySelector('#cp-v').value = v.v;
    card.querySelector('#cp-rate').value = v.rate;
    update();
  }

  card.querySelector('.sim-presets-slot').appendChild(createPresetsBar(presets, applyPreset));

  const proof = createProofDrawer({
    mathHtml: '$$\\text{Value: } W = c + v + s \\quad \\implies \\text{Cost Price: } k = c + v \\quad \\implies W = k + p$$',
    explanation: 'The cost of the commodity to the capitalist is measured by the expenditure of money-capital ($k = c + v$). But the cost of the commodity to society is measured by the total expenditure of living and dead labour ($c + v + s$). Because profit ($p$) appears as an excess over the total cost price $k$, the capitalist imagines that profit springs equally from all parts of capital (machinery and wages alike), entirely erasing the fact that living labour is the sole source of surplus-value.',
    quote: "The cost-price of a commodity refers only to the quantity of paid labour contained in it, the value to the whole quantity of labour, paid and unpaid... Profit is therefore that same surplus-value, only in a mystified form.",
    citation: "Capital Vol. 3, Chapter 1 & 2"
  });
  card.querySelector('.sim-proof-slot').appendChild(proof);

  function update() {
    const c = parseFloat(card.querySelector('#cp-c').value);
    const v = parseFloat(card.querySelector('#cp-v').value);
    const rate = parseFloat(card.querySelector('#cp-rate').value);

    const s = v * (rate / 100);
    const k = c + v;
    const w = k + s;
    const profitRateOnK = Math.round((s / k) * 100);

    card.querySelector('#cp-c-val').textContent = '£' + c;
    card.querySelector('#cp-v-val').textContent = '£' + v;
    card.querySelector('#cp-rate-val').textContent = rate + '%';

    card.querySelector('#cp-k-lbl').textContent = `Cost Price k = £${k} | True Value W = £${w}`;
    const kPct = Math.round((k / w) * 100);
    card.querySelector('#cp-bar-k').style.width = kPct + '%';
    card.querySelector('#cp-bar-k').textContent = `Cost Price k: £${k}`;
    card.querySelector('#cp-bar-p').style.width = (100 - kPct) + '%';
    card.querySelector('#cp-bar-p').textContent = `Profit: £${s}`;

    const statusEl = card.querySelector('#cp-status');
    statusEl.style.background = 'rgba(234, 179, 8, 0.15)';
    statusEl.style.color = '#eab308';
    statusEl.innerHTML = `🎭 The Bourgeois Illusion: Capitalist sees profit as <strong>${profitRateOnK}%</strong> return on total cost price (£${k}), obliterating the truth that only living wages (£${v}) created value!`;

    const form = card.querySelector('#cp-formula');
    const tex = `W = k + p = (c + v) + s = (${c} + ${v}) + ${Math.round(s)} = \\mathbf{\\text{\\pounds}${Math.round(w)}} \\quad (p' = \\frac{s}{k} = \\mathbf{${profitRateOnK}\\%})`;
    renderSimMath(form, tex);
  }

  ['cp-c', 'cp-v', 'cp-rate'].forEach(id => {
    card.querySelector('#' + id).addEventListener('input', () => {
      card.querySelectorAll('.sim-preset-btn').forEach(b => b.classList.remove('active'));
      update();
    });
  });

  update();
  return card;
}

// 19. Differential Rent II: Intensive Capital Investment on Same Land (Vol 3 Ch 40–43)
function buildDifferentialRentIISimulator() {
  const card = document.createElement('div');
  card.className = 'interactive-simulator-card';
  card.innerHTML = `
    <div class="sim-header" onclick="this.parentElement.classList.toggle('collapsed')">
      <div class="sim-header-title">
        <span class="sim-badge">Vol 3 • Ch 40–43</span>
        <span>Differential Rent II: Successive Capital Doses on Same Soil</span>
      </div>
      <span class="sim-toggle-icon">▼</span>
    </div>
    <div class="sim-content">
      <div class="sim-presets-slot"></div>
      <div class="sim-grid">
        <div class="sim-controls-pane">
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Capital Dose 1 Output (Initial £100):</span>
              <span class="sim-val-display" id="dr2-d1-val">3.0 qrs</span>
            </div>
            <input type="range" class="sim-slider" id="dr2-d1" min="1.0" max="5.0" step="0.5" value="3.0">
          </div>
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Capital Dose 2 Output (2nd £100 Intensive):</span>
              <span class="sim-val-display" id="dr2-d2-val">4.0 qrs (Fertilizer/Drainage)</span>
            </div>
            <input type="range" class="sim-slider" id="dr2-d2" min="1.0" max="6.0" step="0.5" value="4.0">
          </div>
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Regulating Market Price per Quarter:</span>
              <span class="sim-val-display" id="dr2-p-val">£60 / qr</span>
            </div>
            <input type="range" class="sim-slider" id="dr2-p" min="30" max="90" step="5" value="60">
          </div>
        </div>
        <div class="sim-results-pane">
          <div class="sim-formula-display" id="dr2-formula"></div>
          <div class="sim-table-wrap">
            <table class="sim-table">
              <thead>
                <tr><th>Capital Investment</th><th>Capital Advanced</th><th>Output (qrs)</th><th>Revenue</th><th>Rent II Extracted</th></tr>
              </thead>
              <tbody id="dr2-tbody"></tbody>
            </table>
          </div>
          <div class="sim-status-banner" id="dr2-status"></div>
        </div>
      </div>
      <div class="sim-proof-slot"></div>
    </div>
  `;

  const presets = [
    { label: "Increasing Returns on Intensive Dose", values: { d1: 3.0, d2: 4.5, p: 60 }, active: true },
    { label: "Diminishing Returns on Intensive Dose", values: { d1: 4.0, d2: 2.5, p: 60 } },
    { label: "Equal Productivity Dosage", values: { d1: 3.0, d2: 3.0, p: 60 } }
  ];

  function applyPreset(v) {
    card.querySelector('#dr2-d1').value = v.d1;
    card.querySelector('#dr2-d2').value = v.d2;
    card.querySelector('#dr2-p').value = v.p;
    update();
  }

  card.querySelector('.sim-presets-slot').appendChild(createPresetsBar(presets, applyPreset));

  const proof = createProofDrawer({
    mathHtml: '$$\\text{Rent}_{\\text{II}} = (Q_{\\text{dose 2}} \\cdot P_{\\text{mkt}}) - (k + \\bar{p}) \\implies \\text{Expropriation of Tenant Improvements}$$',
    explanation: 'While Differential Rent I is based on natural differences in soil fertility, Differential Rent II arises from successive doses of capital applied to the same land. During the lease, the capitalist tenant pockets the surplus-profit of drainage and fertilizers; but when the contract expires, the landlord raises the rent and expropriates the fruits of the tenant\'s improvements.',
    quote: "Differential Rent II is distinguished from Differential Rent I only by the fact that the different productivities of capital investments are here realized on the same piece of land, not on different lands.",
    citation: "Capital Vol. 3, Chapter 40"
  });
  card.querySelector('.sim-proof-slot').appendChild(proof);

  function update() {
    const d1 = parseFloat(card.querySelector('#dr2-d1').value);
    const d2 = parseFloat(card.querySelector('#dr2-d2').value);
    const p = parseFloat(card.querySelector('#dr2-p').value);

    const costProf = 120; // £100 + 20%
    const rev1 = d1 * p;
    const rent1 = Math.max(0, rev1 - costProf);

    const rev2 = d2 * p;
    const rent2 = Math.max(0, rev2 - costProf);
    const totalRent = rent1 + rent2;

    card.querySelector('#dr2-d1-val').textContent = d1.toFixed(1) + ' qrs';
    card.querySelector('#dr2-d2-val').textContent = d2.toFixed(1) + ' qrs';
    card.querySelector('#dr2-p-val').textContent = '£' + p + ' / qr';

    const tbody = card.querySelector('#dr2-tbody');
    tbody.innerHTML = `
      <tr><td>1st Dose (£100)</td><td>£120</td><td>${d1.toFixed(1)}</td><td>£${Math.round(rev1)}</td><td style="color:#10b981;font-weight:700;">£${Math.round(rent1)}</td></tr>
      <tr><td>2nd Dose (£100 Intensive)</td><td>£120</td><td>${d2.toFixed(1)}</td><td>£${Math.round(rev2)}</td><td style="color:#10b981;font-weight:700;">£${Math.round(rent2)}</td></tr>
      <tr style="font-weight:700;border-top:2px solid var(--border-color);"><td>Total:</td><td>£240</td><td>${(d1+d2).toFixed(1)}</td><td>£${Math.round(rev1+rev2)}</td><td style="color:#10b981;">£${Math.round(totalRent)}</td></tr>
    `;

    const statusEl = card.querySelector('#dr2-status');
    statusEl.style.background = 'rgba(16, 185, 129, 0.15)';
    statusEl.style.color = '#10b981';
    statusEl.innerHTML = `🌾 Differential Rent II: Landlord extracts <strong>£${Math.round(totalRent)}</strong> across both capital investments on the same acre!`;

    const form = card.querySelector('#dr2-formula');
    const tex = `\\text{Dose 1 Rent: } \\text{\\pounds}${Math.round(rent1)} + \\text{Dose 2 Rent: } \\text{\\pounds}${Math.round(rent2)} = \\mathbf{\\text{Total Rent II = \\pounds}${Math.round(totalRent)}}`;
    renderSimMath(form, tex);
  }

  ['dr2-d1', 'dr2-d2', 'dr2-p'].forEach(id => {
    card.querySelector('#' + id).addEventListener('input', () => {
      card.querySelectorAll('.sim-preset-btn').forEach(b => b.classList.remove('active'));
      update();
    });
  });

  update();
  return card;
}

// 20. Absolute Ground-Rent (Vol 3 Ch 45)
function buildAbsoluteGroundRentSimulator() {
  const card = document.createElement('div');
  card.className = 'interactive-simulator-card';
  card.innerHTML = `
    <div class="sim-header" onclick="this.parentElement.classList.toggle('collapsed')">
      <div class="sim-header-title">
        <span class="sim-badge">Vol 3 • Ch 45</span>
        <span>Absolute Ground-Rent (Agricultural vs Industrial Composition)</span>
      </div>
      <span class="sim-toggle-icon">▼</span>
    </div>
    <div class="sim-content">
      <div class="sim-presets-slot"></div>
      <div class="sim-grid">
        <div class="sim-controls-pane">
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Agricultural Variable Capital (vagri per 100):</span>
              <span class="sim-val-display" id="ar-va-val">40v (60c + 40v)</span>
            </div>
            <input type="range" class="sim-slider" id="ar-va" min="20" max="55" step="5" value="40">
          </div>
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Industrial Social Variable Capital (vind per 100):</span>
              <span class="sim-val-display" id="ar-vi-val">20v (80c + 20v)</span>
            </div>
            <input type="range" class="sim-slider" id="ar-vi" min="10" max="30" step="5" value="20">
          </div>
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Rate of Surplus-Value:</span>
              <span class="sim-val-display" id="ar-sv-val">100%</span>
            </div>
            <input type="range" class="sim-slider" id="ar-sv" min="50" max="150" step="10" value="100">
          </div>
        </div>
        <div class="sim-results-pane">
          <div class="sim-formula-display" id="ar-formula"></div>
          <div class="sim-bar-wrapper">
            <div class="sim-bar-labels">
              <span>Agricultural Value (£140) vs Production Price (£120):</span>
              <span id="ar-toll-lbl">Absolute Rent: £20</span>
            </div>
            <div class="sim-segmented-bar">
              <div class="sim-segment sim-seg-c" id="ar-bar-prod" style="width:86%;">Production Price: £120</div>
              <div class="sim-segment sim-seg-rent" id="ar-bar-rent" style="width:14%;">Absolute Rent: £20</div>
            </div>
          </div>
          <div class="sim-status-banner" id="ar-status"></div>
        </div>
      </div>
      <div class="sim-proof-slot"></div>
    </div>
  `;

  const presets = [
    { label: "Marx's Classical Case (60c:40v vs 80c:20v)", values: { va: 40, vi: 20, sv: 100 }, active: true },
    { label: "Industrialized Agriculture (Equal OCC -> Rent = 0)", values: { va: 20, vi: 20, sv: 100 } },
    { label: "Backward Agrarian Gap (50v vs 15v)", values: { va: 50, vi: 15, sv: 100 } }
  ];

  function applyPreset(v) {
    card.querySelector('#ar-va').value = v.va;
    card.querySelector('#ar-vi').value = v.vi;
    card.querySelector('#ar-sv').value = v.sv;
    update();
  }

  card.querySelector('.sim-presets-slot').appendChild(createPresetsBar(presets, applyPreset));

  const proof = createProofDrawer({
    mathHtml: '$$\\text{Value} = 100 + s_{\\text{agri}} = \\text{\\pounds}140 \\quad \\text{vs} \\quad P_{\\text{prod}} = 100 + \\bar{p} = \\text{\\pounds}120 \\implies \\text{Absolute Rent} = \\mathbf{\\text{\\pounds}20}$$',
    explanation: 'Historically, agriculture employs more living labour relative to constant capital than industry ($60c + 40v$ vs $80c + 20v$). Because private monopoly in land blocks industrial capital from freely entering farming, agricultural products sell at their individual value (£140) rather than falling to their price of production (£120). Landowners intercept the £20 difference as Absolute Rent on ALL cultivated land, including the poorest Soil A.',
    quote: "Absolute ground-rent arises from the fact that capital in agriculture produces more surplus-value than capital of equal magnitude in industry... Private property in land forms a barrier to the equalization of profits, and intercepts this excess value as absolute rent.",
    citation: "Capital Vol. 3, Chapter 45"
  });
  card.querySelector('.sim-proof-slot').appendChild(proof);

  function update() {
    const va = parseFloat(card.querySelector('#ar-va').value);
    const vi = parseFloat(card.querySelector('#ar-vi').value);
    const sv = parseFloat(card.querySelector('#ar-sv').value) / 100;

    const ca = 100 - va;
    const ci = 100 - vi;

    const sa = va * sv;
    const si = vi * sv;

    const valAgri = 100 + sa;
    const pProd = 100 + si;
    const absRent = Math.max(0, valAgri - pProd);

    card.querySelector('#ar-va-val').textContent = `${va}v (${ca}c + ${va}v)`;
    card.querySelector('#ar-vi-val').textContent = `${vi}v (${ci}c + ${vi}v)`;
    card.querySelector('#ar-sv-val').textContent = Math.round(sv * 100) + '%';

    card.querySelector('#ar-toll-lbl').textContent = `Absolute Rent Toll: £${Math.round(absRent)}`;
    const prodPct = Math.round((pProd / valAgri) * 100);
    card.querySelector('#ar-bar-prod').style.width = prodPct + '%';
    card.querySelector('#ar-bar-prod').textContent = `Price of Prod: £${Math.round(pProd)}`;
    card.querySelector('#ar-bar-rent').style.width = (100 - prodPct) + '%';
    card.querySelector('#ar-bar-rent').textContent = absRent > 0 ? `Absolute Rent: £${Math.round(absRent)}` : '';

    const statusEl = card.querySelector('#ar-status');
    if (absRent > 0) {
      statusEl.style.background = 'rgba(16, 185, 129, 0.15)';
      statusEl.style.color = '#10b981';
      statusEl.innerHTML = `🌾 Landlord Barrier Active: Agricultural value (£${Math.round(valAgri)}) exceeds production price (£${Math.round(pProd)}). Landowner pockets <strong>£${Math.round(absRent)}</strong> absolute rent on every single acre!`;
    } else {
      statusEl.style.background = 'rgba(245, 158, 11, 0.15)';
      statusEl.style.color = '#f59e0b';
      statusEl.innerHTML = `⚖️ Organic Composition Equalized: Agriculture is fully mechanized. Absolute rent falls to zero!`;
    }

    const form = card.querySelector('#ar-formula');
    const tex = `\\text{Value} = \\text{\\pounds}${Math.round(valAgri)} \\quad \\text{vs} \\quad P_{\\text{prod}} = \\text{\\pounds}${Math.round(pProd)} \\implies \\text{Absolute Rent} = \\mathbf{\\text{\\pounds}${Math.round(absRent)}}`;
    renderSimMath(form, tex);
  }

  ['ar-va', 'ar-vi', 'ar-sv'].forEach(id => {
    card.querySelector('#' + id).addEventListener('input', () => {
      card.querySelectorAll('.sim-preset-btn').forEach(b => b.classList.remove('active'));
      update();
    });
  });

  update();
  return card;
}

function buildCircuitsAndTurnoverSimulator() {
  const card = document.createElement('div');
  card.className = 'interactive-simulator-card';
  card.innerHTML = `
    <div class="sim-header" onclick="this.parentElement.classList.toggle('collapsed')">
      <div class="sim-header-title">
        <span class="sim-badge">Vol 2 • Ch 5, 7, 9, 12–14</span>
        <span>Circuits of Capital &amp; Annual Turnover Time (n = U/u)</span>
      </div>
      <span class="sim-toggle-icon">▼</span>
    </div>
    <div class="sim-content">
      <div class="sim-presets-slot"></div>
      <div class="sim-grid">
        <div class="sim-controls-pane">
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Production Time (Working Period):</span>
              <span class="sim-val-display" id="to-prod-val">6 wks</span>
            </div>
            <input type="range" class="sim-slider" id="to-prod" min="1" max="24" step="1" value="6">
          </div>
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Circulation Time (Transport &amp; Sale):</span>
              <span class="sim-val-display" id="to-circ-val">4 wks</span>
            </div>
            <input type="range" class="sim-slider" id="to-circ" min="1" max="24" step="1" value="4">
          </div>
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Variable Capital Advanced (v per cycle):</span>
              <span class="sim-val-display" id="to-v-val">£3,000</span>
            </div>
            <input type="range" class="sim-slider" id="to-v" min="1000" max="10000" step="500" value="3000">
          </div>
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Rate of Surplus-Value (s/v):</span>
              <span class="sim-val-display" id="to-rate-val">100%</span>
            </div>
            <input type="range" class="sim-slider" id="to-rate" min="50" max="200" step="10" value="100">
          </div>
        </div>
        <div class="sim-results-pane">
          <div class="sim-formula-display" id="to-formula"></div>
          <div class="sim-bar-wrapper">
            <div class="sim-bar-labels">
              <span>Turnover Cycle Breakdown (u = Prod + Circ):</span>
              <span id="to-u-lbl">u: 10 weeks (5.20 / yr)</span>
            </div>
            <div class="sim-segmented-bar">
              <div class="sim-segment sim-seg-c" id="to-bar-prod" style="width:60%;">Prod: 6w</div>
              <div class="sim-segment sim-seg-s" id="to-bar-circ" style="width:40%;">Circ: 4w</div>
            </div>
          </div>
          <div class="sim-status-banner" id="to-status"></div>
        </div>
      </div>
      <div class="sim-proof-slot"></div>
    </div>
  `;

  const presets = [
    { label: "Ocean Sailing (1850)", values: { prod: 10, circ: 16, v: 3000, rate: 100 } },
    { label: "Steam Railways & Telegraph", values: { prod: 6, circ: 4, v: 3000, rate: 100 }, active: true },
    { label: "Modern Container Logistics", values: { prod: 2, circ: 1, v: 3000, rate: 100 } },
    { label: "Inventory Glut (Crisis)", values: { prod: 4, circ: 22, v: 3000, rate: 100 } }
  ];

  function applyPreset(v) {
    card.querySelector('#to-prod').value = v.prod;
    card.querySelector('#to-circ').value = v.circ;
    card.querySelector('#to-v').value = v.v;
    card.querySelector('#to-rate').value = v.rate;
    update();
  }

  card.querySelector('.sim-presets-slot').appendChild(createPresetsBar(presets, applyPreset));

  const proof = createProofDrawer({
    mathHtml: '$$u = t_p + t_c \\implies n = \\frac{52}{u} \\implies S_{\\text{annual}} = n \\cdot (s\' \\cdot v) \\implies S\' = n \\cdot s\'$$',
    explanation: 'Capital produces surplus-value only while in the production process ($t_p$). While stuck in circulation ($t_c$), it produces zero value. By cutting transport and sale times, capital turns over more times per year ($n$), multiplying the total annual surplus-value extracted.',
    quote: "The shorter the turnover time, the smaller the capital advanced, and the greater the annual rate of surplus-value... Velocity here acts as a substitute for volume of capital.",
    citation: "Capital Vol. 2, Chapter 15 & 16"
  });
  card.querySelector('.sim-proof-slot').appendChild(proof);

  function update() {
    const prod = parseFloat(card.querySelector('#to-prod').value);
    const circ = parseFloat(card.querySelector('#to-circ').value);
    const v = parseFloat(card.querySelector('#to-v').value);
    const ratePct = parseFloat(card.querySelector('#to-rate').value);

    const u = prod + circ;
    const n = 52 / u;
    const sCycle = v * (ratePct / 100);
    const sAnnual = n * sCycle;
    const annualRate = n * ratePct;

    card.querySelector('#to-prod-val').textContent = prod + ' wks';
    card.querySelector('#to-circ-val').textContent = circ + ' wks';
    card.querySelector('#to-v-val').textContent = '£' + v.toLocaleString();
    card.querySelector('#to-rate-val').textContent = ratePct + '%';

    card.querySelector('#to-u-lbl').textContent = `u: ${u} wks (${n.toFixed(2)} turnovers/yr)`;
    const pPct = Math.round((prod / u) * 100);
    card.querySelector('#to-bar-prod').style.width = pPct + '%';
    card.querySelector('#to-bar-prod').textContent = `Prod: ${prod}w`;
    card.querySelector('#to-bar-circ').style.width = (100 - pPct) + '%';
    card.querySelector('#to-bar-circ').textContent = `Circ: ${circ}w`;

    const statusEl = card.querySelector('#to-status');
    statusEl.style.background = 'rgba(16, 185, 129, 0.15)';
    statusEl.style.color = '#10b981';
    statusEl.innerHTML = `💰 Annual Realized Surplus: <strong>£${Math.round(sAnnual).toLocaleString()}</strong> (Effective Annual Rate: <strong>${Math.round(annualRate)}%</strong>)`;

    const form = card.querySelector('#to-formula');
    const tex = `n = \\frac{52\\text{w}}{${u}\\text{w}} = ${n.toFixed(2)}\\text{/yr} \\implies S_{\\text{annual}} = ${n.toFixed(2)} \\times \\text{\\pounds}${Math.round(sCycle)} = \\mathbf{\\text{\\pounds}${Math.round(sAnnual).toLocaleString()}}`;
    renderSimMath(form, tex);
  }

  ['to-prod', 'to-circ', 'to-v', 'to-rate'].forEach(id => {
    card.querySelector('#' + id).addEventListener('input', () => {
      card.querySelectorAll('.sim-preset-btn').forEach(b => b.classList.remove('active'));
      update();
    });
  });

  update();
  return card;
}

// 6. Fixed vs Circulating Capital & Sinking Fund (Vol 2 Ch 7, 8, 15)

function buildFixedCapitalSinkingFundSimulator() {
  const card = document.createElement('div');
  card.className = 'interactive-simulator-card';
  card.innerHTML = `
    <div class="sim-header" onclick="this.parentElement.classList.toggle('collapsed')">
      <div class="sim-header-title">
        <span class="sim-badge">Vol 2 • Ch 8</span>
        <span>Fixed Capital Amortization &amp; Sinking Fund</span>
      </div>
      <span class="sim-toggle-icon">▼</span>
    </div>
    <div class="sim-content">
      <div class="sim-presets-slot"></div>
      <div class="sim-grid">
        <div class="sim-controls-pane">
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Machinery / Plant Cost (Fixed K):</span>
              <span class="sim-val-display" id="fc-cost-val">£12,000</span>
            </div>
            <input type="range" class="sim-slider" id="fc-cost" min="5000" max="50000" step="1000" value="12000">
          </div>
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Useful Lifespan (Years):</span>
              <span class="sim-val-display" id="fc-life-val">10 yrs</span>
            </div>
            <input type="range" class="sim-slider" id="fc-life" min="3" max="25" step="1" value="10">
          </div>
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Current Year of Operation (t):</span>
              <span class="sim-val-display" id="fc-year-val">Year 4</span>
            </div>
            <input type="range" class="sim-slider" id="fc-year" min="1" max="10" step="1" value="4">
          </div>
        </div>
        <div class="sim-results-pane">
          <div class="sim-formula-display" id="fc-formula"></div>
          <div class="sim-bar-wrapper">
            <div class="sim-bar-labels">
              <span>Fixed Capital Conversion into Money-Capital:</span>
              <span id="fc-accum-lbl">Bank Hoard: £4,800</span>
            </div>
            <div class="sim-segmented-bar">
              <div class="sim-segment sim-seg-c" id="fc-bar-res" style="width:60%;">Machine: £7,200</div>
              <div class="sim-segment sim-seg-rent" id="fc-bar-hoard" style="width:40%;">Hoard: £4,800</div>
            </div>
          </div>
          <div class="sim-status-banner" id="fc-status"></div>
        </div>
      </div>
      <div class="sim-proof-slot"></div>
    </div>
  `;

  const presets = [
    { label: "Steam Mill Engine", values: { cost: 12000, life: 10, year: 4 }, active: true },
    { label: "Heavy Blast Furnace Plant", values: { cost: 30000, life: 25, year: 12 } },
    { label: "Modern Microchip Fab", values: { cost: 40000, life: 4, year: 2 } }
  ];

  function applyPreset(v) {
    card.querySelector('#fc-cost').value = v.cost;
    card.querySelector('#fc-life').value = v.life;
    card.querySelector('#fc-year').max = v.life;
    card.querySelector('#fc-year').value = Math.min(v.year, v.life);
    update();
  }

  card.querySelector('.sim-presets-slot').appendChild(createPresetsBar(presets, applyPreset));

  const proof = createProofDrawer({
    mathHtml: '$$d = \\frac{K_{\\text{fixed}}}{L} \\implies M_{\\text{latent}}(t) = t \\cdot d \\quad | \\quad K_{\\text{residual}} = K_{\\text{fixed}} - M_{\\text{latent}}$$',
    explanation: 'Fixed capital gives up its value to the product in fractional installments while physically remaining in the workshop. The money collected as amortization accumulates in banks as dormant "latent money-capital". These hoarded depreciation reserves form the primary material base of the commercial credit and financial lending system.',
    quote: "Fixed capital endures in its natural form over a long period... It yields up its value to the product in fractional installments... The money returned through depreciation lies dormant as latent money-capital in the banking system until the day of total replacement arrives.",
    citation: "Capital Vol. 2, Chapter 8"
  });
  card.querySelector('.sim-proof-slot').appendChild(proof);

  function update() {
    const cost = parseFloat(card.querySelector('#fc-cost').value);
    const life = parseFloat(card.querySelector('#fc-life').value);
    card.querySelector('#fc-year').max = life;
    let year = parseFloat(card.querySelector('#fc-year').value);
    if (year > life) { year = life; card.querySelector('#fc-year').value = life; }

    const annualDeprec = cost / life;
    const hoard = year * annualDeprec;
    const residual = cost - hoard;

    card.querySelector('#fc-cost-val').textContent = '£' + cost.toLocaleString();
    card.querySelector('#fc-life-val').textContent = life + ' yrs';
    card.querySelector('#fc-year-val').textContent = 'Year ' + year;

    const hoardPct = Math.round((hoard / cost) * 100);
    card.querySelector('#fc-accum-lbl').textContent = `Bank Hoard: £${Math.round(hoard).toLocaleString()} (${hoardPct}%)`;
    card.querySelector('#fc-bar-res').style.width = (100 - hoardPct) + '%';
    card.querySelector('#fc-bar-res').textContent = `Machine: £${Math.round(residual).toLocaleString()}`;
    card.querySelector('#fc-bar-hoard').style.width = hoardPct + '%';
    card.querySelector('#fc-bar-hoard').textContent = `Bank Hoard: £${Math.round(hoard).toLocaleString()}`;

    const statusEl = card.querySelector('#fc-status');
    statusEl.style.background = 'rgba(2, 132, 199, 0.15)';
    statusEl.style.color = '#0284c7';
    statusEl.innerHTML = `🏦 Latent Money-Capital: <strong>£${Math.round(hoard).toLocaleString()}</strong> in liquid bank reserves awaiting replacement in Year ${life}.`;

    const form = card.querySelector('#fc-formula');
    const tex = `d = \\frac{\\text{\\pounds}${cost.toLocaleString()}}{${life}} = \\text{\\pounds}${Math.round(annualDeprec).toLocaleString()}/\\text{yr} \\implies M_{\\text{latent}}(t=${year}) = \\mathbf{\\text{\\pounds}${Math.round(hoard).toLocaleString()}}`;
    renderSimMath(form, tex);
  }

  ['fc-cost', 'fc-life', 'fc-year'].forEach(id => {
    card.querySelector('#' + id).addEventListener('input', () => {
      card.querySelectorAll('.sim-preset-btn').forEach(b => b.classList.remove('active'));
      update();
    });
  });

  update();
  return card;
}

// 7. Social Reproduction Schemas: Dept I & II Equilibrium (Vol 2 Ch 20 & 21)

function buildReproductionTableauSimulator() {
  const card = document.createElement('div');
  card.className = 'interactive-simulator-card';
  card.innerHTML = `
    <div class="sim-header" onclick="this.parentElement.classList.toggle('collapsed')">
      <div class="sim-header-title">
        <span class="sim-badge">Vol 2 • Ch 20</span>
        <span>Simple Reproduction Tableau (Dept I &amp; II: $I_{(v+s)} = II_c$)</span>
      </div>
      <span class="sim-toggle-icon">▼</span>
    </div>
    <div class="sim-content">
      <div class="sim-presets-slot"></div>
      <div class="sim-grid">
        <div class="sim-controls-pane">
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Dept I Constant Capital (c₁):</span>
              <span class="sim-val-display" id="rep-c1-val">4000</span>
            </div>
            <input type="range" class="sim-slider" id="rep-c1" min="2000" max="6000" step="200" value="4000">
          </div>
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Dept I Variable Capital (v₁, s₁=v₁):</span>
              <span class="sim-val-display" id="rep-v1-val">1000</span>
            </div>
            <input type="range" class="sim-slider" id="rep-v1" min="500" max="2000" step="100" value="1000">
          </div>
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Dept II Constant Capital (c₂):</span>
              <span class="sim-val-display" id="rep-c2-val">2000</span>
            </div>
            <input type="range" class="sim-slider" id="rep-c2" min="1000" max="4000" step="100" value="2000">
          </div>
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Dept II Variable Capital (v₂, s₂=v₂):</span>
              <span class="sim-val-display" id="rep-v2-val">500</span>
            </div>
            <input type="range" class="sim-slider" id="rep-v2" min="250" max="1500" step="50" value="500">
          </div>
        </div>
        <div class="sim-results-pane">
          <div class="sim-formula-display" id="rep-formula"></div>
          <div class="sim-table-wrap">
            <table class="sim-table">
              <thead>
                <tr><th>Department</th><th>c</th><th>v</th><th>s</th><th>Total Product (W)</th></tr>
              </thead>
              <tbody>
                <tr><td>I. Means of Production</td><td id="rep-t-c1">4000</td><td id="rep-t-v1">1000</td><td id="rep-t-s1">1000</td><td id="rep-t-w1">6000</td></tr>
                <tr><td>II. Consumer Goods</td><td id="rep-t-c2">2000</td><td id="rep-t-v2">500</td><td id="rep-t-s2">500</td><td id="rep-t-w2">3000</td></tr>
              </tbody>
            </table>
          </div>
          <div class="sim-status-banner" id="rep-status"></div>
        </div>
      </div>
      <div class="sim-proof-slot"></div>
    </div>
  `;

  const presets = [
    { label: "Marx's Classical Equilibrium", values: { c1: 4000, v1: 1000, c2: 2000, v2: 500 }, active: true },
    { label: "Dept I Overproduction (Glut)", values: { c1: 4000, v1: 1400, c2: 1600, v2: 500 } },
    { label: "Dept II Consumer Underproduction", values: { c1: 4000, v1: 800, c2: 2400, v2: 600 } },
    { label: "Expanded Scale (Growth)", values: { c1: 4400, v1: 1100, c2: 2200, v2: 550 } }
  ];

  function applyPreset(v) {
    card.querySelector('#rep-c1').value = v.c1;
    card.querySelector('#rep-v1').value = v.v1;
    card.querySelector('#rep-c2').value = v.c2;
    card.querySelector('#rep-v2').value = v.v2;
    update();
  }

  card.querySelector('.sim-presets-slot').appendChild(createPresetsBar(presets, applyPreset));

  const proof = createProofDrawer({
    mathHtml: '$$I(v + s) = II(c) \\iff (v_1 + s_1) = c_2 \\quad | \\quad W_{\\text{total}} = W_1 + W_2$$',
    explanation: 'Workers and capitalists in Dept I cannot consume machines; they must exchange $(v_1 + s_1)$ for consumer goods produced by Dept II. Concurrently, Dept II capitalists must spend $c_2$ to buy replacement machinery from Dept I. In an uncoordinated market economy, this exact equality is a sheer miracle, continually ruptured by commercial crises.',
    quote: "The basic condition of simple reproduction is: $I(v + s) = II(c)$... In an anarchic capitalist society, this exact proportionality is a pure accident, perpetually broken by commercial crises.",
    citation: "Capital Vol. 2, Chapter 20, Section 2"
  });
  card.querySelector('.sim-proof-slot').appendChild(proof);

  function update() {
    const c1 = parseFloat(card.querySelector('#rep-c1').value);
    const v1 = parseFloat(card.querySelector('#rep-v1').value);
    const s1 = v1;
    const w1 = c1 + v1 + s1;

    const c2 = parseFloat(card.querySelector('#rep-c2').value);
    const v2 = parseFloat(card.querySelector('#rep-v2').value);
    const s2 = v2;
    const w2 = c2 + v2 + s2;

    const ivs = v1 + s1;
    const iic = c2;
    const diff = ivs - iic;

    card.querySelector('#rep-c1-val').textContent = c1;
    card.querySelector('#rep-v1-val').textContent = v1;
    card.querySelector('#rep-c2-val').textContent = c2;
    card.querySelector('#rep-v2-val').textContent = v2;

    card.querySelector('#rep-t-c1').textContent = c1;
    card.querySelector('#rep-t-v1').textContent = v1;
    card.querySelector('#rep-t-s1').textContent = s1;
    card.querySelector('#rep-t-w1').textContent = w1;

    card.querySelector('#rep-t-c2').textContent = c2;
    card.querySelector('#rep-t-v2').textContent = v2;
    card.querySelector('#rep-t-s2').textContent = s2;
    card.querySelector('#rep-t-w2').textContent = w2;

    const statusEl = card.querySelector('#rep-status');
    if (diff === 0) {
      statusEl.style.background = 'rgba(16, 185, 129, 0.15)';
      statusEl.style.color = '#10b981';
      statusEl.innerHTML = `⚖️ Exact Proportional Equilibrium: I(v+s) == II(c) = $${ivs}. Both departments balance perfectly!`;
    } else if (diff > 0) {
      statusEl.style.background = 'rgba(245, 158, 11, 0.15)';
      statusEl.style.color = '#f59e0b';
      statusEl.innerHTML = `⚠️ Overproduction of Means of Production (+${diff}): Dept I machines remain unsold in warehouses.`;
    } else {
      statusEl.style.background = 'rgba(239, 68, 68, 0.15)';
      statusEl.style.color = '#ef4444';
      statusEl.innerHTML = `⚠️ Deficit of Means of Production (-${Math.abs(diff)}): Dept II suffers an equipment replacement shortage.`;
    }

    const form = card.querySelector('#rep-formula');
    const tex = `I(v + s) = ${ivs} \\quad \\text{vs} \\quad II(c) = ${iic} \\implies \\Delta = ${diff >= 0 ? '+' : ''}${diff}`;
    renderSimMath(form, tex);
  }

  ['rep-c1', 'rep-v1', 'rep-c2', 'rep-v2'].forEach(id => {
    card.querySelector('#' + id).addEventListener('input', () => {
      card.querySelectorAll('.sim-preset-btn').forEach(b => b.classList.remove('active'));
      update();
    });
  });

  update();
  return card;
}

// 8. Transformation of Values into Prices of Production (Vol 3 Ch 8–12)

function buildTransformationTableSimulator() {
  const card = document.createElement('div');
  card.className = 'interactive-simulator-card';
  card.innerHTML = `
    <div class="sim-header" onclick="this.parentElement.classList.toggle('collapsed')">
      <div class="sim-header-title">
        <span class="sim-badge">Vol 3 • Ch 8–12</span>
        <span>Transformation of Values into Prices of Production (Ch 9)</span>
      </div>
      <span class="sim-toggle-icon">▼</span>
    </div>
    <div class="sim-content">
      <div class="sim-presets-slot"></div>
      <div class="sim-controls-pane" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(min(100%, 260px), 1fr));gap:1rem;">
        <div class="sim-control-group">
          <div class="sim-label-row">
            <span>Rate of Surplus-Value (s / v):</span>
            <span class="sim-val-display" id="tf-sv-val">100%</span>
          </div>
          <input type="range" class="sim-slider" id="tf-sv" min="50" max="200" step="10" value="100">
        </div>
        <div class="sim-control-group">
          <div class="sim-label-row">
            <span>Organic Composition Spread:</span>
            <span class="sim-val-display" id="tf-spread-val">1.0x (Marx's Table)</span>
          </div>
          <input type="range" class="sim-slider" id="tf-spread" min="0.5" max="2.0" step="0.1" value="1.0">
        </div>
      </div>
      <div class="sim-results-pane" style="width:100%;">
        <div class="sim-formula-display" id="tf-formula"></div>
        <div class="sim-table-wrap">
          <table class="sim-table" id="tf-table">
            <thead>
              <tr><th>Branch</th><th>c</th><th>v</th><th>s</th><th>Value (W)</th><th>p'</th><th>Avg Profit (p̄)</th><th>Price of Prod</th><th>Dev (P-W)</th></tr>
            </thead>
            <tbody id="tf-tbody"></tbody>
            <tfoot id="tf-tfoot"></tfoot>
          </table>
        </div>
      </div>
      <div class="sim-proof-slot"></div>
    </div>
  `;

  const presets = [
    { label: "Marx's 1894 5-Sector Table (Ch 9)", values: { sv: 100, spread: 1.0 }, active: true },
    { label: "High-Tech Extreme Divergence", values: { sv: 120, spread: 1.8 } },
    { label: "Labor-Intensive Economy", values: { sv: 100, spread: 0.5 } }
  ];

  function applyPreset(v) {
    card.querySelector('#tf-sv').value = v.sv;
    card.querySelector('#tf-spread').value = v.spread;
    update();
  }

  card.querySelector('.sim-presets-slot').appendChild(createPresetsBar(presets, applyPreset));

  const proof = createProofDrawer({
    mathHtml: '$$\\bar{p}\' = \\frac{\\sum s}{\\sum(c+v)} = 22\\% \\implies \\sum \\text{Value} = \\sum \\text{Price of Production} \\quad \\text{and} \\quad \\sum s = \\sum \\bar{p}$$',
    explanation: 'Commodities do not sell at their individual values, but at their prices of production ($k + \\bar{p}$). Capital migrates ceaselessly across sectors until a single general rate of profit is formed. The capitalist class operates as a joint-stock brotherhood, dividing the total pool of extracted social surplus-value in proportion to capital invested.',
    quote: "The rates of profit in different spheres of production would be completely different if commodities were sold at their values... Capitalist competition brings about an equalization of profit rates, so that every capital of 100 receives the same average profit.",
    citation: "Capital Vol. 3, Chapter 9"
  });
  card.querySelector('.sim-proof-slot').appendChild(proof);

  const baseSectors = [
    { name: "I. Textiles", baseV: 20 },
    { name: "II. Mining", baseV: 30 },
    { name: "III. Agriculture", baseV: 40 },
    { name: "IV. Chemicals", baseV: 15 },
    { name: "V. Engineering", baseV: 5 }
  ];

  function update() {
    const svRate = parseFloat(card.querySelector('#tf-sv').value) / 100;
    const spread = parseFloat(card.querySelector('#tf-spread').value);

    card.querySelector('#tf-sv-val').textContent = Math.round(svRate * 100) + '%';
    card.querySelector('#tf-spread-val').textContent = spread.toFixed(1) + 'x';

    let totalC = 0, totalV = 0, totalS = 0, totalVal = 0, totalPrice = 0, totalAvgP = 0;
    const rows = baseSectors.map(s => {
      const v = Math.max(3, Math.min(48, Math.round(s.baseV * spread)));
      const c = 100 - v;
      const surp = Math.round(v * svRate);
      const val = c + v + surp;
      const indP = Math.round((surp / 100) * 100);
      totalC += c; totalV += v; totalS += surp; totalVal += val;
      return { name: s.name, c, v, s: surp, val, indP };
    });

    const avgProfitRate = totalS / (totalC + totalV);
    const avgProfitPer100 = Math.round(100 * avgProfitRate);

    const tbody = card.querySelector('#tf-tbody');
    tbody.innerHTML = '';
    rows.forEach(r => {
      const pProd = 100 + avgProfitPer100;
      const dev = pProd - r.val;
      totalPrice += pProd;
      totalAvgP += avgProfitPer100;
      const devStr = (dev >= 0 ? '+' : '') + dev;
      const devColor = dev > 0 ? '#10b981' : (dev < 0 ? '#ef4444' : 'inherit');
      tbody.innerHTML += `
        <tr>
          <td>${r.name}</td>
          <td>${r.c}</td>
          <td>${r.v}</td>
          <td>${r.s}</td>
          <td>${r.val}</td>
          <td>${r.indP}%</td>
          <td>${avgProfitPer100}</td>
          <td><strong>${pProd}</strong></td>
          <td style="color:${devColor};font-weight:700;">${devStr}</td>
        </tr>
      `;
    });

    const tfoot = card.querySelector('#tf-tfoot');
    tfoot.innerHTML = `
      <tr>
        <td>Total / Social Sum:</td>
        <td>${totalC}</td>
        <td>${totalV}</td>
        <td>${totalS}</td>
        <td>${totalVal}</td>
        <td>—</td>
        <td>${totalAvgP}</td>
        <td><strong>${totalPrice}</strong></td>
        <td>${totalPrice - totalVal} (0)</td>
      </tr>
    `;

    const form = card.querySelector('#tf-formula');
    const tex = `\\bar{p}' = \\frac{\\sum s}{\\sum(c+v)} = \\frac{${totalS}}{${totalC+totalV}} = \\mathbf{${Math.round(avgProfitRate * 100)}\\%} \\quad | \\quad \\sum \\text{Value} = \\sum \\text{Price} = \\mathbf{${totalVal}}`;
    renderSimMath(form, tex);
  }

  ['tf-sv', 'tf-spread'].forEach(id => {
    card.querySelector('#' + id).addEventListener('input', () => {
      card.querySelectorAll('.sim-preset-btn').forEach(b => b.classList.remove('active'));
      update();
    });
  });

  update();
  return card;
}

// 9. TRPF & Counteracting Influences Dashboard (Vol 3 Ch 1–7, 13–15)

function buildTrpfDashboardSimulator() {
  const card = document.createElement('div');
  card.className = 'interactive-simulator-card';
  card.innerHTML = `
    <div class="sim-header" onclick="this.parentElement.classList.toggle('collapsed')">
      <div class="sim-header-title">
        <span class="sim-badge">Vol 3 • Ch 2–7, 13–15</span>
        <span>TRPF &amp; Counteracting Influences Dashboard (Ch 13–14)</span>
      </div>
      <span class="sim-toggle-icon">▼</span>
    </div>
    <div class="sim-content">
      <div class="sim-presets-slot"></div>
      <div class="sim-grid">
        <div class="sim-controls-pane">
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Organic Composition of Capital (c / v):</span>
              <span class="sim-val-display" id="trpf-occ-val">5.0 : 1</span>
            </div>
            <input type="range" class="sim-slider" id="trpf-occ" min="1.0" max="12.0" step="0.5" value="5.0">
          </div>
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Baseline Surplus-Value Rate (s / v):</span>
              <span class="sim-val-display" id="trpf-sv-val">100%</span>
            </div>
            <input type="range" class="sim-slider" id="trpf-sv" min="50" max="250" step="10" value="100">
          </div>
          <div style="font-size:0.75rem;font-weight:700;text-transform:uppercase;color:var(--text-dim);margin-top:0.2rem;">
            6 Counteracting Influences (Ch 14):
          </div>
          <div class="sim-toggles-grid" id="trpf-toggles">
            <div class="sim-toggle-pill" data-idx="0"><span>1. Intense Exploitation (s/v ↑)</span><span class="sim-pill-indicator">OFF</span></div>
            <div class="sim-toggle-pill" data-idx="1"><span>2. Wage Depression (v ↓)</span><span class="sim-pill-indicator">OFF</span></div>
            <div class="sim-toggle-pill" data-idx="2"><span>3. Cheapening Constant Capital (c ↓)</span><span class="sim-pill-indicator">OFF</span></div>
            <div class="sim-toggle-pill" data-idx="3"><span>4. Relative Surplus Pop. (Cheap labor)</span><span class="sim-pill-indicator">OFF</span></div>
            <div class="sim-toggle-pill" data-idx="4"><span>5. Foreign Trade &amp; Imperial Drain</span><span class="sim-pill-indicator">OFF</span></div>
            <div class="sim-toggle-pill" data-idx="5"><span>6. Share &amp; Fictitious Capital</span><span class="sim-pill-indicator">OFF</span></div>
          </div>
        </div>
        <div class="sim-results-pane">
          <div class="sim-formula-display" id="trpf-formula"></div>
          <div class="sim-bar-wrapper">
            <div class="sim-bar-labels">
              <span>Theoretical Fall vs Countervailed Rate:</span>
              <span id="trpf-cmp-lbl">Raw: 16.7% | Actual: 16.7%</span>
            </div>
            <div class="sim-segmented-bar" style="background:rgba(255,255,255,0.06);height:28px;">
              <div class="sim-segment" id="trpf-bar-raw" style="background:#ef4444;width:40%;">Raw: 16.7%</div>
              <div class="sim-segment" id="trpf-bar-act" style="background:#10b981;width:40%;">Actual: 16.7%</div>
            </div>
          </div>
          <div class="sim-status-banner" id="trpf-status"></div>
        </div>
      </div>
      <div class="sim-proof-slot"></div>
    </div>
  `;

  const presets = [
    { label: "Pure Mechanization (No Offsets)", values: { occ: 6.0, sv: 100, toggles: [false,false,false,false,false,false] } },
    { label: "Marx's 19th-Century Offsets", values: { occ: 4.0, sv: 100, toggles: [true,false,true,false,true,false] }, active: true },
    { label: "Neoliberal Super-Exploitation", values: { occ: 7.5, sv: 140, toggles: [true,true,false,true,true,false] } },
    { label: "Financialized Late Capitalism", values: { occ: 9.0, sv: 120, toggles: [true,false,false,false,true,true] } }
  ];

  function applyPreset(v) {
    card.querySelector('#trpf-occ').value = v.occ;
    card.querySelector('#trpf-sv').value = v.sv;
    card.querySelectorAll('.sim-toggle-pill').forEach((pill, i) => {
      const active = v.toggles[i];
      pill.classList.toggle('active', !!active);
      pill.querySelector('.sim-pill-indicator').textContent = active ? 'ON' : 'OFF';
    });
    update();
  }

  card.querySelector('.sim-presets-slot').appendChild(createPresetsBar(presets, applyPreset));

  const proof = createProofDrawer({
    mathHtml: '$$p\' = \\frac{s}{c+v} = \\frac{s/v}{c/v + 1} = \\frac{e\'}{\\text{OCC} + 1} \\implies p\'_{\\text{actual}} = \\mathbf{X\\%}$$',
    explanation: 'The Law of the Tendency of the Rate of Profit to Fall is the central internal contradiction of capitalism. Raising the organic composition of capital ($c/v$) expels living labour—the sole source of surplus-value. However, counteracting factors check the drop, converting what would be an immediate collapse into a long-term cyclical tendency punctuated by crises.',
    quote: "The progressive tendency of the general rate of profit to fall is an expression peculiar to the capitalist mode of production of the progressive development of the social productivity of labour... There must be counteracting influences at work, leaving to the law merely the character of a tendency.",
    citation: "Capital Vol. 3, Chapter 13 & 14"
  });
  card.querySelector('.sim-proof-slot').appendChild(proof);

  card.querySelectorAll('.sim-toggle-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      pill.classList.toggle('active');
      pill.querySelector('.sim-pill-indicator').textContent = pill.classList.contains('active') ? 'ON' : 'OFF';
      card.querySelectorAll('.sim-preset-btn').forEach(b => b.classList.remove('active'));
      update();
    });
  });

  function update() {
    const occ = parseFloat(card.querySelector('#trpf-occ').value);
    const sv = parseFloat(card.querySelector('#trpf-sv').value);

    card.querySelector('#trpf-occ-val').textContent = occ.toFixed(1) + ' : 1';
    card.querySelector('#trpf-sv-val').textContent = sv + '%';

    const rawRate = sv / (occ + 1);

    let effSv = sv;
    let effOcc = occ;
    let bonus = 0;

    const pills = card.querySelectorAll('.sim-toggle-pill');
    if (pills[0].classList.contains('active')) effSv += 25; // exploitation
    if (pills[1].classList.contains('active')) effSv += 15; // wage depression
    if (pills[2].classList.contains('active')) effOcc *= 0.80; // cheapening c
    if (pills[3].classList.contains('active')) { effSv += 10; effOcc *= 0.95; } // surplus pop
    if (pills[4].classList.contains('active')) { effOcc *= 0.85; effSv += 10; } // foreign trade
    if (pills[5].classList.contains('active')) bonus += 1.5; // stock capital

    const actualRate = (effSv / (effOcc + 1)) + bonus;

    card.querySelector('#trpf-cmp-lbl').textContent = `Raw: ${rawRate.toFixed(1)}% | Actual: ${actualRate.toFixed(1)}%`;
    card.querySelector('#trpf-bar-raw').style.width = Math.min(100, rawRate * 2.5) + '%';
    card.querySelector('#trpf-bar-raw').textContent = `Raw: ${rawRate.toFixed(1)}%`;
    card.querySelector('#trpf-bar-act').style.width = Math.min(100, actualRate * 2.5) + '%';
    card.querySelector('#trpf-bar-act').textContent = `Actual: ${actualRate.toFixed(1)}%`;

    const statusEl = card.querySelector('#trpf-status');
    const diff = actualRate - rawRate;
    if (diff > 0.5) {
      statusEl.style.background = 'rgba(16, 185, 129, 0.15)';
      statusEl.style.color = '#10b981';
      statusEl.innerHTML = `🛡️ Countervailing Forces Active: Profit rate lifted by <strong>+${diff.toFixed(1)}%</strong> above raw mechanization baseline!`;
    } else {
      statusEl.style.background = 'rgba(239, 68, 68, 0.15)';
      statusEl.style.color = '#ef4444';
      statusEl.innerHTML = `⚠️ Unchecked TRPF in Effect: Rising organic composition directly depresses the general rate of profit!`;
    }

    const form = card.querySelector('#trpf-formula');
    const tex = `p'_{\\text{raw}} = \\frac{${sv}\\%}{${occ.toFixed(1)}+1} = ${rawRate.toFixed(1)}\\% \\implies p'_{\\text{countervailed}} = \\mathbf{${actualRate.toFixed(1)}\\%}`;
    renderSimMath(form, tex);
  }

  ['trpf-occ', 'trpf-sv'].forEach(id => {
    card.querySelector('#' + id).addEventListener('input', () => {
      card.querySelectorAll('.sim-preset-btn').forEach(b => b.classList.remove('active'));
      update();
    });
  });

  update();
  return card;
}

// 10. Fictitious Capital & Financial Asset Capitalization (Vol 3 Ch 21–36)

function buildFictitiousCapitalSimulator() {
  const card = document.createElement('div');
  card.className = 'interactive-simulator-card';
  card.innerHTML = `
    <div class="sim-header" onclick="this.parentElement.classList.toggle('collapsed')">
      <div class="sim-header-title">
        <span class="sim-badge">Vol 3 • Ch 21–33</span>
        <span>Fictitious Capital &amp; Financial Asset Yield Capitalizer</span>
      </div>
      <span class="sim-toggle-icon">▼</span>
    </div>
    <div class="sim-content">
      <div class="sim-presets-slot"></div>
      <div class="sim-grid">
        <div class="sim-controls-pane">
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Annual Revenue / Dividend Yield (Y):</span>
              <span class="sim-val-display" id="fic-yield-val">£1,000</span>
            </div>
            <input type="range" class="sim-slider" id="fic-yield" min="200" max="5000" step="100" value="1000">
          </div>
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Market Rate of Interest (i%):</span>
              <span class="sim-val-display" id="fic-rate-val">4.0%</span>
            </div>
            <input type="range" class="sim-slider" id="fic-rate" min="1.0" max="12.0" step="0.25" value="4.0">
          </div>
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Credit Leverage Multiplier (Λ):</span>
              <span class="sim-val-display" id="fic-lev-val">1.0x (No Leverage)</span>
            </div>
            <input type="range" class="sim-slider" id="fic-lev" min="1.0" max="5.0" step="0.25" value="1.0">
          </div>
        </div>
        <div class="sim-results-pane">
          <div class="sim-formula-display" id="fic-formula"></div>
          <div class="sim-bar-wrapper">
            <div class="sim-bar-labels">
              <span>Real Productive Base vs Fictitious Bubble:</span>
              <span id="fic-split-lbl">Real: £25,000 | Fictitious: £0</span>
            </div>
            <div class="sim-segmented-bar">
              <div class="sim-segment sim-seg-v" id="fic-bar-real" style="width:100%;">Real: £25,000</div>
              <div class="sim-segment sim-seg-s" id="fic-bar-fict" style="width:0%;">Froth</div>
            </div>
          </div>
          <div class="sim-status-banner" id="fic-status"></div>
        </div>
      </div>
      <div class="sim-proof-slot"></div>
    </div>
  `;

  const presets = [
    { label: "1840s British Railway Mania", values: { yield: 1000, rate: 4.0, lev: 2.5 } },
    { label: "Low-Rate Asset Bubble", values: { yield: 1000, rate: 1.5, lev: 4.0 }, active: true },
    { label: "Central Bank Rate Shock", values: { yield: 1000, rate: 7.5, lev: 1.5 } },
    { label: "Consols Government Annuity", values: { yield: 300, rate: 3.0, lev: 1.0 } }
  ];

  function applyPreset(v) {
    card.querySelector('#fic-yield').value = v.yield;
    card.querySelector('#fic-rate').value = v.rate;
    card.querySelector('#fic-lev').value = v.lev;
    update();
  }

  card.querySelector('.sim-presets-slot').appendChild(createPresetsBar(presets, applyPreset));

  const proof = createProofDrawer({
    mathHtml: '$$V_{\\text{asset}} = \\frac{Y}{i} \\cdot \\Lambda \\implies \\frac{\\partial V}{\\partial i} = -\\frac{Y}{i^2} \\cdot \\Lambda$$',
    explanation: 'Fictitious capital converts an annual flow of revenue into an imaginary capital asset by dividing it by the market interest rate. Equities and bonds produce no physical surplus-value themselves; they are merely legal property deeds claiming future surplus. When interest rates jump, billions in paper valuation evaporate instantly without destroying a single brick or machine.',
    quote: "The formation of a fictitious capital is called capitalization... Every periodic income is capitalized by calculating it on each occasion according to the average rate of interest... In the credit system, all connection with the real process of self-expansion of capital is lost to the last trace.",
    citation: "Capital Vol. 3, Chapter 25 & 29"
  });
  card.querySelector('.sim-proof-slot').appendChild(proof);

  function update() {
    const y = parseFloat(card.querySelector('#fic-yield').value);
    const rate = parseFloat(card.querySelector('#fic-rate').value);
    const lev = parseFloat(card.querySelector('#fic-lev').value);

    const vReal = y / (rate / 100);
    const vTotal = vReal * lev;
    const vFict = vTotal - vReal;

    const ratePlusTwo = rate + 2.0;
    const vShock = (y / (ratePlusTwo / 100)) * lev;
    const loss = vTotal - vShock;

    card.querySelector('#fic-yield-val').textContent = '£' + y.toLocaleString();
    card.querySelector('#fic-rate-val').textContent = rate.toFixed(2) + '%';
    card.querySelector('#fic-lev-val').textContent = lev.toFixed(2) + 'x';

    const realPct = Math.round((vReal / vTotal) * 100);
    card.querySelector('#fic-split-lbl').textContent = `Real: £${Math.round(vReal).toLocaleString()} | Speculative Froth: £${Math.round(vFict).toLocaleString()}`;
    card.querySelector('#fic-bar-real').style.width = realPct + '%';
    card.querySelector('#fic-bar-real').textContent = `Real: £${Math.round(vReal).toLocaleString()}`;
    card.querySelector('#fic-bar-fict').style.width = (100 - realPct) + '%';
    card.querySelector('#fic-bar-fict').textContent = vFict > 0 ? `Froth: £${Math.round(vFict).toLocaleString()}` : '';

    const statusEl = card.querySelector('#fic-status');
    statusEl.style.background = 'rgba(234, 179, 8, 0.15)';
    statusEl.style.color = '#eab308';
    statusEl.innerHTML = `⚠️ Interest Rate Shock Risk: If interest rates rise +2% (${rate.toFixed(1)}% → ${ratePlusTwo.toFixed(1)}%), paper wealth drops by <strong>£${Math.round(loss).toLocaleString()}</strong>!`;

    const form = card.querySelector('#fic-formula');
    const tex = `V = \\frac{\\text{\\pounds}${y}}{${rate.toFixed(2)}\\%} \\times ${lev.toFixed(2)} = \\mathbf{\\text{\\pounds}${Math.round(vTotal).toLocaleString()}} \\quad (\\text{Froth: } \\text{\\pounds}${Math.round(vFict).toLocaleString()})`;
    renderSimMath(form, tex);
  }

  ['fic-yield', 'fic-rate', 'fic-lev'].forEach(id => {
    card.querySelector('#' + id).addEventListener('input', () => {
      card.querySelectorAll('.sim-preset-btn').forEach(b => b.classList.remove('active'));
      update();
    });
  });

  update();
  return card;
}

// 11. Differential & Absolute Ground-Rent Matrix (Vol 3 Ch 37–47)

function buildGroundRentMatrixSimulator() {
  const card = document.createElement('div');
  card.className = 'interactive-simulator-card';
  card.innerHTML = `
    <div class="sim-header" onclick="this.parentElement.classList.toggle('collapsed')">
      <div class="sim-header-title">
        <span class="sim-badge">Vol 3 • Ch 37–39</span>
        <span>Differential Rent I Matrix (Soils A, B, C, D Fertility &amp; Location)</span>
      </div>
      <span class="sim-toggle-icon">▼</span>
    </div>
    <div class="sim-content">
      <div class="sim-presets-slot"></div>
      <div class="sim-grid">
        <div class="sim-controls-pane">
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Soil A Output (Worst Soil, Sets Regulating Price):</span>
              <span class="sim-val-display" id="gr-out-a-val">1.0 qr</span>
            </div>
            <input type="range" class="sim-slider" id="gr-out-a" min="0.5" max="2.0" step="0.1" value="1.0">
          </div>
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Soil D Output (Best Soil Fertility):</span>
              <span class="sim-val-display" id="gr-out-d-val">4.0 qrs</span>
            </div>
            <input type="range" class="sim-slider" id="gr-out-d" min="3.0" max="8.0" step="0.5" value="4.0">
          </div>
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Capital Advanced per Acre (K):</span>
              <span class="sim-val-display" id="gr-cost-val">£100</span>
            </div>
            <input type="range" class="sim-slider" id="gr-cost" min="50" max="200" step="10" value="100">
          </div>
        </div>
        <div class="sim-results-pane">
          <div class="sim-formula-display" id="gr-formula"></div>
          <div class="sim-table-wrap">
            <table class="sim-table">
              <thead>
                <tr><th>Soil</th><th>Output (qrs)</th><th>Production Cost+Profit</th><th>Market Value</th><th>Landlord Rent</th></tr>
              </thead>
              <tbody id="gr-tbody"></tbody>
            </table>
          </div>
          <div class="sim-status-banner" id="gr-status"></div>
        </div>
      </div>
      <div class="sim-proof-slot"></div>
    </div>
  `;

  const presets = [
    { label: "Differential Rent I (Natural Fertility)", values: { outA: 1.0, outD: 4.0, cost: 100 }, active: true },
    { label: "Poor Harvest Market Spike", values: { outA: 0.5, outD: 3.5, cost: 100 } },
    { label: "Differential Rent II (Intensive Tech)", values: { outA: 1.2, outD: 6.0, cost: 120 } }
  ];

  function applyPreset(v) {
    card.querySelector('#gr-out-a').value = v.outA;
    card.querySelector('#gr-out-d').value = v.outD;
    card.querySelector('#gr-cost').value = v.cost;
    update();
  }

  card.querySelector('.sim-presets-slot').appendChild(createPresetsBar(presets, applyPreset));

  const proof = createProofDrawer({
    mathHtml: '$$P_{\\text{mkt}} = \\frac{k + \\bar{p}}{Q_A} \\implies \\text{Rent}_i = (Q_i \\cdot P_{\\text{mkt}}) - (k + \\bar{p})$$',
    explanation: 'Differential rent does not arise because soil is fertile, but because fertility is unequal. Market prices of agricultural goods are set by the individual price of production on the poorest soil under cultivation (Soil A). All better soils produce a surplus-profit that is confiscated as tribute by private landowners.',
    quote: "Differential rent arises not from the absolute fertility of the soil, but from the difference in the fertility of different soils... The regulating market price is set by the individual price of production on the worst soil under cultivation. The surplus-profit yielded on superior soils is transformed into ground-rent.",
    citation: "Capital Vol. 3, Chapter 38 & 39"
  });
  card.querySelector('.sim-proof-slot').appendChild(proof);

  function update() {
    const outA = parseFloat(card.querySelector('#gr-out-a').value);
    const outD = parseFloat(card.querySelector('#gr-out-d').value);
    const cost = parseFloat(card.querySelector('#gr-cost').value);

    const costWithProf = cost * 1.2; // 20% average profit
    const pMkt = costWithProf / outA;

    const outB = outA + (outD - outA) * 0.33;
    const outC = outA + (outD - outA) * 0.67;

    const soils = [
      { name: "Soil A (Worst)", out: outA },
      { name: "Soil B", out: outB },
      { name: "Soil C", out: outC },
      { name: "Soil D (Best)", out: outD }
    ];

    let totalRent = 0;
    const tbody = card.querySelector('#gr-tbody');
    tbody.innerHTML = '';
    soils.forEach(s => {
      const rev = s.out * pMkt;
      const rent = Math.max(0, rev - costWithProf);
      totalRent += rent;
      tbody.innerHTML += `
        <tr>
          <td>${s.name}</td>
          <td>${s.out.toFixed(2)}</td>
          <td>£${Math.round(costWithProf)}</td>
          <td>£${Math.round(rev)}</td>
          <td style="color:${rent > 0 ? '#10b981' : 'var(--text-muted)'};font-weight:700;">£${Math.round(rent)}</td>
        </tr>
      `;
    });

    card.querySelector('#gr-out-a-val').textContent = outA.toFixed(1) + ' qr';
    card.querySelector('#gr-out-d-val').textContent = outD.toFixed(1) + ' qrs';
    card.querySelector('#gr-cost-val').textContent = '£' + cost;

    const statusEl = card.querySelector('#gr-status');
    statusEl.style.background = 'rgba(16, 185, 129, 0.15)';
    statusEl.style.color = '#10b981';
    statusEl.innerHTML = `🌾 Total Ground-Rent Toll: Landlords pocket <strong>£${Math.round(totalRent).toLocaleString()}</strong> in surplus-profits across all 4 soils!`;

    const form = card.querySelector('#gr-formula');
    const tex = `P_{\\text{mkt}} = \\frac{\\text{\\pounds}${Math.round(costWithProf)}}{${outA.toFixed(1)}\\text{ qr}} = \\mathbf{\\text{\\pounds}${Math.round(pMkt)}/\\text{qr}} \\implies \\text{Total Rent} = \\mathbf{\\text{\\pounds}${Math.round(totalRent)}}`;
    renderSimMath(form, tex);
  }

  ['gr-out-a', 'gr-out-d', 'gr-cost'].forEach(id => {
    card.querySelector('#' + id).addEventListener('input', () => {
      card.querySelectorAll('.sim-preset-btn').forEach(b => b.classList.remove('active'));
      update();
    });
  });

  update();
  return card;
}

// Vol 1 Ch 18: Different Formulae for the Rate of Surplus-Value
function buildDifferentFormulaeSimulator() {
  const card = document.createElement('div');
  card.className = 'interactive-simulator-card';
  card.innerHTML = `
    <div class="sim-header" onclick="this.parentElement.classList.toggle('collapsed')">
      <div class="sim-header-title">
        <span class="sim-badge">Vol 1 • Ch 18</span>
        <span>Different Formulae for the Rate of Surplus-Value (Marx vs Bourgeois Measures)</span>
      </div>
      <span class="sim-toggle-icon">▼</span>
    </div>
    <div class="sim-content">
      <div class="sim-presets-slot"></div>
      <div class="sim-grid">
        <div class="sim-controls-pane">
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Working Day Duration (Hours):</span>
              <span class="sim-val-display" id="df-day-val">12 hrs</span>
            </div>
            <input type="range" class="sim-slider" id="df-day" min="8" max="16" step="0.5" value="12">
          </div>
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Necessary Labour Time (Hours):</span>
              <span class="sim-val-display" id="df-v-val">6 hrs</span>
            </div>
            <input type="range" class="sim-slider" id="df-v" min="2" max="10" step="0.5" value="6">
          </div>
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Daily Wage Rate (Variable Capital v):</span>
              <span class="sim-val-display" id="df-w-val">£3.00</span>
            </div>
            <input type="range" class="sim-slider" id="df-w" min="1.0" max="6.0" step="0.5" value="3.0">
          </div>
        </div>

        <div class="sim-output-pane">
          <div class="sim-formula-display" id="df-formula"></div>
          <div class="sim-bar-wrapper">
            <div class="sim-bar-labels">
              <span>Scientific (s/v) vs Bourgeois (s / Day):</span>
              <span id="df-ratio-lbl">100% vs 50%</span>
            </div>
            <div class="sim-segmented-bar">
              <div class="sim-segment sim-seg-c" id="df-bar-v" style="width:50%;">Paid: 6h</div>
              <div class="sim-segment sim-seg-s" id="df-bar-s" style="width:50%;">Unpaid: 6h</div>
            </div>
          </div>
          <div class="sim-status-banner" id="df-status"></div>
        </div>
      </div>
      <div class="sim-proof-slot"></div>
    </div>
  `;

  const presets = [
    {
      label: "Marx's 1867 Standard (6h Paid / 6h Unpaid)",
      apply: () => {
        card.querySelector('#df-day').value = 12;
        card.querySelector('#df-v').value = 6;
        card.querySelector('#df-w').value = 3.0;
      }
    },
    {
      label: "Sweated 14h Day (4h Paid / 10h Unpaid)",
      apply: () => {
        card.querySelector('#df-day').value = 14;
        card.querySelector('#df-v').value = 4;
        card.querySelector('#df-w').value = 2.0;
      }
    },
    {
      label: "Modern 8h Day (4h Paid / 4h Unpaid)",
      apply: () => {
        card.querySelector('#df-day').value = 8;
        card.querySelector('#df-v').value = 4;
        card.querySelector('#df-w').value = 4.0;
      }
    }
  ];

  const presetsSlot = card.querySelector('.sim-presets-slot');
  presetsSlot.appendChild(createPresetsBar(presets, () => update()));

  const proofDrawer = createProofDrawer({
    mathHtml: '$$\\text{Formula I (Scientific): } \\frac{s}{v} = \\frac{\\text{Surplus-labour}}{\\text{Necessary labour}} \\quad \\text{vs} \\quad \\text{Formula II (Bourgeois): } \\frac{s}{\\text{Working-day}} = \\frac{s}{v+s}$$',
    explanation: 'Classical political economy deliberately substituted Formula II ($s / (v+s)$) for Formula I ($s/v$). By comparing surplus-value to the whole working day instead of to the variable capital that produced it, the apparent exploitation rate is cut in half (e.g. 50% instead of 100%), creating the false illusion that the capitalist and labourer are equal partners dividing a jointly created pie.',
    quote: "The actual degree of exploitation of labour is represented by s/v, not by s/(v+s). Formula II treats surplus-value as a fraction of the working day, obscuring the decisive fact that the capitalist pays nothing whatever for surplus-labour.",
    citation: "Capital Vol. 1, Chapter 18"
  });
  card.querySelector('.sim-proof-slot').appendChild(proofDrawer);

  function update() {
    let day = parseFloat(card.querySelector('#df-day').value);
    let v = parseFloat(card.querySelector('#df-v').value);
    if (v >= day) {
      v = day - 0.5;
      card.querySelector('#df-v').value = v;
    }
    const w = parseFloat(card.querySelector('#df-w').value);

    card.querySelector('#df-day-val').textContent = `${day.toFixed(1)} hrs`;
    card.querySelector('#df-v-val').textContent = `${v.toFixed(1)} hrs`;
    card.querySelector('#df-w-val').textContent = `£${w.toFixed(2)}`;

    const s = day - v;
    const sRateTrue = (s / v) * 100;
    const sRateBourgeois = (s / day) * 100;

    const vPct = (v / day) * 100;
    const sPct = (s / day) * 100;

    card.querySelector('#df-bar-v').style.width = `${vPct}%`;
    card.querySelector('#df-bar-v').textContent = `Paid: ${v.toFixed(1)}h (${Math.round(vPct)}%)`;

    card.querySelector('#df-bar-s').style.width = `${sPct}%`;
    card.querySelector('#df-bar-s').textContent = `Unpaid: ${s.toFixed(1)}h (${Math.round(sPct)}%)`;

    card.querySelector('#df-ratio-lbl').textContent = `Marx s/v: ${Math.round(sRateTrue)}% | Bourgeois: ${Math.round(sRateBourgeois)}%`;

    const statusEl = card.querySelector('#df-status');
    statusEl.style.background = 'rgba(239, 68, 68, 0.15)';
    statusEl.style.color = '#ef4444';
    statusEl.innerHTML = `⚠️ <strong>The Bourgeois Veil Unmasked</strong>: The true rate of exploitation is <strong>${Math.round(sRateTrue)}%</strong> (unpaid/paid). Apologists report <strong>${Math.round(sRateBourgeois)}%</strong> by diluting surplus against the whole working day!`;

    const form = card.querySelector('#df-formula');
    const tex = `\\text{Marx: } s' = \\frac{s}{v} = \\frac{${s.toFixed(1)}\\text{h}}{${v.toFixed(1)}\\text{h}} = \\mathbf{${Math.round(sRateTrue)}\\%} \\quad \\text{vs} \\quad \\text{Apologist: } \\frac{s}{v+s} = \\frac{${s.toFixed(1)}\\text{h}}{${day.toFixed(1)}\\text{h}} = ${Math.round(sRateBourgeois)}\\%`;
    renderSimMath(form, tex);
  }

  ['df-day', 'df-v', 'df-w'].forEach(id => {
    card.querySelector('#' + id).addEventListener('input', () => {
      card.querySelectorAll('.sim-preset-btn').forEach(b => b.classList.remove('active'));
      update();
    });
  });

  update();
  return card;
}

// Vol 3 Ch 17: Commercial Profit and Merchant Capital
function buildCommercialProfitSimulator() {
  const card = document.createElement('div');
  card.className = 'interactive-simulator-card';
  card.innerHTML = `
    <div class="sim-header" onclick="this.parentElement.classList.toggle('collapsed')">
      <div class="sim-header-title">
        <span class="sim-badge">Vol 3 • Ch 16–18</span>
        <span>Commercial Profit &amp; Merchant Capital Equalization (Ch 17: p̄' = S / (K + B))</span>
      </div>
      <span class="sim-toggle-icon">▼</span>
    </div>
    <div class="sim-content">
      <div class="sim-presets-slot"></div>
      <div class="sim-grid">
        <div class="sim-controls-pane">
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Industrial Capital Advanced (K = c + v):</span>
              <span class="sim-val-display" id="cp-k-val">£900</span>
            </div>
            <input type="range" class="sim-slider" id="cp-k" min="500" max="2000" step="50" value="900">
          </div>
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Living Wages (Variable Capital v):</span>
              <span class="sim-val-display" id="cp-v-val">£180</span>
            </div>
            <input type="range" class="sim-slider" id="cp-v" min="50" max="500" step="10" value="180">
          </div>
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Merchant Capital Advanced (B):</span>
              <span class="sim-val-display" id="cp-b-val">£100</span>
            </div>
            <input type="range" class="sim-slider" id="cp-b" min="20" max="400" step="10" value="100">
          </div>
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Surplus-Value Rate (s / v):</span>
              <span class="sim-val-display" id="cp-sv-val">100%</span>
            </div>
            <input type="range" class="sim-slider" id="cp-sv" min="50" max="200" step="10" value="100">
          </div>
        </div>

        <div class="sim-output-pane">
          <div class="sim-formula-display" id="cp-formula"></div>
          <div class="sim-bar-wrapper">
            <div class="sim-bar-labels">
              <span>Surplus-Value Partition:</span>
              <span id="cp-split-lbl">Industrial Profit: £162 | Commercial Profit: £18</span>
            </div>
            <div class="sim-segmented-bar">
              <div class="sim-segment sim-seg-c" id="cp-bar-ind" style="width:90%;">Industrial Profit: £162</div>
              <div class="sim-segment sim-seg-rent" id="cp-bar-com" style="width:10%;">Commercial Profit: £18</div>
            </div>
          </div>
          <div class="sim-status-banner" id="cp-status"></div>
        </div>
      </div>
      <div class="sim-proof-slot"></div>
    </div>
  `;

  const presets = [
    {
      label: "Marx's Ch 17 Classic (£900 Ind + £100 Merch)",
      apply: () => {
        card.querySelector('#cp-k').value = 900;
        card.querySelector('#cp-v').value = 180;
        card.querySelector('#cp-b').value = 100;
        card.querySelector('#cp-sv').value = 100;
      }
    },
    {
      label: "Swollen Merchant Sector (£800 Ind + £300 Merch)",
      apply: () => {
        card.querySelector('#cp-k').value = 800;
        card.querySelector('#cp-v').value = 200;
        card.querySelector('#cp-b').value = 300;
        card.querySelector('#cp-sv').value = 100;
      }
    },
    {
      label: "Lean Logistics (£1000 Ind + £50 Merch)",
      apply: () => {
        card.querySelector('#cp-k').value = 1000;
        card.querySelector('#cp-v').value = 200;
        card.querySelector('#cp-b').value = 50;
        card.querySelector('#cp-sv').value = 100;
      }
    }
  ];

  const presetsSlot = card.querySelector('.sim-presets-slot');
  presetsSlot.appendChild(createPresetsBar(presets, () => update()));

  const proofDrawer = createProofDrawer({
    mathHtml: '$$\\bar{p}\' = \\frac{S}{K + B} = \\frac{180}{900 + 100} = 18\\% \\implies P_{\\text{wholesale}} = K + \\bar{p}\'K = 1,062 \\quad | \\quad P_{\\text{retail}} = 1,080$$',
    explanation: 'Merchant capital operates exclusively in the sphere of circulation and creates neither value nor surplus-value. However, because capital will not enter commerce without receiving the average profit, merchant capital ($B$) enters into the equalization of the general profit rate. Industrialists sell their commodities to merchants below their price of production, surrendering a portion of the surplus-value produced by industrial workers.',
    quote: "Merchant's capital produces neither value nor surplus-value directly... It participates in the leveling of surplus-value to average profit, and draws its dividend from the total social surplus-value just as if it had been invested in production.",
    citation: "Capital Vol. 3, Chapter 17"
  });
  card.querySelector('.sim-proof-slot').appendChild(proofDrawer);

  function update() {
    const K = parseFloat(card.querySelector('#cp-k').value);
    let v = parseFloat(card.querySelector('#cp-v').value);
    if (v >= K) {
      v = K * 0.4;
      card.querySelector('#cp-v').value = v;
    }
    const B = parseFloat(card.querySelector('#cp-b').value);
    const svRate = parseFloat(card.querySelector('#cp-sv').value) / 100;

    card.querySelector('#cp-k-val').textContent = `£${Math.round(K).toLocaleString()}`;
    card.querySelector('#cp-v-val').textContent = `£${Math.round(v).toLocaleString()}`;
    card.querySelector('#cp-b-val').textContent = `£${Math.round(B).toLocaleString()}`;
    card.querySelector('#cp-sv-val').textContent = `${Math.round(svRate * 100)}%`;

    const S = v * svRate;
    const pureIndRate = (S / K) * 100;
    const totalCap = K + B;
    const generalRate = (S / totalCap) * 100;

    const indProfit = K * (generalRate / 100);
    const comProfit = B * (generalRate / 100);

    const indPct = (indProfit / S) * 100;
    const comPct = (comProfit / S) * 100;

    card.querySelector('#cp-bar-ind').style.width = `${indPct}%`;
    card.querySelector('#cp-bar-ind').textContent = `Industry: £${Math.round(indProfit).toLocaleString()} (${Math.round(indPct)}%)`;

    card.querySelector('#cp-bar-com').style.width = `${comPct}%`;
    card.querySelector('#cp-bar-com').textContent = `Commerce: £${Math.round(comProfit).toLocaleString()} (${Math.round(comPct)}%)`;

    card.querySelector('#cp-split-lbl').textContent = `Industrial Profit: £${Math.round(indProfit).toLocaleString()} | Commercial Profit: £${Math.round(comProfit).toLocaleString()}`;

    const statusEl = card.querySelector('#cp-status');
    statusEl.style.background = 'rgba(59, 130, 246, 0.15)';
    statusEl.style.color = '#3b82f6';
    statusEl.innerHTML = `🏪 <strong>Commercial Equalization</strong>: Merchant capital (£${Math.round(B)}) creates £0 new value, but lowers the social profit rate from <strong>${pureIndRate.toFixed(1)}%</strong> to <strong>${generalRate.toFixed(1)}%</strong>, pocketing <strong>£${Math.round(comProfit).toLocaleString()}</strong> of surplus-value!`;

    const form = card.querySelector('#cp-formula');
    const tex = `\\bar{p}' = \\frac{S}{K + B} = \\frac{\\text{\\pounds}${Math.round(S)}}{\\text{\\pounds}${Math.round(K)} + \\text{\\pounds}${Math.round(B)}} = \\mathbf{${generalRate.toFixed(1)}\\%} \\implies \\text{Comm. Profit } p_c = \\mathbf{\\text{\\pounds}${Math.round(comProfit).toLocaleString()}}`;
    renderSimMath(form, tex);
  }

  ['cp-k', 'cp-v', 'cp-b', 'cp-sv'].forEach(id => {
    card.querySelector('#' + id).addEventListener('input', () => {
      card.querySelectorAll('.sim-preset-btn').forEach(b => b.classList.remove('active'));
      update();
    });
  });

  update();
  return card;
}

// Complete suite of 10 New Interactive Simulators for Das Kapital

// 1. The Four Forms of Value & Dialectical Genesis of Money (Vol 1 Ch 1)
function buildValueFormsSimulator() {
  const card = document.createElement('div');
  card.className = 'interactive-simulator-card';
  card.innerHTML = `
    <div class="sim-header" onclick="this.parentElement.classList.toggle('collapsed')">
      <div class="sim-header-title">
        <span class="sim-badge">Vol 1 • Ch 1</span>
        <span>The Four Forms of Value &amp; Genesis of Money (Section 3)</span>
      </div>
      <span class="sim-toggle-icon">▼</span>
    </div>
    <div class="sim-content">
      <div class="sim-presets-slot"></div>
      <div class="sim-grid">
        <div class="sim-controls-pane">
          <div class="sim-control-group">
            <label style="font-weight:600;display:block;margin-bottom:0.4rem;font-size:0.85rem;">Dialectical Form of Value:</label>
            <div style="display:flex;gap:0.3rem;flex-wrap:wrap;">
              <button type="button" class="sim-preset-btn active" id="vf-btn-1">I. Simple</button>
              <button type="button" class="sim-preset-btn" id="vf-btn-2">II. Expanded</button>
              <button type="button" class="sim-preset-btn" id="vf-btn-3">III. General</button>
              <button type="button" class="sim-preset-btn" id="vf-btn-4">IV. Money</button>
            </div>
          </div>
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Linen Quantity (Relative Form A):</span>
              <span class="sim-val-display" id="vf-linen-val">20 yards</span>
            </div>
            <input type="range" class="sim-slider" id="vf-linen" min="5" max="60" step="5" value="20">
          </div>
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Equivalence Ratio (Coats per 20 yds):</span>
              <span class="sim-val-display" id="vf-ratio-val">1 coat</span>
            </div>
            <input type="range" class="sim-slider" id="vf-ratio" min="0.5" max="3" step="0.5" value="1">
          </div>
          <div class="sim-explainer-box" id="vf-dialectics-box" style="margin-top:0.6rem;font-size:0.85rem;line-height:1.45;color:var(--text-muted);border-left:3px solid var(--accent);padding-left:0.6rem;">
          </div>
        </div>
        <div class="sim-visuals-pane">
          <div class="sim-metric-grid" style="grid-template-columns:1fr;margin-bottom:0.75rem;">
            <div class="sim-metric-card" style="text-align:center;padding:0.9rem;">
              <div class="sim-metric-label" id="vf-form-title">FORM I: SIMPLE, ISOLATED, OR ACCIDENTAL</div>
              <div class="sim-metric-val" id="vf-formula-display" style="font-size:1.15rem;margin:0.5rem 0;">$$20\\text{ yards linen} = 1\\text{ coat}$$</div>
              <div style="font-size:0.8rem;color:var(--text-muted);" id="vf-formula-subtext">Active Relative Pole seeking expression = Passive Equivalent Pole acting as mirror</div>
            </div>
          </div>
          <div id="vf-matrix-display" style="background:var(--callout-bg);padding:0.8rem;border-radius:8px;border:1px solid var(--border-color);font-size:0.85rem;line-height:1.6;">
          </div>
        </div>
      </div>
    </div>
  `;

  let currentForm = 1;
  const presets = [
    { label: "Marx's Canonical Form (1867)", values: { form: 1, linen: 20, ratio: 1 } },
    { label: "Expanded Barter Network", values: { form: 2, linen: 20, ratio: 1 } },
    { label: "Universal Equivalent Emergence", values: { form: 3, linen: 20, ratio: 1 } },
    { label: "Gold Sovereign Monopolization", values: { form: 4, linen: 20, ratio: 1 } }
  ];

  const presetsSlot = card.querySelector('.sim-presets-slot');
  presetsSlot.appendChild(createPresetsBar(presets, (vals) => {
    currentForm = vals.form;
    card.querySelector('#vf-linen').value = vals.linen;
    card.querySelector('#vf-ratio').value = vals.ratio;
    updateButtons();
    update();
  }));

  const content = card.querySelector('.sim-content');
  content.appendChild(createProofDrawer({
    mathHtml: '$$20\\text{ yds linen (Relative Form)} = 1\\text{ coat (Equivalent Form)} \\iff \\sum x_i A_i = 1\\text{ Universal Equivalent} \\rightarrow \\text{Gold Money}$$',
    explanation: 'A commodity cannot express its own value in its own body ($20\\text{ yards linen} = 20\\text{ yards linen}$ is an empty tautology). Value can only appear socially by equating itself to another commodity as its corporeal equivalent. Through Form II (endless series) and Form III (reversal into a single general equivalent), the money-form (Form IV) crystalizes when gold firmly monopolizes this universal equivalent position.',
    quote: 'The linen, by equating the coat to itself as an equivalent, makes the coat the material in which its own value is expressed. The value of the linen is expressed in the bodily form of the coat.',
    citation: 'Das Kapital, Volume 1, Chapter 1, Section 3'
  }));

  function updateButtons() {
    [1, 2, 3, 4].forEach(f => {
      const b = card.querySelector('#vf-btn-' + f);
      if (b) b.classList.toggle('active', f === currentForm);
    });
  }

  [1, 2, 3, 4].forEach(f => {
    const b = card.querySelector('#vf-btn-' + f);
    if (b) {
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        currentForm = f;
        updateButtons();
        update();
      });
    }
  });

  const linenInput = card.querySelector('#vf-linen');
  const ratioInput = card.querySelector('#vf-ratio');

  linenInput.addEventListener('input', update);
  ratioInput.addEventListener('input', update);

  function update() {
    const L = parseFloat(linenInput.value) || 20;
    const R = parseFloat(ratioInput.value) || 1;
    const coats = ((L / 20) * R).toFixed(1).replace(/\.0$/, '');
    const tea = ((L / 20) * 10 * R).toFixed(0);
    const coffee = ((L / 20) * 40 * R).toFixed(0);
    const iron = ((L / 20) * 0.5 * R).toFixed(1).replace(/\.0$/, '');
    const goldOz = ((L / 20) * 2 * R).toFixed(1).replace(/\.0$/, '');

    card.querySelector('#vf-linen-val').textContent = L + ' yards';
    card.querySelector('#vf-ratio-val').textContent = R + (R === 1 ? ' coat' : ' coats');

    const formTitle = card.querySelector('#vf-form-title');
    const formulaDisp = card.querySelector('#vf-formula-display');
    const matrixDisp = card.querySelector('#vf-matrix-display');
    const dialecticsBox = card.querySelector('#vf-dialectics-box');

    if (currentForm === 1) {
      formTitle.textContent = 'FORM I: SIMPLE, ELEMENTARY, OR ACCIDENTAL';
      renderSimMath(formulaDisp, `${L}\\text{ yards linen} = ${coats}\\text{ coat}${coats > 1 ? 's' : ''}`);
      dialecticsBox.innerHTML = `<strong>Polarity of Value:</strong> Linen is the <em>Relative form</em> (seeks expression), Coat is the <em>Equivalent form</em> (acts as mirror of value). They are mutually dependent, mutually exclusive opposites.`;
      matrixDisp.innerHTML = `
        <div style="font-weight:600;margin-bottom:0.3rem;">Bilateral Qualitative Encounter:</div>
        <div>👕 <strong>1 Coat</strong> counts not as a useful tailored garment, but directly as the embodiment of abstract human labour expended on ${L} yards of linen.</div>
      `;
    } else if (currentForm === 2) {
      formTitle.textContent = 'FORM II: TOTAL OR EXPANDED FORM';
      renderSimMath(formulaDisp, `${L}\\text{ yds linen} = ${coats}\\text{ coats} = ${tea}\\text{ lb tea} = ${coffee}\\text{ lb coffee} = ${iron}\\text{ qr iron} = ${goldOz}\\text{ oz gold}`);
      dialecticsBox.innerHTML = `<strong>Endless Series:</strong> The value of linen is now expressed in every other commodity in the world. But it is defective because the series is never completed, and every commodity has its own divergent list.`;
      matrixDisp.innerHTML = `
        <div style="font-weight:600;margin-bottom:0.3rem;">Fragmented Mosaic of Equivalents:</div>
        <div>• ${L} yds linen = ${coats} coats<br>• ${L} yds linen = ${tea} lb tea<br>• ${L} yds linen = ${coffee} lb coffee<br>• ${L} yds linen = ${goldOz} oz gold</div>
      `;
    } else if (currentForm === 3) {
      formTitle.textContent = 'FORM III: THE GENERAL FORM OF VALUE';
      renderSimMath(formulaDisp, `\\left\\{ ${coats}\\text{ coats}, ${tea}\\text{ tea}, ${coffee}\\text{ coffee}, ${goldOz}\\text{ gold} \\right\\} \\longrightarrow ${L}\\text{ yds linen}`);
      dialecticsBox.innerHTML = `<strong>Dialectical Inversion:</strong> When all commodity producers collectively express their values in a single common commodity (linen), that commodity is elevated to the <em>Universal Equivalent</em>.`;
      matrixDisp.innerHTML = `
        <div style="font-weight:600;margin-bottom:0.3rem;">Social Centralization:</div>
        <div>${coats} coats, ${tea} lb tea, ${coffee} lb coffee, ${goldOz} oz gold all equate themselves to <strong>${L} yds linen</strong>. Linen now enjoys universal social exchangeability.</div>
      `;
    } else {
      formTitle.textContent = 'FORM IV: THE MONEY FORM';
      renderSimMath(formulaDisp, `${L}\\text{ yards linen} = ${goldOz}\\text{ oz gold } (\\text{\\pounds}${(parseFloat(goldOz) * 4).toFixed(0)})`);
      dialecticsBox.innerHTML = `<strong>Social Monopolization:</strong> Custom and physical suitability fix the Universal Equivalent exclusively onto <em>Gold</em>. Price is now the money-name of the labour objectified in the commodity.`;
      matrixDisp.innerHTML = `
        <div style="font-weight:600;margin-bottom:0.3rem;">Money-Commodity Crystallization:</div>
        <div>🥇 Gold separates itself from the world of commodities, confronting them as universal wealth incarnate. Price is born: <strong>£${(parseFloat(goldOz) * 4).toFixed(0)}</strong>.</div>
      `;
    }
  }

  update();
  return card;
}

// 2. Currency Velocity & The Quantity of Money in Circulation (Vol 1 Ch 3)
function buildCurrencyVelocitySimulator() {
  const card = document.createElement('div');
  card.className = 'interactive-simulator-card';
  card.innerHTML = `
    <div class="sim-header" onclick="this.parentElement.classList.toggle('collapsed')">
      <div class="sim-header-title">
        <span class="sim-badge">Vol 1 • Ch 3</span>
        <span>Quantity of Money &amp; Currency Velocity (M = (ΣPQ − C) / V)</span>
      </div>
      <span class="sim-toggle-icon">▼</span>
    </div>
    <div class="sim-content">
      <div class="sim-presets-slot"></div>
      <div class="sim-grid">
        <div class="sim-controls-pane">
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Total Price of Commodities (ΣPQ):</span>
              <span class="sim-val-display" id="cv-prices-val">£100,000</span>
            </div>
            <input type="range" class="sim-slider" id="cv-prices" min="20000" max="500000" step="10000" value="100000">
          </div>
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Velocity of Money (V, turns/year):</span>
              <span class="sim-val-display" id="cv-v-val">5 turns</span>
            </div>
            <input type="range" class="sim-slider" id="cv-v" min="1" max="20" step="1" value="5">
          </div>
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Mutual Credit / Debt Offsetting:</span>
              <span class="sim-val-display" id="cv-credit-val">20% (£20,000)</span>
            </div>
            <input type="range" class="sim-slider" id="cv-credit" min="0" max="80" step="5" value="20">
          </div>
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Paper Notes Issued vs Gold Required:</span>
              <span class="sim-val-display" id="cv-paper-val">100% (Par)</span>
            </div>
            <input type="range" class="sim-slider" id="cv-paper" min="50" max="300" step="10" value="100">
          </div>
        </div>
        <div class="sim-visuals-pane">
          <div class="sim-metric-grid" style="grid-template-columns:1fr 1fr;margin-bottom:0.75rem;">
            <div class="sim-metric-card">
              <div class="sim-metric-label">Gold Mass Required</div>
              <div class="sim-metric-val" id="cv-gold-mass">£16,000</div>
              <div style="font-size:0.75rem;color:var(--text-muted);">Real metal needed</div>
            </div>
            <div class="sim-metric-card">
              <div class="sim-metric-label">Paper Token Purchasing Power</div>
              <div class="sim-metric-val" id="cv-token-val">100%</div>
              <div style="font-size:0.75rem;color:var(--text-muted);" id="cv-token-sub">1 Paper £ = 1 Gold £</div>
            </div>
          </div>
          <div style="background:var(--callout-bg);padding:0.8rem;border-radius:8px;border:1px solid var(--border-color);font-size:0.85rem;" id="cv-verdict-box">
          </div>
        </div>
      </div>
    </div>
  `;

  const presets = [
    { label: "Normal Gold Circulation (V=5)", values: { p: 100000, v: 5, c: 20, paper: 100 } },
    { label: "Clearing-House Credit Economy", values: { p: 250000, v: 8, c: 75, paper: 100 } },
    { label: "Paper Fiat Inflation (Assignats)", values: { p: 100000, v: 5, c: 10, paper: 250 } }
  ];

  const presetsSlot = card.querySelector('.sim-presets-slot');
  presetsSlot.appendChild(createPresetsBar(presets, (vals) => {
    card.querySelector('#cv-prices').value = vals.p;
    card.querySelector('#cv-v').value = vals.v;
    card.querySelector('#cv-credit').value = vals.c;
    card.querySelector('#cv-paper').value = vals.paper;
    update();
  }));

  const content = card.querySelector('.sim-content');
  content.appendChild(createProofDrawer({
    mathHtml: '$$M = \\frac{\\sum (P \\cdot Q) - \\text{Credit Offsets} + \\text{Due Payments}}{V}, \\quad \\text{Purchasing Power per Token} = \\frac{M_{\\text{gold}}}{M_{\\text{paper}}}$$',
    explanation: 'The quantity of circulating money is not an independent variable that determines prices (as Hume and Ricardo\'s quantity theory claimed); rather, given commodity values and the value of gold, the sum of prices and velocity determine the quantity of currency needed. If inconvertible paper money is injected beyond this gold ceiling, it cannot expand real circulation; instead, each token depreciates proportionally.',
    quote: 'The quantity of money functioning as the circulating medium is determined by the sum of the prices of the commodities circulating, and the average speed of their currency... If paper money is issued beyond its limit, it will only represent that quantity of gold which is in accordance with the laws of commodity circulation.',
    citation: 'Das Kapital, Volume 1, Chapter 3, Section 2'
  }));

  const pInput = card.querySelector('#cv-prices');
  const vInput = card.querySelector('#cv-v');
  const cInput = card.querySelector('#cv-credit');
  const paperInput = card.querySelector('#cv-paper');

  pInput.addEventListener('input', update);
  vInput.addEventListener('input', update);
  cInput.addEventListener('input', update);
  paperInput.addEventListener('input', update);

  function update() {
    const P = parseFloat(pInput.value) || 100000;
    const V = parseFloat(vInput.value) || 5;
    const creditPct = parseFloat(cInput.value) || 20;
    const paperPct = parseFloat(paperInput.value) || 100;

    const creditOffset = P * (creditPct / 100);
    const netPrices = P - creditOffset;
    const goldReq = netPrices / V;
    const paperIssued = goldReq * (paperPct / 100);
    const tokenPower = paperPct > 100 ? (100 / paperPct) * 100 : 100;

    card.querySelector('#cv-prices-val').textContent = '£' + P.toLocaleString();
    card.querySelector('#cv-v-val').textContent = V + ' turns/yr';
    card.querySelector('#cv-credit-val').textContent = creditPct + '% (£' + Math.round(creditOffset).toLocaleString() + ')';
    card.querySelector('#cv-paper-val').textContent = paperPct + '% (' + (paperPct === 100 ? 'Par' : paperPct > 100 ? 'Depreciation' : 'Shortage') + ')';

    card.querySelector('#cv-gold-mass').textContent = '£' + Math.round(goldReq).toLocaleString();
    card.querySelector('#cv-token-val').textContent = tokenPower.toFixed(1) + '%';
    card.querySelector('#cv-token-sub').textContent = paperPct > 100 ?
      `1 Paper £ buys £${(tokenPower/100).toFixed(2)} in gold` : '1 Paper £ = 1 Gold £ (At Par)';

    const vBox = card.querySelector('#cv-verdict-box');
    if (paperPct > 100) {
      vBox.innerHTML = `<strong>⚠️ Paper Currency Inflation:</strong> The state printed £${Math.round(paperIssued).toLocaleString()} in notes, but society only needs £${Math.round(goldReq).toLocaleString()} in gold. Paper tokens devalue to <strong>${tokenPower.toFixed(1)}%</strong> of par value. Commodity prices in paper double/rise proportionally.`;
    } else if (creditPct >= 50) {
      vBox.innerHTML = `<strong>⚡ Advanced Credit Economy:</strong> By clearing £${Math.round(creditOffset).toLocaleString()} of mutual obligations through the banking clearing-house, the economy economizes on gold by <strong>${creditPct}%</strong>.`;
    } else {
      vBox.innerHTML = `<strong>⚖️ Classical Equilibrium:</strong> £${Math.round(goldReq).toLocaleString()} in sovereign gold coins circulating ${V} times per year effortlessly realizes £${P.toLocaleString()} of gross commodity exchanges.`;
    }
  }

  update();
  return card;
}

// 3. General Formula: C-M-C vs M-C-M' & Circulation Fallacy (Vol 1 Ch 4-5)
function buildGeneralFormulaCirculationSimulator() {
  const card = document.createElement('div');
  card.className = 'interactive-simulator-card';
  card.innerHTML = `
    <div class="sim-header" onclick="this.parentElement.classList.toggle('collapsed')">
      <div class="sim-header-title">
        <span class="sim-badge">Vol 1 • Ch 4–5</span>
        <span>General Formula: C–M–C vs M–C–M' &amp; The Circulation Fallacy</span>
      </div>
      <span class="sim-toggle-icon">▼</span>
    </div>
    <div class="sim-content">
      <div class="sim-presets-slot"></div>
      <div class="sim-grid">
        <div class="sim-controls-pane">
          <div class="sim-control-group">
            <label style="font-weight:600;display:block;margin-bottom:0.4rem;font-size:0.85rem;">Circulation Motion:</label>
            <div style="display:flex;gap:0.4rem;">
              <button type="button" class="sim-preset-btn active" id="gfc-mode-cmc">C–M–C (Selling to Buy)</button>
              <button type="button" class="sim-preset-btn" id="gfc-mode-mcm">M–C–M' (Capital)</button>
            </div>
          </div>
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Initial Advance Value:</span>
              <span class="sim-val-display" id="gfc-adv-val">£100</span>
            </div>
            <input type="range" class="sim-slider" id="gfc-adv" min="20" max="300" step="10" value="100">
          </div>
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Market Trade Mark-up / Surcharge:</span>
              <span class="sim-val-display" id="gfc-markup-val">15%</span>
            </div>
            <input type="range" class="sim-slider" id="gfc-markup" min="0" max="50" step="5" value="15">
          </div>
        </div>
        <div class="sim-visuals-pane">
          <div class="sim-metric-grid" style="grid-template-columns:1fr 1fr;margin-bottom:0.75rem;">
            <div class="sim-metric-card">
              <div class="sim-metric-label" id="gfc-metric1-label">Qualitative Outcome</div>
              <div class="sim-metric-val" id="gfc-metric1-val" style="font-size:1.1rem;">Different Use-Value</div>
              <div style="font-size:0.75rem;color:var(--text-muted);" id="gfc-metric1-sub">Corn → Money → Clothes</div>
            </div>
            <div class="sim-metric-card">
              <div class="sim-metric-label">Net Social Surplus-Value</div>
              <div class="sim-metric-val" id="gfc-metric2-val">£0.00</div>
              <div style="font-size:0.75rem;color:var(--text-muted);" id="gfc-metric2-sub">Zero net gain in circulation</div>
            </div>
          </div>
          <div style="background:var(--callout-bg);padding:0.8rem;border-radius:8px;border:1px solid var(--border-color);font-size:0.85rem;" id="gfc-narrative-box">
          </div>
        </div>
      </div>
    </div>
  `;

  let mode = 'cmc';
  const presets = [
    { label: "Simple Commodity Circulation (C-M-C)", values: { mode: 'cmc', adv: 100, markup: 0 } },
    { label: "Mercantilist Surcharge Fallacy", values: { mode: 'mcm', adv: 100, markup: 20 } },
    { label: "Industrial Valorization with Labour", values: { mode: 'mcm', adv: 100, markup: 30 } }
  ];

  const presetsSlot = card.querySelector('.sim-presets-slot');
  presetsSlot.appendChild(createPresetsBar(presets, (vals) => {
    mode = vals.mode;
    card.querySelector('#gfc-adv').value = vals.adv;
    card.querySelector('#gfc-markup').value = vals.markup;
    updateButtons();
    update();
  }));

  const content = card.querySelector('.sim-content');
  content.appendChild(createProofDrawer({
    mathHtml: '$$C - M - C \\rightarrow \\Delta M = 0; \\quad M - C - M\' \\rightarrow M\' = M + \\Delta M \\text{ (Impossible from trade mark-ups alone)}$$',
    explanation: 'If sellers charge 10% above value, they win £10 as sellers, but immediately lose £10 when they purchase other commodities from fellow sellers. Buying cheap and selling dear merely redistributes existing value between parties like gambling. True surplus-value cannot originate in circulation alone, yet without circulation capital cannot buy the unique value-creating commodity: labour-power.',
    quote: 'Circulation, or the exchange of commodities, creates no value... Capital cannot arise from circulation, and it is equally impossible for it to arise apart from circulation.',
    citation: 'Das Kapital, Volume 1, Chapter 5'
  }));

  function updateButtons() {
    card.querySelector('#gfc-mode-cmc').classList.toggle('active', mode === 'cmc');
    card.querySelector('#gfc-mode-mcm').classList.toggle('active', mode === 'mcm');
  }

  card.querySelector('#gfc-mode-cmc').addEventListener('click', () => { mode = 'cmc'; updateButtons(); update(); });
  card.querySelector('#gfc-mode-mcm').addEventListener('click', () => { mode = 'mcm'; updateButtons(); update(); });

  const advInput = card.querySelector('#gfc-adv');
  const markupInput = card.querySelector('#gfc-markup');

  advInput.addEventListener('input', update);
  markupInput.addEventListener('input', update);

  function update() {
    const M = parseFloat(advInput.value) || 100;
    const markup = parseFloat(markupInput.value) || 15;

    card.querySelector('#gfc-adv-val').textContent = '£' + M;
    card.querySelector('#gfc-markup-val').textContent = markup + '%';

    const m1Label = card.querySelector('#gfc-metric1-label');
    const m1Val = card.querySelector('#gfc-metric1-val');
    const m1Sub = card.querySelector('#gfc-metric1-sub');
    const m2Val = card.querySelector('#gfc-metric2-val');
    const m2Sub = card.querySelector('#gfc-metric2-sub');
    const nBox = card.querySelector('#gfc-narrative-box');

    if (mode === 'cmc') {
      m1Label.textContent = 'Qualitative Aim';
      m1Val.textContent = 'Use-Value Consumption';
      m1Sub.textContent = 'Corn → Money → Coat';
      m2Val.textContent = '£0.00 (Equivalence)';
      m2Sub.textContent = 'Money is spent once and for all';
      nBox.innerHTML = `<strong>🌾 C–M–C (Selling in Order to Buy):</strong> The producer sells a commodity they do not need (£${M}) to obtain a different commodity they need. The circuit has a natural terminus in consumption: <em>use-value is the final cause</em>. No surplus-value is sought or created.`;
    } else {
      const nominalMPrime = M * (1 + markup / 100);
      m1Label.textContent = 'Quantitative Aim';
      m1Val.textContent = `M' = £${nominalMPrime.toFixed(0)}`;
      m1Sub.textContent = `Apparent increment +£${(nominalMPrime - M).toFixed(0)}`;
      m2Val.textContent = markup > 0 ? '£0.00 (Social Net)' : '£0.00';
      m2Sub.textContent = 'Markups cancel out across society';
      nBox.innerHTML = `<strong>💰 M–C–M' (Buying in Order to Sell):</strong> If capitalist A marks up commodities by ${markup}%, they withdraw £${nominalMPrime.toFixed(0)}. But Capitalist B and C do the same: A loses that entire gain when replenishing stock! <em>"The sum of the values in circulation cannot be increased by any change in their distribution."</em> The secret of M' lies outside circulation in the purchase of <strong>labour-power</strong>.`;
    }
  }

  update();
  return card;
}

// 4. Value of Labour-Power & Subsistence Basket Amortization (Vol 1 Ch 6)
function buildLabourPowerValueSimulator() {
  const card = document.createElement('div');
  card.className = 'interactive-simulator-card';
  card.innerHTML = `
    <div class="sim-header" onclick="this.parentElement.classList.toggle('collapsed')">
      <div class="sim-header-title">
        <span class="sim-badge">Vol 1 • Ch 6</span>
        <span>Value of Labour-Power &amp; Subsistence Basket Amortization</span>
      </div>
      <span class="sim-toggle-icon">▼</span>
    </div>
    <div class="sim-content">
      <div class="sim-presets-slot"></div>
      <div class="sim-grid">
        <div class="sim-controls-pane">
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Food &amp; Daily Physical Needs:</span>
              <span class="sim-val-display" id="lp-food-val">2.0 shillings</span>
            </div>
            <input type="range" class="sim-slider" id="lp-food" min="0.5" max="5.0" step="0.25" value="2.0">
          </div>
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Housing, Fuel &amp; Clothing (daily share):</span>
              <span class="sim-val-display" id="lp-shelter-val">1.0 shilling</span>
            </div>
            <input type="range" class="sim-slider" id="lp-shelter" min="0.25" max="3.0" step="0.25" value="1.0">
          </div>
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Family Procreation &amp; Child-Rearing:</span>
              <span class="sim-val-display" id="lp-family-val">0.75 shillings</span>
            </div>
            <input type="range" class="sim-slider" id="lp-family" min="0.25" max="2.5" step="0.25" value="0.75">
          </div>
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Education &amp; Training Amortization:</span>
              <span class="sim-val-display" id="lp-edu-val">0.25 shillings</span>
            </div>
            <input type="range" class="sim-slider" id="lp-edu" min="0.0" max="2.0" step="0.25" value="0.25">
          </div>
        </div>
        <div class="sim-visuals-pane">
          <div class="sim-metric-grid" style="grid-template-columns:1fr 1fr;margin-bottom:0.75rem;">
            <div class="sim-metric-card">
              <div class="sim-metric-label">Daily Value of Labour-Power (V)</div>
              <div class="sim-metric-val" id="lp-total-val">4.00s</div>
              <div style="font-size:0.75rem;color:var(--text-muted);">Necessary subsistence fund</div>
            </div>
            <div class="sim-metric-card">
              <div class="sim-metric-label">Necessary Labour Time (at 0.5s/hr)</div>
              <div class="sim-metric-val" id="lp-hours-val">8.0 hrs</div>
              <div style="font-size:0.75rem;color:var(--text-muted);" id="lp-hours-sub">Hours to reproduce wage</div>
            </div>
          </div>
          <div style="background:var(--callout-bg);padding:0.8rem;border-radius:8px;border:1px solid var(--border-color);font-size:0.85rem;" id="lp-basket-narrative">
          </div>
        </div>
      </div>
    </div>
  `;

  const presets = [
    { label: "Victorian Mill Hand (Ch 7)", values: { food: 1.75, shelter: 0.75, family: 0.40, edu: 0.10 } },
    { label: "Agricultural Labourer (Minimum)", values: { food: 1.20, shelter: 0.40, family: 0.30, edu: 0.00 } },
    { label: "Skilled Artisan (Expanded Moral Needs)", values: { food: 2.50, shelter: 1.50, family: 1.00, edu: 0.75 } }
  ];

  const presetsSlot = card.querySelector('.sim-presets-slot');
  presetsSlot.appendChild(createPresetsBar(presets, (vals) => {
    card.querySelector('#lp-food').value = vals.food;
    card.querySelector('#lp-shelter').value = vals.shelter;
    card.querySelector('#lp-family').value = vals.family;
    card.querySelector('#lp-edu').value = vals.edu;
    update();
  }));

  const content = card.querySelector('.sim-content');
  content.appendChild(createProofDrawer({
    mathHtml: '$$V_{\\text{lp}} = \\sum_{i} \\frac{P_i \\cdot Q_i}{D_i} + \\text{Historical/Moral Element}$$',
    explanation: 'The value of labour-power is determined by the labour-time necessary for the worker\'s subsistence. Unlike other commodities, its value contains a historical and moral element depending on civilization, habits, and class struggle. It covers not just the worker\'s individual daily sustenance, but the maintenance of their children (the next generation of wage-labourers) and education costs for skilled trades.',
    quote: 'The value of labour-power is resolved into the value of a definite quantity of the means of subsistence. It therefore varies with the value of these means of subsistence, i.e. with the quantity of labour-time required to produce them.',
    citation: 'Das Kapital, Volume 1, Chapter 6'
  }));

  const fIn = card.querySelector('#lp-food');
  const sIn = card.querySelector('#lp-shelter');
  const famIn = card.querySelector('#lp-family');
  const eIn = card.querySelector('#lp-edu');

  [fIn, sIn, famIn, eIn].forEach(inp => inp.addEventListener('input', update));

  function update() {
    const food = parseFloat(fIn.value) || 2.0;
    const shelter = parseFloat(sIn.value) || 1.0;
    const fam = parseFloat(famIn.value) || 0.75;
    const edu = parseFloat(eIn.value) || 0.25;

    const totalS = food + shelter + fam + edu;
    const hours = (totalS / 0.5).toFixed(1);

    card.querySelector('#lp-food-val').textContent = food.toFixed(2) + 's';
    card.querySelector('#lp-shelter-val').textContent = shelter.toFixed(2) + 's';
    card.querySelector('#lp-family-val').textContent = fam.toFixed(2) + 's';
    card.querySelector('#lp-edu-val').textContent = edu.toFixed(2) + 's';

    card.querySelector('#lp-total-val').textContent = totalS.toFixed(2) + 's';
    card.querySelector('#lp-hours-val').textContent = hours + ' hrs';
    card.querySelector('#lp-hours-sub').textContent = `Assuming 1 hr living labour = 0.5 shillings`;

    const nBox = card.querySelector('#lp-basket-narrative');
    nBox.innerHTML = `
      <div style="font-weight:600;margin-bottom:0.3rem;">Decomposition of the Daily Labour-Fund:</div>
      <div>• Physical Nutrition: <strong>${((food/totalS)*100).toFixed(0)}%</strong> | Shelter & Fuel: <strong>${((shelter/totalS)*100).toFixed(0)}%</strong></div>
      <div>• Generational Procreation: <strong>${((fam/totalS)*100).toFixed(0)}%</strong> | Training & Skills: <strong>${((edu/totalS)*100).toFixed(0)}%</strong></div>
      <div style="margin-top:0.4rem;color:var(--text-muted);font-size:0.8rem;">In a 12-hour working day, the worker reproduces their own subsistence in <strong>${hours} hours</strong>; the remaining <strong>${Math.max(0, 12 - hours).toFixed(1)} hours</strong> constitute pure unpaid surplus-value.</div>
    `;
  }

  update();
  return card;
}

// 5. Wage Mystification: Time-Wages vs Piece-Wages & The Speed-Up Trap (Vol 1 Ch 19-21)
function buildWageMystificationSimulator() {
  const card = document.createElement('div');
  card.className = 'interactive-simulator-card';
  card.innerHTML = `
    <div class="sim-header" onclick="this.parentElement.classList.toggle('collapsed')">
      <div class="sim-header-title">
        <span class="sim-badge">Vol 1 • Ch 19–21</span>
        <span>The Wage Mystification: Time-Wages vs Piece-Wages &amp; The Speed-Up Trap</span>
      </div>
      <span class="sim-toggle-icon">▼</span>
    </div>
    <div class="sim-content">
      <div class="sim-presets-slot"></div>
      <div class="sim-grid">
        <div class="sim-controls-pane">
          <div class="sim-control-group">
            <label style="font-weight:600;display:block;margin-bottom:0.4rem;font-size:0.85rem;">Wage Form:</label>
            <div style="display:flex;gap:0.4rem;">
              <button type="button" class="sim-preset-btn active" id="wm-mode-time">Time-Wage (Hourly)</button>
              <button type="button" class="sim-preset-btn" id="wm-mode-piece">Piece-Wage (Per-Item)</button>
            </div>
          </div>
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Working Day Duration:</span>
              <span class="sim-val-display" id="wm-hours-val">10 hrs</span>
            </div>
            <input type="range" class="sim-slider" id="wm-hours" min="8" max="16" step="1" value="10">
          </div>
          <div class="sim-control-group" id="wm-speedup-group">
            <div class="sim-label-row">
              <span>Worker Intensity / Speed-Up Factor:</span>
              <span class="sim-val-display" id="wm-speedup-val">100% (Normal)</span>
            </div>
            <input type="range" class="sim-slider" id="wm-speedup" min="100" max="220" step="10" value="100">
          </div>
          <div class="sim-control-group" id="wm-cut-group">
            <div class="sim-label-row">
              <span>Capitalist Piece-Rate Revision (Post-Speedup):</span>
              <span class="sim-val-display" id="wm-cut-val">0% (Uncut)</span>
            </div>
            <input type="range" class="sim-slider" id="wm-cut" min="0" max="50" step="5" value="0">
          </div>
        </div>
        <div class="sim-visuals-pane">
          <div class="sim-metric-grid" style="grid-template-columns:1fr 1fr;margin-bottom:0.75rem;">
            <div class="sim-metric-card">
              <div class="sim-metric-label">Worker Daily Pay</div>
              <div class="sim-metric-val" id="wm-pay-val">4.00s</div>
              <div style="font-size:0.75rem;color:var(--text-muted);" id="wm-pay-sub">40d total wage</div>
            </div>
            <div class="sim-metric-card">
              <div class="sim-metric-label">Surplus-Value Rate (s')</div>
              <div class="sim-metric-val" id="wm-rate-val">100%</div>
              <div style="font-size:0.75rem;color:var(--text-muted);" id="wm-rate-sub">Paid: 5h | Unpaid: 5h</div>
            </div>
          </div>
          <div style="background:var(--callout-bg);padding:0.8rem;border-radius:8px;border:1px solid var(--border-color);font-size:0.85rem;" id="wm-narrative-box">
          </div>
        </div>
      </div>
    </div>
  `;

  let mode = 'time';
  const presets = [
    { label: "Normal 10-Hour Day (Time)", values: { mode: 'time', hours: 10, speed: 100, cut: 0 } },
    { label: "Overtime Day Lengthening (14h)", values: { mode: 'time', hours: 14, speed: 100, cut: 0 } },
    { label: "Piece-Wage Speed-Up Trap (150% output, 30% cut)", values: { mode: 'piece', hours: 10, speed: 150, cut: 30 } }
  ];

  const presetsSlot = card.querySelector('.sim-presets-slot');
  presetsSlot.appendChild(createPresetsBar(presets, (vals) => {
    mode = vals.mode;
    card.querySelector('#wm-hours').value = vals.hours;
    card.querySelector('#wm-speedup').value = vals.speed;
    card.querySelector('#wm-cut').value = vals.cut;
    updateButtons();
    update();
  }));

  const content = card.querySelector('.sim-content');
  content.appendChild(createProofDrawer({
    mathHtml: '$$\\text{Time Wage: } P_l = \\frac{V}{T}; \\quad \\text{Piece Wage: } P_p = \\frac{W_{\\text{day}}}{Q_{\\text{normal}}} \\rightarrow P_p^{\\text{revised}} = \\frac{W_{\\text{subsistence}}}{Q_{\\text{intensified}}}$$',
    explanation: 'The wage form disguises necessary labour as payment for all labour performed. Under piece-wages, the piece price is merely the time-wage in disguise. When workers exert intense energy to increase their piece earnings, the capitalist responds by reducing the price per piece on the grounds that output is now higher. The worker ends up working with exhausting intensity while returning to the original subsistence day wage.',
    quote: 'The wage-form thus extinguishes every trace of the division of the working day into necessary labour and surplus labour, into paid labour and unpaid labour... Piece-wages become, from this point of view, the most fruitful source of reductions in wages.',
    citation: 'Das Kapital, Volume 1, Chapters 19 & 21'
  }));

  function updateButtons() {
    card.querySelector('#wm-mode-time').classList.toggle('active', mode === 'time');
    card.querySelector('#wm-mode-piece').classList.toggle('active', mode === 'piece');
  }

  card.querySelector('#wm-mode-time').addEventListener('click', () => { mode = 'time'; updateButtons(); update(); });
  card.querySelector('#wm-mode-piece').addEventListener('click', () => { mode = 'piece'; updateButtons(); update(); });

  const hIn = card.querySelector('#wm-hours');
  const sIn = card.querySelector('#wm-speedup');
  const cIn = card.querySelector('#wm-cut');

  [hIn, sIn, cIn].forEach(inp => inp.addEventListener('input', update));

  function update() {
    const hours = parseFloat(hIn.value) || 10;
    const speed = parseFloat(sIn.value) || 100;
    const cut = parseFloat(cIn.value) || 0;

    card.querySelector('#wm-hours-val').textContent = hours + ' hrs';
    card.querySelector('#wm-speedup-val').textContent = speed + '%';
    card.querySelector('#wm-cut-val').textContent = cut + '% cut';

    // Baseline: 5h necessary labour (2.5s wage), 10h day -> 5h surplus (s' = 100%)
    const necessaryHours = 5.0;
    const basePieceRate = 2.5 / 20; // 0.125s per piece (20 pieces in 10h)
    let dailyPay = 0;
    let sPrime = 0;
    let paidH = 0;
    let unpaidH = 0;

    const nBox = card.querySelector('#wm-narrative-box');

    if (mode === 'time') {
      // Time wage: Fixed day pay 2.5s for normal day, or small nominal addition for overtime
      paidH = necessaryHours;
      unpaidH = hours - necessaryHours;
      sPrime = (unpaidH / paidH) * 100;
      dailyPay = 2.5 + (hours > 10 ? (hours - 10) * 0.2 : 0);
      const hourlyPrice = dailyPay / hours;

      card.querySelector('#wm-pay-val').textContent = dailyPay.toFixed(2) + 's';
      card.querySelector('#wm-pay-sub').textContent = `Nominal rate: ${(hourlyPrice*12).toFixed(1)}d / hr`;
      card.querySelector('#wm-rate-val').textContent = sPrime.toFixed(0) + '%';
      card.querySelector('#wm-rate-sub').textContent = `Paid: ${paidH.toFixed(1)}h | Unpaid: ${unpaidH.toFixed(1)}h`;

      nBox.innerHTML = `<strong>⏰ Time-Wage Mystification:</strong> The worker appears to be paid for <em>all ${hours} hours</em>. In reality, their wage only equals ${necessaryHours} hours of subsistence labour. The lengthening of the day from 10 to ${hours} hours raises surplus-value extraction to <strong>${sPrime.toFixed(0)}%</strong> while driving down the real hourly price of labour to ${(hourlyPrice*12).toFixed(1)}d.`;
    } else {
      // Piece wage: Output scales with hours and speedup
      const output = 20 * (hours / 10) * (speed / 100);
      const effectivePieceRate = basePieceRate * (1 - cut / 100);
      dailyPay = output * effectivePieceRate;
      const valueCreated = (hours * (speed / 100)) * 0.5; // Value in shillings
      const surplus = Math.max(0, valueCreated - dailyPay);
      sPrime = (surplus / (dailyPay || 1)) * 100;

      card.querySelector('#wm-pay-val').textContent = dailyPay.toFixed(2) + 's';
      card.querySelector('#wm-pay-sub').textContent = `Output: ${Math.round(output)} pieces`;
      card.querySelector('#wm-rate-val').textContent = sPrime.toFixed(0) + '%';
      card.querySelector('#wm-rate-sub').textContent = `Net Surplus: +${surplus.toFixed(2)}s`;

      nBox.innerHTML = `<strong>⚙️ The Piece-Rate Speed-Up Trap:</strong> By exerting ${speed}% intensity, the worker produced <strong>${Math.round(output)} articles</strong>. ${cut > 0 ? `The employer responded with a <strong>${cut}% piece-rate cut</strong>, reducing earnings back toward the original baseline.` : 'If the capitalist cuts piece rates, the worker will be forced to maintain this exhausting speed just to survive.'} Rate of surplus-value extracted: <strong>${sPrime.toFixed(0)}%</strong>.`;
    }
  }

  update();
  return card;
}

// 6. National Differences in Wages & International Exploitation (Vol 1 Ch 22)
function buildNationalWagesSimulator() {
  const card = document.createElement('div');
  card.className = 'interactive-simulator-card';
  card.innerHTML = `
    <div class="sim-header" onclick="this.parentElement.classList.toggle('collapsed')">
      <div class="sim-header-title">
        <span class="sim-badge">Vol 1 • Ch 22</span>
        <span>National Differences in Wages &amp; International Exploitation</span>
      </div>
      <span class="sim-toggle-icon">▼</span>
    </div>
    <div class="sim-content">
      <div class="sim-presets-slot"></div>
      <div class="sim-grid">
        <div class="sim-controls-pane">
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Nation A (Developed) Productivity:</span>
              <span class="sim-val-display" id="nw-prodA-val">2.0x</span>
            </div>
            <input type="range" class="sim-slider" id="nw-prodA" min="1.0" max="3.0" step="0.25" value="2.0">
          </div>
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Nation A Nominal Daily Wage:</span>
              <span class="sim-val-display" id="nw-wageA-val">6.0s</span>
            </div>
            <input type="range" class="sim-slider" id="nw-wageA" min="3.0" max="10.0" step="0.5" value="6.0">
          </div>
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Nation B (Developing) Productivity:</span>
              <span class="sim-val-display" id="nw-prodB-val">1.0x</span>
            </div>
            <input type="range" class="sim-slider" id="nw-prodB" min="0.5" max="1.5" step="0.25" value="1.0">
          </div>
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Nation B Nominal Daily Wage:</span>
              <span class="sim-val-display" id="nw-wageB-val">2.5s</span>
            </div>
            <input type="range" class="sim-slider" id="nw-wageB" min="1.0" max="4.0" step="0.5" value="2.5">
          </div>
        </div>
        <div class="sim-visuals-pane">
          <div class="sim-metric-grid" style="grid-template-columns:1fr 1fr;margin-bottom:0.75rem;">
            <div class="sim-metric-card">
              <div class="sim-metric-label">Nation A Exploitation (s')</div>
              <div class="sim-metric-val" id="nw-rateA-val">100%</div>
              <div style="font-size:0.75rem;color:var(--text-muted);" id="nw-unitA-sub">Unit Cost: 0.50s</div>
            </div>
            <div class="sim-metric-card">
              <div class="sim-metric-label">Nation B Exploitation (s')</div>
              <div class="sim-metric-val" id="nw-rateB-val">60%</div>
              <div style="font-size:0.75rem;color:var(--text-muted);" id="nw-unitB-sub">Unit Cost: 0.83s</div>
            </div>
          </div>
          <div style="background:var(--callout-bg);padding:0.8rem;border-radius:8px;border:1px solid var(--border-color);font-size:0.85rem;" id="nw-verdict-box">
          </div>
        </div>
      </div>
    </div>
  `;

  const presets = [
    { label: "Marx's 1860s Anglo-German Comparison", values: { prodA: 2.0, wageA: 6.0, prodB: 1.0, wageB: 2.5 } },
    { label: "High-Tech Modern vs Low-Wage Periphery", values: { prodA: 3.0, wageA: 8.0, prodB: 0.75, wageB: 1.5 } }
  ];

  const presetsSlot = card.querySelector('.sim-presets-slot');
  presetsSlot.appendChild(createPresetsBar(presets, (vals) => {
    card.querySelector('#nw-prodA').value = vals.prodA;
    card.querySelector('#nw-wageA').value = vals.wageA;
    card.querySelector('#nw-prodB').value = vals.prodB;
    card.querySelector('#nw-wageB').value = vals.wageB;
    update();
  }));

  const content = card.querySelector('.sim-content');
  content.appendChild(createProofDrawer({
    mathHtml: '$$s\'_A = \\frac{T_A - V_A}{V_A} \\quad \\text{vs} \\quad s\'_B = \\frac{T_B - V_B}{V_B}; \\quad \\text{Relative Wage} = \\frac{V}{V + S}$$',
    explanation: 'A higher nominal wage in an advanced nation does not mean lower exploitation. Because the productive power and intensity of labour are higher, the worker reproduces their higher basket of subsistence in a shorter fraction of the working day. Hence, the more developed nation often combines higher money wages with a HIGHER rate of surplus-value and a LOWER relative price of labour.',
    quote: 'It frequently happens that the daily or weekly wage is higher in the first nation, but the relative price of labour... is much higher in the second than in the first, because the productivity of labour is so much lower.',
    citation: 'Das Kapital, Volume 1, Chapter 22'
  }));

  const pAIn = card.querySelector('#nw-prodA');
  const wAIn = card.querySelector('#nw-wageA');
  const pBIn = card.querySelector('#nw-prodB');
  const wBIn = card.querySelector('#nw-wageB');

  [pAIn, wAIn, pBIn, wBIn].forEach(inp => inp.addEventListener('input', update));

  function update() {
    const prodA = parseFloat(pAIn.value) || 2.0;
    const wageA = parseFloat(wAIn.value) || 6.0;
    const prodB = parseFloat(pBIn.value) || 1.0;
    const wageB = parseFloat(wBIn.value) || 2.5;

    card.querySelector('#nw-prodA-val').textContent = prodA.toFixed(2) + 'x';
    card.querySelector('#nw-wageA-val').textContent = wageA.toFixed(1) + 's';
    card.querySelector('#nw-prodB-val').textContent = prodB.toFixed(2) + 'x';
    card.querySelector('#nw-wageB-val').textContent = wageB.toFixed(1) + 's';

    // 10-hour working day: In A, 1 day of complex/intense labour counts as 10 * prodA hours of simple labour
    const valCreatedA = 10 * prodA * 0.6; // shillings of value
    const valCreatedB = 10 * prodB * 0.6;
    const surplusA = Math.max(0, valCreatedA - wageA);
    const surplusB = Math.max(0, valCreatedB - wageB);
    const sPrimeA = (surplusA / wageA) * 100;
    const sPrimeB = (surplusB / wageB) * 100;

    const unitCostA = (wageA / (20 * prodA)).toFixed(2);
    const unitCostB = (wageB / (20 * prodB)).toFixed(2);

    card.querySelector('#nw-rateA-val').textContent = sPrimeA.toFixed(0) + '%';
    card.querySelector('#nw-unitA-sub').textContent = `Wage Cost / Unit: ${unitCostA}s`;
    card.querySelector('#nw-rateB-val').textContent = sPrimeB.toFixed(0) + '%';
    card.querySelector('#nw-unitB-sub').textContent = `Wage Cost / Unit: ${unitCostB}s`;

    const vBox = card.querySelector('#nw-verdict-box');
    vBox.innerHTML = `
      <strong>🌍 Marx's Counter-Intuitive Law Verified:</strong><br>
      Nation A's worker earns <strong>£${(wageA/wageB).toFixed(1)}x higher nominal wages</strong> than Nation B. Yet Nation A's rate of surplus-value is <strong>${sPrimeA.toFixed(0)}% vs ${sPrimeB.toFixed(0)}%</strong>, and its unit labour cost is <strong>cheaper (${unitCostA}s vs ${unitCostB}s)</strong>. Capitalists in the advanced nation extract more unpaid labour while paying higher wages!
    `;
  }

  update();
  return card;
}

// 7. Wakefield's Swan River Colony & Preconditions of Capital (Vol 1 Ch 33)
function buildWakefieldColonizationSimulator() {
  const card = document.createElement('div');
  card.className = 'interactive-simulator-card';
  card.innerHTML = `
    <div class="sim-header" onclick="this.parentElement.classList.toggle('collapsed')">
      <div class="sim-header-title">
        <span class="sim-badge">Vol 1 • Ch 33</span>
        <span>Wakefield's Colonization Paradox &amp; The "Sufficient Price" of Land</span>
      </div>
      <span class="sim-toggle-icon">▼</span>
    </div>
    <div class="sim-content">
      <div class="sim-presets-slot"></div>
      <div class="sim-grid">
        <div class="sim-controls-pane">
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Artificial Crown Land Price / Acre:</span>
              <span class="sim-val-display" id="wf-price-val">£2.0 / acre</span>
            </div>
            <input type="range" class="sim-slider" id="wf-price" min="0" max="15" step="0.5" value="2.0">
          </div>
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Daily Wage Rate:</span>
              <span class="sim-val-display" id="wf-wage-val">4.0 shillings</span>
            </div>
            <input type="range" class="sim-slider" id="wf-wage" min="2" max="10" step="0.5" value="4.0">
          </div>
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Worker Annual Savings Rate:</span>
              <span class="sim-val-display" id="wf-save-val">20%</span>
            </div>
            <input type="range" class="sim-slider" id="wf-save" min="5" max="40" step="5" value="20">
          </div>
        </div>
        <div class="sim-visuals-pane">
          <div class="sim-metric-grid" style="grid-template-columns:1fr 1fr;margin-bottom:0.75rem;">
            <div class="sim-metric-card">
              <div class="sim-metric-label">Years of Wage-Labour to Buy Farm</div>
              <div class="sim-metric-val" id="wf-years-val">4.2 yrs</div>
              <div style="font-size:0.75rem;color:var(--text-muted);" id="wf-years-sub">Minimum servitude horizon</div>
            </div>
            <div class="sim-metric-card">
              <div class="sim-metric-label">Capitalist Exploitation Viability</div>
              <div class="sim-metric-val" id="wf-viability-val">Stable</div>
              <div style="font-size:0.75rem;color:var(--text-muted);" id="wf-viability-sub">Wage discipline secured</div>
            </div>
          </div>
          <div style="background:var(--callout-bg);padding:0.8rem;border-radius:8px;border:1px solid var(--border-color);font-size:0.85rem;" id="wf-narrative-box">
          </div>
        </div>
      </div>
    </div>
  `;

  const presets = [
    { label: "Mr. Peel's Swan River Fiasco (£0 Free Land)", values: { price: 0, wage: 5, save: 20 } },
    { label: "Wakefield's 'Sufficient Price' Policy (£5/acre)", values: { price: 5, wage: 4, save: 15 } },
    { label: "Colonial Wage Squeeze (£10/acre)", values: { price: 10, wage: 3, save: 10 } }
  ];

  const presetsSlot = card.querySelector('.sim-presets-slot');
  presetsSlot.appendChild(createPresetsBar(presets, (vals) => {
    card.querySelector('#wf-price').value = vals.price;
    card.querySelector('#wf-wage').value = vals.wage;
    card.querySelector('#wf-save').value = vals.save;
    update();
  }));

  const content = card.querySelector('.sim-content');
  content.appendChild(createProofDrawer({
    mathHtml: '$$T_{\\text{servitude}} = \\frac{\\text{Acres} \\times P_{\\text{land}}}{\\text{Annual Savings}} \\iff P_{\\text{land}} = 0 \\rightarrow T = 0 \\rightarrow \\text{Capital Abolished}$$',
    explanation: 'Wakefield discovered the profound open secret of political economy: money and means of production are NOT capital in themselves. They only become capital when confronting a propertyless worker forced to sell labour-power. When workers in the colonies can easily access free land, wage-labour instantly dissolves, and capital ceases to exist.',
    quote: 'Unhappy Mr Peel, who provided for everything except the export of English relations of production to the Swan River! A negro is a negro. In certain relations he becomes a slave. A mule is a machine for spinning cotton. Only in certain relations does it become capital.',
    citation: 'Das Kapital, Volume 1, Chapter 33'
  }));

  const prIn = card.querySelector('#wf-price');
  const wIn = card.querySelector('#wf-wage');
  const sIn = card.querySelector('#wf-save');

  [prIn, wIn, sIn].forEach(inp => inp.addEventListener('input', update));

  function update() {
    const pricePerAcre = parseFloat(prIn.value) || 0;
    const dailyWage = parseFloat(wIn.value) || 4.0;
    const savePct = parseFloat(sIn.value) || 20;

    card.querySelector('#wf-price-val').textContent = '£' + pricePerAcre.toFixed(1) + ' / acre';
    card.querySelector('#wf-wage-val').textContent = dailyWage.toFixed(1) + ' shillings';
    card.querySelector('#wf-save-val').textContent = savePct + '%';

    // 25 acre homestead farm cost: 25 * price
    const farmCost = 25 * pricePerAcre;
    const annualWages = (dailyWage * 300) / 20; // in £
    const annualSavings = annualWages * (savePct / 100);
    const years = annualSavings > 0 ? farmCost / annualSavings : 99;

    const yVal = card.querySelector('#wf-years-val');
    const vVal = card.querySelector('#wf-viability-val');
    const nBox = card.querySelector('#wf-narrative-box');

    if (pricePerAcre <= 0.5) {
      yVal.textContent = '0.0 yrs (Instant)';
      vVal.textContent = '💥 Total Collapse';
      vVal.style.color = 'var(--danger, #e53e3e)';
      nBox.innerHTML = `<strong>🏝️ Mr. Peel's Swan River Catastrophe (1829):</strong> Mr. Peel brought £50,000 in capital and 3,000 workers to Western Australia. But because fertile land was free, <em>all 3,000 workers walked off immediately</em> to establish independent homesteads! Peel was left without a single servant to make his bed or fetch him water from the river.`;
    } else if (years < 3) {
      yVal.textContent = years.toFixed(1) + ' yrs';
      vVal.textContent = '⚠️ Precarious';
      vVal.style.color = '#dd6b20';
      nBox.innerHTML = `<strong>⚠️ Rapid Emancipation:</strong> Workers can buy a 25-acre freehold in just <strong>${years.toFixed(1)} years</strong>. The capitalist experiences continuous labour shortages, bidding wars, and a breakdown of workshop discipline.`;
    } else {
      yVal.textContent = years.toFixed(1) + ' yrs';
      vVal.textContent = '🛡️ Secure';
      vVal.style.color = '#38a169';
      nBox.innerHTML = `<strong>🏛️ Wakefield's "Sufficient Price" Imposed:</strong> By placing an artificial ransom of £${pricePerAcre.toFixed(1)}/acre on wild land, the state prevents the worker from becoming an independent peasant for <strong>${years.toFixed(1)} years</strong>. The artificial land monopoly forces the worker to remain a wage-slave.`;
    }
  }

  update();
  return card;
}

// 8. Costs of Circulation: Pure Faux Frais vs Transport Continuation (Vol 2 Ch 6)
function buildCirculationCostsSimulator() {
  const card = document.createElement('div');
  card.className = 'interactive-simulator-card';
  card.innerHTML = `
    <div class="sim-header" onclick="this.parentElement.classList.toggle('collapsed')">
      <div class="sim-header-title">
        <span class="sim-badge">Vol 2 • Ch 6</span>
        <span>Costs of Circulation: Pure Faux Frais vs Productive Transport</span>
      </div>
      <span class="sim-toggle-icon">▼</span>
    </div>
    <div class="sim-content">
      <div class="sim-presets-slot"></div>
      <div class="sim-grid">
        <div class="sim-controls-pane">
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Gross Surplus-Value Produced (S):</span>
              <span class="sim-val-display" id="cc-surplus-val">£50,000</span>
            </div>
            <input type="range" class="sim-slider" id="cc-surplus" min="10000" max="100000" step="5000" value="50000">
          </div>
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Pure Buying &amp; Selling Costs (Faux Frais):</span>
              <span class="sim-val-display" id="cc-sales-val">£8,000</span>
            </div>
            <input type="range" class="sim-slider" id="cc-sales" min="1000" max="25000" step="1000" value="8000">
          </div>
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Bookkeeping &amp; Cashier Overhead:</span>
              <span class="sim-val-display" id="cc-book-val">£4,000</span>
            </div>
            <input type="range" class="sim-slider" id="cc-book" min="500" max="15000" step="500" value="4000">
          </div>
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Transport &amp; Preservation (Value-Adding):</span>
              <span class="sim-val-display" id="cc-trans-val">£12,000</span>
            </div>
            <input type="range" class="sim-slider" id="cc-trans" min="2000" max="30000" step="1000" value="12000">
          </div>
        </div>
        <div class="sim-visuals-pane">
          <div class="sim-metric-grid" style="grid-template-columns:1fr 1fr;margin-bottom:0.75rem;">
            <div class="sim-metric-card">
              <div class="sim-metric-label">Unproductive Deduction (Faux Frais)</div>
              <div class="sim-metric-val" id="cc-deduct-val" style="color:var(--danger, #e53e3e);">£12,000</div>
              <div style="font-size:0.75rem;color:var(--text-muted);">Lost from surplus-value</div>
            </div>
            <div class="sim-metric-card">
              <div class="sim-metric-label">Net Realized Surplus-Value</div>
              <div class="sim-metric-val" id="cc-net-val">£38,000</div>
              <div style="font-size:0.75rem;color:var(--text-muted);" id="cc-net-sub">76.0% retention</div>
            </div>
          </div>
          <div style="background:var(--callout-bg);padding:0.8rem;border-radius:8px;border:1px solid var(--border-color);font-size:0.85rem;" id="cc-narrative-box">
          </div>
        </div>
      </div>
    </div>
  `;

  const presets = [
    { label: "Standard 19th C Industrial Firm", values: { s: 50000, sales: 8000, book: 4000, trans: 12000 } },
    { label: "Bloated Commercial Overhead (High Faux Frais)", values: { s: 50000, sales: 18000, book: 9000, trans: 8000 } },
    { label: "Railway Transport Revolution", values: { s: 75000, sales: 5000, book: 3000, trans: 20000 } }
  ];

  const presetsSlot = card.querySelector('.sim-presets-slot');
  presetsSlot.appendChild(createPresetsBar(presets, (vals) => {
    card.querySelector('#cc-surplus').value = vals.s;
    card.querySelector('#cc-sales').value = vals.sales;
    card.querySelector('#cc-book').value = vals.book;
    card.querySelector('#cc-trans').value = vals.trans;
    update();
  }));

  const content = card.querySelector('.sim-content');
  content.appendChild(createProofDrawer({
    mathHtml: '$$\\text{Net Realized Surplus} = S_{\\text{gross}} - (C_{\\text{selling}} + C_{\\text{bookkeeping}}); \\quad \\text{Transport adds new value: } \\Delta W = C_{\\text{transport}}$$',
    explanation: 'Marx distinguishes costs that merely effect the metamorphosis of value (buying and selling, contracts, money management) from costs of production continuing into circulation (transport, storage). Pure costs of circulation cannot create value or surplus-value; they are deadweight faux frais deducted from the social surplus fund.',
    quote: 'The general law is that all costs of circulation which arise only from changes in the forms of commodities do not add any value to them. They are merely expenses incurred in realizing the value or in converting it from one form into another.',
    citation: 'Das Kapital, Volume 2, Chapter 6'
  }));

  const sIn = card.querySelector('#cc-surplus');
  const slIn = card.querySelector('#cc-sales');
  const bIn = card.querySelector('#cc-book');
  const tIn = card.querySelector('#cc-trans');

  [sIn, slIn, bIn, tIn].forEach(inp => inp.addEventListener('input', update));

  function update() {
    const S = parseFloat(sIn.value) || 50000;
    const sales = parseFloat(slIn.value) || 8000;
    const book = parseFloat(bIn.value) || 4000;
    const trans = parseFloat(tIn.value) || 12000;

    const pureFauxFrais = sales + book;
    const netSurplus = Math.max(0, S - pureFauxFrais);
    const retention = ((netSurplus / S) * 100).toFixed(1);

    card.querySelector('#cc-surplus-val').textContent = '£' + S.toLocaleString();
    card.querySelector('#cc-sales-val').textContent = '£' + sales.toLocaleString();
    card.querySelector('#cc-book-val').textContent = '£' + book.toLocaleString();
    card.querySelector('#cc-trans-val').textContent = '£' + trans.toLocaleString();

    card.querySelector('#cc-deduct-val').textContent = '£' + pureFauxFrais.toLocaleString();
    card.querySelector('#cc-net-val').textContent = '£' + netSurplus.toLocaleString();
    card.querySelector('#cc-net-sub').textContent = `${retention}% retained for accumulation`;

    const nBox = card.querySelector('#cc-narrative-box');
    nBox.innerHTML = `
      <strong>🚚 The Dual Character of Circulation Costs:</strong><br>
      • <strong>Pure Faux Frais:</strong> £${pureFauxFrais.toLocaleString()} is consumed unproductively in marketing and accounting. This is a direct loss of <strong>${(100 - retention).toFixed(1)}%</strong> of produced surplus-value.<br>
      • <strong>Transport:</strong> The £${trans.toLocaleString()} spent on rail/shipping represents productive labour that physically completes the use-value and transfers its own value to the commodities.
    `;
  }

  update();
  return card;
}

// 9. Capitalized Price of Land & Interest-Yield Capitalizer (Vol 3 Ch 46-47)
function buildLandPriceCapitalizerSimulator() {
  const card = document.createElement('div');
  card.className = 'interactive-simulator-card';
  card.innerHTML = `
    <div class="sim-header" onclick="this.parentElement.classList.toggle('collapsed')">
      <div class="sim-header-title">
        <span class="sim-badge">Vol 3 • Ch 46–47</span>
        <span>Capitalized Ground-Rent &amp; Land Price (P = R / i)</span>
      </div>
      <span class="sim-toggle-icon">▼</span>
    </div>
    <div class="sim-content">
      <div class="sim-presets-slot"></div>
      <div class="sim-grid">
        <div class="sim-controls-pane">
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Annual Ground-Rent (R):</span>
              <span class="sim-val-display" id="lp-rent-val">£1,000 / year</span>
            </div>
            <input type="range" class="sim-slider" id="lp-rent" min="200" max="5000" step="100" value="1000">
          </div>
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Prevailing Rate of Interest (i):</span>
              <span class="sim-val-display" id="lp-rate-val">5.0%</span>
            </div>
            <input type="range" class="sim-slider" id="lp-rate" min="1.0" max="8.0" step="0.25" value="5.0">
          </div>
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Fixed Capital Improvements (Drainage/Buildings):</span>
              <span class="sim-val-display" id="lp-fix-val">£3,000</span>
            </div>
            <input type="range" class="sim-slider" id="lp-fix" min="0" max="15000" step="1000" value="3000">
          </div>
        </div>
        <div class="sim-visuals-pane">
          <div class="sim-metric-grid" style="grid-template-columns:1fr 1fr;margin-bottom:0.75rem;">
            <div class="sim-metric-card">
              <div class="sim-metric-label">Capitalized Land Price (P)</div>
              <div class="sim-metric-val" id="lp-price-val">£20,000</div>
              <div style="font-size:0.75rem;color:var(--text-muted);" id="lp-years-sub">20 Years' Purchase</div>
            </div>
            <div class="sim-metric-card">
              <div class="sim-metric-label">Total Real Estate Estate Value</div>
              <div class="sim-metric-val" id="lp-estate-val">£23,000</div>
              <div style="font-size:0.75rem;color:var(--text-muted);">Land + Built Capital</div>
            </div>
          </div>
          <div style="background:var(--callout-bg);padding:0.8rem;border-radius:8px;border:1px solid var(--border-color);font-size:0.85rem;" id="lp-narrative-box">
          </div>
        </div>
      </div>
    </div>
  `;

  const presets = [
    { label: "19th Century British Estate (5% interest)", values: { rent: 1000, rate: 5.0, fix: 4000 } },
    { label: "Modern Low-Rate Speculative Boom (1.5% interest)", values: { rent: 1000, rate: 1.5, fix: 4000 } },
    { label: "High-Interest Slump (7.5% interest)", values: { rent: 1000, rate: 7.5, fix: 4000 } }
  ];

  const presetsSlot = card.querySelector('.sim-presets-slot');
  presetsSlot.appendChild(createPresetsBar(presets, (vals) => {
    card.querySelector('#lp-rent').value = vals.rent;
    card.querySelector('#lp-rate').value = vals.rate;
    card.querySelector('#lp-fix').value = vals.fix;
    update();
  }));

  const content = card.querySelector('.sim-content');
  content.appendChild(createProofDrawer({
    mathHtml: '$$P_{\\text{land}} = \\frac{\\text{Annual Ground-Rent } (R)}{i}; \\quad \\text{Years\' Purchase} = \\frac{1}{i}$$',
    explanation: 'Soil is a natural element and possesses no value in itself (since no human labour is objectified in the earth). Its "price" is an irrational economic category representing nothing other than a capitalized perpetual annuity. If the interest rate falls from 5% to 2.5%, the price of the exact same physical field doubles from £20,000 to £40,000 without a single grain of extra wheat being grown.',
    quote: 'The price of land is nothing other than capitalized rent, and is calculated in advance on the basis of the prevailing rate of interest... It is the purchase price not of the land, but of the ground-rent which it yields.',
    citation: 'Das Kapital, Volume 3, Chapter 46'
  }));

  const rIn = card.querySelector('#lp-rent');
  const rtIn = card.querySelector('#lp-rate');
  const fxIn = card.querySelector('#lp-fix');

  [rIn, rtIn, fxIn].forEach(inp => inp.addEventListener('input', update));

  function update() {
    const rent = parseFloat(rIn.value) || 1000;
    const rate = parseFloat(rtIn.value) || 5.0;
    const fix = parseFloat(fxIn.value) || 3000;

    const landPrice = rent / (rate / 100);
    const yearsPurchase = (100 / rate).toFixed(1);
    const totalEstate = landPrice + fix;

    card.querySelector('#lp-rent-val').textContent = '£' + rent.toLocaleString() + ' / yr';
    card.querySelector('#lp-rate-val').textContent = rate.toFixed(2) + '%';
    card.querySelector('#lp-fix-val').textContent = '£' + fix.toLocaleString();

    card.querySelector('#lp-price-val').textContent = '£' + Math.round(landPrice).toLocaleString();
    card.querySelector('#lp-years-sub').textContent = `${yearsPurchase} Years' Purchase`;
    card.querySelector('#lp-estate-val').textContent = '£' + Math.round(totalEstate).toLocaleString();

    const nBox = card.querySelector('#lp-narrative-box');
    nBox.innerHTML = `
      <strong>🌾 The Irrational Category of "Land Price":</strong><br>
      The soil itself is costless past nature. To buy the right to harvest £${rent.toLocaleString()} in annual unpaid ground-rent at a ${rate.toFixed(2)}% interest rate requires advancing <strong>£${Math.round(landPrice).toLocaleString()}</strong> in money-capital. Pure capitalized rent accounts for <strong>${((landPrice/totalEstate)*100).toFixed(0)}%</strong> of the property's total market price.
    `;
  }

  update();
  return card;
}

// 10. The Trinity Formula Demystifier (Vol 3 Ch 48)
function buildTrinityFormulaSimulator() {
  const card = document.createElement('div');
  card.className = 'interactive-simulator-card';
  card.innerHTML = `
    <div class="sim-header" onclick="this.parentElement.classList.toggle('collapsed')">
      <div class="sim-header-title">
        <span class="sim-badge">Vol 3 • Ch 48</span>
        <span>The Trinity Formula Demystifier (Capital–Profit, Land–Rent, Labour–Wages)</span>
      </div>
      <span class="sim-toggle-icon">▼</span>
    </div>
    <div class="sim-content">
      <div class="sim-presets-slot"></div>
      <div class="sim-grid">
        <div class="sim-controls-pane">
          <div class="sim-control-group">
            <label style="font-weight:600;display:block;margin-bottom:0.4rem;font-size:0.85rem;">Analytical Perspective:</label>
            <div style="display:flex;gap:0.4rem;">
              <button type="button" class="sim-preset-btn active" id="tf-mode-vulgar">Bourgeois Trinity Illusion</button>
              <button type="button" class="sim-preset-btn" id="tf-mode-marx">Marxist Value Deconstruction</button>
            </div>
          </div>
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Total Social New Value (v + s):</span>
              <span class="sim-val-display" id="tf-val-val">£200,000</span>
            </div>
            <input type="range" class="sim-slider" id="tf-val" min="50000" max="500000" step="25000" value="200000">
          </div>
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Surplus-Value Rate (s'):</span>
              <span class="sim-val-display" id="tf-sprime-val">100%</span>
            </div>
            <input type="range" class="sim-slider" id="tf-sprime" min="40" max="200" step="10" value="100">
          </div>
          <div class="sim-control-group">
            <div class="sim-label-row">
              <span>Ground-Rent Share of Surplus:</span>
              <span class="sim-val-display" id="tf-rentshare-val">25%</span>
            </div>
            <input type="range" class="sim-slider" id="tf-rentshare" min="10" max="50" step="5" value="25">
          </div>
        </div>
        <div class="sim-visuals-pane">
          <div class="sim-metric-grid" style="grid-template-columns:1fr 1fr 1fr;margin-bottom:0.75rem;">
            <div class="sim-metric-card">
              <div class="sim-metric-label">1. Wages (Labour)</div>
              <div class="sim-metric-val" id="tf-wages-val">£100,000</div>
              <div style="font-size:0.75rem;color:var(--text-muted);" id="tf-wages-sub">Variable Capital (v)</div>
            </div>
            <div class="sim-metric-card">
              <div class="sim-metric-label">2. Profit (Capital)</div>
              <div class="sim-metric-val" id="tf-profit-val">£75,000</div>
              <div style="font-size:0.75rem;color:var(--text-muted);" id="tf-profit-sub">Industrial + Interest</div>
            </div>
            <div class="sim-metric-card">
              <div class="sim-metric-label">3. Ground-Rent (Land)</div>
              <div class="sim-metric-val" id="tf-rent-val">£25,000</div>
              <div style="font-size:0.75rem;color:var(--text-muted);" id="tf-rent-sub">Landlord share</div>
            </div>
          </div>
          <div style="background:var(--callout-bg);padding:0.8rem;border-radius:8px;border:1px solid var(--border-color);font-size:0.85rem;" id="tf-narrative-box">
          </div>
        </div>
      </div>
    </div>
  `;

  let mode = 'vulgar';
  const presets = [
    { label: "Standard Class Distribution (s'=100%)", values: { mode: 'vulgar', v: 200000, sp: 100, r: 25 } },
    { label: "Marxist Scientific Deconstruction", values: { mode: 'marx', v: 200000, sp: 120, r: 30 } },
    { label: "High Rentier Extractive State", values: { mode: 'marx', v: 300000, sp: 150, r: 45 } }
  ];

  const presetsSlot = card.querySelector('.sim-presets-slot');
  presetsSlot.appendChild(createPresetsBar(presets, (vals) => {
    mode = vals.mode;
    card.querySelector('#tf-val').value = vals.v;
    card.querySelector('#tf-sprime').value = vals.sp;
    card.querySelector('#tf-rentshare').value = vals.r;
    updateButtons();
    update();
  }));

  const content = card.querySelector('.sim-content');
  content.appendChild(createProofDrawer({
    mathHtml: '$$\\text{Trinity Illusion: } \\text{Capital} \\rightarrow p, \\, \\text{Land} \\rightarrow R, \\, \\text{Labour} \\rightarrow w \\iff \\text{Truth: } W = v + s \\, (s = p + i + R)$$',
    explanation: 'The Trinity Formula completes the mystification of the capitalist mode of production. Capital (past dead labour embodied in machines) is imagined to naturally secrete profit; the Earth (an inanimate rock) is imagined to naturally produce ground-rent; and Labour is imagined to be paid its full value in wages. In reality, living labour is the sole source of value; profit, interest, and rent are simply fractions of the unpaid surplus-value extracted from the working class.',
    quote: 'In capital – profit, land – ground-rent, labour – wages, in this economic trinity represented as the connection between the component parts of value and wealth in general and its sources, we have the complete mystification of the capitalist mode of production, the conversion of social relations into things.',
    citation: 'Das Kapital, Volume 3, Chapter 48'
  }));

  function updateButtons() {
    card.querySelector('#tf-mode-vulgar').classList.toggle('active', mode === 'vulgar');
    card.querySelector('#tf-mode-marx').classList.toggle('active', mode === 'marx');
  }

  card.querySelector('#tf-mode-vulgar').addEventListener('click', () => { mode = 'vulgar'; updateButtons(); update(); });
  card.querySelector('#tf-mode-marx').addEventListener('click', () => { mode = 'marx'; updateButtons(); update(); });

  const valIn = card.querySelector('#tf-val');
  const spIn = card.querySelector('#tf-sprime');
  const rIn = card.querySelector('#tf-rentshare');

  [valIn, spIn, rIn].forEach(inp => inp.addEventListener('input', update));

  function update() {
    const totalNewVal = parseFloat(valIn.value) || 200000;
    const sPrime = parseFloat(spIn.value) || 100;
    const rentPct = parseFloat(rIn.value) || 25;

    // v + s = totalNewVal, s / v = sPrime / 100 => v (1 + sPrime/100) = totalNewVal
    const v = totalNewVal / (1 + (sPrime / 100));
    const s = totalNewVal - v;
    const groundRent = s * (rentPct / 100);
    const profitAndInterest = s - groundRent;

    card.querySelector('#tf-val-val').textContent = '£' + Math.round(totalNewVal).toLocaleString();
    card.querySelector('#tf-sprime-val').textContent = sPrime + '%';
    card.querySelector('#tf-rentshare-val').textContent = rentPct + '%';

    card.querySelector('#tf-wages-val').textContent = '£' + Math.round(v).toLocaleString();
    card.querySelector('#tf-profit-val').textContent = '£' + Math.round(profitAndInterest).toLocaleString();
    card.querySelector('#tf-rent-val').textContent = '£' + Math.round(groundRent).toLocaleString();

    const nBox = card.querySelector('#tf-narrative-box');

    if (mode === 'vulgar') {
      card.querySelector('#tf-wages-sub').textContent = 'Compensation for Labour';
      card.querySelector('#tf-profit-sub').textContent = 'Reward for Capital Tools';
      card.querySelector('#tf-rent-sub').textContent = 'Product of Earth Fertility';
      nBox.innerHTML = `
        <strong>🎭 The Bourgeois Fetish Trinity:</strong><br>
        To everyday consciousness, wealth flows from three independent fountains: <strong>Capital</strong> produces £${Math.round(profitAndInterest).toLocaleString()} profit, <strong>The Earth</strong> produces £${Math.round(groundRent).toLocaleString()} rent, and <strong>Labour</strong> produces £${Math.round(v).toLocaleString()} wages. The social relationship of exploitation is rendered completely invisible, appearing as an eternal law of nature.
      `;
    } else {
      card.querySelector('#tf-wages-sub').textContent = 'Necessary Labour (v)';
      card.querySelector('#tf-profit-sub').textContent = 'Surplus-Value: Industrial + Bank';
      card.querySelector('#tf-rent-sub').textContent = 'Surplus-Value: Landlord Share';
      nBox.innerHTML = `
        <strong>🔬 The Scientific Reality:</strong><br>
        <strong>Living Labour alone</strong> generated the entire <strong>£${Math.round(totalNewVal).toLocaleString()}</strong> value product. Workers received only £${Math.round(v).toLocaleString()} to survive. The remaining <strong>£${Math.round(s).toLocaleString()} (s' = ${sPrime}%)</strong> is pure unpaid surplus-value, carved up between the industrialist (£${Math.round(profitAndInterest*0.65).toLocaleString()}), banker (£${Math.round(profitAndInterest*0.35).toLocaleString()}), and landed aristocrat (£${Math.round(groundRent).toLocaleString()}).
      `;
    }
  }

  update();
  return card;
}

function mountChapterSimulators() {
  const info = getChapterInfo();
  if (!info) return;

  const contentEl = document.getElementById('content');
  if (!contentEl) return;

  let simCard = null;

  if (info.volume === 1) {
    if (info.chapter === 1) {
      simCard = buildValueFormsSimulator();
    } else if (info.chapter === 3) {
      simCard = buildCurrencyVelocitySimulator();
    } else if ([4, 5].includes(info.chapter)) {
      simCard = buildGeneralFormulaCirculationSimulator();
    } else if (info.chapter === 6) {
      simCard = buildLabourPowerValueSimulator();
    } else if (info.chapter === 7) {
      simCard = buildCottonSpinningSimulator();
    } else if (info.chapter === 9) {
      simCard = buildSeniorLastHourSimulator();
    } else if (info.chapter === 10) {
      simCard = buildWorkingDaySimulator();
    } else if (info.chapter === 11) {
      simCard = buildMassOfSurplusValueSimulator();
    } else if (info.chapter === 12) {
      simCard = buildRelativeSurplusValueSimulator();
    } else if (info.chapter === 13) {
      simCard = buildCooperationSimulator();
    } else if (info.chapter === 14) {
      simCard = buildManufactureDivisionLabourSimulator();
    } else if (info.chapter === 15) {
      simCard = buildMachineryLargeScaleIndustrySimulator();
    } else if (info.chapter === 16) {
      simCard = buildAbsoluteAndRelativeSurplusValueSimulator();
    } else if (info.chapter === 17) {
      simCard = buildChangesOfMagnitudeSimulator();
    } else if (info.chapter === 18) {
      simCard = buildDifferentFormulaeSimulator();
    } else if ([19, 20, 21].includes(info.chapter)) {
      simCard = buildWageMystificationSimulator();
    } else if (info.chapter === 22) {
      simCard = buildNationalWagesSimulator();
    } else if (info.chapter === 23) {
      simCard = buildSimpleReproductionWorkerDependencySimulator();
    } else if (info.chapter === 24) {
      simCard = buildAccumulationVsRevenueSimulator();
    } else if (info.chapter === 25) {
      simCard = buildAccumulationReserveArmySimulator();
    } else if (info.chapter === 33) {
      simCard = buildWakefieldColonizationSimulator();
    }
  } else if (info.volume === 2) {
    if ([1, 2, 3, 4].includes(info.chapter)) {
      simCard = buildThreeCircuitsSimulator();
    } else if ([5, 7, 9, 12, 13, 14].includes(info.chapter)) {
      simCard = buildCircuitsAndTurnoverSimulator();
    } else if (info.chapter === 6) {
      simCard = buildCirculationCostsSimulator();
    } else if (info.chapter === 8) {
      simCard = buildFixedCapitalSinkingFundSimulator();
    } else if (info.chapter === 15) {
      simCard = buildAlternatingCapitalsSimulator();
    } else if (info.chapter === 16) {
      simCard = buildVariableCapitalTurnoverSimulator();
    } else if (info.chapter === 20) {
      simCard = buildReproductionTableauSimulator();
    } else if (info.chapter === 21) {
      simCard = buildExpandedReproductionTableauSimulator();
    }
  } else if (info.volume === 3) {
    if (info.chapter === 1) {
      simCard = buildCostPriceMystificationSimulator();
    } else if ([2, 3, 4, 5, 6, 7, 13, 14, 15].includes(info.chapter)) {
      simCard = buildTrpfDashboardSimulator();
    } else if ([8, 9, 10, 11, 12].includes(info.chapter)) {
      simCard = buildTransformationTableSimulator();
    } else if ([16, 17, 18].includes(info.chapter)) {
      simCard = buildCommercialProfitSimulator();
    } else if (info.chapter >= 21 && info.chapter <= 33) {
      simCard = buildFictitiousCapitalSimulator();
    } else if ([37, 38, 39].includes(info.chapter)) {
      simCard = buildGroundRentMatrixSimulator();
    } else if ([40, 41, 42, 43].includes(info.chapter)) {
      simCard = buildDifferentialRentIISimulator();
    } else if (info.chapter === 45) {
      simCard = buildAbsoluteGroundRentSimulator();
    } else if ([46, 47].includes(info.chapter)) {
      simCard = buildLandPriceCapitalizerSimulator();
    } else if (info.chapter === 48) {
      simCard = buildTrinityFormulaSimulator();
    }
  }

  if (simCard) {
    mountSimulatorToSection(contentEl, simCard, info);
  }
}

const CHAPTER_SIMULATOR_TARGETS = {
  1: {
    1: ['the-total-or-expanded-form-of-value', 'the-transition-to-the-money-form', 'the-fetishism-of-commodities-and-the-secret-thereof'],
    3: ['the-quantity-of-money-in-circulation', 'the-velocity-of-circulation-and-the-equation-of-exchange', 'the-medium-of-circulation'],
    4: ['ii-the-formal-antithesis-cmc-contrasted-with-mcm', 'the-general-formula-for-capital'],
    5: ['the-test-case-simple-exchange-of-equivalents', 'the-two-theorems-equivalence-and-non-equivalence', 'contradictions-in-the-general-formula-of-capital'],
    6: ['the-value-formula-and-numerical-illustration', 'determining-the-value-of-labour-power', 'the-buying-and-selling-of-labour-power'],
    7: ['the-extended-labour-process', 'the-value-calculation-the-spinning-example', '22-the-valorization-process'],
    9: ['210-seniors-last-hour-anatomy-of-an-apologetic-fallacy', '28-the-two-numerical-illustrations'],
    10: ['21-the-fundamental-antinomy-the-working-day-as-variable-and-contested', '26-the-factory-legislation-of-183364-struggle-relay-system-capitals-revolt'],
    11: ['the-algebra-of-exploitation-formalizing-the-ratemass-relationship', 'the-presupposition-fixed-labour-power-value-and-the-direct-translation-of-rate-into-mass'],
    12: ['28-the-numerical-core-twelve-articles-individual-value-social-value-and-the-genesis-of-extra-surplus-value', '24-the-formal-definition-of-absolute-and-relative-surplus-value'],
    13: ['the-definition-of-co-operation-and-the-emergence-of-a-new-collective-productive-power', 'the-consolidated-theorem-the-social-productive-power-of-labour'],
    14: ['the-division-of-labour-in-manufacture-and-the-division-of-labour-in-society', 'the-two-fundamental-forms-heterogeneous-and-organic-manufacture'],
    15: ['the-value-transferred-by-the-machinery-to-the-product', 'the-compensation-theory', 'the-development-of-machinery-from-tool-to-machine'],
    16: ['26-formal-and-real-subsumption', '25-the-two-forms-defined'],
    17: ['section-i-law-one-the-constant-working-day-as-a-constant-magnitude-of-value', 'the-architectonic-setup-assumptions-variables-and-the-analytical-frame'],
    18: ['iii-the-derivative-formulae-ii-and-the-handling-of-constant-capital', 'i-the-opening-move-one-relation-three-symbolic-registers'],
    19: ['the-workers-perspective-and-the-capitalists-perspective', 'the-transformation-of-the-value-and-price-of-labour-power-into-wages'],
    20: ['the-unit-of-measurement-price-of-labour-as-daily-value-divided-by-hours', 'time-wages'],
    21: ['the-numerical-anatomy-twelve-hours-twenty-four-pieces-six-shillings', 'piece-wages'],
    22: ['25-the-relative-price-of-labour-the-decisive-category', 'national-differences-of-wages'],
    23: ['the-primitive-accumulation-parenthesis-and-the-dissolution-of-the-original-capital', 'simple-reproduction-defined-and-why-its-mere-repetition-matters'],
    24: ['section-3-division-of-surplus-value-into-capital-and-revenue-the-abstinence-theory', 'seniors-abstinence-theory-and-its-demolition'],
    25: ['section-3-the-progressive-production-of-a-relative-surplus-population-or-industrial-reserve-army', 'section-4-different-forms-of-existence-of-the-relative-surplus-population-the-general-law-of-capitalist-accumulation'],
    33: ['wakefields-discovery-capital-as-a-social-relation-not-a-thing', 'the-cure-artificial-land-price-and-the-sufficient-price-as-ransom', 'the-modern-theory-of-colonisation']
  },
  2: {
    1: ['the-opening-framework-three-stages-and-the-formula-of-the-circuit', 'the-qualitative-and-quantitative-division-of-money-capital'],
    2: ['mc-the-return-to-productive-capital', 'the-formula-for-the-circuit-of-productive-capital'],
    3: ['why-c-can-never-open-the-circuit-as-mere-c', 'the-general-formula-for-the-circuit-of-commodity-capital'],
    4: ['21-the-three-figures-set-out-valorization-as-the-determining-purpose', '27-immediacy-vs-totality-the-fluid-forms-and-the-unity-of-the-three-circuits'],
    5: ['21-the-founding-definition-the-circuit-as-the-sum-of-two-times', '27-the-mutual-exclusivity-of-circulation-time-and-production-time-the-negative-limit'],
    6: ['ii-costs-of-storage-the-pivotal-distinction', 'i-pure-costs-of-circulation', 'the-costs-of-circulation'],
    7: ['71-the-operational-definition-of-turnover-time-and-the-valorization-imperative', '77-the-circuit-as-periodic-process-turnover-formally-defined'],
    8: ['ii22-the-necessity-of-the-amortization-fund-and-the-hoard-circulation-mechanism', 'i8-the-peculiar-turnover-of-fixed-capital-and-the-money-reserve-fund'],
    9: ['the-two-premises-established-diversity-of-turnover-and-the-need-for-aggregation', 'value-turnover-versus-real-reproduction-time-the-chapters-sharpest-distinction'],
    12: ['the-conceptual-innovation-the-working-period-defined', 'the-controlled-experiment-posing-equal-capitals-against-unequal-turnover'],
    13: ['23-the-two-period-structure-of-production-time-and-the-extension-of-turnover', '24-artificial-shortening-of-production-time-tanning-bleaching-iron'],
    14: ['140-the-starting-point-circulation-time-as-an-independent-variable-of-turnover', '141-selling-time-as-the-decisive-segment-of-circulation-time'],
    15: ['section-1-working-period-circulation-period', 'the-central-problem-two-possible-responses-to-the-circulation-gap'],
    16: ['deriving-s-sn', 'formalizing-the-ratio-numerator-denominator-and-the-number-of-turnovers'],
    20: ['c-the-first-exchange-ivs-against-iic-and-the-money-that-mediates-it', 'b-the-two-departments-the-material-basis-of-the-social-schema'],
    21: ['section-iii-the-schematic-presentation-of-accumulation', 'section-i-accumulation-in-department-i']
  },
  3: {
    1: ['the-fundamental-formula-and-the-birth-of-the-cost-price', 'the-mystification-accomplished-profit-as-offspring-of-total-capital'],
    2: ['starting-from-the-rate-of-profit-the-uniformity-of-capitals-parts-and-fixed-vs-circulating', 'the-mathematical-formula-for-the-rate-of-profit'],
    3: ['22-the-primary-equations-and-the-proportionality-p-s-v-c', '26-the-analytical-programme-decomposing-p-svc'],
    4: ['variable-capitals-enhanced-efficacy-and-the-annual-rate-of-surplus-value', 'the-turnover-of-variable-capital-and-the-annual-rate-of-profit'],
    5: ['26-economy-in-the-employment-vs-economy-in-the-production-of-constant-capital', '21-the-general-principle-constant-capital-savings-raise-the-rate-of-profit-directly'],
    6: ['210-devaluation-of-fixed-capital-moral-depreciation-and-second-owners', '21-the-law-restated-input-price-changes-move-the-rate-of-profit-inversely'],
    7: ['24-the-numerical-illustration-same-exploitation-different-profit-rates', '210-the-general-theorem-the-two-sources-of-a-rising-profit-rate'],
    8: ['first-numerical-excursus-unequal-organic-compositions-at-equal-capital-size', 'value-and-surplus-value-before-averaging-the-110-and-the-190'],
    9: ['general-rate-of-profit-from-competition-and-the-definition-of-average-profit', 'the-transformation-table'],
    10: ['market-value-emerges-individual-value-social-value-and-the-modal-producer', 'equalization-of-the-general-rate-of-profit-through-competition'],
    11: ['the-general-formula-production-price-k-kp', 'case-ii-below-average-composition-50c-50v-the-price-rises'],
    12: ['the-formula-k-p-k-kp-and-the-fundamental-asymmetry', 'the-general-rate-of-profit-traces-back-to-productivity-and-value'],
    13: ['the-rising-organic-composition-as-the-expression-of-rising-social-productivity', 'the-numerical-demonstration-of-the-falling-rate-of-profit'],
    14: ['27-counteracting-factor-5-foreign-trade-surplus-profit-and-the-dispute-with-ricardo', '21-counteracting-factor-1-more-intense-exploitation-of-labour'],
    15: ['219-absolute-overproduction-of-capital-definition-and-arithmetic', '21-the-conflict-between-expansion-of-production-and-valorization'],
    16: ['25-the-dealers-entry-and-the-3000-example-m-c-m-as-the-form-of-merchants-capital', '24-commercial-capital-defined-the-transformed-portion-of-circulation-capital'],
    17: ['commercial-capital-inside-the-equalization-process', 'the-fundamental-question-how-does-commercial-capital-attract-its-share'],
    18: ['21-the-founding-distinction-industrial-turnover-as-totality-commercial-turnover-as-fragment', 'the-turnover-of-commercial-capital'],
    21: ['the-characteristic-circulation-of-interest-bearing-capital', 'the-numerical-illustration-100-20-and-the-5-interest'],
    22: ['22-the-limits-of-interest-a-determinate-maximum-an-indeterminate-minimum', 'the-division-of-profit-rate-of-interest'],
    23: ['the-deeper-objective-unmasking-the-wages-of-superintendence-illusion', 'interest-and-profit-of-enterprise'],
    24: ['the-starting-point-why-interest-bearing-capital-is-the-most-fetishized-form', 'interest-bearing-capital-as-the-superlative-fetish'],
    25: ['the-genesis-of-credit-in-money-as-means-of-payment', 'credit-and-fictitious-capital'],
    26: ['hubbards-mechanism-gold-flows-idle-money-capital-and-the-rate-of-interest', 'accumulation-of-money-capital-its-influence-on-the-interest-rate'],
    27: ['beat-iii-the-joint-stock-company-and-its-threefold-socialization', 'the-role-of-credit-in-capitalist-production'],
    28: ['the-bankers-standpoint-why-the-currencycapital-distinction-arises', 'means-of-circulation-and-capital'],
    29: ['22-the-inventory-of-banking-capital-cash-securities-and-the-invariance-of-the-subdivisions', 'banking-capital-its-component-parts'],
    30: ['imaginary-capital-ii-joint-stock-shares-and-the-autonomization-of-stock-exchange-values', 'money-capital-and-real-capital'],
    31: ['the-billbroker-machine-rediscounting-and-fictitious-credit', 'money-capital-and-real-capital-continuation'],
    32: ['credit-capital-how-often-the-same-money-serves-as-loan-capital', 'money-capital-and-real-capital-concluded'],
    33: ['credit-as-the-mediator-and-accelerator-of-velocity-the-five-transaction-example', 'how-banks-create-credit-and-capital'],
    37: ['ground-rent-defined-the-transformation-of-surplus-value-into-rent', 'introduction-to-the-theory-of-ground-rent'],
    38: ['384-the-waterfalls-cost-price-and-the-birth-of-surplus-profit', 'differential-rent-general-remarks'],
    39: ['23-fertility-and-location-the-two-non-capital-causes-of-differential-product', 'differential-rent-i-fertility-and-location'],
    40: ['vi-the-core-numerical-demonstration-dr-ii-reproduces-dr-i-on-a-single-acre-pp-816817', 'differential-rent-ii-general-characteristics'],
    41: ['case-ii-proportional-investment-table-ii-and-the-demotion-of-the-arithmetic-difference', 'differential-rent-ii-first-case-price-of-production-constant'],
    42: ['what-differential-rent-ii-adds-to-differential-rent-i', 'section-i-constant-productivity-of-the-extra-capital'],
    43: ['the-precondition-of-a-rising-production-price-declining-productivity-on-land-a', 'differential-rent-ii-third-case-rising-price-of-production'],
    45: ['disappearance-of-absolute-rent-under-compositional-equality', 'the-mechanism-of-absolute-rent-fully-articulated'],
    46: ['capitalized-rent-the-price-of-land-and-the-slave-analogy', 'rent-of-buildings-rent-in-mines-price-of-land'],
    47: ['24-money-rent', '21-introduction-the-exact-nature-of-the-difficulty', 'genesis-of-capitalist-ground-rent'],
    48: ['22-fragment-one-part-a-the-formula-and-its-reduction-to-a-second-trinity', '211-the-skeleton-of-distribution-profit-rent-wages', 'the-trinity-formula']
  }
};

function mountSimulatorToSection(contentEl, simCard, info) {
  if (!contentEl || !simCard) return;

  function safeEscape(str) {
    if (typeof CSS !== 'undefined' && CSS.escape) {
      return CSS.escape(str);
    }
    return str.replace(/[^\w-]/g, '\\$&');
  }

  // 1. Explicit placeholder in HTML if author provided one
  const explicitContainer = contentEl.querySelector('#chapter-simulator-container, [data-simulator-target]');
  if (explicitContainer) {
    explicitContainer.appendChild(simCard);
    renderSimMath(simCard);
    reAnchorHash(contentEl);
    return;
  }

  // 2. Targeted section heading lookup
  const volTargets = CHAPTER_SIMULATOR_TARGETS[info.volume];
  const chTargets = volTargets ? volTargets[info.chapter] : null;
  let targetHeading = null;

  if (chTargets && Array.isArray(chTargets)) {
    for (let i = 0; i < chTargets.length; i++) {
      const tid = chTargets[i];
      try {
        const sel = tid.startsWith('#') || tid.startsWith('.') ? tid : '#' + safeEscape(tid);
        const el = contentEl.querySelector(sel);
        if (el) {
          targetHeading = el;
          break;
        }
      } catch (e) {
        console.warn('Selector error for simulator target:', tid, e);
      }
    }
  }

  if (targetHeading) {
    targetHeading.insertAdjacentElement('afterend', simCard);
    renderSimMath(simCard);
    reAnchorHash(contentEl);
    return;
  }

  // 3. Fallback: Inside Section 2 Deconstruction (after Section 2 H2 or its first H3)
  const sec2H2 = contentEl.querySelector('#2-unified-exhaustive-chapter-deconstruction-analysis') ||
                 Array.from(contentEl.querySelectorAll('h2')).find(h => /deconstruction|analysis/i.test(h.textContent));
  if (sec2H2) {
    let nextEl = sec2H2.nextElementSibling;
    while (nextEl && nextEl.tagName !== 'H3' && nextEl.tagName !== 'H2') {
      nextEl = nextEl.nextElementSibling;
    }
    if (nextEl && nextEl.tagName === 'H3') {
      nextEl.insertAdjacentElement('afterend', simCard);
    } else {
      sec2H2.insertAdjacentElement('afterend', simCard);
    }
    renderSimMath(simCard);
    reAnchorHash(contentEl);
    return;
  }

  // 4. Safe fallback: Before first H2 (only if Section 2 is missing)
  const firstH2 = contentEl.querySelector('h2');
  if (firstH2) {
    firstH2.parentNode.insertBefore(simCard, firstH2);
  } else {
    contentEl.insertBefore(simCard, contentEl.firstChild);
  }
  renderSimMath(simCard);
  reAnchorHash(contentEl);
}

function reAnchorHash(contentEl) {
  if (typeof window !== 'undefined' && window.location && window.location.hash) {
    try {
      const hashEl = contentEl.querySelector(window.location.hash);
      if (hashEl) {
        setTimeout(() => {
          hashEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 120);
      }
    } catch (_) {}
  }
}


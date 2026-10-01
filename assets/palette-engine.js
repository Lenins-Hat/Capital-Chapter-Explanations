/**
 * Universal Command Palette (Ctrl+K) Engine
 * Das Kapital Chapter Explanations
 * Works on index.html and inside all 110 chapter reader pages
 * Features: Volume Filter Tabs, Complete 110-Chapter Directory, Interactive Labs Browser,
 * Quick Actions, Section Search & Responsive Mobile Bottom Sheet
 */
(function() {
  'use strict';

  let isReader = !!document.getElementById('content');
  let rootPrefix = isReader ? '../../' : './';
  let activeIndex = 0;
  let currentResults = [];
  let backdropEl = null;
  let inputEl = null;
  let resultsEl = null;
  let clearBtnEl = null;
  let activeTab = 'all'; // 'all', 'Volume 1', 'Volume 2', 'Volume 3', 'labs'

  // Curated list of all 28 interactive Marxian laboratories with direct anchor links
  const LABS_CATALOG = [
    { volume: 'Volume 1', chapter: 1, title: 'Value Forms & Dual Character of Labour', href: 'Volume 1/Chapter 1/Chapter 1  The Commodity_explanation.html#sec-sim-lab' },
    { volume: 'Volume 1', chapter: 3, title: 'Currency Velocity & Hoarding Dynamic', href: 'Volume 1/Chapter 3/Chapter 3  Money, or the Circulation of Commodities_explanation.html#sec-sim-lab' },
    { volume: 'Volume 1', chapter: 4, title: "General Formula (M-C-M') & Exchange Contradiction", href: 'Volume 1/Chapter 4/Chapter 4  The General Formula for Capital_explanation.html#sec-sim-lab' },
    { volume: 'Volume 1', chapter: 6, title: 'Value of Labour-Power & Subsistence Basket', href: 'Volume 1/Chapter 6/Chapter 6  The Sale and Purchase of Labour-Power_explanation.html#sec-sim-lab' },
    { volume: 'Volume 1', chapter: 7, title: 'Cotton Spinning Mill Valorization Accounting', href: 'Volume 1/Chapter 7/Chapter 7  The Labour Process and the Valorization Process_explanation.html#sec-sim-lab' },
    { volume: 'Volume 1', chapter: 9, title: "Senior's 'Last Hour' Fallacy Refutation", href: 'Volume 1/Chapter 9/Chapter 9  The Rate of Surplus-Value_explanation.html#sec-sim-lab' },
    { volume: 'Volume 1', chapter: 10, title: 'The Working Day & Factory Legislation Limits', href: 'Volume 1/Chapter 10/Chapter 10  The Working Day_explanation.html#sec-sim-lab' },
    { volume: 'Volume 1', chapter: 11, title: 'Rate vs Mass of Surplus-Value Multiplier', href: 'Volume 1/Chapter 11/Chapter 11  The Rate and Mass of Surplus-Value_explanation.html#sec-sim-lab' },
    { volume: 'Volume 1', chapter: 12, title: 'Relative Surplus-Value & Productivity Shifts', href: 'Volume 1/Chapter 12/Chapter 12  The Concept of Relative Surplus-Value_explanation.html#sec-sim-lab' },
    { volume: 'Volume 1', chapter: 13, title: 'Collective Cooperation & Scale Economies', href: 'Volume 1/Chapter 13/Chapter 13  Co-operation_explanation.html#sec-sim-lab' },
    { volume: 'Volume 1', chapter: 14, title: 'Workshop Division of Labour & Detail Workers', href: 'Volume 1/Chapter 14/Chapter 14  The Division of Labour and Manufacture_explanation.html#sec-sim-lab' },
    { volume: 'Volume 1', chapter: 15, title: 'Mechanization, Speed-up & Industrial Reserve Army', href: 'Volume 1/Chapter 15/Chapter 15  Machinery and Large-Scale Industry_explanation.html#sec-sim-lab' },
    { volume: 'Volume 1', chapter: 16, title: 'Absolute vs Relative Surplus-Value Subsumption', href: 'Volume 1/Chapter 16/Chapter 16  Absolute and Relative Surplus-Value_explanation.html#sec-sim-lab' },
    { volume: 'Volume 1', chapter: 17, title: 'Price of Labour-Power & Surplus-Value Magnitude Shifts', href: 'Volume 1/Chapter 17/Chapter 17  Changes of Magnitude in the Price of Labo_explanation.html#sec-sim-lab' },
    { volume: 'Volume 1', chapter: 18, title: 'Different Formulae for the Rate of Surplus-Value', href: 'Volume 1/Chapter 18/Chapter 18  Different Formulae for the Rate of Surplu_explanation.html#sec-sim-lab' },
    { volume: 'Volume 1', chapter: 19, title: 'Wage Mystification (Time vs Piece-Wages)', href: 'Volume 1/Chapter 19/Chapter 19  The Transformation of the Value (and Respectively the Price) of Labour-Power into Wages_explanation.html#sec-sim-lab' },
    { volume: 'Volume 1', chapter: 22, title: 'National Wage Disparities & Purchasing Power', href: 'Volume 1/Chapter 22/Chapter 22  National Differences in Wages_explanation.html#sec-sim-lab' },
    { volume: 'Volume 1', chapter: 23, title: 'Simple Reproduction & Worker Dependency', href: 'Volume 1/Chapter 23/Chapter 23  Simple Reproduction_explanation.html#sec-sim-lab' },
    { volume: 'Volume 1', chapter: 24, title: 'Accumulation vs Capitalist Abstinence Dynamic', href: 'Volume 1/Chapter 24/Chapter 24  The Transformation of Surplus-Value into Capital_explanation.html#sec-sim-lab' },
    { volume: 'Volume 1', chapter: 25, title: 'Organic Composition & Surplus Population Polarization', href: 'Volume 1/Chapter 25/Chapter 25  The General Law of Capitalist Accumulation_explanation.html#sec-sim-lab' },
    { volume: 'Volume 1', chapter: 33, title: "Wakefield's Colonial Paradox & Land Pricing", href: 'Volume 1/Chapter 33/Chapter 33  The Modem Theory of Colonization_explanation.html#sec-sim-lab' },
    { volume: 'Volume 2', chapter: 1, title: 'The Three Circuits of Industrial Capital', href: 'Volume 2/Chapter 1/Chapter 1 original_explanation.html#sec-sim-lab' },
    { volume: 'Volume 2', chapter: 5, title: 'Turnover Time & Velocity of Return Matrix', href: 'Volume 2/Chapter 5/Chapter 5 original_explanation.html#sec-sim-lab' },
    { volume: 'Volume 2', chapter: 6, title: 'Pure Costs of Circulation vs Conservation', href: 'Volume 2/Chapter 6/Chapter 6 original_explanation.html#sec-sim-lab' },
    { volume: 'Volume 2', chapter: 8, title: 'Fixed Capital Sinking Fund & Amortization Lag', href: 'Volume 2/Chapter 8/Chapter 8 original_explanation.html#sec-sim-lab' },
    { volume: 'Volume 2', chapter: 15, title: 'Alternating Capitals in Circulation & Production', href: 'Volume 2/Chapter 15/Chapter 15 original_explanation.html#sec-sim-lab' },
    { volume: 'Volume 2', chapter: 16, title: 'Variable Capital Turnover Multiplier', href: 'Volume 2/Chapter 16/Chapter 16 original_explanation.html#sec-sim-lab' },
    { volume: 'Volume 2', chapter: 20, title: 'Simple Reproduction Equilibrium Tableau (Dept I & II)', href: 'Volume 2/Chapter 20/Chapter 20 original_explanation.html#sec-sim-lab' },
    { volume: 'Volume 2', chapter: 21, title: 'Expanded Reproduction & Sectoral Disproportionality', href: 'Volume 2/Chapter 21/Chapter 21 original_explanation.html#sec-sim-lab' },
    { volume: 'Volume 3', chapter: 1, title: 'Cost Price Mystification & Profit Illusion', href: 'Volume 3/Chapter 1/Chapter 1 original_explanation.html#sec-sim-lab' },
    { volume: 'Volume 3', chapter: 2, title: 'TRPF Dynamic Dashboard (Rate of Profit Tendency to Fall)', href: 'Volume 3/Chapter 2/Chapter 2 original_explanation.html#sec-sim-lab' },
    { volume: 'Volume 3', chapter: 8, title: 'Transformation Problem & Production Prices Matrix', href: 'Volume 3/Chapter 8/Chapter 8 original_explanation.html#sec-sim-lab' },
    { volume: 'Volume 3', chapter: 16, title: 'Commercial Capital & Merchant Exploitation', href: 'Volume 3/Chapter 16/Chapter 16 original_explanation.html#sec-sim-lab' },
    { volume: 'Volume 3', chapter: 21, title: 'Fictitious Capital & Financial Bubble Engine', href: 'Volume 3/Chapter 21/Chapter 21 original_explanation.html#sec-sim-lab' },
    { volume: 'Volume 3', chapter: 37, title: 'Differential Ground Rent I (Fertility & Location)', href: 'Volume 3/Chapter 37/Chapter 37 original_explanation.html#sec-sim-lab' },
    { volume: 'Volume 3', chapter: 40, title: 'Differential Ground Rent II (Capital Intensity)', href: 'Volume 3/Chapter 40/Chapter 40 original_explanation.html#sec-sim-lab' },
    { volume: 'Volume 3', chapter: 45, title: 'Absolute Ground Rent & Agricultural OCC Lag', href: 'Volume 3/Chapter 45/Chapter 45 original_explanation.html#sec-sim-lab' }
  ];

  function getCatalog() {
    return window.CAPITAL_CATALOG || { chapters: [], concepts: [] };
  }

  function createPaletteDOM() {
    if (document.getElementById('palette-backdrop')) return;

    backdropEl = document.createElement('div');
    backdropEl.id = 'palette-backdrop';
    backdropEl.className = 'palette-backdrop';
    backdropEl.innerHTML = `
      <div class="palette-modal" id="palette-modal" role="dialog" aria-modal="true" aria-label="Command Palette">
        <div class="palette-header">
          <span class="palette-icon">🔍</span>
          <input type="text" class="palette-input" id="palette-input" placeholder="Jump to chapter, concept, or lab... (e.g. 'v3 ch 17', 'rent', 'tableau')" autocomplete="off" spellcheck="false" aria-label="Search command palette">
          <button type="button" class="palette-clear-btn" id="palette-clear-btn" title="Clear input" aria-label="Clear input">✕</button>
          <button type="button" class="palette-close-btn" id="palette-close-btn" title="Close (Esc)" aria-label="Close">✕</button>
        </div>
        <div class="palette-tabs-bar" id="palette-tabs-bar" role="tablist" aria-label="Volume Filters">
          <button type="button" class="palette-tab active" data-tab="all" role="tab" aria-selected="true">All (110)</button>
          <button type="button" class="palette-tab" data-tab="Volume 1" role="tab" aria-selected="false">Volume 1 (35)</button>
          <button type="button" class="palette-tab" data-tab="Volume 2" role="tab" aria-selected="false">Volume 2 (22)</button>
          <button type="button" class="palette-tab" data-tab="Volume 3" role="tab" aria-selected="false">Volume 3 (53)</button>
          <button type="button" class="palette-tab" data-tab="labs" role="tab" aria-selected="false">⚡ Labs (28)</button>
        </div>
        <div class="palette-results" id="palette-results" role="listbox"></div>
        <div class="palette-footer">
          <div class="palette-keys">
            <span><span class="palette-key-pill">↑↓</span> Navigate</span>
            <span><span class="palette-key-pill">↵</span> Select</span>
            <span><span class="palette-key-pill">Esc</span> Close</span>
          </div>
          <div>Das Kapital Navigator</div>
        </div>
      </div>
    `;

    document.body.appendChild(backdropEl);

    inputEl = document.getElementById('palette-input');
    resultsEl = document.getElementById('palette-results');
    clearBtnEl = document.getElementById('palette-clear-btn');
    const closeBtnEl = document.getElementById('palette-close-btn');
    const tabsBar = document.getElementById('palette-tabs-bar');

    backdropEl.addEventListener('click', (e) => {
      if (e.target === backdropEl) closePalette();
    });

    if (closeBtnEl) {
      closeBtnEl.addEventListener('click', closePalette);
    }

    if (clearBtnEl) {
      clearBtnEl.addEventListener('click', () => {
        inputEl.value = '';
        clearBtnEl.classList.remove('visible');
        inputEl.focus();
        renderResults('');
      });
    }

    if (tabsBar) {
      tabsBar.addEventListener('click', (e) => {
        const btn = e.target.closest('.palette-tab');
        if (!btn) return;
        tabsBar.querySelectorAll('.palette-tab').forEach(t => {
          t.classList.remove('active');
          t.setAttribute('aria-selected', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-selected', 'true');
        activeTab = btn.getAttribute('data-tab');
        renderResults(inputEl.value.trim());
      });
    }

    inputEl.addEventListener('input', () => {
      const val = inputEl.value.trim();
      if (clearBtnEl) {
        clearBtnEl.classList.toggle('visible', val.length > 0);
      }
      renderResults(val);
    });

    inputEl.addEventListener('keydown', handleKeyNavigation);
  }

  function openPalette(initialTab) {
    if (!backdropEl) createPaletteDOM();
    if (initialTab) {
      activeTab = initialTab;
      const tabsBar = document.getElementById('palette-tabs-bar');
      if (tabsBar) {
        tabsBar.querySelectorAll('.palette-tab').forEach(t => {
          const match = t.getAttribute('data-tab') === initialTab;
          t.classList.toggle('active', match);
          t.setAttribute('aria-selected', match ? 'true' : 'false');
        });
      }
    }
    backdropEl.classList.add('open');
    inputEl.value = '';
    if (clearBtnEl) clearBtnEl.classList.remove('visible');
    inputEl.focus();
    renderResults('');
  }

  function closePalette() {
    if (backdropEl) backdropEl.classList.remove('open');
  }

  function handleKeyNavigation(e) {
    if (e.key === 'Escape') {
      closePalette();
      e.preventDefault();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (currentResults.length > 0) {
        activeIndex = (activeIndex + 1) % currentResults.length;
        updateActiveItem();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (currentResults.length > 0) {
        activeIndex = (activeIndex - 1 + currentResults.length) % currentResults.length;
        updateActiveItem();
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (currentResults[activeIndex]) {
        executeResult(currentResults[activeIndex]);
      }
    }
  }

  function updateActiveItem() {
    const items = resultsEl.querySelectorAll('.palette-item');
    items.forEach((item, idx) => {
      if (idx === activeIndex) {
        item.classList.add('active');
        item.scrollIntoView({ block: 'nearest' });
      } else {
        item.classList.remove('active');
      }
    });
  }

  function executeResult(res) {
    closePalette();
    if (res.action) {
      res.action();
    } else if (res.href) {
      window.location.href = res.href;
    }
  }

  function getQuickActions() {
    const actions = [
      {
        type: 'action',
        icon: '🌙',
        title: 'Switch to Dark Theme',
        badge: 'Theme',
        action: () => {
          if (typeof setTheme === 'function') setTheme('dark');
          else if (typeof switchTheme === 'function') switchTheme('dark');
        }
      },
      {
        type: 'action',
        icon: '☀️',
        title: 'Switch to Light Theme',
        badge: 'Theme',
        action: () => {
          if (typeof setTheme === 'function') setTheme('light');
          else if (typeof switchTheme === 'function') switchTheme('light');
        }
      },
      {
        type: 'action',
        icon: '📜',
        title: 'Switch to Sepia Theme',
        badge: 'Theme',
        action: () => {
          if (typeof setTheme === 'function') setTheme('sepia');
          else if (typeof switchTheme === 'function') switchTheme('sepia');
        }
      }
    ];

    if (isReader) {
      actions.push(
        {
          type: 'action',
          icon: '🔊',
          title: 'Toggle Audio Reader (Text-to-Speech)',
          badge: 'TTS',
          action: () => {
            const btn = document.getElementById('tts-btn');
            if (btn) btn.click();
          }
        },
        {
          type: 'action',
          icon: '🔤',
          title: 'Increase Font Size (A+)',
          badge: 'Typography',
          action: () => {
            if (typeof adjustFontSize === 'function') adjustFontSize(1);
          }
        },
        {
          type: 'action',
          icon: '🔡',
          title: 'Decrease Font Size (A-)',
          badge: 'Typography',
          action: () => {
            if (typeof adjustFontSize === 'function') adjustFontSize(-1);
          }
        },
        {
          type: 'action',
          icon: '🏠',
          title: 'Return to Main Catalogue Index',
          badge: 'Navigation',
          action: () => {
            window.location.href = rootPrefix + 'index.html';
          }
        }
      );
    }

    return actions;
  }

  function renderChapterItem(c, idx) {
    const href = rootPrefix + c.href;
    const item = {
      type: 'chapter',
      icon: '📖',
      title: `${c.volume}: ${c.title}`,
      subtitle: c.subtitle,
      href: href
    };
    currentResults.push(item);
    return `
      <div class="palette-item ${idx === 0 ? 'active' : ''}" data-idx="${idx}">
        <div class="palette-item-left">
          <span class="palette-item-icon">📖</span>
          <span class="palette-item-text">${c.title}</span>
          <span class="palette-item-sub">— ${c.subtitle}</span>
        </div>
        <span class="palette-item-badge">${c.volume}</span>
      </div>
    `;
  }

  function renderLabItem(l, idx) {
    const href = rootPrefix + l.href;
    const item = {
      type: 'lab',
      icon: '⚡',
      title: `${l.volume} Ch ${l.chapter}: ${l.title}`,
      subtitle: 'Interactive Simulation Laboratory',
      href: href
    };
    currentResults.push(item);
    return `
      <div class="palette-item ${idx === 0 ? 'active' : ''}" data-idx="${idx}">
        <div class="palette-item-left">
          <span class="palette-item-icon" style="color:var(--accent);">⚡</span>
          <span class="palette-item-text">${l.volume} Ch ${l.chapter}: ${l.title}</span>
          <span class="palette-item-sub">— Interactive Lab</span>
        </div>
        <span class="palette-item-badge" style="background:rgba(56,189,248,0.15);color:var(--accent);">Lab</span>
      </div>
    `;
  }

  function renderResults(q) {
    currentResults = [];
    activeIndex = 0;
    const catalog = getCatalog();
    const query = q.toLowerCase();

    let html = '';

    // ==========================================
    // 1. TABS: Interactive Labs View
    // ==========================================
    if (activeTab === 'labs') {
      const matchedLabs = query
        ? LABS_CATALOG.filter(l => (l.title + ' ' + l.volume + ' ch ' + l.chapter).toLowerCase().includes(query))
        : LABS_CATALOG;

      html += `<div class="palette-group-title">⚡ Interactive Marxian Laboratories (${matchedLabs.length})</div>`;
      if (matchedLabs.length === 0) {
        html += `<div style="padding:1.5rem;text-align:center;color:var(--text-dim);font-size:0.85rem;">No laboratories match "${query}".</div>`;
      } else {
        matchedLabs.forEach(l => {
          html += renderLabItem(l, currentResults.length);
        });
      }
      finishRender(html);
      return;
    }

    // ==========================================
    // 2. TABS: Single Volume Filtered View (Vol 1, 2, or 3)
    // ==========================================
    if (activeTab.startsWith('Volume')) {
      const volChapters = (catalog.chapters || []).filter(c => c.volume === activeTab);
      let matched = volChapters;
      if (query) {
        matched = volChapters.filter(c => {
          const hay = `${c.title} ${c.subtitle} ${c.search || ''}`.toLowerCase();
          return hay.includes(query);
        });
      }

      html += `<div class="palette-group-title">📖 ${activeTab} (${matched.length} Chapters)</div>`;
      if (matched.length === 0) {
        html += `<div style="padding:1.5rem;text-align:center;color:var(--text-dim);font-size:0.85rem;">No chapters found in ${activeTab} for "${query}".</div>`;
      } else {
        matched.forEach(c => {
          html += renderChapterItem(c, currentResults.length);
        });
      }
      finishRender(html);
      return;
    }

    // ==========================================
    // 3. TABS: "All" View
    // ==========================================

    // A. Quick Actions (show when query is empty or matches action)
    const quickActions = getQuickActions();
    const matchedActions = query
      ? quickActions.filter(a => a.title.toLowerCase().includes(query) || a.badge.toLowerCase().includes(query))
      : (query ? [] : quickActions.slice(0, 4));

    if (matchedActions.length > 0) {
      html += `<div class="palette-group-title">⚡ Quick Actions</div>`;
      matchedActions.forEach(a => {
        const idx = currentResults.length;
        currentResults.push(a);
        html += `
          <div class="palette-item ${idx === 0 ? 'active' : ''}" data-idx="${idx}">
            <div class="palette-item-left">
              <span class="palette-item-icon">${a.icon}</span>
              <span class="palette-item-text">${a.title}</span>
            </div>
            <span class="palette-item-badge">${a.badge}</span>
          </div>
        `;
      });
    }

    // B. Sections in Current Chapter (if reading a chapter)
    if (isReader && query.length >= 2) {
      const headings = document.querySelectorAll('#content h1, #content h2, #content h3');
      const matchedHeadings = [];
      headings.forEach(h => {
        const text = h.textContent.replace(/^#+\s*/, '').replace(/#$/, '').trim();
        if (text.toLowerCase().includes(query) && h.id) {
          matchedHeadings.push({
            type: 'heading',
            icon: '§',
            title: text,
            badge: h.tagName,
            action: () => {
              h.scrollIntoView({ behavior: 'smooth', block: 'start' });
              history.pushState(null, '', '#' + h.id);
            }
          });
        }
      });

      if (matchedHeadings.length > 0) {
        html += `<div class="palette-group-title">📑 Sections in This Chapter</div>`;
        matchedHeadings.slice(0, 5).forEach(h => {
          const idx = currentResults.length;
          currentResults.push(h);
          html += `
            <div class="palette-item ${idx === 0 ? 'active' : ''}" data-idx="${idx}">
              <div class="palette-item-left">
                <span class="palette-item-icon" style="color:var(--accent);font-weight:700;">§</span>
                <span class="palette-item-text">${h.title}</span>
              </div>
              <span class="palette-item-badge">${h.badge}</span>
            </div>
          `;
        });
      }
    }

    // C. Chapters across all 3 Volumes
    if (catalog.chapters && catalog.chapters.length > 0) {
      if (!query) {
        // Group by Volume so user can browse and jump to ANY of the 110 chapters!
        const v1 = catalog.chapters.filter(c => c.volume === 'Volume 1');
        const v2 = catalog.chapters.filter(c => c.volume === 'Volume 2');
        const v3 = catalog.chapters.filter(c => c.volume === 'Volume 3');

        if (v1.length > 0) {
          html += `<div class="palette-group-title">📖 Volume 1: Production (${v1.length} Chapters)</div>`;
          v1.forEach(c => { html += renderChapterItem(c, currentResults.length); });
        }
        if (v2.length > 0) {
          html += `<div class="palette-group-title">📖 Volume 2: Circulation (${v2.length} Chapters)</div>`;
          v2.forEach(c => { html += renderChapterItem(c, currentResults.length); });
        }
        if (v3.length > 0) {
          html += `<div class="palette-group-title">📖 Volume 3: Capitalist Production as a Whole (${v3.length} Chapters)</div>`;
          v3.forEach(c => { html += renderChapterItem(c, currentResults.length); });
        }
      } else {
        // Search across all chapters
        const matchedChapters = catalog.chapters.filter(c => {
          const hay = `${c.volume} ${c.title} ${c.subtitle} ${c.search || ''}`.toLowerCase();
          return hay.includes(query);
        });

        if (matchedChapters.length > 0) {
          html += `<div class="palette-group-title">📖 Matching Chapters (${matchedChapters.length})</div>`;
          matchedChapters.forEach(c => {
            html += renderChapterItem(c, currentResults.length);
          });
        }
      }
    }

    // D. Matching Interactive Laboratories (if searching)
    if (query) {
      const matchedLabs = LABS_CATALOG.filter(l => (l.title + ' ' + l.volume + ' ch ' + l.chapter).toLowerCase().includes(query));
      if (matchedLabs.length > 0) {
        html += `<div class="palette-group-title">⚡ Interactive Laboratories (${matchedLabs.length})</div>`;
        matchedLabs.forEach(l => {
          html += renderLabItem(l, currentResults.length);
        });
      }
    }

    // E. Theoretical Concepts (30)
    if (catalog.concepts && catalog.concepts.length > 0 && query.length >= 2) {
      const matchedConcepts = catalog.concepts.filter(c => c.toLowerCase().includes(query));
      if (matchedConcepts.length > 0) {
        html += `<div class="palette-group-title">🏷️ Theoretical Concepts</div>`;
        matchedConcepts.slice(0, 8).forEach(c => {
          const idx = currentResults.length;
          const item = {
            type: 'concept',
            icon: '🏷️',
            title: c,
            action: () => {
              if (!isReader && typeof window.setConceptFilter === 'function') {
                window.setConceptFilter(c);
              } else {
                window.location.href = rootPrefix + 'index.html?concept=' + encodeURIComponent(c);
              }
            }
          };
          currentResults.push(item);
          html += `
            <div class="palette-item ${idx === 0 ? 'active' : ''}" data-idx="${idx}">
              <div class="palette-item-left">
                <span class="palette-item-icon">🏷️</span>
                <span class="palette-item-text">${c}</span>
              </div>
              <span class="palette-item-badge">Concept</span>
            </div>
          `;
        });
      }
    }

    finishRender(html);
  }

  function finishRender(html) {
    if (currentResults.length === 0) {
      html = `<div style="text-align:center;padding:2.5rem 1rem;color:var(--text-dim);font-size:0.88rem;">No matching chapters, concepts, or labs found.</div>`;
    }

    resultsEl.innerHTML = html;

    // Attach click and hover listeners to rendered items
    resultsEl.querySelectorAll('.palette-item').forEach(el => {
      el.addEventListener('click', () => {
        const idx = parseInt(el.getAttribute('data-idx'), 10);
        if (currentResults[idx]) executeResult(currentResults[idx]);
      });
      el.addEventListener('mouseenter', () => {
        const idx = parseInt(el.getAttribute('data-idx'), 10);
        activeIndex = idx;
        updateActiveItem();
      });
    });
  }

  // Global Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    // Ctrl+K or Cmd+K
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (backdropEl && backdropEl.classList.contains('open')) {
        closePalette();
      } else {
        openPalette();
      }
    }
    // '/' key when not typing in an input
    else if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
      e.preventDefault();
      openPalette();
    }
  });

  // Expose global methods
  window.openCommandPalette = openPalette;
  window.closeCommandPalette = closePalette;

  // If URL has ?concept=..., apply filter on index.html
  if (!isReader && window.location.search) {
    const params = new URLSearchParams(window.location.search);
    const concept = params.get('concept');
    if (concept && typeof window.setConceptFilter === 'function') {
      window.addEventListener('DOMContentLoaded', () => {
        window.setConceptFilter(concept);
      });
    }
  }
})();

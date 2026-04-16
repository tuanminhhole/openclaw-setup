// @ts-nocheck
/* eslint-disable no-undef, no-unused-vars */
/**
 * @fileoverview UI layer — part of the OpenClaw Setup Wizard IIFE bundle.
 * Variables like state, PROVIDERS, SKILLS, PLUGINS, CHANNELS are IIFE globals.
 * Functions like botFiles(), botConfigContent() etc. are defined in generators/.
 *
 * Built via: node build.mjs
 */
  // ========== Multi-Bot State & Logic ==========

  // Extend state with multi-bot fields (lazily added to avoid breaking single-bot)
  state.botCount = 1;
  state.activeBotIndex = 0;
  state.bots = [{ name: '', slashCmd: '', desc: '', provider: '9router', model: '9router/smart-route', token: '', apiKey: '' }];
  state.groupId = '';

  function ensureBotState(index) {
    if (!state.bots[index]) {
      state.bots[index] = { name: '', slashCmd: '', desc: '', provider: '9router', model: '9router/smart-route', token: '', apiKey: '' };
    }
    return state.bots[index];
  }

  window.__selectProvider = function(key) {
    const p = PROVIDERS[key] || PROVIDERS.google;
    state.config.provider = key;
    if (state.bots[state.activeBotIndex]) {
      state.bots[state.activeBotIndex].provider = key;
    }
    const nextModel = (p.models && p.models[0]) ? p.models[0].id : state.config.model;
    state.config.model = nextModel;
    if (state.bots[state.activeBotIndex]) {
      state.bots[state.activeBotIndex].model = p.models[0].id;
    }
    const modelEl = document.getElementById('cfg-model');
    if (modelEl) {
      const lang = document.getElementById('cfg-language')?.value || 'vi';
      modelEl.innerHTML = (p.models || []).map((m) => {
        const desc = lang === 'vi' ? (m.descVi || m.desc || '') : (m.descEn || m.desc || '');
        const badge = lang === 'vi' ? (m.badgeVi || m.badge || '') : (m.badgeEn || m.badge || '');
        const suffix = [desc, badge].filter(Boolean).join(' ');
        return `<option value="${m.id}">${m.name}${suffix ? ' — ' + suffix : ''}</option>`;
      }).join('');
      modelEl.value = nextModel;
    }
    document.querySelectorAll('.provider-card').forEach((card) => {
      card.classList.toggle('provider-card--selected', card.dataset.provider === key);
    });
    if (typeof renderPluginGrid === 'function') {
      renderPluginGrid();
    }
    if (typeof updateNavButtons === 'function') updateNavButtons();
  };

  window.__selectModel = function(modelId) {
    state.config.model = modelId;
    if (state.bots[state.activeBotIndex]) {
      state.bots[state.activeBotIndex].model = modelId;
    }
    if (typeof updateNavButtons === 'function') updateNavButtons();
  };

  function saveCredentials() {
    const botTokenEl = document.getElementById('key-bot-token');
    const apiKeyEl = document.getElementById('key-api-key');
    const pathEl = document.getElementById('cfg-project-path');
    if (botTokenEl) state.config.botToken = botTokenEl.value;
    if (apiKeyEl) state.config.apiKey = apiKeyEl.value;
    if (pathEl) state.config.projectPath = pathEl.value;

    if (state.botCount <= 1 && state.bots[0]) {
      state.bots[0].provider = state.config.provider;
      state.bots[0].model = state.config.model;
      if (botTokenEl) state.bots[0].token = botTokenEl.value;
      if (apiKeyEl) state.bots[0].apiKey = apiKeyEl.value;
    }

    for (let i = 0; i < state.botCount; i++) {
      const bot = ensureBotState(i);
      const tokenInput = document.getElementById(`key-bot-token-${i}`);
      const keyInput = document.getElementById(`key-api-key-${i}`);
      if (tokenInput) bot.token = tokenInput.value;
      if (keyInput) bot.apiKey = keyInput.value;
    }
  }

  window.__selectBotCount = function(count) {
    state.botCount = count;

    // Update button styles
    document.querySelectorAll('#botcount-grid .botcount-btn').forEach(btn => {
      const isActive = parseInt(btn.dataset.count) === count;
      btn.style.border = isActive ? '1px solid rgba(99,102,241,0.5)' : '1px solid rgba(255,255,255,0.12)';
      btn.style.background = isActive ? 'rgba(99,102,241,0.15)' : 'transparent';
      btn.style.color = isActive ? 'var(--text-primary)' : 'var(--text-secondary)';
    });

    // Ensure bots array has enough entries
    while (state.bots.length < count) {
      state.bots.push({ name: '', slashCmd: '', desc: '', provider: 'google', model: 'google/gemini-2.5-flash', token: '', apiKey: '' });
    }

    // Auto-select relay plugin via centralized function
    if (typeof window.__syncRelayPluginVisibility === 'function') {
      window.__syncRelayPluginVisibility();
    }

    // Show/hide group option for 2+ bots
    const groupOpt = document.getElementById('multibot-group-option');
    if (groupOpt) groupOpt.style.display = count > 1 ? '' : 'none';

    // Hide/show global bot name + desc fields when multi-bot (each bot has its own in tab panel)
    const identityGrid = document.querySelector('.identity-grid');
    if (identityGrid) {
      const nameField = identityGrid.querySelector('.form-group:has(#cfg-name)');
      const descField = identityGrid.querySelector('.form-group:has(#cfg-desc)');
      if (nameField) nameField.style.display = count > 1 ? 'none' : '';
      if (descField) descField.style.display = count > 1 ? 'none' : '';
    }

    // Refresh tab bar in Step 3 when already there
    renderBotTabBar();
    if (typeof updateNavButtons === 'function') updateNavButtons();
  };

  // ── Group option card toggle ─────────────────────────────────────────────
  window.__onGroupOptionChange = function() {
    const isExisting = document.getElementById('group-opt-existing')?.checked;

    // Cards
    const cardCreate   = document.getElementById('group-card-create');
    const cardExisting = document.getElementById('group-card-existing');
    const checkCreate  = document.getElementById('group-card-create-check');
    const checkExisting= document.getElementById('group-card-existing-check');

    if (cardCreate) {
      cardCreate.style.background  = isExisting ? 'rgba(255,255,255,0.03)' : 'rgba(16,185,129,0.08)';
      cardCreate.style.borderColor = isExisting ? 'rgba(255,255,255,0.1)'  : 'rgba(16,185,129,0.5)';
    }
    if (cardExisting) {
      cardExisting.style.background  = isExisting ? 'rgba(99,102,241,0.10)' : 'rgba(255,255,255,0.03)';
      cardExisting.style.borderColor = isExisting ? 'rgba(99,102,241,0.55)' : 'rgba(255,255,255,0.1)';
    }
    if (checkCreate) {
      checkCreate.style.background = isExisting ? 'rgba(255,255,255,0.12)' : 'var(--accent)';
      checkCreate.style.border     = isExisting ? '1.5px solid rgba(255,255,255,0.2)' : 'none';
      checkCreate.querySelector('path').setAttribute('opacity', isExisting ? '.3' : '1');
    }
    if (checkExisting) {
      checkExisting.style.background = isExisting ? 'rgb(99,102,241)' : 'rgba(255,255,255,0.12)';
      checkExisting.style.border     = isExisting ? 'none' : '1.5px solid rgba(255,255,255,0.2)';
      checkExisting.querySelector('path').setAttribute('opacity', isExisting ? '1' : '.3');
    }

    // Show/hide Group ID input
    const wrap = document.getElementById('group-id-wrap');
    if (wrap) wrap.style.display = isExisting ? '' : 'none';
  };

  // Keep legacy alias in case old HTML references remain
  window.__toggleGroupIdInput = (show) => {
    const wrap = document.getElementById('group-id-wrap');
    if (wrap) wrap.style.display = show ? '' : 'none';
  };

  window.__saveGroupId = function(val) {
    state.groupId = val;
    if (typeof updateNavButtons === 'function') updateNavButtons();
  };


  function renderBotTabBar() {
    const tabBar = document.getElementById('bot-tab-bar');
    const tabsEl = document.getElementById('bot-tabs');
    const labelEl = document.getElementById('multibot-tab-label');
    const slashGroup = document.getElementById('slash-cmd-group');
    if (!tabBar || !tabsEl) return;

    tabBar.style.display = 'block';

    // ── Combo mode: 2 fixed tabs (Telegram / Zalo Personal) ─────────────────
    if (false) {
      ensureBotState(0);
      ensureBotState(1);
      tabsEl.style.display = 'flex';
      if (labelEl) { labelEl.style.display = 'block'; labelEl.textContent = ''; }
      if (slashGroup) slashGroup.style.display = 'none'; // slash cmd not relevant for Zalo

      const COMBO_TABS = [
        { icon: '📨', labelVi: 'Telegram', labelEn: 'Telegram' },
        { icon: '💬', labelVi: 'Zalo Personal', labelEn: 'Zalo Personal' },
      ];
      const lang = document.getElementById('cfg-language')?.value || 'vi';

      tabsEl.innerHTML = COMBO_TABS.map((tab, i) => {
        const isActive = i === state.activeBotIndex;
        const customName = state.bots[i]?.name;
        const labelText = customName ? customName : (lang === 'vi' ? tab.labelVi : tab.labelEn);
        const label = `${tab.icon} ${labelText}`;
        return `<button onclick="window.__switchBotTab(${i})" style="
          padding:7px 18px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;
          border:1px solid ${isActive ? 'rgba(99,102,241,0.6)' : 'rgba(255,255,255,0.12)'};
          background:${isActive ? 'rgba(99,102,241,0.2)' : 'transparent'};
          color:${isActive ? 'var(--text-primary)' : 'var(--text-secondary)'};
          transition:all 0.15s;">${label}</button>`;
      }).join('');

      syncBotTabMeta();
      return;
    }

    // ── Normal mode ──────────────────────────────────────────────────────────
    if (state.botCount <= 1) {
      tabsEl.style.display = 'none';
      if (labelEl) labelEl.style.display = 'none';
      if (slashGroup) slashGroup.style.display = 'none';
      
      // Restore single-bot fields — fall back to state.config.botName so Next button
      // is never falsely disabled just because state.bots[0].name is empty yet.
      const bot = state.bots[0] || { name: '', desc: '', persona: '', slashCmd: '' };
      const resolvedName = bot.name || state.config.botName || '';
      document.getElementById('cfg-bot-tab-name').value = resolvedName;
      document.getElementById('cfg-bot-tab-desc').value = bot.desc || state.config.description || '';
      document.getElementById('cfg-bot-tab-persona').value = bot.persona || '';
      return;
    }
    
    tabsEl.style.display = 'flex';
    if (labelEl) labelEl.style.display = 'block';
    if (slashGroup) slashGroup.style.display = 'block';
    const lang = document.getElementById('cfg-language')?.value || 'vi';

    tabsEl.innerHTML = Array.from({ length: state.botCount }, (_, i) => {
      const bot = state.bots[i] || {};
      const label = bot.name || (lang === 'vi' ? `Bot ${i + 1}` : `Bot ${i + 1}`);
      const isActive = i === state.activeBotIndex;
      return `<button onclick="window.__switchBotTab(${i})" style="
        padding:7px 18px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;
        border:1px solid ${isActive ? 'rgba(99,102,241,0.6)' : 'rgba(255,255,255,0.12)'};
        background:${isActive ? 'rgba(99,102,241,0.2)' : 'transparent'};
        color:${isActive ? 'var(--text-primary)' : 'var(--text-secondary)'};
        transition:all 0.15s;">${label}</button>`;
    }).join('');

    // Populate meta fields for active bot
    syncBotTabMeta();
  }

  function syncBotTabMeta() {
    const bot = ensureBotState(state.activeBotIndex);
    const nameEl = document.getElementById('cfg-bot-tab-name');
    const slashEl = document.getElementById('cfg-bot-tab-slash');
    const descEl = document.getElementById('cfg-bot-tab-desc');
    const personaEl = document.getElementById('cfg-bot-tab-persona');
    if (nameEl) nameEl.value = bot.name || '';
    if (slashEl) slashEl.value = bot.slashCmd || '';
    if (descEl) descEl.value = bot.desc || '';
    if (personaEl) personaEl.value = bot.persona || '';

    // Also sync global config fields from active bot (provider/model carry over)
    if (bot.provider) {
      state.config.provider = bot.provider;
      state.config.model = bot.model || 'google/gemini-2.5-flash';
    }
  }

  window.__switchBotTab = function(index) {
    // Save current tab data first
    saveFormData();
    saveBotTabMeta();

    // Sync provider/model from global config back to the bot being left
    if (state.bots[state.activeBotIndex]) {
      state.bots[state.activeBotIndex].provider = state.config.provider;
      state.bots[state.activeBotIndex].model = state.config.model;
    }

    state.activeBotIndex = index;
    renderBotTabBar();

    // Reload provider/model for newly selected bot
    const bot = ensureBotState(index);
    state.config.provider = bot.provider || 'google';
    state.config.model = bot.model || 'google/gemini-2.5-flash';
    window.__selectProvider(state.config.provider);
    const mdSel = document.getElementById('cfg-model');
    if (mdSel && state.config.model) {
      const opt = mdSel.querySelector(`option[value="${state.config.model}"]`);
      if (opt) mdSel.value = state.config.model;
    }
  };

  function saveBotTabMeta() {
    const bot = ensureBotState(state.activeBotIndex);
    const nameEl = document.getElementById('cfg-bot-tab-name');
    const slashEl = document.getElementById('cfg-bot-tab-slash');
    const descEl = document.getElementById('cfg-bot-tab-desc');
    const personaEl = document.getElementById('cfg-bot-tab-persona');
    if (nameEl) bot.name = nameEl.value;
    if (slashEl) bot.slashCmd = slashEl.value;
    if (descEl) bot.desc = descEl.value;
    if (personaEl) bot.persona = personaEl.value;
  }

  window.__saveBotTabName = function(val) {
    const bot = ensureBotState(state.activeBotIndex);
    if (bot) {
      bot.name = val;
      // Update tab label live
      const tabs = document.querySelectorAll('#bot-tabs button');
      if (tabs[state.activeBotIndex]) {
        if (false) {
          const fallback = state.activeBotIndex === 0 ? '📨 Telegram' : '💬 Zalo Personal';
          tabs[state.activeBotIndex].textContent = val ? `${state.activeBotIndex === 0 ? '📨' : '💬'} ${val}` : fallback;
        } else {
          tabs[state.activeBotIndex].textContent = val || `Bot ${state.activeBotIndex + 1}`;
        }
      }
    }
    if (state.botCount <= 1) {
      state.config.botName = val;
    }
    if (typeof updateNavButtons === 'function') updateNavButtons();
  };

  window.__saveBotTabSlash = function(val) {
    ensureBotState(state.activeBotIndex).slashCmd = val;
    if (typeof updateNavButtons === 'function') updateNavButtons();
  };

  window.__saveBotTabDesc = function(val) {
    ensureBotState(state.activeBotIndex).desc = val;
    if (state.botCount <= 1) {
      state.config.description = val;
    }
    if (typeof updateNavButtons === 'function') updateNavButtons();
  };

  window.__saveBotTabPersona = function(val) {
    ensureBotState(state.activeBotIndex).persona = val;
    if (typeof updateNavButtons === 'function') updateNavButtons();
  };



  // ========== Step 1: Deploy Mode + OS ==========

// @ts-nocheck
/* eslint-disable no-undef, no-unused-vars */
/**
 * Restored UI controller layer for the wizard.
 * These functions were accidentally dropped during refactor, which left
 * setup.js syntactically valid but runtime-broken.
 */
  const OS_ADVISORY = {
    win: {
      icon: '🪟',
      deploy: 'docker',
      titleVi: 'Windows — Khuyên dùng Docker',
      titleEn: 'Windows — Docker Recommended',
      descVi: 'Bot chạy trong container isolation. Script `.bat` tự động cài Docker Desktop, build và khởi động bot.',
      descEn: 'The bot runs in container isolation. The `.bat` script auto-installs Docker Desktop, builds, and starts the bot.',
      badgeVi: '🐳 Docker',
      badgeEn: '🐳 Docker',
      badgeStyle: 'background:rgba(16,185,129,0.15); color:#10b981; border:1px solid rgba(16,185,129,0.3);'
    },
    linux: {
      icon: '🍎',
      deploy: 'docker',
      titleVi: 'macOS — Khuyên dùng Docker',
      titleEn: 'macOS — Docker Recommended',
      descVi: 'Dùng Docker để tránh lệch môi trường. Script `.sh` tải về rồi chạy trong Terminal.',
      descEn: 'Use Docker to avoid host-environment drift. Download the `.sh` script and run it in Terminal.',
      badgeVi: '🐳 Docker',
      badgeEn: '🐳 Docker',
      badgeStyle: 'background:rgba(16,185,129,0.15); color:#10b981; border:1px solid rgba(16,185,129,0.3);'
    },
    vps: {
      icon: '🐧',
      deploy: 'native',
      titleVi: 'Ubuntu / VPS — Khuyên dùng Native + PM2',
      titleEn: 'Ubuntu / VPS — Native + PM2 Recommended',
      descVi: 'Chạy thẳng trên máy chủ để tối ưu RAM, đơn giản hóa vận hành, và tự restart qua PM2.',
      descEn: 'Run directly on the server for better RAM usage, simpler ops, and PM2 auto-restart.',
      badgeVi: '💻 Native',
      badgeEn: '💻 Native',
      badgeStyle: 'background:rgba(245,158,11,0.15); color:#f59e0b; border:1px solid rgba(245,158,11,0.3);'
    },
    'linux-desktop': {
      icon: '🖥️',
      deploy: 'native',
      titleVi: 'Linux Desktop — Khuyên dùng Native',
      titleEn: 'Linux Desktop — Native Recommended',
      descVi: 'Phù hợp máy cá nhân Linux. Script `.sh` cài trực tiếp OpenClaw và runtime cần thiết.',
      descEn: 'Best for personal Linux desktops. The `.sh` script installs OpenClaw and required runtime directly.',
      badgeVi: '💻 Native',
      badgeEn: '💻 Native',
      badgeStyle: 'background:rgba(245,158,11,0.15); color:#f59e0b; border:1px solid rgba(245,158,11,0.3);'
    }
  };

  function init() {
    bindChannelCards();
    bindDeployModeCards();
    bindNavButtons();
    bindFormEvents();
    renderProviderCards();
    renderPluginGrid();
    initLanguageSelector();
    initSecurityRules();
    updateAdvisory(state.nativeOs || 'win');
    updateUI();
  }

  document.addEventListener('DOMContentLoaded', init);

  function initSecurityRules() {
    const textarea = document.getElementById('cfg-security');
    if (!textarea) return;
    const lang = document.getElementById('cfg-language')?.value || 'vi';
    if (!state.config.securityRules) {
      state.config.securityRules = DEFAULT_SECURITY_RULES[lang];
    }
    textarea.value = state.config.securityRules;
  }

  window.__toggleSecurityEdit = function() {
    const textarea = document.getElementById('cfg-security');
    const btn = document.getElementById('btn-toggle-security');
    const lang = document.getElementById('cfg-language')?.value || 'vi';
    if (!textarea || !btn) return;
    if (textarea.readOnly) {
      textarea.readOnly = false;
      btn.textContent = lang === 'vi' ? '🔒 Khóa' : '🔒 Lock';
      btn.classList.add('btn-toggle-edit--active');
      textarea.focus();
    } else {
      textarea.readOnly = true;
      btn.textContent = lang === 'vi' ? '✏️ Sửa' : '✏️ Edit';
      btn.classList.remove('btn-toggle-edit--active');
    }
  };

  function initLanguageSelector() {
    document.querySelectorAll('.lang-toggle__flag').forEach((el) => {
      const lang = el.dataset.lang || 'vi';
      if (FLAG_ICONS[lang]) el.innerHTML = FLAG_ICONS[lang];
    });
  }

  window.__navToStep = function(step) {
    if (step <= 1) {
      goToStep(1);
      return;
    }
    if (step <= state.currentStep + 1) {
      goToStep(step);
    }
  };

  window.__selectLang = function(val) {
    const input = document.getElementById('cfg-language');
    if (input) input.value = val;
    state.config.language = val;

    document.querySelectorAll('.lang-toggle__btn').forEach((btn) => {
      btn.classList.toggle('lang-toggle__btn--active', btn.dataset.lang === val);
    });

    document.querySelectorAll('[data-vi][data-en]').forEach((el) => {
      el.innerHTML = el.getAttribute(`data-${val}`);
    });

    const securityEl = document.getElementById('cfg-security');
    if (securityEl && !securityEl.dataset.userEdited) {
      securityEl.value = DEFAULT_SECURITY_RULES[val];
      state.config.securityRules = securityEl.value;
    }

    renderProviderCards();
    renderPluginGrid();
    updateAdvisory(state.nativeOs || 'win');
    if (state.currentStep === 3) populateStep2();
    if (state.currentStep === 4) populateStep3();
    updateUI();
  };

  function bindChannelCards() {
    const step2 = document.querySelector('.step[data-step="2"]');
    if (!step2) return;
    step2.querySelectorAll('.channel-card[data-channel]').forEach((card) => {
      card.addEventListener('click', () => {
        state.channel = card.dataset.channel;
        step2.querySelectorAll('.channel-card[data-channel]').forEach((c) => c.classList.remove('channel-card--selected'));
        card.classList.add('channel-card--selected');
        const multibotPanel = document.getElementById('multibot-panel');
        if (multibotPanel) {
          multibotPanel.style.display = state.channel === 'telegram' ? '' : 'none';
        }
        if (state.channel !== 'telegram') {
          state.botCount = 1;
          state.activeBotIndex = 0;
        }
        syncRelayPluginVisibility();
        updateNavButtons();
      });
    });
  }

  function bindDeployModeCards() {
    document.querySelectorAll('#deploy-mode-grid .channel-card').forEach((card) => {
      card.addEventListener('click', () => {
        state.deployMode = card.dataset.deploy;
        document.querySelectorAll('#deploy-mode-grid .channel-card').forEach((c) => c.classList.remove('channel-card--selected'));
        card.classList.add('channel-card--selected');
        updateDockerNotice();
        updateAdvisoryBadgeOnly();
        updateNavButtons();
      });
    });
  }

  function updateAdvisoryBadgeOnly() {
    const adv = document.getElementById('env-adv-badge');
    if (!adv) return;
    if (state.deployMode === 'docker') {
      adv.textContent = '🐳 Docker';
      adv.style.cssText = 'flex-shrink:0; padding:4px 12px; border-radius:20px; font-size:12px; font-weight:600; white-space:nowrap; background:rgba(16,185,129,0.15); color:#10b981; border:1px solid rgba(16,185,129,0.3);';
    } else {
      adv.textContent = '💻 Native';
      adv.style.cssText = 'flex-shrink:0; padding:4px 12px; border-radius:20px; font-size:12px; font-weight:600; white-space:nowrap; background:rgba(245,158,11,0.15); color:#f59e0b; border:1px solid rgba(245,158,11,0.3);';
    }
  }

  function updateAdvisory(os) {
    const lang = document.getElementById('cfg-language')?.value || 'vi';
    const data = OS_ADVISORY[os] || OS_ADVISORY.win;
    if (!document.getElementById('deploy-override-panel')?.style.display || document.getElementById('deploy-override-panel')?.style.display === 'none') {
      state.deployMode = data.deploy;
    }
    const icon = document.getElementById('env-adv-icon');
    const title = document.getElementById('env-adv-title');
    const desc = document.getElementById('env-adv-desc');
    const badge = document.getElementById('env-adv-badge');
    if (icon) icon.textContent = data.icon;
    if (title) title.textContent = lang === 'vi' ? data.titleVi : data.titleEn;
    if (desc) desc.innerHTML = lang === 'vi' ? data.descVi : data.descEn;
    if (badge) {
      badge.textContent = lang === 'vi' ? data.badgeVi : data.badgeEn;
      badge.style.cssText = `flex-shrink:0; padding:4px 12px; border-radius:20px; font-size:12px; font-weight:600; white-space:nowrap; ${data.badgeStyle}`;
    }
    document.querySelectorAll('#deploy-mode-grid .channel-card').forEach((c) => {
      c.classList.toggle('channel-card--selected', c.dataset.deploy === state.deployMode);
    });
    updateDockerNotice();
  }

  window.__selectOs = function(os) {
    state.nativeOs = os;
    document.querySelectorAll('#native-os-grid .channel-card').forEach((c) => c.classList.remove('channel-card--selected'));
    document.querySelector(`#native-os-grid .channel-card[data-os="${os}"]`)?.classList.add('channel-card--selected');
    updateAdvisory(os);
    updateNavButtons();
  };

  window.__toggleDeployOverride = function() {
    const panel = document.getElementById('deploy-override-panel');
    const btn = document.getElementById('btn-deploy-toggle');
    const lang = document.getElementById('cfg-language')?.value || 'vi';
    if (!panel) return;
    const isOpen = panel.style.display !== 'none';
    panel.style.display = isOpen ? 'none' : '';
    if (!isOpen) {
      document.querySelectorAll('#deploy-mode-grid .channel-card').forEach((c) => {
        c.classList.toggle('channel-card--selected', c.dataset.deploy === state.deployMode);
      });
    } else {
      updateAdvisory(state.nativeOs || 'win');
    }
    if (btn?.querySelector('span')) {
      btn.querySelector('span').textContent = isOpen
        ? (lang === 'vi' ? 'Tuỳ chỉnh ▾' : 'Customize ▾')
        : (lang === 'vi' ? 'Thu gọn ▴' : 'Collapse ▴');
    }
  };

  function updateDockerNotice() {
    const notice = document.getElementById('docker-install-notice');
    const winNotice = document.getElementById('docker-win-notice');
    if (notice) notice.style.display = state.deployMode === 'docker' ? '' : 'none';
    if (winNotice) winNotice.style.display = (state.deployMode === 'docker' && state.nativeOs === 'win') ? '' : 'none';
  }

  function renderProviderCards() {
    const grid = document.getElementById('provider-grid');
    if (!grid) return;
    const lang = document.getElementById('cfg-language')?.value || 'vi';
    grid.innerHTML = Object.entries(PROVIDERS).map(([key, p]) => {
      const iconHTML = p.logo
        ? `<img src="${p.logo}" alt="${p.name}" width="32" height="32">`
        : `<span style="font-size:32px;line-height:1">${p.logoEmoji || '🤖'}</span>`;
      const badgeClass = p.isProxy ? 'badge--proxy' : (p.free ? 'badge--free' : 'badge--paid');
      const badgeText = p.isProxy ? '🔀 Proxy' : (p.free ? '🆓 Free' : '🔒 Paid');
      const desc = lang === 'vi' ? (p.models?.[0]?.descVi || '') : (p.models?.[0]?.descEn || '');
      const selected = key === state.config.provider ? ' provider-card--selected' : '';
      return `
        <div class="provider-card${selected}" data-provider="${key}" onclick="window.__selectProvider('${key}')">
          <div class="provider-card__icon">${iconHTML}</div>
          <div class="provider-card__name">${p.name}</div>
          <div class="provider-card__badge ${badgeClass}">${badgeText}</div>
          ${desc ? `<div class="provider-card__desc">${desc}</div>` : ''}
        </div>`;
    }).join('');
  }

  function renderPluginGrid() {
    const lang = document.getElementById('cfg-language')?.value || 'vi';
    const providerKey = state.config.provider || 'google';
    const skillGrid = document.getElementById('plugin-grid');
    if (skillGrid) {
      skillGrid.innerHTML = SKILLS.map((skill) => {
        const checked = state.config.skills.includes(skill.id);
        const badge = getSkillBadge(skill, providerKey, lang);
        const name = escapeHtml(getSkillDisplayName(skill, providerKey, lang));
        const tooltip = escapeHtml(getSkillTooltipContent(skill, providerKey, lang));
        const badgeHtml = badge
          ? `<span class="${badge.className}">${escapeHtml(badge.text)}</span>`
          : '<span class="plugin-card__badge plugin-card__badge--placeholder">\u00a0</span>';
        const hintHtml = tooltip
          ? `<div class="plugin-card__hint" tabindex="0" onclick="event.preventDefault();event.stopPropagation();" aria-label="Info">
              \u24d8
              <div class="plugin-card__tooltip">${tooltip.replace(/\n/g, '<br>')}</div>
            </div>`
          : '<div class="plugin-card__hint plugin-card__hint--placeholder">\u24d8</div>';
        return `
          <label class="plugin-card${checked ? ' plugin-card--selected' : ''}" data-skill="${skill.id}">
            <input type="checkbox" class="plugin-checkbox" value="${skill.id}" ${checked ? 'checked' : ''} onchange="window.__toggleSkill('${skill.id}', this.checked)">
            <div class="plugin-card__topline">
              <div class="plugin-card__titleline">
                <span class="plugin-card__icon">${skill.icon}</span>
                <span class="plugin-card__name">${name}</span>
              </div>
              <div class="toggle-switch plugin-card__switch" aria-hidden="true">
                <span class="toggle-slider"></span>
              </div>
            </div>
            <div class="plugin-card__subline">
              <div class="plugin-card__hint-slot">${hintHtml}</div>
              <div class="plugin-card__badge-slot">${badgeHtml}</div>
            </div>
          </label>`;
      }).join('');
    }

    const pluginGrid = document.getElementById('extra-plugin-grid');
    if (pluginGrid) {
      pluginGrid.innerHTML = PLUGINS.filter((plugin) => !plugin.hidden).map((plugin) => {
        const checked = state.config.plugins.includes(plugin.id);
        const name = escapeHtml(plugin.name);
        const tooltip = escapeHtml(getPluginTooltipContent(plugin, lang));
        const hintHtml = tooltip
          ? `<div class="plugin-card__hint" tabindex="0" onclick="event.preventDefault();event.stopPropagation();" aria-label="Info">
              \u24d8
              <div class="plugin-card__tooltip">${tooltip}</div>
            </div>`
          : '<div class="plugin-card__hint plugin-card__hint--placeholder">\u24d8</div>';
        return `
          <label class="plugin-card${checked ? ' plugin-card--selected' : ''}" data-plugin="${plugin.id}">
            <input type="checkbox" class="plugin-checkbox" value="${plugin.id}" ${checked ? 'checked' : ''} onchange="window.__togglePlugin('${plugin.id}', this.checked)">
            <div class="plugin-card__topline">
              <div class="plugin-card__titleline">
                <span class="plugin-card__icon">${plugin.icon}</span>
                <span class="plugin-card__name">${name}</span>
              </div>
              <div class="toggle-switch plugin-card__switch" aria-hidden="true">
                <span class="toggle-slider"></span>
              </div>
            </div>
            <div class="plugin-card__subline">
              <div class="plugin-card__hint-slot">${hintHtml}</div>
            </div>
          </label>`;
      }).join('');
    }
  }

  window.__toggleSkill = function(id, checked) {
    if (checked && !state.config.skills.includes(id)) {
      state.config.skills.push(id);
    } else if (!checked) {
      state.config.skills = state.config.skills.filter((s) => s !== id);
    }
    document.querySelector(`.plugin-card[data-skill="${id}"]`)?.classList.toggle('plugin-card--selected', checked);
    updateNavButtons();
  };

  /**
   * Auto-show and auto-enable the Telegram Multi-Bot Relay plugin card
   * when multi-bot Telegram is active. Hide it otherwise.
   * Called from: bindChannelCards, multi-bot.js bot count change, renderPluginGrid.
   */
  function syncRelayPluginVisibility() {
    const isMultiBotTelegram = state.channel === 'telegram' && state.botCount > 1;
    const relayId = 'telegram-multibot-relay';
    const relayPlugin = PLUGINS.find((p) => p.id === relayId);
    if (!relayPlugin) return;

    // Auto-add/remove from state
    if (isMultiBotTelegram && !state.config.plugins.includes(relayId)) {
      state.config.plugins.push(relayId);
    } else if (!isMultiBotTelegram) {
      state.config.plugins = state.config.plugins.filter((p) => p !== relayId);
    }

    // Show/hide card in the extra-plugin-grid
    const pluginGrid = document.getElementById('extra-plugin-grid');
    if (!pluginGrid) return;
    let card = pluginGrid.querySelector(`.plugin-card[data-plugin="${relayId}"]`);

    if (isMultiBotTelegram) {
      if (!card) {
        // Render the relay card and prepend it
        const lang = document.getElementById('cfg-language')?.value || 'vi';
        const name = escapeHtml(relayPlugin.name);
        const tooltip = escapeHtml(getPluginTooltipContent(relayPlugin, lang));
        const badgeText = lang === 'vi' ? 'Tự động bật' : 'Auto-enabled';
        const hintHtml = tooltip
          ? `<div class="plugin-card__hint" tabindex="0" onclick="event.preventDefault();event.stopPropagation();" aria-label="Info">
              \u24d8
              <div class="plugin-card__tooltip">${tooltip}</div>
            </div>`
          : '<div class="plugin-card__hint plugin-card__hint--placeholder">\u24d8</div>';
        const html = `
          <label class="plugin-card plugin-card--selected" data-plugin="${relayId}">
            <input type="checkbox" class="plugin-checkbox" value="${relayId}" checked disabled>
            <div class="plugin-card__topline">
              <div class="plugin-card__titleline">
                <span class="plugin-card__icon">${relayPlugin.icon}</span>
                <span class="plugin-card__name">${name}</span>
              </div>
              <div class="toggle-switch plugin-card__switch" aria-hidden="true">
                <span class="toggle-slider"></span>
              </div>
            </div>
            <div class="plugin-card__subline">
              <div class="plugin-card__hint-slot">${hintHtml}</div>
              <div class="plugin-card__badge-slot"><span class="plugin-card__badge plugin-card__badge--recommended">${badgeText}</span></div>
            </div>
          </label>`;
        pluginGrid.insertAdjacentHTML('afterbegin', html);
      } else {
        card.style.display = '';
        card.classList.add('plugin-card--selected');
        const checkbox = card.querySelector('input[type="checkbox"]');
        if (checkbox) { checkbox.checked = true; checkbox.disabled = true; }
      }
    } else if (card) {
      card.style.display = 'none';
      card.classList.remove('plugin-card--selected');
      const checkbox = card.querySelector('input[type="checkbox"]');
      if (checkbox) { checkbox.checked = false; checkbox.disabled = false; }
    }
  }
  // Expose for multi-bot.js to call when bot count changes
  window.__syncRelayPluginVisibility = syncRelayPluginVisibility;

  window.__togglePlugin = function(id, checked) {
    if (checked && !state.config.plugins.includes(id)) {
      state.config.plugins.push(id);
    } else if (!checked) {
      state.config.plugins = state.config.plugins.filter((p) => p !== id);
    }
    document.querySelector(`.plugin-card[data-plugin="${id}"]`)?.classList.toggle('plugin-card--selected', checked);
    updateNavButtons();
  };

  function bindFormEvents() {
    document.addEventListener('input', (e) => {
      const target = e.target;
      if (!target || !target.id) return;
      if (target.id === 'cfg-user-info') state.config.userInfo = target.value.trim();
      if (target.id === 'cfg-project-path') state.config.projectPath = target.value.trim();
      if (target.id === 'cfg-security') {
        target.dataset.userEdited = 'true';
        state.config.securityRules = target.value;
      }
      updateNavButtons();
    });
  }

  function populateStep2() {
    const lang = document.getElementById('cfg-language')?.value || 'vi';
    const userInfoEl = document.getElementById('cfg-user-info');
    const securityEl = document.getElementById('cfg-security');
    if (userInfoEl) userInfoEl.value = state.config.userInfo || '';
    if (securityEl) {
      if (state.config.securityRules) {
        securityEl.value = state.config.securityRules;
        securityEl.dataset.userEdited = 'true';
      } else if (!securityEl.dataset.userEdited) {
        securityEl.value = DEFAULT_SECURITY_RULES[lang];
      }
    }
    renderProviderCards();
    window.__selectProvider(state.config.provider || 'google');
    const modelSelect = document.getElementById('cfg-model');
    if (modelSelect && state.config.model) {
      const opt = modelSelect.querySelector(`option[value="${state.config.model}"]`);
      if (opt) modelSelect.value = state.config.model;
    }
    renderPluginGrid();
    const channelLabel = document.getElementById('selected-channel-label');
    if (channelLabel && state.channel && CHANNELS[state.channel]) {
      channelLabel.textContent = CHANNELS[state.channel].name;
    }
    renderBotTabBar();
    updateNavButtons();
  }

  function saveFormData() {
    const lang = document.getElementById('cfg-language')?.value || 'vi';
    const singleName = document.getElementById('cfg-name')?.value?.trim();
    const tabName = document.getElementById('cfg-bot-tab-name')?.value?.trim();
    const singleDesc = document.getElementById('cfg-desc')?.value?.trim();
    const tabDesc = document.getElementById('cfg-bot-tab-desc')?.value?.trim();
    state.config.botName = singleName || tabName || state.config.botName || 'Chat Bot';
    state.config.description = singleDesc || tabDesc || state.config.description || (lang === 'vi' ? 'Trợ lý AI cá nhân' : 'Personal AI assistant');
    state.config.model = document.getElementById('cfg-model')?.value || state.config.model || 'google/gemini-2.5-flash';
    state.config.language = lang;
    state.config.userInfo = document.getElementById('cfg-user-info')?.value?.trim() || state.config.userInfo || '';
    state.config.securityRules = document.getElementById('cfg-security')?.value || state.config.securityRules || DEFAULT_SECURITY_RULES[lang];
  }

  window.__saveBotToken = function(index, val) {
    if (state.bots[index]) state.bots[index].token = val;
    updateNavButtons();
  };

  function populateStep3() {
    const ch = CHANNELS[state.channel];
    const provider = PROVIDERS[state.config.provider];
    if (!ch || !provider) return;
    renderKeyInputs();
    updateNavButtons();
  }

  function renderKeyInputs() {
    const ch = CHANNELS[state.channel];
    const provider = PROVIDERS[state.config.provider];
    if (!ch || !provider) return;

    const lang = document.getElementById('cfg-language')?.value || 'vi';
    const isVi = lang === 'vi';
    const providerEl = document.getElementById('key-section-provider');
    if (providerEl) {
      let pHtml = '';
      const providerName = provider.isProxy ? '9Router (Proxy)' : (provider.isLocal ? 'Ollama (Local)' : provider.name);
      const providerIcon = provider.isProxy ? '🔀' : (provider.isLocal ? '🏠' : '🤖');
      pHtml += `<div style="padding:16px 20px;border:1px solid rgba(255,255,255,0.08);border-radius:12px;background:rgba(255,255,255,0.02);">`;
      pHtml += `<h3 style="margin:0 0 12px;font-size:15px;font-weight:700;color:var(--text-primary);">${providerIcon} AI Provider — ${providerName}</h3>`;
      if (provider.isProxy) {
        pHtml += `<p style="font-size:13px;color:var(--text-secondary);margin:0;">${isVi ? '9Router không cần API key trong wizard. Sau khi chạy xong, mở dashboard để login OAuth provider.' : '9Router does not need an API key in the wizard. After install, open the dashboard to OAuth-login providers.'}</p>`;
      } else if (provider.isLocal) {
        pHtml += `<p style="font-size:13px;color:var(--text-secondary);margin:0;">${isVi ? 'Ollama sẽ được cấu hình tự động. Không cần nhập API key.' : 'Ollama is configured automatically. No API key required.'}</p>`;
      } else {
        pHtml += `<div class="form-group" style="margin:0;">
          <label class="form-group__label" for="key-api-key">🔑 ${provider.envLabel} <span style="color:var(--danger,#ef4444)">*</span></label>
          <input type="text" class="form-input" id="key-api-key" value="${escapeHtml(state.config.apiKey || '')}" placeholder="${provider.envKey}=..." style="font-family:monospace;font-size:13px;" oninput="window.__validateKeys()">
          <p class="form-group__hint">${isVi ? 'Lấy từ' : 'Get from'} <a href="${provider.envLink}" target="_blank">${provider.envLink.replace('https://', '')}</a></p>
        </div>`;
      }
      pHtml += `</div>`;
      providerEl.innerHTML = pHtml;
    }

    const channelEl = document.getElementById('key-section-channel');
    if (channelEl) {
      let cHtml = '';
      const channelName = ch.name;
      const channelIcon = state.channel === 'telegram' ? '📨' : '💬';
      cHtml += `<div style="padding:16px 20px;border:1px solid rgba(255,255,255,0.08);border-radius:12px;background:rgba(255,255,255,0.02);">`;
      cHtml += `<h3 style="margin:0 0 12px;font-size:15px;font-weight:700;color:var(--text-primary);">${channelIcon} ${isVi ? 'Kênh chat' : 'Chat Channel'} — ${channelName}</h3>`;
      if (state.channel === 'telegram') {
        if (state.botCount > 1) {
          cHtml += `<div style="display:flex;flex-direction:column;gap:12px;">`;
          for (let i = 0; i < state.botCount; i++) {
            const botLabel = state.bots[i]?.name || `Bot ${i + 1}`;
            const slashTag = state.bots[i]?.slashCmd ? ` <code style="font-size:11px;color:var(--text-muted)">${escapeHtml(state.bots[i].slashCmd)}</code>` : '';
            cHtml += `<div class="form-group" style="margin:0;">
              <label class="form-group__label" for="key-bot-token-${i}">🤖 ${escapeHtml(botLabel)}${slashTag} — Bot Token <span style="color:var(--danger,#ef4444)">*</span></label>
              <input type="text" class="form-input" id="key-bot-token-${i}" value="${escapeHtml(state.bots[i]?.token || '')}" placeholder="1234567890:ABC..." style="font-family:monospace;font-size:13px;" oninput="window.__saveBotToken(${i},this.value);window.__validateKeys()">
            </div>`;
          }
          cHtml += `</div>`;
        } else {
          cHtml += `<div class="form-group" style="margin:0;">
            <label class="form-group__label" for="key-bot-token">🤖 Telegram Bot Token <span style="color:var(--danger,#ef4444)">*</span></label>
            <input type="text" class="form-input" id="key-bot-token" value="${escapeHtml(state.config.botToken || '')}" placeholder="1234567890:ABC..." style="font-family:monospace;font-size:13px;" oninput="window.__validateKeys()">
            <p class="form-group__hint">${isVi ? 'Lấy từ @BotFather' : 'Get it from @BotFather'}</p>
          </div>`;
        }
      } else if (state.channel === 'zalo-bot') {
        cHtml += `<div class="form-group" style="margin:0;">
          <label class="form-group__label" for="key-bot-token">🔑 Zalo Bot Token <span style="color:var(--danger,#ef4444)">*</span></label>
          <input type="text" class="form-input" id="key-bot-token" value="${escapeHtml(state.config.botToken || '')}" placeholder="Zalo Bot Token" style="font-family:monospace;font-size:13px;" oninput="window.__validateKeys()">
        </div>`;
      } else {
        cHtml += `<div style="display:flex;gap:8px;align-items:flex-start;padding:12px 14px;background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.2);border-radius:8px;font-size:13px;color:var(--warning);margin:0;">
          <span style="font-size:16px;margin-top:-2px;">⚠️</span>
          <span style="line-height:1.5;">${isVi ? 'Zalo Personal dùng QR login sau khi cài đặt. Không cần token ở bước này.' : 'Zalo Personal uses QR login after install. No token needed in this step.'}</span>
        </div>`;
      }
      cHtml += `</div>`;
      channelEl.innerHTML = cHtml;
    }

    const skillsEl = document.getElementById('key-section-skills');
    if (skillsEl) {
      let sHtml = '';
      state.config.skills.forEach((sid) => {
        const skill = SKILLS.find((s) => s.id === sid);
        if (!skill?.envVars?.length) return;
        skill.envVars.forEach((envLine) => {
          const eq = envLine.indexOf('=');
          if (eq > 0 && !envLine.startsWith('#')) {
            const envKey = envLine.substring(0, eq);
            sHtml += `<div class="form-group" style="margin-bottom:16px;">
              <label class="form-group__label" for="key-${envKey.toLowerCase()}">${skill.icon} ${envKey}</label>
              <input type="text" class="form-input" id="key-${envKey.toLowerCase()}" placeholder="${escapeHtml(envLine)}" style="font-family:monospace;font-size:13px;" oninput="window.__validateKeys()">
              <p class="form-group__hint">${escapeHtml(skill.noteVi || skill.noteEn || skill.note || '')}</p>
            </div>`;
          }
        });
      });
      skillsEl.innerHTML = sHtml;
    }

    if (state.config.projectPath) {
      const ppEl = document.getElementById('cfg-project-path');
      if (ppEl) ppEl.value = state.config.projectPath;
    }
  }

  window.__validateKeys = function() {
    saveCredentials();
    updateNavButtons();
  };

  function populateEnvContent() {
    const ch = CHANNELS[state.channel];
    const provider = PROVIDERS[state.config.provider];
    const envContent = document.getElementById('env-content');
    if (!ch || !provider || !envContent) return;
    const lines = [];
    const apiKeyVal = document.getElementById('key-api-key')?.value?.trim() || state.config.apiKey || '';
    const botTokenVal = document.getElementById('key-bot-token')?.value?.trim() || state.config.botToken || '';
    if (provider.isProxy) {
      lines.push('# No AI API key needed — 9Router handles upstream auth');
    } else if (provider.isLocal) {
      lines.push('OLLAMA_HOST=http://ollama:11434');
      lines.push('OLLAMA_API_KEY=ollama-local');
    } else {
      lines.push(`${provider.envKey}=${apiKeyVal || `<your_${provider.envKey.toLowerCase()}>`}`);
    }
    if (state.channel === 'telegram' && state.botCount > 1) {
      lines.push('');
      lines.push('# Multi-bot Telegram tokens');
      for (let i = 0; i < state.botCount; i++) {
        const t = state.bots[i]?.token || '';
        const label = state.bots[i]?.name || `Bot ${i + 1}`;
        lines.push(`TELEGRAM_BOT_TOKEN_${i + 1}=${t || `<token_for_${label.toLowerCase().replace(/\s+/g, '_')}>`}`);
      }
      if (state.groupId) lines.push(`TELEGRAM_GROUP_ID=${state.groupId}`);
    } else if (ch.envExtra) {
      lines.push(botTokenVal ? ch.envExtra.replace(/=<[^>]+>$/, `=${botTokenVal}`) : ch.envExtra);
    }
    state.config.skills.forEach((sid) => {
      const skill = SKILLS.find((s) => s.id === sid);
      if (!skill?.envVars?.length) return;
      lines.push('');
      lines.push(`# --- ${skill.name} ---`);
      skill.envVars.forEach((v) => {
        const eq = v.indexOf('=');
        if (eq > 0 && !v.startsWith('#')) {
          const envKey = v.substring(0, eq);
          const inputVal = document.getElementById(`key-${envKey.toLowerCase()}`)?.value?.trim() || '';
          lines.push(`${envKey}=${inputVal || v.substring(eq + 1)}`);
        } else {
          lines.push(v);
        }
      });
    });
    envContent.textContent = lines.join('\n');
  }

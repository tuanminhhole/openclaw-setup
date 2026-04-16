// @ts-nocheck
/* eslint-disable no-undef, no-unused-vars */
/**
 * @fileoverview UI layer — part of the OpenClaw Setup Wizard IIFE bundle.
 * Variables like state, PROVIDERS, SKILLS, PLUGINS, CHANNELS are IIFE globals.
 * Functions like botFiles(), botConfigContent() etc. are defined in generators/.
 *
 * Built via: node build.mjs
 */
  // ========== Navigation ==========
  function bindNavButtons() {
    const btnNext = document.getElementById('btn-next');
    const btnPrev = document.getElementById('btn-prev');

    btnNext.addEventListener('click', () => {
      // Step 2 requires channel selection
      if (state.currentStep === 2 && !state.channel) return;
      // Step 3 (bot config) — save form
      if (state.currentStep === 3) saveFormData();
      // Step 4 (credentials) — save before moving to step 5
      if (state.currentStep === 4) saveCredentials();
      if (state.currentStep < state.totalSteps) {
        goToStep(state.currentStep + 1);
      }
    });

    btnPrev.addEventListener('click', () => {
      if (state.currentStep > 1) {
        // Save current step data before going back
        if (state.currentStep === 3) saveFormData();
        if (state.currentStep === 4) saveCredentials();
        goToStep(state.currentStep - 1);
      }
    });
  }

  function goToStep(step) {
    state.currentStep = step;
    // 1=env/deploy, 2=channel, 3=bot config, 4=api keys, 5=output
    if (step === 3) populateStep2(); // bot config
    if (step === 4) populateStep3(); // api keys
    if (step === 5) generateOutput(); // output
    updateUI();
  }

  function updateUI() {
    document.querySelectorAll('.step').forEach((el) => {
      el.classList.toggle('step--active', parseInt(el.dataset.step) === state.currentStep);
    });

    document.querySelectorAll('.progress-step').forEach((el) => {
      const stepNum = parseInt(el.dataset.pstep);
      el.classList.toggle('progress-step--active', stepNum === state.currentStep);
      el.classList.toggle('progress-step--completed', stepNum < state.currentStep);
    });

    document.querySelectorAll('.progress-line').forEach((el) => {
      const after = parseInt(el.dataset.after);
      el.classList.toggle('progress-line--active', after < state.currentStep);
    });

    updateNavButtons();
  }

  function updateNavButtons() {
    const btnNext = document.getElementById('btn-next');
    const btnPrev = document.getElementById('btn-prev');
    const btnNextLabel = document.getElementById('btn-next-label');

    btnPrev.style.visibility = state.currentStep === 1 ? 'hidden' : 'visible';

    if (state.currentStep === state.totalSteps) {
      btnNext.style.display = 'none';
    } else {
      const lang = document.getElementById('cfg-language')?.value || 'vi';
      btnNext.style.display = '';

      let isDisabled = false;
      // Step 1 (env): always valid
      // Step 2 (channel): require selection
      if (state.currentStep === 2 && !state.channel) isDisabled = true;
      // Step 3 (bot config): require at least one bot name
      if (state.currentStep === 3) {
        if (state.botCount > 1) {
          // Multi-bot: require name for the currently active bot tab
          const activeTab = state.activeBotIndex || 0;
          const tabNameVal = document.getElementById('cfg-bot-tab-name')?.value?.trim()
            || state.bots[activeTab]?.name?.trim();
          if (!tabNameVal) isDisabled = true;
        } else {
          // Single bot: require cfg-name or the shared tab name field
          const nameVal = document.getElementById('cfg-name')?.value?.trim()
            || document.getElementById('cfg-bot-tab-name')?.value?.trim()
            || state.config.botName?.trim();
          if (!nameVal) isDisabled = true;
        }
      }
      // Step 4 (api keys): require token/key
      if (state.currentStep === 4) {
        const provider = PROVIDERS[state.config.provider];
        const hasTelegramCh = state.channel === 'telegram';
        if (hasTelegramCh && state.botCount > 1) {
          // Multi-bot: check DOM first, fallback to state (works even before user types)
          const firstTokenEl = document.getElementById('key-bot-token-0');
          const firstTokenVal = firstTokenEl?.value?.trim() || state.bots[0]?.token?.trim() || '';
          if (!firstTokenVal) isDisabled = true;
        } else if (hasTelegramCh || state.channel === 'zalo-bot') {
          const botTokenEl = document.getElementById('key-bot-token');
          const botTokenVal = botTokenEl?.value?.trim() || state.config.botToken?.trim() || '';
          if (!botTokenVal) isDisabled = true;
        }
        // API key: check DOM first, fallback to state
        if (provider && !provider.isProxy && !provider.isLocal && provider.envKey) {
          const apiKeyEl = document.getElementById('key-api-key');
          const apiKeyVal = apiKeyEl?.value?.trim() || state.config.apiKey?.trim() || '';
          if (!apiKeyVal) isDisabled = true;
        }
      }

      btnNext.disabled = isDisabled;
      btnNextLabel.textContent = state.currentStep === 4
        ? (lang === 'vi' ? 'Generate Configs' : 'Generate Configs')
        : (lang === 'vi' ? 'Tiếp theo' : 'Next');

      // Show inline hint when Generate Configs is blocked
      let hintEl = document.getElementById('btn-next-hint');
      if (state.currentStep === 4 && isDisabled) {
        if (!hintEl) {
          hintEl = document.createElement('p');
          hintEl.id = 'btn-next-hint';
          hintEl.style.cssText = 'font-size:12px;color:#ffc107;text-align:center;margin:6px 16px 0;';
          const navEl = document.querySelector('.nav-buttons');
          if (navEl && navEl.parentNode) navEl.parentNode.insertBefore(hintEl, navEl.nextSibling);
        }
        const missing = [];
        const _prov = PROVIDERS[state.config.provider];
        if (state.channel === 'telegram' && state.botCount > 1) {
          const t0 = document.getElementById('key-bot-token-0')?.value?.trim() || state.bots[0]?.token?.trim() || '';
          if (!t0) missing.push(lang === 'vi' ? 'Token Bot 1' : 'Bot 1 Token');
        } else if (state.channel === 'telegram' || state.channel === 'zalo-bot') {
          const bt = document.getElementById('key-bot-token')?.value?.trim() || state.config.botToken?.trim() || '';
          if (!bt) missing.push('Bot Token');
        }
        if (_prov && !_prov.isProxy && !_prov.isLocal && _prov.envKey) {
          const ak = document.getElementById('key-api-key')?.value?.trim() || state.config.apiKey?.trim() || '';
          if (!ak) missing.push(_prov.envLabel || _prov.envKey);
        }
        if (missing.length) {
          hintEl.textContent = (lang === 'vi' ? '⚠️ Còn thiếu: ' : '⚠️ Missing: ') + missing.join(', ');
        }
      } else if (hintEl) {
        hintEl.remove();
      }
    }
  }


  // ========== Step 2: Bot Config ==========

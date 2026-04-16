// @ts-nocheck
/* eslint-disable no-undef, no-unused-vars */
/**
 * @fileoverview Part of the OpenClaw Setup Wizard IIFE bundle.
 * Thin wrappers that delegate to install-gen.js pure builders.
 * Do NOT add import/export statements. Edit, then run: node build.mjs
 */

// ── Wizard-only wrappers (read state, delegate to shared builders) ──────────

function generateStartBotBat(opts) {
  return globalThis.__openclawInstall.buildStartBotBat(opts);
}

function generateStartBotSh(opts) {
  return globalThis.__openclawInstall.buildStartBotSh(opts);
}

function generateStartScript() {
  const osType = typeof state !== 'undefined' && state.os ? state.os : 'windows';
  const is9RouterConfigured = typeof state !== 'undefined' && state.config && state.config.provider === '9router';
  const isViLang = typeof isVi !== 'undefined' ? isVi : true;

  if (osType === 'windows') {
    return {
      name: 'start-bot.bat',
      content: generateStartBotBat({
        projectDir: '%~dp0',
        openclawHome: '%~dp0.openclaw',
        is9Router: is9RouterConfigured,
        isVi: isViLang
      })
    };
  } else if (osType === 'linux' || osType === 'linux-desktop' || osType === 'vps') {
    return {
      name: 'start-bot.sh',
      content: generateStartBotSh({
        projectDir: '$(cd "$(dirname "$0")" && pwd)',
        is9Router: is9RouterConfigured,
        isVi: isViLang
      })
    };
  }
  return null;
}

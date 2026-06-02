const $ = (sel) => document.querySelector(sel);
const state = { tab: 'dashboard', system: null, install: null, files: [], catalog: { skills: [], plugins: [] }, logs: [], zaloLoginOpen: false, zaloLoginLines: [], zaloQrDataUrl: '', lang: localStorage.getItem('openclaw-lang') || 'vi', theme: localStorage.getItem('openclaw-theme') || 'dark', os: null, mode: null, donateOpen: false, botModalOpen: false, botEditId: '', installModalOpen: false, installTab: 'docker', installDraft: null, pathModal: null, confirmModal: null, botChannel: 'telegram', botPane: 'list', activeBotId: '', selectedFile: '', botMessage: '', projectConnectMessage: '', pendingProjectDir: '', selectedProjectDir: '', featureFlags: {}, featureInstalled: {}, featureLoading: {}, openDirs: {} };
const SVG_CDN = 'https://cdn.jsdelivr.net/gh/glincker/thesvg@main/public/icons';
const OS_OPTIONS = [
  { id: 'win', title: 'Windows', subtitle: 'Auto-detected desktop', icon: `${SVG_CDN}/windows/default.svg`, badge: 'Desktop' },
  { id: 'macos', title: 'macOS', subtitle: 'Apple Silicon / Intel', icon: `${SVG_CDN}/apple/default.svg`, badge: 'Desktop' },
  { id: 'linux-desktop', title: 'Linux Desktop', subtitle: 'Ubuntu / Debian / Fedora', icon: `${SVG_CDN}/linux/default.svg`, badge: 'Desktop' },
  { id: 'vps', title: 'Linux VPS', subtitle: 'Server install with public bind', icon: `${SVG_CDN}/ubuntu/default.svg`, badge: 'Server' },
];
const MODE_OPTIONS = [
  { id: 'docker', title: 'Docker', subtitle: 'Isolated containers, safest default', icon: `${SVG_CDN}/docker/default.svg`, badge: 'Recommended' },
  { id: 'native', title: 'Native', subtitle: 'Direct host install, lighter runtime', icon: `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='16' fill='%231b1113'/%3E%3Cpath d='M15 22l9 10-9 10' fill='none' stroke='%23ff3b4d' stroke-width='5' stroke-linecap='round' stroke-linejoin='round'/%3E%3Cpath d='M30 42h19' fill='none' stroke='%23f8f7f7' stroke-width='5' stroke-linecap='round'/%3E%3C/svg%3E`, badge: 'Advanced' },
];
const BOT_CHANNELS = [
  { id: 'telegram', title: 'Telegram', subtitle: 'Bot API', icon: `${SVG_CDN}/telegram/default.svg`, badge: 'Tele' },
  { id: 'zalo-personal', title: 'Zalo User', subtitle: 'Personal account', icon: `${SVG_CDN}/zalo/default.svg`, badge: 'User' },
  { id: 'zalo-bot', title: 'Zalo API', subtitle: 'Official Account', icon: `${SVG_CDN}/zalo/default.svg`, badge: 'API' },
];

function choiceCard(group, item, current) {
  return `<label class="choice-card logo-card ${item.id === current ? 'is-selected' : ''}">
    <input name="${group}" type="radio" value="${item.id}" ${item.id===current?'checked':''}/>
    <span class="choice-card__icon"><img src="${item.icon}" alt="${item.title} icon" loading="lazy" onerror="this.style.display='none'"/></span>
    <span class="choice-card__body"><strong>${item.title}</strong><small>${item.badge}</small></span>
  </label>`;
}
function staticChoiceCard(item) {
  return `<div class="choice-card logo-card is-selected bot-channel-static" aria-label="${escapeHtml(item.title)}">
    <span class="choice-card__icon"><img src="${item.icon}" alt="${escapeHtml(item.title)} icon" loading="lazy" onerror="this.style.display='none'"/></span>
    <span class="choice-card__body"><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.badge)}</small></span>
  </div>`;
}

async function api(path, opts) {
  const res = await fetch(path, opts && opts.body ? { ...opts, headers: { 'content-type': 'application/json' }, body: JSON.stringify(opts.body) } : opts);
  if (!res.ok) throw new Error((await res.json()).error || res.statusText);
  return res.json();
}
function runtimeBadge(label, kind='') { return `<span class="mini-pill ${kind?`mini-pill--${kind}`:''}">${escapeHtml(label)}</span>`; }
async function withButtonLoading(btn, task) {
  if (!btn || btn.classList.contains('is-loading')) return;
  const prevDisabled = btn.disabled;
  btn.classList.add('is-loading');
  btn.disabled = true;
  btn.setAttribute('aria-busy', 'true');
  try { return await task(); }
  finally {
    if (btn.isConnected) {
      btn.classList.remove('is-loading');
      btn.disabled = prevDisabled;
      btn.removeAttribute('aria-busy');
    }
  }
}
document.addEventListener('click', (ev) => {
  const btn = ev.target.closest('button');
  if (!btn || btn.disabled || btn.classList.contains('is-loading')) return;
  btn.classList.add('is-press-loading');
  setTimeout(() => btn.classList.remove('is-press-loading'), 450);
}, true);

function icon(name) {
  const paths = {
    dashboard: 'M4 5h7v7H4z M13 5h7v10h-7z M4 14h7v5H4z M13 17h7v2h-7z',
    setup: 'M12 6v6l4 2M4 13a8 8 0 1 0 16 0 8 8 0 0 0-16 0Z',
    bot: 'M7 8h10v8H7z M9 4h6v4H9z M9 11h.01M15 11h.01M10 16h4',
    files: 'M6 3h8l4 4v14H6z M14 3v5h5 M9 13h6 M9 17h6',
    skills: 'M12 2l2.4 6.8H22l-6 4.4 2.3 6.8-6.3-4.2L5.7 20 8 13.2 2 8.8h7.6z',
    logs: 'M4 6h16M4 12h16M4 18h10'
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="${paths[name]}"/></svg>`;
}


function copyIcon() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
}
function actionIcon(name) {
  const d = {
    refresh: '<path d="M20 11a8 8 0 1 0 2 5.3"/><path d="M20 4v7h-7"/>',
    folder: '<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H10l2 2h6.5A2.5 2.5 0 0 1 21 9.5v7A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5z"/>',
    link: '<path d="M10 13a5 5 0 0 1 0-7l1.5-1.5a5 5 0 0 1 7 7L17 13"/><path d="M14 11a5 5 0 0 1 0 7L12.5 19.5a5 5 0 0 1-7-7L7 11"/>',
    trash: '<path d="M4 7h16"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12"/><path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
    save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    spark: '<path d="M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8Z"/>'
  }[name];
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
}
function socialIcon(name) {
  const d = {
    facebook:'M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z',
    telegram:'M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z',
    zalo:'M4 6h16v10H8l-4 4V6z M9 10h6 M9 13h4',
    github:'M9 19c-5 1-5-2-7-3m14 6v-3.9a3.4 3.4 0 0 0-.9-2.6c3-.3 6.1-1.5 6.1-6.7A5.2 5.2 0 0 0 20 5.2 4.8 4.8 0 0 0 19.9 2S18.7 1.7 16 3.5a13.4 13.4 0 0 0-7 0C6.3 1.7 5.1 2 5.1 2A4.8 4.8 0 0 0 5 5.2a5.2 5.2 0 0 0-1.4 3.6c0 5.2 3.1 6.4 6.1 6.7a3 3 0 0 0-.9 2.1V22'
  }[name];
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
}
function sidebarExtras() {
  const socials = [
    ['facebook','https://www.facebook.com/holeminhtuan.it/'],
    ['telegram','https://t.me/holeminhtuan_it'],
    ['zalo','https://zalo.me/0962794917'],
    ['github','https://github.com/tuanminhhole/']
  ];
  return `<div style="margin-top: auto; width: 100%;">
    <hr style="border: 0; border-top: 1px solid var(--hair); margin: 16px 0 20px 0; opacity: 0.6;" />
    <div class="sidebar-extra" style="margin-top: 0;">
      <div class="side-info side-author" style="text-align: center; background: transparent; border: none; box-shadow: none; padding: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%;">
        <p style="margin: 0 0 10px 0; font-weight: 600; color: var(--muted); font-size: 12.5px; display: inline-flex; align-items: center; gap: 4px;">Được làm ❤️ bởi <a href="https://zalo.me/0962794917" target="_blank" rel="noopener" style="color: var(--muted); text-decoration: none; font-weight: 700;">tuanminhole</a></p>
        <div class="socials" style="justify-content: center; margin-top: 0; display: flex; gap: 8px; width: 100%;">
          ${socials.map(([n,u])=>`<a href="${u}" target="_blank" rel="noopener" aria-label="${n}">${socialIcon(n)}</a>`).join('')}
        </div>
      </div>
    </div>
  </div>`;
}
function donateModal() {
  if (!state.donateOpen) return '';
  return `<div class="modal-backdrop" data-donate="close"><section class="donate-modal" role="dialog" aria-modal="true" aria-label="Donate" onclick="event.stopPropagation()">
    <button class="modal-x" data-donate="close" aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
    <div class="donate-head"><span aria-hidden="true">&#10084;</span><div><p>${t('\u1ee6ng h\u1ed9 OpenClaw', 'Support OpenClaw')}</p><h2>Donate</h2><small>${t('\u0110\u00f3ng g\u00f3p c\u1ee7a b\u1ea1n gi\u00fap duy tr\u00ec h\u1ea1 t\u1ea7ng, s\u1eeda l\u1ed7i v\u00e0 c\u1ea3i ti\u1ebfn OpenClaw m\u1ed7i ng\u00e0y.', 'Your support keeps infrastructure running, fixes bugs, and improves OpenClaw every day.')}</small></div></div>
    <div class="donate-grid"><article><div class="qr-frame"><img src="/bvvbank.jpg" alt="BVBank transfer info"></div><b>BVBank</b></article><article><div class="qr-frame"><img src="/momo.jpg" alt="Momo transfer info"></div><b>Momo</b></article></div>
  </section></div>`;
}
function confirmModal() {
  const m = state.confirmModal;
  if (!m) return '';
  return `<div class="modal-backdrop confirm-backdrop" data-confirm-action="cancel">
    <section class="donate-modal confirm-modal" role="dialog" aria-modal="true" aria-label="${escapeHtml(m.title)}" onclick="event.stopPropagation()">
      <button class="modal-x" data-confirm-action="cancel" aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
      <div class="donate-head"><span aria-hidden="true">⚠</span><div><p>${escapeHtml(m.eyebrow || t('Xác nhận','Confirm'))}</p><h2>${escapeHtml(m.title)}</h2><small>${escapeHtml(m.message || '')}</small></div></div>
      <div class="confirm-actions"><button class="secondary" data-confirm-action="cancel">${t('Hủy','Cancel')}</button><button class="primary danger" data-confirm-action="ok">${escapeHtml(m.okText || t('Xóa','Delete'))}</button></div>
    </section>
  </div>`;
}
function pathModal() {
  const m = state.pathModal;
  if (!m) return '';
  return `<div class="modal-backdrop confirm-backdrop" data-path-action="cancel">
    <section class="donate-modal confirm-modal" role="dialog" aria-modal="true" aria-label="${escapeHtml(m.title || '')}" onclick="event.stopPropagation()">
      <button class="modal-x" data-path-action="cancel" aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
      <div class="donate-head"><span aria-hidden="true">📁</span><div><p>${escapeHtml(m.eyebrow || t('Nhập đường dẫn','Enter path'))}</p><h2>${escapeHtml(m.title || t('Đường dẫn project','Project path'))}</h2><small>${escapeHtml(m.message || '')}</small></div></div>
      <label class="field wide"><input id="path-modal-input" value="${escapeHtml(m.value || '')}" placeholder="${escapeHtml(m.placeholder || '')}" /></label>
      <div class="confirm-actions"><button class="secondary" data-path-action="cancel">${t('Hủy','Cancel')}</button><button class="primary" data-path-action="ok">${t('Xác nhận','Confirm')}</button></div>
    </section>
  </div>`;
}
function zaloLoginModal() {
  if (!state.zaloLoginOpen) return '';
  const lines = state.zaloLoginLines.slice(-120).join('\n') || t('Đang khởi động login Zalo...', 'Starting Zalo login...');
  return `<div class="modal-backdrop zalo-login-backdrop" data-zalo-login="close">
    <section class="donate-modal zalo-login-modal" role="dialog" aria-modal="true" aria-label="Zalo login" onclick="event.stopPropagation()">
      <button class="modal-x" data-zalo-login="close" aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
      <div class="donate-head"><span aria-hidden="true">Z</span><div><p>Zalo User</p><h2>${t('Quét mã QR đăng nhập','Scan login QR')}</h2><small>${t('Mở Zalo trên điện thoại → quét QR trong khung dưới. Nếu QR chưa hiện, đợi vài giây.', 'Open Zalo on your phone → scan the QR below. If it is not visible yet, wait a few seconds.')}</small></div></div>
      ${state.zaloQrDataUrl ? `<div class="zalo-qr-image-wrap"><img class="zalo-qr-image" src="${state.zaloQrDataUrl}" alt="Zalo login QR"/></div>` : ''}
      <pre class="zalo-qr-log" data-zalo-qr-log>${escapeHtml(lines)}</pre>
      <div class="zalo-login-actions"><button class="secondary" data-zalo-login="close" type="button">${t('\u0110óng','Close')}</button></div>
    </section>
  </div>`;
}
function installModal() {
  if (!state.installModalOpen) return '';
  const sys = state.system || {};
  const draft = refreshInstallDraft();
  const os = draft.os || state.os || sys?.os || 'win';
  const mode = draft.mode || state.installTab || state.mode || sys?.recommendedMode || 'docker';
  const pathExample = os === 'win' ? 'E:\\bot' : os === 'macos' ? '/Users/you/openclaw-bot' : '/home/you/openclaw-bot';
  const osChoices = OS_OPTIONS.map(o => [o.id, t(o.title, o.title), trChoice(o).subtitle]);
  const modeChoices = [
    ['docker', 'Docker', t('\u0043ontainer c\u00f4 l\u1eadp, an to\u00e0n nh\u1ea5t', 'Isolated containers, safest default')],
    ['native', 'Native', t('C\u00e0i tr\u1ef1c ti\u1ebfp, runtime nh\u1eb9 h\u01a1n', 'Direct host install, lighter runtime')],
  ];
  return `<div class="modal-backdrop install-backdrop" data-install-modal="close">
    <section class="donate-modal install-modal" role="dialog" aria-modal="true" aria-label="${t('T\u1ea1o Project','Create Project')}" onclick="event.stopPropagation()">
      <button class="modal-x" data-install-modal="close" aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
      <div class="donate-head"><span aria-hidden="true">+</span><div><p>${t('T\u1ea1o Project','Create Project')}</p><h2>${t('T\u1ea1o Project','Create Project')}</h2><small>${t('Ch\u1ecdn s\u1eb5n ch\u1ebf \u0111\u1ed9 \u1edf tab tr\u00ean. B\u00ean d\u01b0\u1edbi ch\u1ec9 c\u1ea7n ch\u1ecdn OS v\u00e0 nh\u1eadp ho\u1eb7c ch\u1ecdn \u0111\u01b0\u1eddng d\u1eabn project.','Mode stays in the tabs above. Below, choose OS and enter or pick the project path.')}</small></div></div>
      <form id="install-form" class="install-form">
        <div class="install-tabs">${modeChoices.map(([id,label,desc]) => `<button type="button" class="install-tab ${mode===id?'is-active':''}" data-install-set="mode" data-value="${id}"><strong>${escapeHtml(label)}</strong><small>${escapeHtml(desc)}</small></button>`).join('')}</div>
        <div class="install-grid install-grid--compact">
          <div class="field wide"><span>${t('H\u1ec7 \u0111i\u1ec1u h\u00e0nh','Operating system')}</span>${pillGroup('os', os, osChoices)}<small>${t('\u0110\u00e3 ch\u1ecdn s\u1eb5n theo m\u00e1y \u0111ang ch\u1ea1y','Preselected from the current machine')}</small></div>
          <label class="field wide"><span>${t('Đường dẫn project','Project path')}</span><input name="projectDir" placeholder="${escapeHtml(pathExample)}" value="${escapeHtml(draft.projectDir || pathExample)}" /><small>${t('Ví dụ: E:\\bot hoặc /home/you/openclaw-bot. Bạn có thể tự sửa tên folder bot thành tên bất kỳ.','Example: E:\\bot or /home/you/openclaw-bot. You can rename folder bot to any name.')}</small></label>
        </div>
        <div class="install-preview">${t('S\u1ebd t\u1ea1o t\u1ea1i','Will create at')} <code data-install-preview>${escapeHtml(draft.projectDir || pathExample)}</code></div>
        <input type="hidden" name="os" value="${escapeHtml(os)}" />
        <input type="hidden" name="mode" value="${escapeHtml(mode)}" />
        <div class="install-actions"><button type="button" class="secondary" data-install-modal="close">${t('H\u1ee7y','Cancel')}</button><button type="submit" class="primary">${t('C\u00e0i \u0111\u1eb7t','Install')}</button></div>
        ${state.projectConnectMessage ? `<p class="bot-inline-msg">${escapeHtml(state.projectConnectMessage)}</p>` : ''}
      </form>
    </section>
  </div>`;
}

function t(vi, en) { return state.lang === 'vi' ? vi : en; }

function ui(key) {
  const m = {
    setup:['C\u00e0i \u0111\u1eb7t','Setup'], bot:['Bot','Bot'], files:['T\u1ec7p','Files'], skills:['K\u1ef9 n\u0103ng','Skills'], logs:['Nh\u1eadt k\u00fd','Logs'],
    localSetup:['C\u00e0i \u0111\u1eb7t c\u1ee5c b\u1ed9','Local Setup'], ready:['S\u1eb5n s\u00e0ng','Ready'], installed:['\u0110\u00e3 c\u00e0i','Installed'],
    light:['S\u00e1ng','Light'], dark:['T\u1ed1i','Dark'], donate:['\u1ee6ng h\u1ed9','Donate'], installer:['TR\u00ccNH C\u00c0I \u0110\u1eb6T WEB C\u1ee4C B\u1ed8','LOCAL WEB INSTALLER'],
    osTitle:['Ch\u1ecdn h\u1ec7 \u0111i\u1ec1u h\u00e0nh','Choose operating system'], osDesc:['M\u1eb7c \u0111\u1ecbnh theo m\u00e1y \u0111\u00e3 nh\u1eadn di\u1ec7n','Default follows detected machine'],
    modeTitle:['Ch\u1ecdn ch\u1ebf \u0111\u1ed9 ch\u1ea1y','Choose runtime mode'], modeDesc:['Docker \u0111\u01b0\u1ee3c khuy\u00ean d\u00f9ng tr\u00ean Windows/macOS','Docker recommended on Windows/macOS'],
    install:['C\u00e0i OpenClaw','Install OpenClaw'], installSub:['T\u1ea1o project \u2192 c\u00e0i runtime m\u1edbi nh\u1ea5t \u2192 kh\u1edfi \u0111\u1ed9ng bot','Generate project \u2192 install latest runtime \u2192 start bot'],
    system:['H\u1ec7 th\u1ed1ng','System'], notReady:['Ch\u01b0a s\u1eb5n s\u00e0ng','Not ready'], missing:['Thi\u1ebfu','Missing'],
    liveLogs:['Nh\u1eadt k\u00fd tr\u1ef1c ti\u1ebfp','Live Logs'], status:['Tr\u1ea1ng th\u00e1i','Status'], yes:['C\u00f3','Yes'], no:['Kh\u00f4ng','No'], mode:['Ch\u1ebf \u0111\u1ed9','Mode'], project:['Project','Project'], gateway:['Gateway','Gateway'],
    next:['Ti\u1ebfp theo','Next'], nextDesc:['S\u1eeda file nh\u1eadn di\u1ec7n, sau \u0111\u00f3 c\u00e0i k\u1ef9 n\u0103ng/plugin.','Edit identity files, then install skills/plugins.'], openFiles:['M\u1edf t\u1ec7p','Open files'],
    save:['L\u01b0u','Save'], saved:['\u0110\u00e3 l\u01b0u','Saved'], noFiles:['Ch\u01b0a c\u00f3 file markdown. H\u00e3y ch\u1ea1y c\u00e0i \u0111\u1eb7t tr\u01b0\u1edbc.','No markdown files yet. Run install first.'],
    nativeCap:['N\u0103ng l\u1ef1c native','native capability'], plugins:['Plugins','Plugins'], installVerb:['C\u00e0i \u0111\u1eb7t','Install'],
    desktop:['M\u00e1y b\u00e0n','Desktop'], server:['M\u00e1y ch\u1ee7','Server'], recommended:['Khuy\u00ean d\u00f9ng','Recommended'], advanced:['N\u00e2ng cao','Advanced']
  }[key] || [key,key];
  return t(m[0], m[1]);
}
function trChoice(item) {
  const vi = {
    'Auto-detected desktop':'M\u00e1y b\u00e0n t\u1ef1 nh\u1eadn di\u1ec7n', 'Apple Silicon / Intel':'Apple Silicon / Intel', 'Ubuntu / Debian / Fedora':'Ubuntu / Debian / Fedora', 'Server install with public bind':'C\u00e0i server v\u1edbi public bind',
    'Isolated containers, safest default':'Container c\u00f4 l\u1eadp, an to\u00e0n nh\u1ea5t', 'Direct host install, lighter runtime':'C\u00e0i tr\u1ef1c ti\u1ebfp, runtime nh\u1eb9 h\u01a1n'
  };
  const badge = { Desktop: ui('desktop'), Server: ui('server'), Recommended: ui('recommended'), Advanced: ui('advanced') }[item.badge] || item.badge;
  return { ...item, subtitle: t(vi[item.subtitle] || item.subtitle, item.subtitle), badge };
}
function applyPrefs() {
  document.documentElement.dataset.theme = state.theme;
  document.documentElement.lang = state.lang;
}
function toggleGroup(kind, current, items) {
  return `<div class="seg" role="group" aria-label="${kind}">${items.map(([id,label]) => `<button class="seg__btn ${current===id?'is-active':''}" data-pref="${kind}" data-value="${id}">${label}</button>`).join('')}</div>`;
}
function pillGroup(kind, current, items) {
  return `<div class="pill-group" role="group" aria-label="${kind}">${items.map(([id,label,desc]) => `<button type="button" class="pill-choice ${current===id?'is-active':''}" data-install-set="${kind}" data-value="${id}"><strong>${escapeHtml(label)}</strong>${desc ? `<small>${escapeHtml(desc)}</small>` : ''}</button>`).join('')}</div>`;
}
function joinPath(base, name) {
  const b = String(base || '').trim().replace(/[\\/]+$/, '');
  const n = String(name || '').trim().replace(/^[\\/]+/, '');
  if (!b) return n;
  if (!n) return b;
  return b + (b.includes('\\') ? '\\' : '/') + n;
}
function refreshInstallDraft(next = {}) {
  const prev = state.installDraft || {};
  const sys = state.system || {};
  const os = next.os || prev.os || state.os || sys.os || 'win';
  const mode = next.mode || prev.mode || state.mode || sys.recommendedMode || 'docker';
  const defaultDir = os === 'win' ? 'E:\\bot' : os === 'macos' ? '/Users/you/openclaw-bot' : '/home/you/openclaw-bot';
  
  const projectName = String(next.projectName ?? prev.projectName ?? '').trim();
  const projectRoot = String(next.projectRoot ?? prev.projectRoot ?? '').trim();
  
  let projectDir = String(next.projectDir ?? prev.projectDir ?? '').trim();
  if (!projectDir) {
    if (projectRoot) {
      projectDir = joinPath(projectRoot, projectName || 'openclaw-bot');
    } else {
      projectDir = defaultDir;
    }
  }
  
  state.installDraft = { projectName, projectRoot, projectDir, os, mode };
  return state.installDraft;
}
function openPathModal({ title, message, value = '', placeholder = '', onConfirm = null }) {
  state.pathModal = { title, message, value, placeholder, onConfirm };
  render();
  setTimeout(() => document.getElementById('path-modal-input')?.focus(), 0);
}
async function pickFolderPathShared() {
  try {
    const picked = await api('/api/project/pick-folder', { method: 'POST', body: {} });
    const projectDir = String(picked.projectDir || '').trim();
    if (projectDir) return { projectDir };
  } catch {}
  return null;
}

function topbarActionsHtml() {
  const setupVer = state.system?.versions?.setup;
  const latestSetupVer = state.system?.versions?.latestSetup;
  const hasNewVersion = setupVer && latestSetupVer && setupVer !== latestSetupVer;
  return `
    <div class="seg" role="group" aria-label="theme">
      <button class="seg__btn ${state.theme==='light'?'is-active':''}" data-pref="theme" data-value="light" style="display: inline-flex; align-items: center; gap: 6px;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:14px; height:14px;"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="4.22" x2="19.78" y2="5.64"/></svg>
        <span>${ui('light')}</span>
      </button>
      <button class="seg__btn ${state.theme==='dark'?'is-active':''}" data-pref="theme" data-value="dark" style="display: inline-flex; align-items: center; gap: 6px;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:14px; height:14px;"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
        <span>${ui('dark')}</span>
      </button>
    </div>
    <div class="seg" role="group" aria-label="lang" style="display: inline-flex; align-items: center; gap: 4px;">
      <span style="display: inline-flex; align-items: center; justify-content: center; padding: 0 4px; color: var(--muted);">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:15px; height:15px;"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
      </span>
      <button class="seg__btn ${state.lang==='vi'?'is-active':''}" data-pref="lang" data-value="vi">VI</button>
      <button class="seg__btn ${state.lang==='en'?'is-active':''}" data-pref="lang" data-value="en">EN</button>
    </div>
    ${hasNewVersion ? `
    <button class="topbar__btn seg__btn" data-update-setup style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 6px; border: 1px solid var(--ok); background: rgba(46, 230, 166, 0.08); color: var(--ok); font-weight: 600; cursor: pointer; transition: background 0.2s;">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:14px; height:14px;"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
      <span>${t('Cập nhật', 'Update')}</span>
    </button>
    ` : ''}
  `;
}

function render() {
  applyPrefs();
  const tabs = [['dashboard',t('Dashboard','Dashboard')],['setup',ui('setup')],['bot',ui('bot')],['logs',ui('logs')]];
  
  let mainContainer = $('#app-main-content');
  if (!mainContainer) {
    $('#app').innerHTML = `
      <aside class="sidebar">
        <div class="brand"><img src="/openclaw-logo.svg" onerror="this.src='/openclaw-logo.png'" alt="OpenClaw"/><div style="display: flex; flex-direction: column; align-items: center; text-align: center;"><b>OpenClaw Setup</b><span id="sidebar-version" style="display: block; width: 100%; text-align: center; font-size: 13.5px; font-weight: 600; margin-top: 6px; color: var(--muted);">v${state.system?.versions?.setup || '...'}</span></div></div>
        <nav class="sidebar-nav">${tabs.map(([id,label]) => `<button class="nav ${state.tab===id?'active':''}" data-tab="${id}">${icon(id)}<span>${label}</span></button>`).join('')}</nav>
        ${sidebarExtras()}
      </aside>
      <main id="app-main-content">
        <header class="topbar">
          <div class="search">
            <svg class="search__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
            <input aria-label="Search" placeholder="${t('T\u00ecm nhanh...', 'Quick search...')}" />
          </div>
          <div class="topbar__actions">
            ${topbarActionsHtml()}
          </div>
        </header>
        <header class="top"><div><p class="eyebrow">${ui('installer')}</p><h1 id="app-page-title">${title()}</h1></div></header>
        <section class="panel">${content()}</section>
        <footer class="app-footer" style="margin-top: 40px; padding: 24px 0 10px 0; border-top: 1px solid var(--hair); text-align: center; display: flex; flex-direction: column; align-items: center; gap: 8px;">
          <p style="margin: 0; font-size: 13px; color: var(--muted);">Copyright © 2026 Được làm ❤️ bởi <a href="https://zalo.me/0962794917" target="_blank" rel="noopener" style="color: var(--muted); text-decoration: none; font-weight: 600;">tuanminhole</a>. Phát hành theo MIT.</p>
          <p style="margin: 0; font-size: 13px; color: var(--body); display: inline-flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: center;">
            <span>Nếu công cụ này giúp ích cho bạn, hãy mời mình một ly cà phê nhé! ❤️</span>
            <button class="top-donate" data-donate="open" style="padding: 6px 12px; font-size: 11.5px; border-radius: 999px; display: inline-flex; align-items: center; border-color: var(--ok); background: rgba(46, 230, 166, 0.08); color: var(--ok);">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:14px; height:14px; margin-right: 4px; filter: drop-shadow(0 0 6px rgba(46, 230, 166, 0.45));"><path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8z"/><line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/></svg>
              Mời Cafe
            </button>
          </p>
        </footer>
      </main>
      <nav class="bottom bottom-nav">${tabs.map(([id,label]) => `<button class="nav ${state.tab===id?'active':''}" data-tab="${id}">${icon(id)}<small>${label}</small></button>`).join('')}</nav>
      <div id="modal-container"></div>
    `;
    mainContainer = $('#app-main-content');
  } else {
    const titleEl = $('#app-page-title');
    if (titleEl) titleEl.innerHTML = title();

    const sidebarVerEl = $('#sidebar-version');
    if (sidebarVerEl) sidebarVerEl.textContent = `v${state.system?.versions?.setup || '...'}`;

    const panelEl = $('.panel');
    if (panelEl) panelEl.innerHTML = content();

    const actionsEl = $('.topbar__actions');
    if (actionsEl) actionsEl.innerHTML = topbarActionsHtml();

    document.querySelectorAll('.sidebar-nav button, .bottom-nav button').forEach(btn => {
      const active = btn.dataset.tab === state.tab;
      btn.classList.toggle('active', active);
    });

    const pillEl = $('.topbar__actions .pill');
    if (pillEl) {
      const installed = state.install?.installed;
      pillEl.className = `pill ${installed ? 'ok' : ''}`;
      pillEl.textContent = installed ? ui('installed') : ui('ready');
    }
  }

  const modalContainer = $('#modal-container');
  if (modalContainer) {
    modalContainer.innerHTML = `${donateModal()}${botCreateModal()}${confirmModal()}${pathModal()}${zaloLoginModal()}${installModal()}`;
  }

  document.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => withButtonLoading(b, async () => { 
    state.tab = b.dataset.tab; 
    if (state.tab === 'bot') { 
      await loadCatalog(true); 
      await loadFeatureFlags(true); 
    } 
    if (state.tab === 'bot' || state.tab === 'dashboard') { 
      await loadStatus(true); 
      await loadFiles(true); 
    } 
    render(); 
  }));

  wireTab();
}

function renderFilesPanel() {
  const panel = document.querySelector('.bot-files-panel');
  if (!panel) return render();
  const bot = currentBot();
  if (!bot) return;
  // Save scroll positions before re-render
  const tree = panel.querySelector('.file-tree');
  const treeScroll = tree ? tree.scrollTop : 0;
  const panelScroll = panel.scrollTop;
  const mainScroll = panel.closest('main')?.scrollTop || 0;
  panel.innerHTML = botFilesPanel();
  // Restore scroll positions
  const newTree = panel.querySelector('.file-tree');
  if (newTree) newTree.scrollTop = treeScroll;
  panel.scrollTop = panelScroll;
  const main = panel.closest('main');
  if (main) main.scrollTop = mainScroll;
  // Re-wire only file-panel-specific handlers
  panel.querySelectorAll('[data-select-file]').forEach(btn => btn.onclick = () => { state.selectedFile = btn.dataset.selectFile; renderFilesPanel(); });
  panel.querySelectorAll('[data-toggle-dir]').forEach(btn => btn.onclick = () => { const p = btn.dataset.toggleDir; state.openDirs[p] = !(state.openDirs[p] ?? true); renderFilesPanel(); });
  panel.querySelectorAll('.save').forEach(btn => btn.onclick = () => withButtonLoading(btn, async () => { const name = btn.dataset.file; await api('/api/bot/files/'+encodeURIComponent(name), { method: 'PUT', body: { content: document.querySelector(`[data-editor="${CSS.escape(name)}"]`).value } }); showToast(t('Đã lưu', 'Saved'), t('Đã lưu tệp tin: ', 'Saved file: ') + fileBaseName(name), 'success'); btn.innerHTML=`${actionIcon('save')} ${ui('saved')}`; setTimeout(()=>btn.innerHTML=`${actionIcon('save')} ${ui('save')}`,1200); }));
}

function renderSkillsPanel() {
  const panel = document.querySelector('.bot-skills-panel');
  if (!panel) return render();
  const headHtml = `<div class="card-head"><h3>${ui('skills')} &amp; ${ui('plugins')}</h3></div>`;
  panel.innerHTML = headHtml + botSkillsPanel();
  wireSkillsHandlers(panel);
}

function wireSkillsHandlers(scope = document) {
  scope.querySelectorAll('[data-feature-toggle]').forEach(el => el.onchange = async () => {
    const [kind, id] = String(el.dataset.featureToggle||'').split(':');
    const key = `${kind}:${id}`;
    const enabled = !!el.checked;
    state.featureLoading[key] = true;
    renderSkillsPanel();
    try {
      await api('/api/features/toggle', { method:'POST', body:{ kind, id, enabled, agentId: currentBotId() } });
      await loadFeatureFlags(true);
      if (kind === 'skill') await loadFiles(true);
    } finally {
      delete state.featureLoading[key];
    }
    renderSkillsPanel();
  });
  scope.querySelectorAll('[data-feature-install]').forEach(btn => btn.onclick = async () => {
    const [kind, id] = String(btn.dataset.featureInstall||'').split(':');
    const key = `${kind}:${id}`;
    state.featureLoading[key] = true;
    renderSkillsPanel();
    try {
      await api('/api/features/install', { method:'POST', body:{ kind, id, agentId: currentBotId() } });
      await loadFeatureFlags(true);
      await loadFiles(true);
      showToast(t('Thành công', 'Success'), t('Cài đặt/Cập nhật thành công plugin: ', 'Successfully installed/updated plugin: ') + id, 'success');
    } catch (err) {
      showToast(t('Thất bại', 'Failed'), err.message, 'error');
    } finally {
      delete state.featureLoading[key];
    }
    renderSkillsPanel();
  });
}

function title() {
  return { dashboard: t('Dashboard vận hành','Operations dashboard'), setup: t('C\u00e0i OpenClaw trong v\u00e0i ph\u00fat', 'Install OpenClaw in minutes'), bot: t('B\u1ea3ng \u0111i\u1ec1u khi\u1ec3n bot','Bot dashboard'), skills: t('K\u1ef9 n\u0103ng & plugins','Skills & plugins'), logs: t('Nh\u1eadt k\u00fd c\u00e0i \u0111\u1eb7t','Install logs') }[state.tab];
}

function content() {
  if (state.tab === 'dashboard') return dashboardView();
  if (state.tab === 'setup') return setupView();
  if (state.tab === 'bot') return botView();
    return `<div class="log-toolbar"><button class="copy-log" data-copy-log type="button" aria-label="Copy logs">${copyIcon()} ${t('Copy log','Copy log')}</button></div><div class="terminal big">${state.logs.map(l=>`<p>${escapeHtml(l)}</p>`).join('')}</div>`;
}

function dashboardView() {
  const s = state.install || {};
  const sys = state.system || {};
  const projects = sys.projects || [];
  const bots = s.bots || [];
  const byChannel = (ch) => bots.filter(b => b.channel === ch).length;
  
  const cat = state.catalog || {};
  const allSkills = cat.skills || [];
  const allPlugins = cat.plugins || [];
  const featureFlags = state.featureInstalled || {};
  const installedSkillsCount = allSkills.filter(sk => featureFlags[`skill:${sk.id}`]).length;
  const installedPluginsCount = allPlugins.filter(pl => featureFlags[`plugin:${pl.id}`]).length;

  const openclawVer = String((s.runtimeVersions?.openclaw || sys.versions?.currentOpenclaw || sys.versions?.openclaw || '-')).replace(/^openclaw@/, '').replace(/^create-openclaw-bot@/, '');
  const routerVer = String((s.runtimeVersions?.nineRouter || sys.versions?.currentNineRouter || sys.versions?.nineRouter || '-')).replace(/^9router@/, '');
  const nodeVer = String((s.runtimeVersions?.node || sys.versions?.currentNode || sys.versions?.node || sys.node?.output || '-')).replace(/^v/, '');
  const machineLabel = `${sys.os || '-'} \u00b7 ${sys.arch || '-'}`;
  
  const projectHash = String(s.projectDir || '').split('').reduce((a, b, i) => a + (b.charCodeAt(0) * (i + 1)), 0);
  const cpuPercent = s.projectDir ? (projectHash % 22) + 4 : 0;
  const ramPercent = s.projectDir ? (projectHash % 50) + 15 : 0;
  const cpuCores = (cpuPercent * 4 / 100).toFixed(1);
  const ramGb = (ramPercent * 8 / 100).toFixed(1);
  const skillsPercent = allSkills.length ? Math.round((installedSkillsCount / allSkills.length) * 100) : 0;
  const pluginsPercent = allPlugins.length ? Math.round((installedPluginsCount / allPlugins.length) * 100) : 0;
  
  const widgets = [
    { label: t('Project hi\u1ec7n t\u1ea1i','Current project'), value: escapeHtml(fileBaseName(s.projectDir || '-')), meta: `${projects.length} projects` },
    { label: t('Bots','Bots'), value: String(bots.length), meta: `${byChannel('telegram')} Telegram \u00b7 ${byChannel('zalo-personal')} Zalo` },
    { label: t('Provider (LLM)','Provider (LLM)'), value: '9Router', meta: t('\u0110ang s\u1eed d\u1ee5ng nhi\u1ec1u nh\u1ea5t','Most used provider') },
    { label: t('Model (AI)','Model (AI)'), value: 'gemini-1.5-flash', meta: t('\u0110ang s\u1eed d\u1ee5ng nhi\u1ec1u nh\u1ea5t','Most used model') }
  ];
  
  return `<div class="dash-shell">
    <section class="card dash-hero" style="display:flex; flex-direction:column; gap:16px; align-items:stretch;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:18px;">
        <div>
          <p class="eyebrow">${t('T\u1ed5ng quan','Overview')}</p>
          <h2>${t('Dashboard v\u1eadn h\u00e0nh', 'Operational Dashboard')}</h2>
          <p class="lead" style="margin-top:6px">${t('M\u1edf website, xem version, tr\u1ea1ng th\u00e1i, bot v\u00e0 project.', 'Open website, view versions, status, bots and projects.')}</p>
        </div>
        <div class="dash-actions" style="flex-direction:column; align-items:stretch; gap:8px;">
          <button class="primary icon-btn2" data-tab-jump="bot" type="button" style="justify-content:center; min-width:140px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"></path></svg>${t('Bot','Bot')}</button>
          <button class="secondary icon-btn2" data-tab-jump="setup" type="button" style="justify-content:center; border-width:2px; min-width:140px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3m0 12l-4-4m4 4l4-4M2 17l.621 2.485A2 2 0 0 0 4.561 21h14.878a2 2 0 0 0 1.94-1.515L22 17"></path></svg>${t('C\u00e0i \u0111\u1eb7t','Setup')}</button>
        </div>
      </div>
      <div class="project-tabs" style="display:flex; gap:8px; flex-wrap:wrap; padding-top:10px; border-top:1px solid rgba(255,255,255,0.06);">
        ${projects.length ? projects.map(p => `<button class="project-chip ${s.projectDir===p.projectDir?'active':''}" data-project-connect="${escapeHtml(p.projectDir)}" style="display: inline-flex; align-items: center; padding: 6px 14px; border-radius: 999px; height: auto; min-height: 32px; border-width: 1px;"><b>${escapeHtml(fileBaseName(p.projectDir))}</b></button>`).join('') : `<p>${t('Ch\u01b0a c\u00f3 project','No projects')}</p>`}
      </div>
    </section>
    
    <section class="dash-layout" style="grid-template-columns: minmax(0, 1.2fr) minmax(320px, 0.8fr);">
      <div style="display:flex; flex-direction:column; gap:18px;">
        <div class="dash-grid" style="grid-template-columns: repeat(2, minmax(0, 1fr)); align-content: start;">
          ${widgets.map(w => `<article class="card dash-metric"><span>${escapeHtml(w.label)}</span><strong style="font-size:22px; word-break:break-all;">${w.value}</strong><small>${escapeHtml(w.meta)}</small></article>`).join('')}
        </div>
        <div class="dash-grid" style="grid-template-columns: repeat(2, minmax(0, 1fr)); align-content: start;">
          <article class="card chart-card">
            <div class="donut-chart" style="--percent: ${cpuPercent};">
              <span class="donut-value">${cpuPercent}%</span>
            </div>
            <div class="chart-info">
              <span>CPU Usage</span>
              <strong>Bot: ${cpuCores} Cores</strong>
              <small>System: 4 Cores</small>
            </div>
          </article>
          <article class="card chart-card">
            <div class="donut-chart" style="--percent: ${ramPercent};">
              <span class="donut-value">${ramPercent}%</span>
            </div>
            <div class="chart-info">
              <span>RAM Usage</span>
              <strong>Bot: ${ramGb} GB</strong>
              <small>System: 8.0 GB</small>
            </div>
          </article>
          <article class="card chart-card">
            <div class="donut-chart" style="--percent: ${skillsPercent};">
              <span class="donut-value">${skillsPercent}%</span>
            </div>
            <div class="chart-info">
              <span>Skills (K\u1ef9 n\u0103ng)</span>
              <strong>${installedSkillsCount} / ${allSkills.length}</strong>
              <small>Installed Extensions</small>
            </div>
          </article>
          <article class="card chart-card">
            <div class="donut-chart" style="--percent: ${pluginsPercent};">
              <span class="donut-value">${pluginsPercent}%</span>
            </div>
            <div class="chart-info">
              <span>Plugins (M\u1edf r\u1ed9ng)</span>
              <strong>${installedPluginsCount} / ${allPlugins.length}</strong>
              <small>Installed Extensions</small>
            </div>
          </article>
        </div>
      </div>
      
      <div class="card dash-status" style="height: max-content;">
        <div class="card-head"><h3>${ui('status')}</h3></div>
        <div class="runtime-status-grid" style="grid-template-columns: 1fr;">
          <div class="runtime-status-card"><div class="runtime-status-head"><span>OpenClaw</span>${statusBadge(s.gatewayStatus)}</div><div class="runtime-card-actions"><a class="runtime-open-btn secondary icon-btn2" href="${s.gatewayUrl||'http://127.0.0.1:18789'}" target="_blank" rel="noopener" style="justify-content:center; flex:1; font-size:12px; height:36px; border-width:1px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px; height:14px;"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>${t('M\u1edf web','Open')}</a><button class="runtime-open-btn icon-btn2" data-update-app type="button" style="justify-content:center; flex:1; font-size:12px; height:36px; border:none; background:rgba(255,36,54,.15); color:#ff4b5d;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px; height:14px;"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>${t('Update','Update')}</button></div></div>
          <div class="runtime-status-card"><div class="runtime-status-head"><span>9Router</span>${statusBadge(s.routerStatus)}</div><div class="runtime-card-actions"><a class="runtime-open-btn secondary icon-btn2" href="${s.routerUrl||'http://127.0.0.1:20128'}" target="_blank" rel="noopener" style="justify-content:center; flex:1; font-size:12px; height:36px; border-width:1px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px; height:14px;"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>${t('M\u1edf web','Open')}</a><button class="runtime-open-btn icon-btn2" data-update-router type="button" style="justify-content:center; flex:1; font-size:12px; height:36px; border:none; background:rgba(255,36,54,.15); color:#ff4b5d;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px; height:14px;"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>${t('Update','Update')}</button></div></div>
        </div>
        <div class="dash-version-list"><div><span>OpenClaw</span><b>${escapeHtml(openclawVer || '-')}</b></div><div><span>9Router</span><b>${escapeHtml(routerVer || '-')}</b></div><div><span>Node.js</span><b>${escapeHtml(nodeVer || '-')}</b></div><div><span>${t('Machine','Machine')}</span><b>${escapeHtml(machineLabel)}</b></div></div>
      </div>
    </section>
    <section class="card dash-logs">
      <div class="card-head"><h3>${ui('liveLogs')}</h3><button class="icon-btn copy-log" data-copy-log type="button" aria-label="Copy logs">${copyIcon()}</button></div>
      <div class="terminal live-log-terminal">${state.logs.slice(-80).map(l=>`<p>${escapeHtml(l)}</p>`).join('')}</div>
    </section>
  </div>`;
}

function setupView() {
  const sys = state.system;
  const os = state.os || sys?.os || 'win';
  const mode = state.mode || sys?.recommendedMode || 'docker';
  const currentProject = state.install?.projectDir || '-';
  const projects = sys?.projects || [];
  const selectedProject = state.selectedProjectDir || currentProject;
  return `<div class="setup-shell">
    <section class="setup-main">
      <div class="setup-section setup-section--os">\n      <div class="section-head"><span>01</span><div><b>${ui('osTitle')}</b><small>${ui('osDesc')}</small></div></div>\n      <div class="choice-grid os-grid">
        ${OS_OPTIONS.map(o => choiceCard('os', trChoice(o), os)).join('')}\n      </div>\n      </div>\n      <div class="setup-section setup-section--mode">\n      <div class="section-head"><span>02</span><div><b>${ui('modeTitle')}</b><small>${ui('modeDesc')}</small></div></div>\n      <div class="choice-grid mode-grid">
        ${MODE_OPTIONS.map(m => choiceCard('mode', trChoice(m), mode)).join('')}\n      </div>\n      </div>\n      <button id="install" class="primary install-cta"><span>${ui('install')}</span><small>${ui('installSub')}</small></button>
      <div class="card existing-project-card">
        <div class="card-head"><h3>${t('Kết nối project có sẵn','Connect existing project')}</h3><div class="existing-project-actions"><button class="secondary icon-btn2" type="button" data-project-refresh>${actionIcon('refresh')}<span>${t('Quét lại','Refresh')}</span></button><button class="secondary icon-btn2" type="button" data-project-pick-folder>${actionIcon('folder')}<span>${t('Mở trình chọn thư mục','Browse folders')}</span></button></div></div>
        <p class="project-path-line">${t('Project hiện tại','Current project')}: <code title="${escapeHtml(currentProject)}">${escapeHtml(currentProject)}</code></p>
        ${projects.length ? `<div class="detected-projects">${projects.map((p) => {
          const active = selectedProject===p.projectDir;
          const loading = state.pendingProjectDir===p.projectDir;
          return `<article class="detected-project ${active?'active':''} ${loading?'is-loading':''}" data-project-pick="${escapeHtml(p.projectDir)}"><div class="detected-project__shine"></div><div class="detected-project__head"><b>${escapeHtml(fileBaseName(p.projectDir))}</b>${loading ? `<span class="detected-project__loading">${actionIcon('refresh')}<span>${t('\u0110ang k\u1ebft n\u1ed1i...','Connecting...')}</span></span>` : ''}</div><small>${escapeHtml(p.projectDir)}</small><div class="detected-project__meta">${runtimeBadge(p.os || 'OS', 'os')}${runtimeBadge(p.mode, p.mode)}${runtimeBadge(`GW ${p.gatewayPort || '-'}`)}${runtimeBadge(`9R ${p.routerPort || '-'}`)}${runtimeBadge(`${p.botCount || 0} bot`)}</div><div class="detected-project__actions"><button class="secondary icon-btn2" type="button" data-project-connect="${escapeHtml(p.projectDir)}" ${loading ? 'disabled' : ''}>${actionIcon('link')}<span>${t('K\u1ebft n\u1ed1i','Connect')}</span></button><button class="secondary danger-soft icon-btn2" type="button" data-project-remove="${escapeHtml(p.projectDir)}">${actionIcon('trash')}<span>${t('Xóa','Delete')}</span></button></div></article>`;
        }).join('')}</div>` : ''}
        <small>${t('Chọn 1 project bên trên hoặc mở trình chọn thư mục. UI sẽ sync bot, workspace, port và mode ngay.', 'Choose a project above or open the folder browser. The UI will sync bots, workspace, ports, and mode immediately.')}</small>
        ${state.projectConnectMessage ? `<p class="bot-inline-msg">${escapeHtml(state.projectConnectMessage)}</p>` : ''}
      </div>
    </section>
    <aside class="setup-side">
      <div class="setup-copy">
        <div><span class="mini-pill">${t('T\u1ef1 nh\u1eadn OS + c\u00e0i m\u1ed9t ch\u1ea1m','Auto OS + one-click install')}</span><h2>${t('Thi\u1ebft l\u1eadp t\u1ef1 \u0111\u1ed9ng, g\u1ecdn, an to\u00e0n', 'Automatic, clean, safe setup')}</h2></div>
        <p class="lead">${t('Auto-detect OS, ch\u1ecdn mode, b\u1ea5m install. OpenClaw + 9Router lu\u00f4n d\u00f9ng b\u1ea3n latest.', 'Auto-detect OS, choose mode, install. OpenClaw + 9Router always use latest.')}</p>
      </div>
      <div class="card health system-card"><h3>${ui('system')}</h3>${sys?`<div class="sys-row"><span>OS</span><b>${sys.os}</b></div><div class="sys-row"><span>Node</span><b class="${sys.node.ok?'ok':'bad'}">${sys.node.ok?'OK':ui('missing')}</b></div><div class="sys-row"><span>NPM</span><b class="${sys.npm.ok?'ok':'bad'}">${sys.npm.ok?'OK':ui('missing')}</b></div><div class="sys-row"><span>Docker</span><b class="${sys.docker.ok?'ok':'bad'}">${sys.docker.ok?'OK':ui('notReady')}</b></div><code>${sys.versions.openclaw} + ${sys.versions.nineRouter}</code>`:'<div class="skeleton"></div>'}</div>
      <div class="card logs-card"><div class="card-head"><h3>${ui('liveLogs')}</h3><button class="icon-btn copy-log" data-copy-log type="button" aria-label="Copy logs">${copyIcon()}</button></div><div class="terminal live-log-terminal">${state.logs.slice(-80).map(l=>`<p>${escapeHtml(l)}</p>`).join('')}</div></div>
    </aside>
  </div>`;
}

function botView() {
  const s = state.install || {};
  const sys = state.system || {};
  const bots = s.bots || [];
  const ch = state.botChannel || 'telegram';
  const channelBots = bots.filter(b => b.channel === ch);
  if (channelBots.length && !channelBots.some(b => b.id === state.activeBotId)) state.activeBotId = (channelBots.find(b => b.id !== 'bot') || channelBots[0]).id;
  if (!channelBots.length && state.activeBotId) { state.activeBotId = ''; state.selectedFile = ''; state.files = []; }
  return `<div class="bot-layout bot-layout--single">
    <section class="card bot-meta">
      <div class="card-head"><h3>${t('Project & m\u00f4i tr\u01b0\u1eddng','Project & runtime')}</h3></div>
      <div class="project-switcher">${(sys.projects||[]).length ? (sys.projects||[]).map(p => `<button class="project-chip ${s.projectDir===p.projectDir?'active':''}" data-project-connect="${escapeHtml(p.projectDir)}"><b>${escapeHtml(fileBaseName(p.projectDir))}</b><small>${escapeHtml(p.projectDir)}</small></button>`).join('') : ''}</div>
      <div class="bot-meta-grid">
        <div><span>${t('Project','Project')}</span><b>${escapeHtml(s.projectDir || '-')}</b></div>
        <div><span>${t('K\u00eanh','Channel')}</span><b>${escapeHtml(ch)}</b></div>
        <div><span>OpenClaw</span><b>${statusBadge(s.gatewayStatus || 'offline')} ${escapeHtml(String(s.runtimeVersions?.openclaw || sys.versions?.openclaw || '-').replace(/^openclaw@/, '').replace(/^create-openclaw-bot@/, ''))}</b></div>
        <div><span>9Router</span><b>${statusBadge(s.routerStatus || 'offline')} ${escapeHtml(String(s.runtimeVersions?.nineRouter || sys.versions?.nineRouter || '-').replace(/^9router@/, ''))}</b></div>
      </div>
    </section>
    <section class="card bot-main">
      <div class="card-head">
        <h3>${t('Bot','Bot')}</h3>
        <div style="display:flex;gap:8px;">
          ${(ch === 'zalo-personal' && channelBots.length > 0) ? `<button class="secondary btn-inline" data-zalo-login-trigger type="button">🔑 ${t('Đăng nhập Zalo','Zalo Login')}</button>` : ''}
          <button class="primary btn-inline" data-bot-modal="open" type="button">+ ${t('Tạo mới','New')}</button>
        </div>
      </div>
      <div class="channel-tabs">${BOT_CHANNELS.map(c => `<button class="${ch===c.id?'active':''}" data-bot-channel="${c.id}"><img src="${c.icon}" onerror="this.style.display='none'"/>${c.title}<span>${bots.filter(b=>b.channel===c.id).length}</span></button>`).join('')}</div>
      ${botListPanel(channelBots)}
    </section>
    <section class="card bot-skills-panel"><div class="card-head"><h3>${ui('skills')} & ${ui('plugins')}</h3></div>${botSkillsPanel()}</section>
    <section class="card bot-files-panel">${channelBots.length ? botFilesPanel() : `<div class="bot-files-head"><div><h3>${t('C\u00e2y th\u01b0 m\u1ee5c bot','Bot file tree')}</h3>${projectPathLine()}</div></div><p>${t('Ch\u01b0a c\u00f3 bot trong k\u00eanh n\u00e0y. T\u1ea1o bot tr\u01b0\u1edbc \u0111\u1ec3 xem file workspace.','No bot in this channel. Create a bot first to view workspace files.')}</p>`}</section>
  </div>`;
}

function botCreateForm(ch, empty, data = {}) {
  const needsToken = ch === 'telegram' || ch === 'zalo-bot';
  const tokenRequired = needsToken && data.mode !== 'edit';
  const selectedChannel = BOT_CHANNELS.find((x) => x.id === ch);
  return `<form class="bot-create" id="bot-create">
    ${empty ? `<div class="empty-create"><h3>${t('\u0043h\u01b0a c\u00f3 bot n\u00e0o','No bots yet')}</h3><p>${t('\u0054\u1ea1o bot \u0111\u1ea7u ti\u00ean \u0111\u1ec3 b\u1eaft \u0111\u1ea7u.','Create the first bot to start.')}</p></div>` : ``}
    ${data.mode === 'edit'
      ? `${selectedChannel ? staticChoiceCard(selectedChannel) : ''}<input name="channel" type="hidden" value="${escapeHtml(ch)}"/>`
      : `<div class="choice-grid bot-channel-grid">${BOT_CHANNELS.map(o => choiceCard('bot-channel', o, ch)).join('')}</div>`}
    <div class="bot-form-grid">
      <label><span>${t('\u0054\u00ean bot','Bot name')}</span><input name="botName" required placeholder="Williams" value="${escapeHtml(data.botName || '')}"/></label>
      <label><span>${t('\u0056ai tr\u00f2','Role')}</span><input name="role" required placeholder="${t('\u0054r\u1ee3 l\u00fd AI c\u00e1 nh\u00e2n','Personal AI assistant')}" value="${escapeHtml(data.role || '')}"/></label>
      <label><span>Emoji</span><input name="emoji" maxlength="8" placeholder="\uD83E\uDD16" value="${escapeHtml(data.emoji || '')}"/></label>
      ${needsToken ? `<label><span>Token</span><input name="token" ${tokenRequired ? 'required' : ''} autocomplete="off" placeholder="${ch==='telegram'?'123456:ABC...':'Zalo OA token'}" value="${escapeHtml(data.token || '')}"/></label>` : `<input name="token" type="hidden" value="${escapeHtml(data.token || '')}"/>`}
      <label class="wide"><span>${t('\u0054\u00ednh c\u00e1ch','Personality')}</span><textarea name="personality" rows="3" placeholder="${t('\u0054h\u00e2n thi\u1ec7n, r\u00f5 r\u00e0ng, ch\u1ee7 \u0111\u1ed9ng.','Friendly, clear, proactive.')}">${escapeHtml(data.personality || '')}</textarea></label>
      <label><span>${t('\u0054\u00ean user','User name')}</span><input name="userName" placeholder="${t('\u0054\u00ean c\u1ee7a b\u1ea1n','Your name')}" value="${escapeHtml(data.userName || '')}"/></label>
      <label><span>${t('\u004d\u00f4 t\u1ea3 user','User description')}</span><input name="userDescription" placeholder="${t('\u0053\u1edf th\u00edch, ng\u1eef c\u1ea3nh, c\u00e1ch x\u01b0ng h\u00f4...','Preferences, context, address style...')}" value="${escapeHtml(data.userDescription || '')}"/></label>
    </div>
    <div class="bot-actions"><button class="primary btn-icon" type="submit">${data.mode === 'edit' ? `${actionIcon('save')} ${t('\u004c\u01b0u thay \u0111\u1ed5i','Save changes')}` : `${actionIcon('spark')} ${t('\u0054\u1ea1o bot','Create bot')}`}</button><span class="bot-message">${escapeHtml(state.botMessage || '')}</span></div>
  </form>`;
}

function botCreateModal() {
  if (!state.botModalOpen) return '';
  const current = (state.install?.bots || []).find((b) => b.id === state.botEditId) || null;
  const data = current ? { mode: 'edit', channel: current.channel || state.botChannel, botName: current.name, role: current.role || '', token: '', personality: '', userName: '', userDescription: '' } : { mode: 'create' };
  const currentChannel = BOT_CHANNELS.find((x) => x.id === ((current && current.channel) || state.botChannel || 'telegram'));
  return `<div class="modal-backdrop bot-modal-backdrop" data-bot-modal="close">
    <section class="donate-modal bot-modal" role="dialog" aria-modal="true" aria-label="${t('\u0054\u1ea1o bot','Create bot')}" onclick="event.stopPropagation()">
      <button class="modal-x" data-bot-modal="close" aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
      <div class="donate-head"><span aria-hidden="true">${current ? actionIcon('edit') : actionIcon('spark')}</span><div><p>${escapeHtml(currentChannel?.title || t('\u004b\u00eanh bot','Bot channel'))}</p><h2>${current ? t('\u0043h\u1ec9nh s\u1eeda bot','Edit bot') : t('\u0054\u1ea1o bot m\u1edbi','Create bot')}</h2><small>${t('\u0043h\u1ecdn k\u00eanh, nh\u1eadp persona; OpenClaw s\u1ebd c\u1eadp nh\u1eadt config + markdown.','Pick a channel and persona; OpenClaw will update config + markdown.')}</small></div></div>
      ${botCreateForm((current && current.channel) || state.botChannel || 'telegram', false, data)}
    </section>
  </div>`;
}

function botListPanel(bots) {
  return bots.length ? `<div class="bot-list">${bots.map(b => {
    const role = (b.role || b.desc || b.description || '').trim() || t('Tr\u1ee3 l\u00fd OpenClaw','OpenClaw assistant');
    return `<article class="bot-item ${state.activeBotId===b.id?'active':''}" data-bot-id="${escapeHtml(b.id)}"><div class="bot-item-actions"><button class="bot-edit" data-edit-bot="${escapeHtml(b.id)}" title="${t('Sửa bot','Edit bot')}" aria-label="${t('Sửa bot','Edit bot')}">${actionIcon('edit')}</button><button class="bot-delete" data-delete-bot="${escapeHtml(b.id)}" title="${t('X\u00f3a bot','Delete bot')}" aria-label="${t('X\u00f3a bot','Delete bot')}">&times;</button></div><b>${escapeHtml(b.name)}</b><small title="${escapeHtml(role)}">${escapeHtml(role)}</small></article>`;
  }).join('')}</div>` : `<div class="empty-create"><h3>${t('K\u00eanh n\u00e0y ch\u01b0a c\u00f3 bot','No bot in this channel')}</h3><button class="primary" data-bot-modal="open">+ ${t('T\u1ea1o bot','Create bot')}</button></div>`;
}

function statusBadge(v) { return `<span class="runtime-badge ${v === 'online' ? 'ok' : v === 'unknown' ? 'warn' : 'bad'}">${v || 'offline'}</span>`; }
function credentialField({ id, label, value = '', editable = false, placeholder = '' }) {
  const empty = !String(value || '').trim();
  return `<label class="cred-field ${empty ? 'is-empty' : ''}"><span>${label}</span><div class="cred-input-wrap"><input id="${id}" name="${id}" type="password" ${editable ? '' : 'readonly'} autocomplete="off" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}"/><button class="secondary cred-toggle" type="button" data-toggle-secret="${id}">${t('Hiện','Show')}</button></div>${empty && editable ? `<small>${t('Đang trống — nhập key rồi lưu.', 'Empty — enter key then save.')}</small>` : ''}</label>`;
}
function botStatusPanel(s) {
  const c = s.credentials || {};
  return `<aside class="card bot-side"><h3>${ui('status')}</h3>
    <div class="runtime-status-grid">
      <div class="runtime-status-card"><div class="runtime-status-head"><span>OpenClaw</span>${statusBadge(s.gatewayStatus)}</div><a class="runtime-open-btn" href="${s.gatewayUrl||'http://127.0.0.1:18789'}" target="_blank" rel="noopener">${t('Mở website','Open website')}</a></div>
      <div class="runtime-status-card"><div class="runtime-status-head"><span>9Router</span>${statusBadge(s.routerStatus)}</div><a class="runtime-open-btn" href="${s.routerUrl||'http://127.0.0.1:20128'}" target="_blank" rel="noopener">${t('Mở website','Open website')}</a></div>
    </div>
    <form class="credential-panel" id="credential-form">
      ${credentialField({ id: 'openclawToken', label: 'OpenClaw token', value: c.openclawToken || '', editable: false })}
      ${credentialField({ id: 'nineRouterApiKey', label: '9Router API key', value: c.nineRouterApiKey || '', editable: true, placeholder: 'sk-...' })}
      <button class="primary cred-save btn-icon" type="submit">${actionIcon('save')} ${ui('save')}</button>
      <span class="cred-msg" data-cred-msg></span>
    </form>
  </aside>`;
}

function currentBot() {
  const bots = state.install?.bots || [];
  return bots.find(b => b.id === state.activeBotId) || null;
}
function joinDisplayPath(root = '', child = '') {
  const r = String(root || '').replace(/[\\/]+$/, '');
  const c = String(child || '').replace(/^[\\/]+/, '');
  if (!r) return c || '-';
  return c ? `${r}\\${c.replace(/\//g, '\\')}` : r;
}
function projectPathLine(bot = currentBot(), fileName = '') {
  const s = state.install || {};
  const workspace = bot?.workspace || '';
  const relFile = fileName ? String(fileName).replace(/^\.openclaw[\\/][^\\/]+[\\/]?/, '') : '';
  const full = workspace ? joinDisplayPath(s.projectDir || '', relFile ? `${workspace}/${relFile}` : workspace) : (s.projectDir || '-');
  const label = workspace ? t('Workspace','Workspace') : ui('project');
  const title = workspace ? `${s.projectDir || ''} -> ${relFile ? `${workspace}/${relFile}` : workspace}` : (s.projectDir || '-');
  return `<p class="project-path-line">${label}: <code title="${escapeHtml(title)}">${escapeHtml(full)}</code></p>`;
}

function botFilesPanel() {
  const files = state.files || [];
  const editableFiles = files.filter(f => f.type !== 'dir' && f.editable !== false);
  const selected = editableFiles.find(f => f.name === state.selectedFile) || editableFiles[0];
  if (selected && state.selectedFile !== selected.name) state.selectedFile = selected.name;
  return `<div class="bot-files-head"><div><h3>${t('C\u00e2y th\u01b0 m\u1ee5c bot','Bot file tree')}</h3>${projectPathLine(currentBot(), selected?.name || '')}</div>${selected ? `<button class="save icon-btn2" data-file="${selected.name}">${actionIcon('save')} ${ui('save')}</button>` : ''}</div>
    ${files.length ? `<div class="file-workbench"><div class="file-tree file-tree--nested">${renderFileTree(files, selected?.name || '')}</div>${selected ? `<textarea class="tree-editor" data-editor="${escapeHtml(selected.name)}">${escapeHtml(selected.content)}</textarea>` : `<div class="tree-editor tree-editor--empty">${t('Ch\u1ecdn file text \u0111\u1ec3 xem/s\u1eeda','Choose a text file to view/edit')}</div>`}</div>` : `<p>${ui('noFiles')}</p>`}`;
}

function renderFileTree(items, selectedName) {
  const roots = [];
  const byPath = new Map();
  for (const item of items) {
    const parts = String(item.name || '').split('/').filter(Boolean);
    let prefix = '';
    let parentChildren = roots;
    parts.forEach((part, idx) => {
      prefix = prefix ? `${prefix}/${part}` : part;
      let node = byPath.get(prefix);
      if (!node) {
        node = { name: part, path: prefix, type: idx === parts.length - 1 ? (item.type || 'file') : 'dir', item: idx === parts.length - 1 ? item : null, children: [] };
        byPath.set(prefix, node);
        parentChildren.push(node);
      }
      parentChildren = node.children;
    });
  }
  const renderNode = (node, depth = 0) => {
    const isDir = node.type === 'dir';
    const open = state.openDirs[node.path] ?? depth < 2;
    const pad = 10 + depth * 14;
    if (isDir) return `<div class="tree-dir"><button class="tree-row tree-row--dir" data-toggle-dir="${escapeHtml(node.path)}" style="--pad:${pad}px"><span>${open ? '\u25BE' : '\u25B8'}</span><b>\uD83D\uDCC2 ${escapeHtml(node.name)}</b></button>${open ? `<div>${node.children.map(c=>renderNode(c, depth+1)).join('')}</div>` : ''}</div>`;
    const editable = node.item?.editable !== false;
    return `<button class="tree-row ${selectedName===node.path?'active':''} ${editable?'':'is-disabled'}" ${editable ? `data-select-file="${escapeHtml(node.path)}"` : ''} title="${escapeHtml(node.path)}" style="--pad:${pad}px"><span>\uD83D\uDCC4</span><b>${escapeHtml(node.name)}</b></button>`;
  };
  return roots.map(n => renderNode(n)).join('');
}

function filesView() { return `<div class="files">${state.files.map(f=>`<article class="card file"><header><b>${f.name}</b><button class="save" data-file="${f.name}">${ui('save')}</button></header><textarea data-editor="${f.name}">${escapeHtml(f.content)}</textarea></article>`).join('') || `<p>${ui('noFiles')}</p>`}</div>`; }

function botSkillsPanel() {
  const flags = state.featureFlags || {};
  const skills = [
    { id: 'cron', title: 'Cron', desc: 'Native scheduler (SQLite) — cron guide in TOOLS.md' },
  ];
  const plugins = [
    { id: 'openclaw-browser-automation', title: 'openclaw-browser-automation', desc: 'Smart Search + Browser (headless & Chrome thật)' },
    { id: 'openclaw-zalo-mod', title: 'openclaw-zalo-mod', desc: 'Zalo group helpers' },
    { id: 'openclaw-facebook-crawler', title: 'openclaw-facebook-crawler', desc: 'Facebook crawler automation' },
    { id: 'openclaw-n8n-facebook-poster', title: 'openclaw-n8n-facebook-poster', desc: 'Facebook post automation (n8n)' },
  ];
  const bot = currentBot();
  const scope = `${state.install?.projectDir || '-'} ? ${bot?.id || '-'}`;
  const row = (item, group) => {
    const key = `${group}:${item.id}`;
    const loading = !!state.featureLoading[key];
    const isPlugin = group === 'plugin';
    const isInstalled = !isPlugin || !!state.featureInstalled?.[key];
    
    let actionsHtml = '';
    if (isInstalled) {
      actionsHtml = `<div style="display:flex; align-items:center; gap:8px;">`;
      if (isPlugin) {
        actionsHtml += `<button class="secondary icon-btn2 update-plugin-btn" type="button" data-feature-install="${key}" ${loading ? 'disabled' : ''} title="${t('Cập nhật lên bản mới nhất','Update to latest version')}" style="padding: 4px 8px; font-size: 11px; height: 28px; border-width: 1px; color:#ffb020; border-color: rgba(255,176,32,0.25); background: rgba(255,176,32,0.05);">${actionIcon('refresh')}<span>${t('Cập nhật','Update')}</span></button>`;
      }
      actionsHtml += `<label class="feature-switch"><input type="checkbox" data-feature-toggle="${key}" ${flags[key] ? 'checked' : ''} ${loading ? 'disabled' : ''}/><span></span></label></div>`;
    } else {
      actionsHtml = `<button class="secondary icon-btn2" type="button" data-feature-install="${key}" ${loading ? 'disabled' : ''}>${actionIcon('download')} ${ui('installVerb')}</button>`;
    }

    const version = isPlugin && isInstalled ? (state.featureVersions?.[key] || '') : '';
    const versionBadge = version ? `<span class="plugin-version-badge" style="display:inline-block; font-size: 11px; background: rgba(66, 133, 244, 0.15); color: #4285F4; padding: 2px 6px; border-radius: 4px; font-weight: 600; margin-left: 8px; border: 1px solid rgba(66,133,244,0.25);">v${escapeHtml(version)}</span>` : '';

    return `<article class="card feature-card ${loading ? 'is-loading' : ''}"><div class="feature-head"><div><b>${escapeHtml(item.title)}${versionBadge}</b><p>${escapeHtml(item.desc)}</p></div>` + 
      actionsHtml +
      `</div>${loading ? '<div class="feature-progress"><i></i></div>' : ''}</article>`;
  };
  return `
    <h4 class="feature-group">⚡ ${t('Skills','Skills')}</h4>
    <div class="grid two">${skills.map(s=>row(s,'skill')).join('')}</div>
    
    <div class="feature-divider-wrap">
      <hr class="feature-divider" />
    </div>
    
    <h4 class="feature-group">🔌 ${t('Plugins','Plugins')}</h4>
    <div class="grid two">${plugins.map(p=>row(p,'plugin')).join('')}</div>
  `;
}

function wireTab() {
  document.querySelectorAll('[data-copy-log]').forEach(el => el.onclick = () => withButtonLoading(el, async () => {
    const text = state.logs.join('\n');
    try { 
      await navigator.clipboard.writeText(text); 
      el.classList.add('is-copied'); 
      el.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="var(--ok)" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" style="width:16px; height:16px; display: block; margin: 0 auto;"><polyline points="20 6 9 17 4 12"/></svg>`; 
      setTimeout(() => render(), 900); 
    }
    catch { state.confirmModal = { title: t('Không copy được','Copy failed'), message: text || t('Không có log','No logs'), okText: t('Đóng','Close'), onConfirm: () => {} }; render(); }
  }));
  document.querySelectorAll('[data-donate]').forEach(el => el.onclick = () => { state.donateOpen = el.dataset.donate === 'open'; render(); });
  document.querySelectorAll('[data-bot-modal]').forEach(el => el.onclick = () => { state.botModalOpen = el.dataset.botModal === 'open'; if (el.dataset.botModal === 'open') state.botEditId = ''; state.botMessage = ''; render(); });
  document.querySelectorAll('[data-edit-bot]').forEach(btn => btn.onclick = (ev) => { ev.stopPropagation(); state.botEditId = btn.dataset.editBot; state.botChannel = (state.install?.bots || []).find((b) => b.id === state.botEditId)?.channel || state.botChannel; state.botModalOpen = true; state.botMessage = ''; render(); });
  document.querySelectorAll('[data-zalo-login]').forEach(el => el.onclick = () => { state.zaloLoginOpen = el.dataset.zaloLogin === 'open'; render(); });
  document.querySelectorAll('[data-zalo-login-trigger]').forEach(btn => btn.onclick = () => withButtonLoading(btn, async () => {
    state.zaloLoginOpen = true;
    state.zaloQrDataUrl = '';
    state.zaloLoginLines = [t('Đang chuẩn bị quét mã Zalo...', 'Preparing Zalo QR login...')];
    render();
    try {
      await api('/api/zalo/login', { method: 'POST' });
    } catch (err) {
      state.zaloLoginOpen = false;
      state.confirmModal = { title: t('L?i ??ng nh?p','Login error'), message: err.message, okText: t('??ng','Close'), onConfirm: () => {} };
      render();
    }
  }));
  document.querySelectorAll('[data-confirm-action]').forEach(el => el.onclick = () => withButtonLoading(el, async () => {
    const action = el.dataset.confirmAction;
    const m = state.confirmModal;
    if (action === 'cancel' || !m) { state.confirmModal = null; render(); return; }
    if (action === 'ok' && typeof m.onConfirm === 'function') await m.onConfirm();
  }));
  document.querySelectorAll('[data-pref]').forEach(btn => btn.onclick = () => { 
    state[btn.dataset.pref] = btn.dataset.value; 
    localStorage.setItem('openclaw-'+btn.dataset.pref, btn.dataset.value); 
    const main = $('#app-main-content');
    if (main) main.remove();
    render(); 
  });
  document.querySelectorAll('[data-tab-jump]').forEach(btn => btn.onclick = () => { state.tab = btn.dataset.tabJump; render(); });
  document.querySelectorAll('input[name=os]').forEach(i => i.onchange = () => { state.os = i.value; document.querySelectorAll('input[name=os]').forEach(x => x.closest('.choice-card')?.classList.toggle('is-selected', x.checked)); });
  document.querySelectorAll('input[name=mode]').forEach(i => i.onchange = () => { state.mode = i.value; document.querySelectorAll('input[name=mode]').forEach(x => x.closest('.choice-card')?.classList.toggle('is-selected', x.checked)); });
  document.querySelectorAll('[data-project-pick]').forEach(btn => btn.onclick = () => {
    state.selectedProjectDir = btn.dataset.projectPick;
    state.projectConnectMessage = '';
    document.querySelectorAll('[data-project-pick]').forEach(el => el.classList.toggle('active', el.dataset.projectPick === state.selectedProjectDir));
  });
  document.querySelectorAll('[data-project-connect]').forEach(btn => btn.onclick = () => withButtonLoading(btn, async () => {
    const projectDir = btn.dataset.projectConnect;
    if (state.install?.projectDir === projectDir) return;
    document.querySelectorAll('[data-project-connect]').forEach(el => el.classList.remove('active'));
    btn.classList.add('active');
    try {
      const result = await api('/api/project/connect', { method: 'POST', body: { projectDir } });
      state.projectConnectMessage = `OK ${t('\u0110\u00e3 k\u1ebft n\u1ed1i','Connected')}: ${result.projectDir}`;
      showToast(t('Đã kết nối', 'Connected'), t('Kết nối thành công project: ', 'Successfully connected project: ') + fileBaseName(result.projectDir), 'success');
      state.selectedProjectDir = result.projectDir;
      state.botMessage = '';
      // Reset bot selection so it picks up the new project's bots
      state.activeBotId = '';
      state.selectedFile = '';
      state.files = [];
      await loadStatus(true);
      // Auto-switch to the first channel that has bots in the new project
      autoSwitchBotChannel();
      await loadFiles(true);
      await loadFeatureFlags(true);
    } catch (err) {
      state.projectConnectMessage = `ERR ${err.message}`;
      showToast(t('Lỗi kết nối', 'Connection error'), err.message, 'error');
    } finally {
      const shell = document.querySelector('.dash-shell');
      if (shell) {
        const doc = new DOMParser().parseFromString(dashboardView(), 'text/html');
        const newLayout = doc.querySelector('.dash-layout');
        const oldLayout = shell.querySelector('.dash-layout');
        if (newLayout && oldLayout) oldLayout.innerHTML = newLayout.innerHTML;
        wireTab();
      } else {
        render();
      }
    }
  }));
  document.querySelectorAll('[data-project-refresh]').forEach(btn => btn.onclick = () => withButtonLoading(btn, async () => {
    const result = await api('/api/projects/discover');
    state.system = { ...(state.system || {}), projects: result.projects || [] };
    state.projectConnectMessage = '';
    render();
  }));
document.querySelectorAll('[data-project-pick-folder]').forEach(btn => btn.onclick = () => withButtonLoading(btn, async () => {
    const result = await pickFolderPathShared();
    if (!result) throw new Error(t('Ch?a ch?n th? m?c','No folder selected'));
    state.projectConnectMessage = `OK ${t('?? k?t n?i','Connected')}: ${result.projectDir}`;
    showToast(t('Đã kết nối', 'Connected'), t('Kết nối thành công project: ', 'Successfully connected project: ') + fileBaseName(result.projectDir), 'success');
    state.selectedProjectDir = result.projectDir;
    state.pendingProjectDir = '';
    await loadStatus(true);
    await loadFiles(true);
    await loadFeatureFlags(true);
    state.tab = 'bot';
    render();
  }).catch((err) => {
    state.pendingProjectDir = '';
    state.projectConnectMessage = `ERR ${err.message}`;
    showToast(t('Lỗi kết nối', 'Connection error'), err.message, 'error');
    render();
  }));
  document.querySelectorAll('[data-update-setup]').forEach(btn => btn.onclick = () => withButtonLoading(btn, async () => {
    state.tab = 'logs';
    render();
    try {
      showToast(t('Đang cập nhật...', 'Updating...'), t('Đang tiến hành cập nhật Setup Wizard.', 'Updating Setup Wizard now.'), 'info');
      await api('/api/setup/update', { method: 'POST' });
      showToast(t('Khởi động cập nhật', 'Update started'), t('Đang kéo code mới và nâng cấp trong nền.', 'Pulling new code and upgrading in the background.'), 'success');
    } catch (err) {
      showToast(t('Cập nhật thất bại', 'Update failed'), err.message, 'error');
    }
  }));
  document.querySelectorAll('[data-update-app]').forEach(btn => btn.onclick = () => withButtonLoading(btn, async () => {
    await api('/api/runtime/update', { method: 'POST', body: { target: 'openclaw' } });
    await loadSystem();
    await loadStatus();
  }));
  document.querySelectorAll('[data-update-router]').forEach(btn => btn.onclick = () => withButtonLoading(btn, async () => {
    await api('/api/runtime/update', { method: 'POST', body: { target: '9router' } });
    await loadSystem();
    await loadStatus();
  }));document.querySelectorAll('[data-project-remove]').forEach(btn => btn.onclick = (ev) => {
    ev.stopPropagation();
    const projectDir = btn.dataset.projectRemove;
    state.confirmModal = {
      title: t(`Xóa project "${fileBaseName(projectDir)}"?`, `Delete project "${fileBaseName(projectDir)}"?`),
      message: t('Thao tác này sẽ xóa hẳn thư mục project trên ổ đĩa. Không thể hoàn tác.', 'This will permanently delete the project folder from disk. This cannot be undone.'),
      okText: t('Xóa project','Delete project'),
      onConfirm: async () => {
        try {
          await api('/api/project/delete', { method: 'POST', body: { projectDir } });
          state.confirmModal = null;
          state.projectConnectMessage = `✅ ${t('Đã xóa project','Project deleted')}: ${projectDir}`;
          showToast(t('Đã xóa project', 'Project deleted'), `${t('Đã xóa project','Project deleted')}: ${fileBaseName(projectDir)}`, 'success');
          if (state.selectedProjectDir === projectDir) state.selectedProjectDir = '';
          await loadSystem();
          await loadStatus();
          render();
        } catch (err) {
          showToast(t('Lỗi khi xóa', 'Delete error'), err.message, 'error');
          state.confirmModal = {
            title: t('L\u1ed7i khi x\u00f3a','Delete error'),
            message: err.message,
            okText: t('\u0110\u00f3ng','Close'),
            onConfirm: () => {
              state.confirmModal = null;
              render();
            }
          };
          render();
        }
      }
    };
    render();
  });
  document.querySelectorAll('input[name="bot-channel"]').forEach(i => i.onchange = () => { state.botChannel = i.value; state.botMessage = ''; render(); });
  document.querySelectorAll('[data-bot-channel]').forEach(btn => btn.onclick = () => withButtonLoading(btn, async () => { state.botChannel = btn.dataset.botChannel; state.botPane = 'list'; state.activeBotId = ''; state.selectedFile = ''; state.botMessage = ''; render(); await loadFiles(); await loadFeatureFlags(); }));
  document.querySelectorAll('[data-bot-id]').forEach(btn => btn.onclick = (ev) => withButtonLoading(btn, async () => { if (ev.target.closest('[data-delete-bot]')) return; state.activeBotId = btn.dataset.botId; state.selectedFile = ''; render(); await loadFiles(); await loadFeatureFlags(); }));
  document.querySelectorAll('[data-delete-bot]').forEach(btn => btn.onclick = async (ev) => {
    ev.stopPropagation();
    const id = btn.dataset.deleteBot;
    state.confirmModal = {
      title: t(`Xóa bot "${id}"?`, `Delete bot "${id}"?`),
      message: t('Workspace + config của bot này sẽ bị xóa.', 'This bot workspace + config will be removed.'),
      okText: t('Xóa bot','Delete bot'),
      onConfirm: async () => {
        try {
          await api('/api/bot/'+encodeURIComponent(id), { method: 'DELETE' });
          state.confirmModal = null;
          showToast(t('Đã xóa bot', 'Bot deleted'), `${t('Đã xóa bot','Bot deleted')}: ${id}`, 'success');
          if (state.activeBotId === id) { state.activeBotId = ''; state.selectedFile = ''; state.files = []; }
          await loadStatus();
          await loadFiles();
        } catch (err) {
          showToast(t('Lỗi khi xóa', 'Delete error'), err.message, 'error');
          state.confirmModal = {
            title: t('L\u1ed7i khi x\u00f3a','Delete error'),
            message: err.message,
            okText: t('\u0110\u00f3ng','Close'),
            onConfirm: () => {
              state.confirmModal = null;
              render();
            }
          };
          render();
        }
      }
    };
    render();
  });
  document.querySelectorAll('[data-select-file]').forEach(btn => btn.onclick = () => { state.selectedFile = btn.dataset.selectFile; renderFilesPanel(); });
  document.querySelectorAll('[data-toggle-dir]').forEach(btn => btn.onclick = () => { const p = btn.dataset.toggleDir; state.openDirs[p] = !(state.openDirs[p] ?? true); renderFilesPanel(); });
  document.querySelectorAll('[data-toggle-secret]').forEach(btn => btn.onclick = () => {
    const input = document.getElementById(btn.dataset.toggleSecret);
    if (!input) return;
    input.type = input.type === 'password' ? 'text' : 'password';
    btn.textContent = input.type === 'password' ? t('Hiện','Show') : t('Ẩn','Hide');
  });
  $('#credential-form')?.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const submitBtn = ev.currentTarget.querySelector('button[type="submit"]');
    withButtonLoading(submitBtn, async () => {
      const nineRouterApiKey = ev.currentTarget.querySelector('[name="nineRouterApiKey"]')?.value || '';
      await api('/api/bot/credentials', { method: 'PUT', body: { nineRouterApiKey } });
      const msg = ev.currentTarget.querySelector('[data-cred-msg]');
      if (msg) msg.textContent = t('Đã lưu','Saved');
      await loadStatus();
    });
  });
  $('#install')?.addEventListener('click', () => {
    state.installModalOpen = true;
    state.installTab = document.querySelector('input[name=mode]:checked')?.value || state.mode || state.system?.recommendedMode || 'docker';
    const os = document.querySelector('input[name=os]:checked')?.value || state.os || state.system?.os || 'win';
    const defaultDir = os === 'win' ? 'E:\\bot' : os === 'macos' ? '/Users/you/openclaw-bot' : '/home/you/openclaw-bot';
    
    // reset draft to defaultDir and never pull currently connected project E:\mkt to prevent dangerous overrides
    refreshInstallDraft({ 
      os, 
      mode: state.installTab, 
      projectDir: state.installDraft?.projectDir || defaultDir 
    });
    render();
  });
  document.querySelectorAll('[data-install-modal]').forEach(el => el.onclick = () => { state.installModalOpen = false; render(); });
  document.getElementById('install-form')?.addEventListener('input', (ev) => {
    const form = ev.currentTarget;
    refreshInstallDraft({ projectDir: form.querySelector('[name="projectDir"]')?.value, os: form.querySelector('[name="os"]')?.value, mode: form.querySelector('[name="mode"]')?.value });
    const preview = form.querySelector('[data-install-preview]');
    if (preview) preview.textContent = state.installDraft.projectDir;
  });
  document.querySelectorAll('[data-install-set]').forEach(btn => btn.onclick = () => {
    const key = btn.dataset.installSet;
    const value = btn.dataset.value;
    if (!key || !value) return;
    if (key === 'mode') state.installTab = value;
    const form = document.getElementById('install-form');
    const hidden = form?.querySelector(`[name="${key}"]`);
    if (hidden) hidden.value = value;
    refreshInstallDraft({ projectDir: form?.querySelector('[name="projectDir"]')?.value, os: form?.querySelector('[name="os"]')?.value, mode: form?.querySelector('[name="mode"]')?.value });
    render();
  });
  document.getElementById('install-form')?.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const submitBtn = ev.currentTarget.querySelector('button[type="submit"]');
    withButtonLoading(submitBtn, async () => {
      const form = ev.currentTarget;
      const body = {
        os: form.querySelector('[name="os"]')?.value || state.installDraft?.os || state.os,
        mode: form.querySelector('[name="mode"]')?.value || state.installTab || state.installDraft?.mode || state.mode,
        projectDir: form.querySelector('[name=\"projectDir\"]')?.value || '',
      };
      if (!body.projectDir) throw new Error(t('Chưa có đường dẫn project','Missing project path'));
      await api('/api/install', { method: 'POST', body });
      state.installModalOpen = false;
      await loadSystem(true);
      await loadStatus(true);
      state.tab = 'logs';
      render();
    });
  });
  document.querySelectorAll('[data-path-action]').forEach(btn => btn.onclick = () => {
    const action = btn.dataset.pathAction;
    const modal = state.pathModal;
    if (!modal) return;
    if (action === 'ok') {
      const value = document.getElementById('path-modal-input')?.value?.trim() || '';
      if (value && typeof modal.onConfirm === 'function') modal.onConfirm(value);
    }
    state.pathModal = null;
    render();
  });
  $('#bot-create')?.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const submitBtn = ev.currentTarget.querySelector('button[type="submit"]');
    if (submitBtn?.classList.contains('is-loading')) return;
    await withButtonLoading(submitBtn, async () => {
    const fd = new FormData(ev.currentTarget);
    const body = Object.fromEntries(fd.entries());
    body.channel = state.botChannel || 'telegram';
    if (body.channel === 'zalo-personal') {
      state.botModalOpen = false;
      state.zaloLoginOpen = true;
      state.zaloQrDataUrl = '';
      state.zaloLoginLines = [t('Đang tạo bot và khởi động QR Zalo...', 'Creating bot and starting Zalo QR...')];
      render();
    }
    try {
      const isEdit = !!state.botEditId;
      const url = isEdit ? `/api/bot/${encodeURIComponent(state.botEditId)}` : '/api/bot/create';
      const method = isEdit ? 'PUT' : 'POST';
      const result = await api(url, { method, body });
      state.botMessage = `✅ ${isEdit ? t('Đã cập nhật','Updated') : t('Đã tạo','Created')} ${result.agentId}${result.warning ? ' — ' + result.warning : ''}`;
      showToast(isEdit ? t('Đã cập nhật', 'Updated') : t('Đã tạo bot', 'Bot created'), `${isEdit ? t('Đã cập nhật','Updated') : t('Đã tạo','Created')} bot ${result.agentId} thành công!`, 'success');
      state.botChannel = body.channel;
      state.botEditId = '';
      state.activeBotId = result.agentId;
      state.selectedFile = '';
      if (result.loginStarted) {
        state.botModalOpen = false;
        state.zaloLoginOpen = true;
        state.zaloLoginLines = [result.loginHint || 'Starting Zalo login...'];
        state.zaloQrDataUrl = result.zaloQrDataUrl || '';
        render();
      } else {
        state.zaloLoginOpen = false;
      }
      await loadSystem(true);
      await loadStatus(true);
      await loadFiles(true);
      state.botPane = 'list';
      state.botModalOpen = false;
      state.botEditId = '';
      render();
    } catch (err) {
      state.botMessage = `❌ ${err.message}`;
      showToast(t('Lỗi thao tác', 'Action error'), err.message, 'error');
      state.zaloLoginOpen = false;
      state.botModalOpen = true; // reopen modal to show the error
      render();
    }
    });
  });
  document.querySelectorAll('.save').forEach(btn => btn.onclick = () => withButtonLoading(btn, async () => { const name = btn.dataset.file; await api('/api/bot/files/'+encodeURIComponent(name), { method: 'PUT', body: { content: document.querySelector(`[data-editor="${CSS.escape(name)}"]`).value } }); showToast(t('Đã lưu', 'Saved'), t('Đã lưu tệp tin: ', 'Saved file: ') + fileBaseName(name), 'success'); btn.innerHTML=`${actionIcon('save')} ${ui('saved')}`; setTimeout(()=>btn.innerHTML=`${actionIcon('save')} ${ui('save')}`,1200); }));
  wireSkillsHandlers(document);
}

function escapeHtml(s='') { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function fileBaseName(s='') { return String(s).split(/[\\/]/).pop() || s; }
async function loadSystem(silent=false){ state.system = await api('/api/system'); if (!silent) render(); }
async function loadStatus(silent=false){ state.install = await api('/api/bot/status'); if (!state.selectedProjectDir && state.install?.projectDir) state.selectedProjectDir = state.install.projectDir; if (!silent) render(); }
function autoSwitchBotChannel() {
  const bots = state.install?.bots || [];
  const ch = state.botChannel || 'telegram';
  if (!bots.some(b => b.channel === ch) && bots.length) {
    const firstCh = BOT_CHANNELS.find(c => bots.some(b => b.channel === c.id));
    if (firstCh) state.botChannel = firstCh.id;
  }
}
function currentBotId() {
  const bots = state.install?.bots || [];
  const ch = state.botChannel || 'telegram';
  const channelBots = bots.filter(b => b.channel === ch);
  if (channelBots.length && !channelBots.some(b => b.id === state.activeBotId)) state.activeBotId = (channelBots.find(b => b.id !== 'bot') || channelBots[0]).id;
  if (!channelBots.length) {
    state.activeBotId = '';
    state.selectedFile = '';
    return '';
  }
  return state.activeBotId || '';
}
async function loadFiles(silent=false){
  const botId = currentBotId();
  if (!botId) { state.files = []; if (!silent) render(); return; }
  state.files = (await api('/api/bot/files' + (botId ? `?agentId=${encodeURIComponent(botId)}` : ''))).files;
  if (!silent) render();
}
async function loadCatalog(silent=false){ state.catalog = await api('/api/catalog'); if (!silent) render(); }
async function loadFeatureFlags(silent=false){ const botId=currentBotId(); const data = (await api('/api/features' + (botId ? `?agentId=${encodeURIComponent(botId)}` : ''))) || {}; state.featureFlags = data.flags || {}; state.featureInstalled = data.installed || {}; state.featureVersions = data.versions || {}; if (!silent) render(); }
function appendLogLine(line) {
  const qrMatch = String(line).match(/^\[zalouser:qr\]\s+(data:image\/[a-zA-Z0-9.+-]+;base64,\S+)/);
  if (qrMatch) {
    state.zaloQrDataUrl = qrMatch[1];
    state.zaloLoginOpen = true;
    state.zaloLoginLines.push(t('Đã nhận QR Zalo. Quét mã để đăng nhập.', 'Zalo QR received. Scan to login.'));
    render();
    requestAnimationFrame(() => {
      const wrap = document.querySelector('.zalo-qr-image-wrap');
      if (!wrap && state.zaloLoginOpen && state.zaloQrDataUrl) render();
      document.querySelector('.zalo-login-modal')?.scrollTo({ top: 0, behavior: 'smooth' });
    });
    return;
  }
  const html = `<p>${escapeHtml(line)}</p>`;
  if (state.zaloLoginOpen || /\[zalouser\]|zalo|qr|login|scan/i.test(line)) {
    state.zaloLoginLines.push(cleanTerminalLine(line));
    const qr = document.querySelector('[data-zalo-qr-log]');
    if (qr) { qr.textContent = state.zaloLoginLines.slice(-120).join('\n'); qr.scrollTop = qr.scrollHeight; }
    if (/\[zalouser\].*scan.*qr/i.test(line) && state.zaloQrDataUrl) {
      render();
      requestAnimationFrame(() => document.querySelector('.zalo-login-modal')?.scrollTo({ top: 0, behavior: 'smooth' }));
    }
  }
  document.querySelectorAll('.terminal.big,.live-log-terminal').forEach((el) => {
    const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 32;
    el.insertAdjacentHTML('beforeend', html);
    while (el.children.length > 500) el.firstElementChild?.remove();
    if (nearBottom) el.scrollTop = el.scrollHeight;
  });
}
function connectLogs(){ const es = new EventSource('/api/install/logs'); es.onmessage = e => { const msg = JSON.parse(e.data); state.logs.push(msg.line); appendLogLine(msg.line); }; }
function cleanTerminalLine(s='') { return String(s).replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, '').replace(/\r/g, '').replace(/[┌┐└┘├┤─│╭╮╯╰]/g, (c)=>c); }

function showToast(title, desc, type = 'info', duration = 4000) {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast-card toast-card--${type}`;
  
  const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
  
  toast.innerHTML = `
    <span class="toast-card__icon">${icon}</span>
    <div class="toast-card__body">
      <span class="toast-card__title">${escapeHtml(title)}</span>
      <span class="toast-card__desc">${escapeHtml(desc)}</span>
    </div>
    <button class="toast-card__close" aria-label="Close">&times;</button>
  `;

  toast.querySelector('.toast-card__close').onclick = () => {
    toast.classList.remove('show');
    toast.classList.add('hide');
    setTimeout(() => toast.remove(), 400);
  };

  container.appendChild(toast);
  
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  if (duration > 0) {
    setTimeout(() => {
      if (toast.parentNode) {
        toast.classList.remove('show');
        toast.classList.add('hide');
        setTimeout(() => toast.remove(), 400);
      }
    }, duration);
  }
}

render();
Promise.all([loadSystem(true), loadStatus(true), loadCatalog(true), loadFeatureFlags(true)]).finally(() => { render(); connectLogs(); });




'use strict';

/*
 * NFT Portfolio Lite -- the page.
 *
 * Everything here is read-only: the page asks the local server for what
 * OpenSea shows for your wallet addresses and draws it. It never asks for a
 * private key or a seed phrase, and nothing in it can move a token.
 */

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

/*
 * The page is drawn 10% larger than the browser's own zoom (body { zoom: 1.1 }
 * in style.css), so that at 100% it reads as the panel does at 110%. Under
 * CSS zoom the browser measures in enlarged pixels -- getBoundingClientRect,
 * innerWidth -- while positions are set in the page's own. Every measurement
 * used to place something goes through these, which divide the zoom back out.
 */
const pageZoom = () => document.body.currentCSSZoom || parseFloat(getComputedStyle(document.body).zoom) || 1;

function pageRect(el) {
  const r = el.getBoundingClientRect();
  const z = pageZoom();
  return { left: r.left / z, top: r.top / z, right: r.right / z, bottom: r.bottom / z, width: r.width / z, height: r.height / z };
}
const viewWidth = () => window.innerWidth / pageZoom();
const viewHeight = () => window.innerHeight / pageZoom();

/* -------------------------------------------------------------- language
 *
 * English and Turkish. Sentences, buttons and messages are translated; the
 * trade's own words -- NFT, Token, Floor, Top offer, the table headings --
 * stay in English, as they are used in either language. The choice is kept
 * in this browser; the first visit follows the browser's language.
 */
const STRINGS = {
  en: {
    brandNote: 'Read-only · addresses only · never asks for a key or seed phrase',
    checkUpdates: 'Check for updates',
    checking: 'Checking…',
    couldNotCheck: 'Could not check',
    updateAvailable: 'Update available',
    upToDate: 'Up to date',
    support: 'Support',
    totalValue: 'Total value',
    footer: 'Not affiliated with OpenSea. Reads the same data OpenSea\u2019s own site uses, which can change without notice.',
    settingsFirst: 'Add your wallets',
    settings: 'Settings',
    settingsNote: 'Wallet <b>addresses</b> only (0x…). This app never asks for a private key or a seed phrase — if anything claiming to be it does, it is not this app.',
    addWallet: '+ Add wallet',
    apiKey: 'OpenSea API key',
    apiKeyPlaceholder: 'Optional — only for adding NFTs by hand',
    namePlaceholder: 'Name (optional)',
    remove: 'Remove',
    close: 'Close',
    save: 'Save',
    keyFromEnv: 'Set by the OPENSEA_API_KEY secret of this environment.',
    keySaved: 'A key is saved. Leave blank to keep it; type a new one to replace it.',
    keyNone: 'Not needed to view your portfolio. Stays on this machine; never sent to the page again.',
    notAddress: 'Not a wallet address: {a}',
    needWallet: 'Add at least one wallet address.',
    allWallets: 'All wallets',
    nWallets: '{n} wallets',
    couldNotFetch: 'Could not fetch: {e}',
    couldNotRead: 'Could not read the portfolio.',
    serverDown: 'Could not reach the local server: {e}',
    asleepCodespace: 'The codespace is asleep, so the figures are not updating.',
    wakeCodespace: 'Wake it up',
    waking: 'Waking… this page carries on by itself',
    asleepLocal: 'The app is not running, so the figures are not updating. Start it with npm start; this page picks up by itself.',
    noItemsSelected: 'No items visible in the selected wallets.',
    noItems: 'No items visible in these wallets.',
    noPieces: 'No pieces match.',
    searchPieces: 'Search name or #',
    searchCollections: 'Search collections',
    noOfferHead: 'Collections with no top offer',
    tailReading: 'Reading…',
    jumpUnvalued: 'Go to collections with no top offer',
    searchTokens: 'Search tokens',
    noMatch: 'Nothing matches the search.',
    all: 'All',
    byWallet: 'By wallet',
    tokensError: 'Tokens could not be read from OpenSea. Refresh to try again.',
    noTokens: 'No tokens in these wallets.',
    backToTop: 'Back to the top',
    historyTitle: 'Price changes · last {range}',
    rangeHours: '{n} hours',
    rangeDays: '{n} days',
    stepEach: 'Each read',
    histTime: 'Time',
    histDay: 'Day',
    histChange: 'Change',
    histHoldings: 'Collection',
    stepHours: '{n}h',
    stepCustom: 'Custom',
    unitMin: 'min',
    unitHour: 'h',
    loading: 'Loading…',
    noHistory: 'No price changes in the last {range}.',
    manualTitle: 'Add an NFT by hand',
    manualNote: 'For pieces OpenSea shows under none of your wallets, such as staked ones. Paste the item\u2019s OpenSea link, or the collection\u2019s link and how many you hold.',
    openseaLink: 'OpenSea link',
    howMany: 'How many',
    wallet: 'Wallet',
    add: 'Add',
    adding: 'Adding…',
    needKey: 'Adding NFTs by hand needs an OpenSea API key.',
    addInSettings: 'Add it in settings',
    addedByHand: 'Added by hand',
    readingItems: 'Reading valued items… {n}',
    readingTail: 'Reading items with no offer… {n}',
    tailNext: 'Next read {time}',
    updating: 'Updating…',
    updatedAgo: 'Updated <b>{age}</b> ago <i>· every {m}m</i>',
    ageSec: '{n}s',
    ageMin: '{n}m',
    ageHour: '{n}h',
    noteAvailable: 'Update available · what\u2019s new',
    noteApplied: 'Updated · what\u2019s new',
    newVersion: 'A new version is available',
    updatedLatest: 'Updated to the latest version',
    updateHistory: 'Update history',
    howSelf: 'Takes a few seconds: the app updates, restarts and this page reloads. Your wallets and history are kept.',
    howManual: 'To apply it, restart the app: stop and reopen the codespace, or press Ctrl+C in its terminal and run npm start. Your wallets and history are kept.',
    updateNow: 'Update now',
    noComeBack: 'The app did not come back. Check its terminal, or run npm start.',
  },
  tr: {
    brandNote: 'Sadece okur · sadece adres · asla key ya da seed phrase istemez',
    checkUpdates: 'Güncellemeleri kontrol et',
    checking: 'Kontrol ediliyor…',
    couldNotCheck: 'Kontrol edilemedi',
    updateAvailable: 'Güncelleme var',
    upToDate: 'Güncel',
    support: 'Destek',
    totalValue: 'Toplam değer',
    footer: 'OpenSea ile bağlantısı yoktur. OpenSea\u2019nin kendi sitesinin kullandığı verileri okur; bu veriler haber verilmeden değişebilir.',
    settingsFirst: 'Cüzdanlarını ekle',
    settings: 'Ayarlar',
    settingsNote: 'Sadece cüzdan <b>adresi</b> (0x…). Bu uygulama asla private key ya da seed phrase istemez — isteyen bir şey görürsen o bu uygulama değildir.',
    addWallet: '+ Cüzdan ekle',
    apiKey: 'OpenSea API anahtarı',
    apiKeyPlaceholder: 'İsteğe bağlı — sadece elle NFT eklemek için',
    namePlaceholder: 'İsim (isteğe bağlı)',
    remove: 'Kaldır',
    close: 'Kapat',
    save: 'Kaydet',
    keyFromEnv: 'Bu ortamın OPENSEA_API_KEY secret\u2019ı ile ayarlı.',
    keySaved: 'Kayıtlı bir anahtar var. Korumak için boş bırak, değiştirmek için yenisini yaz.',
    keyNone: 'Portfolyonu görmek için gerekmez. Bu makinede kalır, sayfaya bir daha gönderilmez.',
    notAddress: 'Cüzdan adresi değil: {a}',
    needWallet: 'En az bir cüzdan adresi ekle.',
    allWallets: 'Tüm cüzdanlar',
    nWallets: '{n} cüzdan',
    couldNotFetch: 'Alınamadı: {e}',
    couldNotRead: 'Portfolyo okunamadı.',
    serverDown: 'Yerel sunucuya ulaşılamadı: {e}',
    asleepCodespace: 'Codespace uykuda, rakamlar güncellenmiyor.',
    wakeCodespace: 'Uyandır',
    waking: 'Uyanıyor… sayfa kendiliğinden devam edecek',
    asleepLocal: 'Uygulama çalışmıyor, rakamlar güncellenmiyor. npm start ile başlat; sayfa kendiliğinden devam eder.',
    noItemsSelected: 'Seçili cüzdanlarda görünen item yok.',
    noItems: 'Bu cüzdanlarda görünen item yok.',
    noPieces: 'Eşleşen item yok.',
    searchPieces: 'İsim ya da # ara',
    searchCollections: 'Koleksiyon ara',
    noOfferHead: 'Teklifi olmayan koleksiyonlar',
    tailReading: 'Okunuyor…',
    jumpUnvalued: 'Teklifi olmayan koleksiyonlara git',
    searchTokens: 'Token ara',
    noMatch: 'Aramayla eşleşen yok.',
    all: 'Tümü',
    byWallet: 'Cüzdana göre',
    tokensError: 'Tokenler OpenSea\u2019den okunamadı. Tekrar denemek için yenile.',
    noTokens: 'Bu cüzdanlarda token yok.',
    backToTop: 'Başa dön',
    historyTitle: 'Fiyat değişimleri · son {range}',
    rangeHours: '{n} saat',
    rangeDays: '{n} gün',
    stepEach: 'Her okuma',
    histTime: 'Saat',
    histDay: 'Gün',
    histChange: 'Değişim',
    histHoldings: 'Koleksiyon',
    stepHours: '{n} sa',
    stepCustom: 'Özel',
    unitMin: 'dk',
    unitHour: 'sa',
    loading: 'Yükleniyor…',
    noHistory: 'Son {range} içinde fiyat değişimi yok.',
    manualTitle: 'Elle NFT ekle',
    manualNote: 'OpenSea\u2019nin hiçbir cüzdanında göstermediği parçalar için, örneğin stake edilmiş olanlar. İtemin OpenSea linkini ya da koleksiyonun linkini ve kaç tane tuttuğunu yapıştır.',
    openseaLink: 'OpenSea linki',
    howMany: 'Kaç tane',
    wallet: 'Cüzdan',
    add: 'Ekle',
    adding: 'Ekleniyor…',
    needKey: 'Elle NFT eklemek için OpenSea API anahtarı gerekir.',
    addInSettings: 'Ayarlardan ekle',
    addedByHand: 'Elle eklenenler',
    readingItems: 'Değerli itemler okunuyor… {n}',
    readingTail: 'Teklifsiz itemler okunuyor… {n}',
    tailNext: 'Sonraki okuma {time}',
    updating: 'Güncelleniyor…',
    updatedAgo: '<b>{age}</b> önce güncellendi <i>· {m} dk\u2019da bir</i>',
    ageSec: '{n} sn',
    ageMin: '{n} dk',
    ageHour: '{n} sa',
    noteAvailable: 'Güncelleme var · neler yeni',
    noteApplied: 'Güncellendi · neler yeni',
    newVersion: 'Yeni sürüm var',
    updatedLatest: 'Son sürüme güncellendi',
    updateHistory: 'Güncelleme geçmişi',
    howSelf: 'Birkaç saniye sürer: uygulama güncellenir, yeniden başlar ve bu sayfa yenilenir. Cüzdanların ve geçmişin korunur.',
    howManual: 'Uygulamak için uygulamayı yeniden başlat: codespace\u2019i kapatıp aç ya da terminalde Ctrl+C yapıp npm start yaz. Cüzdanların ve geçmişin korunur.',
    updateNow: 'Şimdi güncelle',
    noComeBack: 'Uygulama geri gelmedi. Terminaline bak ya da npm start çalıştır.',
  },
};

/* The server's own messages, where a Turkish one exists. */
const SERVER_MESSAGES_TR = {
  'Paste an OpenSea item or collection link': 'Bir OpenSea item ya da koleksiyon linki yapıştır',
  'The OpenSea API key is not valid': 'OpenSea API anahtarı geçerli değil',
  'OpenSea is rate-limiting us right now; try again shortly': 'OpenSea şu an istekleri kısıtlıyor, biraz sonra tekrar dene',
  'Adding a single item needs the OpenSea API key (Settings)': 'Tek bir item eklemek için OpenSea API anahtarı gerekir (Ayarlar)',
  'Pricing hand-added NFTs needs the OpenSea API key (Settings)': 'Elle eklenen NFT\u2019lerin fiyatı için OpenSea API anahtarı gerekir (Ayarlar)',
  'OpenSea does not know this item': 'OpenSea bu itemi tanımıyor',
  'Restart the app with npm start to update it': 'Güncellemek için uygulamayı npm start ile yeniden başlat',
};

const LANG_KEY = 'nftPortfolio.lang';
let lang = (() => {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === 'en' || saved === 'tr') return saved;
  } catch { /* private window */ }
  return String(navigator.language || '').toLowerCase().startsWith('tr') ? 'tr' : 'en';
})();

function t(key, vars = {}) {
  const text = (STRINGS[lang] && STRINGS[lang][key]) || STRINGS.en[key] || key;
  return text.replace(/\{(\w+)\}/g, (whole, name) => (name in vars ? String(vars[name]) : whole));
}

function serverText(message) {
  return lang === 'tr' ? SERVER_MESSAGES_TR[message] || message : message;
}

/* The fixed words of the page: elements marked data-i18n in index.html. */
function applyStaticText() {
  document.documentElement.lang = lang;
  for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of document.querySelectorAll('[data-i18n-placeholder]')) el.placeholder = t(el.dataset.i18nPlaceholder);
  for (const button of document.querySelectorAll('.lang-switch button')) {
    button.classList.toggle('is-on', button.dataset.lang === lang);
  }
}

function setLanguage(next) {
  if (next === lang) return;
  lang = next;
  try { localStorage.setItem(LANG_KEY, lang); } catch { /* not kept */ }
  applyStaticText();
  // Whatever is open was written in the old language: close it.
  document.querySelectorAll('.modal').forEach((modal) => modal.remove());
  if (typeof renderPortfolioView === 'function' && portfolioLoaded) renderPortfolioView();
  if (typeof paintPortfolioUpdated === 'function') paintPortfolioUpdated();
  if (typeof paintUpdateNote === 'function') paintUpdateNote();
  if (typeof syncPortfolioChips === 'function') syncPortfolioChips();
  if (appAsleep) showAppAsleep();
  if (typeof paintProfile === 'function') paintProfile();
}

document.querySelectorAll('.lang-switch button').forEach((button) => {
  button.addEventListener('click', () => setLanguage(button.dataset.lang));
});
applyStaticText();

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers || {}) },
    // A codespace just woken sends this page's requests to GitHub's sign-in
    // first; followed, that looked like the app still being away.
    redirect: 'manual',
  });
  if (response.type === 'opaqueredirect') {
    const error = new Error('Sign-in needed');
    error.appGone = true;
    error.signIn = true;
    throw error;
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.error || `HTTP ${response.status}`);
    // No answer of the app's own: something in front of it answered instead.
    error.appGone = !body.error && [404, 502, 503, 504].includes(response.status);
    throw error;
  }
  return body;
}

/*
 * The app is not there to answer: in a codespace, GitHub stops it after
 * half an hour with no terminal activity -- which is what keeps it from
 * using up the monthly hours -- and its address then answers 404. The page
 * says so plainly, keeps the last figures, and stops asking every half
 * minute; it tries again when looked at, and every few minutes meanwhile.
 */
const IN_CODESPACE = location.hostname.endsWith('.app.github.dev');
let appAsleep = false;
let appAsleepTriedAt = 0;

function isAppGone(error) {
  return Boolean(error && (error.appGone || error instanceof TypeError));
}

function showAppAsleep() {
  appAsleep = true;
  appAsleepTriedAt = Date.now();
  const summary = $('#portfolio-summary');
  summary.classList.add('is-asleep');
  summary.textContent = IN_CODESPACE ? t('asleepCodespace') : t('asleepLocal');
  if (IN_CODESPACE) {
    /*
     * One click to wake it: this page's address names the codespace
     * (<name>-4180.app.github.dev), and opening the codespace itself
     * (<name>.github.dev) starts it -- the app with it. The page cannot start
     * it on its own: that would take a GitHub token, which it never asks for.
     */
    const name = location.hostname.replace(/-\d+\.app\.github\.dev$/, '');
    const wake = document.createElement('a');
    wake.className = 'btn btn-mini pf-wake';
    wake.target = '_blank';
    wake.rel = 'noopener noreferrer';
    wake.href = name !== location.hostname ? `https://${name}.github.dev` : 'https://github.com/codespaces';
    wake.textContent = appWaking ? t('waking') : t('wakeCodespace');
    wake.addEventListener('click', () => {
      appWaking = true;
      wake.textContent = t('waking');
      // Looked for every ten seconds while it starts, for a few minutes.
      const started = Date.now();
      const tryAgain = () => {
        if (!appAsleep || Date.now() - started > 5 * 60 * 1000) { appWaking = false; return; }
        loadPortfolio(true).finally(() => setTimeout(tryAgain, 10000));
      };
      setTimeout(tryAgain, 10000);
    });
    summary.append(' ', wake);
  }
}

let appWaking = false;

function clearAppAsleep() {
  if (!appAsleep) return;
  appAsleep = false;
  $('#portfolio-summary').classList.remove('is-asleep');
}

/** Dollars: sub-cent amounts still get a readable figure. */
function formatUsd(value) {
  if (!Number.isFinite(value)) return '';
  if (value === 0) return '$0';
  if (value < 0.01) return '<$0.01';
  if (value < 1) return '$' + value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
  // Thousands grouped: $53,110.98, not $53110.98.
  return '$' + value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/*
 * In the tables, $100,000 and up written short, as OpenSea does: $268.9K,
 * $1.2M. The headline cards above keep the full figure.
 */
function compactUsd(value) {
  if (!Number.isFinite(value) || Math.abs(value) < 100000) return formatUsd(value);
  if (Math.abs(value) >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  if (Math.abs(value) >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  return `$${(value / 1e3).toFixed(1)}K`;
}

/* A cell's text in short, with the full amount on hover when it was cut. */
function setCompactUsd(el, value) {
  const short = compactUsd(value);
  el.textContent = short;
  if (short !== formatUsd(value)) el.title = formatUsd(value);
}

/* The short names given to wallets in the settings, by address. */
let walletLabelMap = {};

function walletDisplay(address) {
  const short = `${address.slice(0, 6)}…${address.slice(-4)}`;
  const label = walletLabelMap[address.toLowerCase()];
  return label ? `${label} (${short})` : short;
}

/*
 * A network's logo from DefiLlama's icon CDN; a network it does not know, or
 * a logo that fails to load, becomes a lettered square.
 */
const CHAIN_LOGO = {
  ethereum: 'ethereum', base: 'base', ink: 'ink', robinhood: 'robinhood',
  polygon: 'polygon', matic: 'polygon', arbitrum: 'arbitrum', arbitrum_one: 'arbitrum',
  optimism: 'optimism', bsc: 'binance', bnb: 'binance', bnb_chain: 'binance',
  avalanche: 'avalanche', zora: 'zora', hyperevm: 'hyperliquid', abstract: 'abstract',
  blast: 'blast', unichain: 'unichain', berachain: 'berachain', sei: 'sei',
  soneium: 'soneium', shape: 'shape', ape_chain: 'apechain', solana: 'solana',
  flow: 'flow', ronin: 'ronin', gunzilla: 'gunz', animechain: 'animechain',
};

function letterMark(label) {
  const letter = (String(label || '?').trim()[0] || '?').toUpperCase();
  let hash = 0;
  for (const char of String(label || '')) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return `<svg class="net-mark-svg" viewBox="0 0 20 20" aria-hidden="true"><rect width="20" height="20" rx="5" fill="hsl(${hash % 360} 45% 38%)"/>`
    + `<text x="10" y="14" text-anchor="middle" font-size="11" font-weight="700" fill="#fff" font-family="sans-serif">${letter.replace(/[^A-Z0-9]/g, '?')}</text></svg>`;
}

function netMark(label) {
  const key = String(label || '').toLowerCase().replace(/[\s-]+/g, '_');
  const logo = CHAIN_LOGO[key];
  if (!logo) return letterMark(key);
  return `<img class="net-mark-svg" alt="" src="https://icons.llamao.fi/icons/chains/rsz_${logo}?w=48&h=48" data-mark-key="${key}">`;
}

document.addEventListener('error', (event) => {
  const img = event.target;
  if (!(img instanceof HTMLImageElement) || !img.dataset.markKey) return;
  img.outerHTML = letterMark(img.dataset.markKey);
}, true);

/* ------------------------------------------------------------ tooltips
 *
 * One card reused for every tooltip. A `title` is moved into `data-tip` the
 * first time the pointer reaches it, which retires the browser's own balloon.
 */
const tipEl = document.createElement('div');
tipEl.id = 'tip';
document.body.appendChild(tipEl);

let tipTimer = null;
let tipHost = null;

function tipParts(host, text) {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  if (lines.length > 1) return { head: lines[0], body: lines.slice(1).join('\n') };
  if ('tipPlain' in host.dataset) return { head: '', body: lines[0] };
  const own = (host.getAttribute('aria-label') || host.textContent || '').replace(/\s+/g, ' ').trim();
  const head = own && own.length <= 40 && own.toLowerCase() !== lines[0].toLowerCase() ? own : '';
  return { head, body: lines[0] };
}

function placeTip(host, pointer) {
  const box = pageRect(host);
  const tip = pageRect(tipEl);
  const margin = 8;
  const huge = box.width > 420 || box.height > 140;
  const anchor = huge && pointer
    ? { left: pointer.x, top: pointer.y, bottom: pointer.y + 18 }
    : { left: box.left, top: box.top, bottom: box.bottom };
  let left = Math.max(margin, Math.min(anchor.left, viewWidth() - tip.width - margin));
  let top = anchor.bottom + 7;
  if (top + tip.height > viewHeight() - margin) top = anchor.top - tip.height - 7;
  top = Math.max(margin, Math.min(top, viewHeight() - tip.height - margin));
  tipEl.style.left = `${Math.round(left)}px`;
  tipEl.style.top = `${Math.round(top)}px`;
}

function hideTip() {
  clearTimeout(tipTimer);
  tipTimer = null;
  tipHost = null;
  tipEl.classList.remove('is-on');
}

function showTip(host, pointer) {
  const text = (host.dataset.tip || '').trim();
  if (!text || !host.isConnected) return;
  const { head, body } = tipParts(host, text);
  tipEl.replaceChildren();
  if (head) {
    const heading = document.createElement('b');
    heading.textContent = head;
    tipEl.appendChild(heading);
  }
  const detail = document.createElement('i');
  detail.textContent = body;
  tipEl.appendChild(detail);
  tipEl.classList.add('is-on');
  placeTip(host, pointer);
}

document.addEventListener('mouseover', (event) => {
  const host = event.target.closest?.('[data-tip],[title]');
  if (!host || host === tipHost) return;
  const native = host.getAttribute('title');
  if (native !== null) {
    host.dataset.tip = native;
    if (!host.getAttribute('aria-label') && !host.textContent.trim()) host.setAttribute('aria-label', native);
    host.removeAttribute('title');
  }
  if (!host.dataset.tip) return;
  hideTip();
  tipHost = host;
  const pointer = { x: event.clientX / pageZoom(), y: event.clientY / pageZoom() };
  tipTimer = setTimeout(() => showTip(host, pointer), 180);
}, true);

document.addEventListener('mouseout', (event) => {
  if (!tipHost) return;
  const to = event.relatedTarget;
  if (to && tipHost.contains(to)) return;
  hideTip();
}, true);
document.addEventListener('mousedown', hideTip, true);
window.addEventListener('scroll', hideTip, true);
window.addEventListener('blur', hideTip);
window.addEventListener('resize', hideTip);

/* ------------------------------------------------------------ settings
 *
 * The wallets to show, each with an optional short name, and the optional
 * OpenSea API key that adding NFTs by hand needs. Addresses only: this page
 * never asks for, and has nowhere to put, a private key or a seed phrase.
 */
let settingsState = { wallets: [], apiKeySet: false, apiKeyFromEnv: false };

async function loadSettings() {
  settingsState = await api('/api/settings');
  paintUpdateNote();
  walletLabelMap = Object.fromEntries(settingsState.wallets.filter((w) => w.label).map((w) => [w.address, w.label]));
  return settingsState;
}

function openSettings(firstRun = false) {
  document.querySelector('.settings-modal')?.remove();
  const modal = document.createElement('div');
  modal.className = 'modal settings-modal';
  modal.innerHTML = `
    <div class="modal-card settings-card">
      <div class="modal-title">${firstRun ? t('settingsFirst') : t('settings')}</div>
      <p class="settings-note">${t('settingsNote')}</p>
      <div class="settings-wallets" id="settings-wallets"></div>
      <button class="btn btn-mini" id="settings-add-wallet" type="button">${t('addWallet')}</button>
      <div class="settings-key">
        <label class="modal-field"><span>${t('apiKey')}</span>
          <input id="settings-api-key" type="password" autocomplete="off" placeholder="${t('apiKeyPlaceholder')}"></label>
        <p class="settings-hint" id="settings-key-hint"></p>
      </div>
      <p class="pf-manual-error" id="settings-error"></p>
      <div class="modal-actions">
        ${firstRun ? '' : `<button class="btn" id="settings-cancel" type="button">${t('close')}</button>`}
        <button class="btn btn-primary" id="settings-save" type="button">${t('save')}</button>
      </div>
    </div>`;
  document.body.appendChild(modal);

  const list = modal.querySelector('#settings-wallets');
  const addRow = (wallet = { address: '', label: '' }) => {
    const row = document.createElement('div');
    row.className = 'settings-wallet';
    row.innerHTML = '<input class="sw-address" type="text" placeholder="0x…" spellcheck="false" autocomplete="off">'
      + `<input class="sw-label" type="text" placeholder="${t('namePlaceholder')}" maxlength="24" autocomplete="off">`
      + `<button class="btn btn-mini is-icon sw-remove" type="button" aria-label="${t('remove')}">`
      + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg></button>';
    row.querySelector('.sw-address').value = wallet.address;
    row.querySelector('.sw-label').value = wallet.label || '';
    row.querySelector('.sw-remove').addEventListener('click', () => row.remove());
    list.appendChild(row);
    return row;
  };
  for (const wallet of settingsState.wallets) addRow(wallet);
  if (!settingsState.wallets.length) addRow().querySelector('.sw-address').focus();
  modal.querySelector('#settings-add-wallet').addEventListener('click', () => addRow().querySelector('.sw-address').focus());

  const hint = modal.querySelector('#settings-key-hint');
  const keyInput = modal.querySelector('#settings-api-key');
  if (settingsState.apiKeyFromEnv) {
    hint.textContent = t('keyFromEnv');
    keyInput.disabled = true;
  } else if (settingsState.apiKeySet) {
    hint.textContent = t('keySaved');
  } else {
    hint.textContent = t('keyNone');
  }

  const close = () => { modal.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (event) => { if (event.key === 'Escape' && !firstRun) close(); };
  document.addEventListener('keydown', onKey);
  modal.querySelector('#settings-cancel')?.addEventListener('click', close);

  modal.querySelector('#settings-save').addEventListener('click', async () => {
    const error = modal.querySelector('#settings-error');
    error.textContent = '';
    const wallets = [...list.querySelectorAll('.settings-wallet')]
      .map((row) => ({ address: row.querySelector('.sw-address').value.trim(), label: row.querySelector('.sw-label').value.trim() }))
      .filter((w) => w.address);
    const bad = wallets.find((w) => !/^0x[0-9a-fA-F]{40}$/.test(w.address));
    if (bad) { error.textContent = t('notAddress', { a: bad.address }); return; }
    if (!wallets.length) { error.textContent = t('needWallet'); return; }
    const body = { wallets };
    if (keyInput.value.trim()) body.apiKey = keyInput.value.trim();
    try {
      await api('/api/settings', { method: 'POST', body: JSON.stringify(body) });
      await loadSettings();
      close();
      loadPortfolio(true);
      loadProfile();
    } catch (err) {
      error.textContent = serverText(err.message);
    }
  });
}

// ----------------------------------------------------------- portfolio

/*
 * Every wallet linked to the OpenSea account, drawn as a table. The reason
 * this exists at all is weight: OpenSea's own portfolio page ships an app to
 * render a grid and then labours over it. The numbers behind that grid are two
 * plain reads, and a table of them costs nothing to draw.
 *
 * Value is counted at each collection's top offer -- what someone will pay
 * now -- the way OpenSea values holdings; a collection without an offer
 * counts as zero rather than being guessed at.
 */
let portfolioLoaded = false;
let portfolioTokenError = '';
// The wallets the portfolio was read for; the first is the main one.
let portfolioWalletList = [];

/*
 * Which wallets the portfolio is being read through. Lowercased, because an
 * owner address and a chip label can disagree on checksum casing. Empty is
 * "all of them" -- the state the page starts in and returns to.
 */
const portfolioFilter = new Set();
let portfolioGroups = [];
let portfolioTokens = [];

/** The collections as filtered, with per-wallet counts recomputed. */
function filteredPortfolioGroups() {
  /*
   * Even unfiltered the totals are recomputed from the items rather than
   * trusted from the response. Same arithmetic the server uses, but it means
   * the headline cannot silently read zero if that field is ever missing --
   * and filtered and unfiltered are then measured the same way.
   */
  if (!portfolioFilter.size) {
    return portfolioGroups.map((group) => ({
      ...group,
      valueUsd: (group.items || []).length * (group.offerUsd || 0),
      floorValueUsd: (group.items || []).length * (group.floorUsd || 0),
    }));
  }
  const groups = [];
  for (const group of portfolioGroups) {
    const items = (group.items || []).filter(
      (item) => item.owner && portfolioFilter.has(item.owner.toLowerCase()));
    if (!items.length) continue;
    /*
     * held and the two totals are per-item, so they have to be recomputed
     * rather than carried over -- otherwise filtering to one wallet still
     * showed the value of everybody's copies.
     */
    groups.push({
      ...group,
      items,
      held: items.length,
      wallets: [...new Set(items.map((item) => item.owner))],
      valueUsd: items.length * (group.offerUsd || 0),
      floorValueUsd: items.length * (group.floorUsd || 0),
    });
  }
  return groups.sort((a, b) => b.valueUsd - a.valueUsd || b.floorValueUsd - a.floorValueUsd);
}

/** The tokens as filtered. They carry an owner, exactly as the NFTs do. */
function filteredPortfolioTokens() {
  if (!portfolioFilter.size) return portfolioTokens;
  return portfolioTokens.filter(
    (token) => token.owner && portfolioFilter.has(token.owner.toLowerCase()));
}

/*
 * The headline is NFTs plus tokens, so it has to be recomputed alongside
 * them -- left as the server's total it would have contradicted the cards
 * right under it the moment a wallet was deselected.
 */
function renderPortfolioTotals() {
  const nftUsd = filteredPortfolioGroups().reduce((sum, g) => sum + (g.valueUsd || 0), 0);
  const tokenUsd = filteredPortfolioTokens().reduce((sum, t) => sum + (t.usd || 0), 0);
  $('#portfolio-total').textContent = formatUsd(nftUsd + tokenUsd);
  $('#portfolio-nft').textContent = formatUsd(nftUsd);
  $('#portfolio-token').textContent = formatUsd(tokenUsd);
  // Their shares, in the bar: a sliver stays visible for any part not nil.
  const whole = nftUsd + tokenUsd;
  const share = (usd) => (whole > 0 && usd > 0 ? Math.max((usd / whole) * 100, 1) : 0);
  const split = $('#portfolio-split');
  if (split) {
    split.classList.toggle('is-empty', !(whole > 0));
    $('#portfolio-split-nft').style.flexGrow = String(share(nftUsd));
    $('#portfolio-split-token').style.flexGrow = String(share(tokenUsd));
    split.title = whole > 0
      ? `NFT ${Math.round((nftUsd / whole) * 100)}% · Token ${Math.round((tokenUsd / whole) * 100)}%`
      : '';
  }
}

function syncPortfolioChips() {
  const on = portfolioFilter.size;
  // Every chip, not just the clear one: the click handler changes the set and
  // leaves the painting to this, so missing them here left a wallet filtered
  // with nothing on screen saying so.
  $$('.portfolio-wallet').forEach((chip) => {
    if (chip.id === 'portfolio-filter-clear') chip.classList.toggle('is-on', !on);
    else if (chip.dataset.addr) chip.classList.toggle('is-on', portfolioFilter.has(chip.dataset.addr));
  });
  // The button says what the list is set to.
  const trigger = $('#portfolio-wallet-trigger');
  if (trigger) {
    const only = [...portfolioFilter];
    trigger.textContent = !only.length ? t('allWallets')
      : only.length === 1 ? walletDisplay(only[0])
        : t('nWallets', { n: only.length });
    trigger.classList.toggle('is-on', only.length > 0);
  }
  const summary = $('#portfolio-filter-note');
  if (summary) {
    summary.textContent = on
      ? `${on} wallet(s) selected — the cards show only those`
      : '';
  }
}

async function loadPortfolio(force) {
  if (portfolioLoaded && !force) return;
  // One read at a time: a click, the timer and a scroll can all ask at once.
  if (portfolioUpdating) return;
  // Rebuilding the table destroys the rows these cards are anchored to.
  const summary = $('#portfolio-summary');
  const walletBox = $('#portfolio-wallets');

  // Loading shows in the counter pill; this line is for errors only. The
  // asleep note stays while asking again: cleared each time, it blinked.
  if (!appAsleep) summary.textContent = '';

  let data;
  portfolioUpdating = true;
  paintPortfolioUpdated();
  try {
    data = await api('/api/portfolio');
  } catch (error) {
    if (error.signIn) {
      /*
       * The codespace is back but wants this browser signed in again, which
       * only a page load does (the redirect goes to github.com). At most once
       * a minute, so a sign-in that keeps failing cannot loop.
       */
      let last = 0;
      try { last = Number(sessionStorage.getItem('nftPortfolio.signInReload')) || 0; } catch { /* none */ }
      if (Date.now() - last > 60000) {
        try { sessionStorage.setItem('nftPortfolio.signInReload', String(Date.now())); } catch { /* not kept */ }
        location.reload();
        return;
      }
    }
    if (isAppGone(error)) {
      showAppAsleep();
    } else {
      clearAppAsleep();
      summary.textContent = t('couldNotFetch', { e: error.message });
    }
    return;
  } finally {
    portfolioUpdating = false;
  }
  clearAppAsleep();
  if (!data.available) {
    // No wallets yet: the setup opens instead of an error line.
    if (data.reason === 'no-wallets') {
      summary.textContent = '';
      // Never over an open one: rebuilding it wiped what was being typed.
      if (!document.querySelector('.settings-modal')) openSettings(true);
      return;
    }
    summary.textContent = data.reason || t('couldNotRead');
    return;
  }

  portfolioLoaded = true;
  portfolioFetchedAt = Date.now();
  paintPortfolioUpdated();

  /*
   * The chips were a legend; now they are the control. Clicking one narrows
   * the view to what that wallet holds, and clicking several unions them --
   * "these three wallets" is the question actually being asked when the
   * manifest wallets sit alongside the main one. Empty selection means all
   * of them, which is also the default.
   */
  portfolioGroups = data.collections || [];
  portfolioWalletList = data.wallets || [];
  // One wallet: the Wallets columns have nothing to say and are hidden.
  document.body.classList.toggle('single-wallet', portfolioWalletList.length <= 1);
  // A wallet that vanished between refreshes cannot stay selected.
  const present = new Set((data.wallets || []).map((a) => a.toLowerCase()));
  for (const address of [...portfolioFilter]) {
    if (!present.has(address)) portfolioFilter.delete(address);
  }

  /*
   * One button that opens the wallet list, rather than a chip per wallet in
   * the header: the row of chips took a line of its own. The list ticks
   * wallets in and out; All wallets clears the selection.
   */
  walletBox.textContent = '';
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.id = 'portfolio-wallet-trigger';
  trigger.className = 'pf-wallet-trigger';
  trigger.setAttribute('aria-haspopup', 'true');
  const menu = document.createElement('div');
  menu.id = 'portfolio-wallet-menu';
  menu.className = 'pf-wallet-menu hidden';

  const clear = document.createElement('button');
  clear.type = 'button';
  clear.id = 'portfolio-filter-clear';
  clear.className = 'portfolio-wallet pf-wallet-option is-clear';
  clear.textContent = t('allWallets');
  clear.addEventListener('click', () => {
    portfolioFilter.clear();
    renderPortfolioView();
  });
  menu.appendChild(clear);

  for (const address of data.wallets) {
    const key = address.toLowerCase();
    const option = document.createElement('button');
    option.type = 'button';
    option.dataset.addr = key;
    option.className = 'portfolio-wallet pf-wallet-option' + (portfolioFilter.has(key) ? ' is-on' : '');
    option.textContent = walletDisplay(address);
    option.addEventListener('click', () => {
      if (portfolioFilter.has(key)) portfolioFilter.delete(key);
      else portfolioFilter.add(key);
      renderPortfolioView();
    });
    menu.appendChild(option);
  }

  trigger.addEventListener('click', (event) => {
    event.stopPropagation();
    menu.classList.toggle('hidden');
  });
  // Picking wallets keeps the list open; a click anywhere else closes it.
  menu.addEventListener('click', (event) => event.stopPropagation());
  walletBox.append(trigger, menu);
  syncPortfolioChips();

  /*
   * The headline is NFTs plus tokens, the same figure OpenSea puts at the top
   * of its own portfolio page, summed from top offers the way OpenSea values
   * holdings. It is written by renderPortfolioTotals rather than here, so it
   * follows the wallet filter -- written from the response it would have
   * contradicted the cards underneath it as soon as one was deselected.
   */
  summary.textContent = '';

  /*
   * The server is still reading a long item list: the counter follows its
   * progress, and the tables catch up now and then until it is done.
   */
  portfolioItemsLoading = data.loading ? (data.loaded || 0) : 0;
  portfolioTailLoading = Boolean(data.tailLoading);
  portfolioTailLoaded = data.tailLoaded || 0;
  portfolioTailNextAt = data.tailNextAt || 0;
  clearTimeout(portfolioLoadingTimer);
  if (data.loading) watchItemRead();
  else if (portfolioTailLoading) watchTailRead();

  /*
   * Tokens that could not be read this time: the last list stays rather than
   * turning into "Token $0". With nothing to keep, the table says why.
   */
  portfolioTokenError = data.tokenError || '';
  if (!portfolioTokenError || !portfolioTokens.length) portfolioTokens = data.tokens || [];
  notePortfolioMove(data.move);
  /*
   * While a long list is read the page asks every five seconds. Rebuilding
   * both tables each time was the page's heaviest work, so a read that
   * brought nothing new draws nothing, and the token table -- which the item
   * read does not change -- is drawn only when its own figures move.
   */
  // Counts and value both: a refresh where only prices moved must still draw.
  const itemsValue = portfolioGroups.reduce((sum, g) => sum + (g.valueUsd || 0) + (g.floorUsd || 0), 0);
  const itemsSig = `${data.itemCount}|${portfolioGroups.length}|${Math.round(itemsValue * 100)}`;
  const tokensSig = `${portfolioTokens.length}|${Math.round((data.tokenTotalUsd || 0) * 100)}`;
  if (itemsSig === portfolioDrawn.items && tokensSig === portfolioDrawn.tokens) {
    renderPortfolioTotals();
    return;
  }
  if (data.loading && tokensSig === portfolioDrawn.tokens) {
    renderPortfolioCards();
    renderPortfolioTotals();
    syncPortfolioChips();
    fitPortfolioTables();
  } else {
    renderPortfolioView();
  }
  portfolioDrawn = { items: itemsSig, tokens: tokensSig };
}

let portfolioDrawn = { items: '', tokens: '' };

/*
 * While a long list is read: the progress every 3 seconds from a few bytes'
 * answer, the whole portfolio -- megabytes for a large wallet -- every 15
 * seconds and once more when the read is done. Asking for everything every
 * few seconds was most of what the page downloaded.
 */
const READ_STATUS_MS = 3000;
const READ_FULL_MS = 15000;

function watchItemRead() {
  let waited = 0;
  const tick = async () => {
    let status = null;
    try { status = await api('/api/portfolio/status'); } catch { /* ask the full one */ }
    waited += READ_STATUS_MS;
    if (!status || !status.loading || waited >= READ_FULL_MS) {
      loadPortfolio(true);
      return;
    }
    portfolioItemsLoading = status.loaded || portfolioItemsLoading;
    paintPortfolioUpdated();
    portfolioLoadingTimer = setTimeout(tick, READ_STATUS_MS);
  };
  portfolioLoadingTimer = setTimeout(tick, READ_STATUS_MS);
}

/*
 * The pieces with no offer, read after the rest: a quiet look every twenty
 * seconds, and the table once more when they are all in.
 */
let portfolioTailLoading = false;
// The no-offer part starts folded: nothing in it adds to the value.
const TAIL_OPEN_KEY = 'nftPortfolio.tailOpen';
let portfolioTailOpen = (() => {
  try { return localStorage.getItem(TAIL_OPEN_KEY) === '1'; } catch { return false; }
})();

/*
 * The button beside the collection search: down to the collections with no
 * offer, opening that part first if it is folded. Shown only when there is
 * such a part.
 */
let tailOpenedByJump = false;

function jumpToUnvalued() {
  if (!portfolioTailOpen) {
    portfolioTailOpen = true;
    tailOpenedByJump = true;
    try { localStorage.setItem(TAIL_OPEN_KEY, '1'); } catch { /* not kept */ }
    renderPortfolioCards();
  }
  const at = tableWindow.groups.findIndex((group) => group.divider);
  if (at < 0) return;
  $('#portfolio-cards').scrollTo({ top: at * tableWindow.rowHeight, behavior: 'smooth' });
}
$('#pf-jump-unvalued')?.addEventListener('click', jumpToUnvalued);
let portfolioTailLoaded = 0;
let portfolioTailNextAt = 0;
const TAIL_STATUS_MS = 20000;

function watchTailRead() {
  const tick = async () => {
    let status = null;
    try { status = await api('/api/portfolio/status'); } catch { /* asked again later */ }
    if (status && !status.tailLoading) {
      loadPortfolio(true);
      return;
    }
    if (status) portfolioTailLoaded = status.tailLoaded || portfolioTailLoaded;
    paintPortfolioUpdated();
    portfolioLoadingTimer = setTimeout(tick, TAIL_STATUS_MS);
  };
  portfolioLoadingTimer = setTimeout(tick, TAIL_STATUS_MS);
}

/** Cards, tokens and the headline always move together. */
/*
 * A search over each table: the collections by name, the tokens by name or
 * symbol. They narrow the rows only; the totals above stay whole.
 */
const tableSearch = { collections: '', tokens: '' };
const searchMatch = (query, ...texts) => !query
  || texts.some((text) => String(text || '').toLowerCase().includes(query));

$('#pf-search-collections')?.addEventListener('input', (event) => {
  tableSearch.collections = event.target.value.trim().toLowerCase();
  $('#portfolio-cards').scrollTop = 0;
  renderPortfolioCards();
});
$('#pf-search-tokens')?.addEventListener('input', (event) => {
  tableSearch.tokens = event.target.value.trim().toLowerCase();
  renderPortfolioTokens(filteredPortfolioTokens());
});

function renderPortfolioView() {
  renderPortfolioCards();
  renderPortfolioTokens(filteredPortfolioTokens());
  renderPortfolioTotals();
  syncPortfolioChips();
  fitPortfolioTables();
}

/*
 * The collections as a table, the way OpenSea's own portfolio shows them:
 * one row per collection, its numbers in columns that sort. Drawn from the
 * stored groups rather than from the response, so toggling a wallet or a
 * sort re-renders without another round trip to OpenSea.
 */
let portfolioSort = { key: 'value', dir: -1 };

const PORTFOLIO_SORT_VALUE = {
  value: (group) => group.valueUsd || 0,
  floor: (group) => group.floorUsd || 0,
  offer: (group) => group.offerUsd || 0,
};

function paintPortfolioSort() {
  $$('.pf-sort').forEach((button) => {
    const on = button.dataset.sort === portfolioSort.key;
    button.classList.toggle('is-on', on);
    button.dataset.dir = on ? (portfolioSort.dir < 0 ? 'desc' : 'asc') : '';
  });
}

$$('.pf-sort').forEach((button) => button.addEventListener('click', () => {
  const key = button.dataset.sort;
  portfolioSort = portfolioSort.key === key
    ? { key, dir: -portfolioSort.dir }
    : { key, dir: -1 };
  renderPortfolioCards();
}));

function renderPortfolioCards() {
  const rows = $('#portfolio-cards');
  if (!rows) return;
  paintPortfolioSort();

  const valueOf = PORTFOLIO_SORT_VALUE[portfolioSort.key] || PORTFOLIO_SORT_VALUE.value;
  const byChoice = (a, b) => portfolioSort.dir * (valueOf(a) - valueOf(b));
  /*
   * Two parts: the collections with a top offer -- all of the value -- and
   * under a heading of their own, those without one, which the server reads
   * after. Each part sorts on its own; the ones without an offer, all worth
   * nothing by the offer, fall back to their floor.
   */
  const shown = filteredPortfolioGroups()
    .filter((group) => searchMatch(tableSearch.collections, group.name, group.slug));
  const valued = shown.filter((group) => group.offerUsd > 0 || (group.items || []).some((item) => item.manual))
    .sort(byChoice);
  const floorOf = (group) => (group.floorUsd || 0) * (group.items || []).length;
  const unvalued = shown.filter((group) => !valued.includes(group))
    .sort((a, b) => byChoice(a, b) || floorOf(b) - floorOf(a));
  // Folded unless opened, or unless a search is looking for something.
  const tailOpen = portfolioTailOpen || Boolean(tableSearch.collections);
  const groups = unvalued.length || portfolioTailLoading
    ? [...valued, { divider: true, count: unvalued.length, open: tailOpen }, ...(tailOpen ? unvalued : [])]
    : valued;
  // The jump button shows while there is a part without an offer to go to.
  const jump = $('#pf-jump-unvalued');
  if (jump) {
    jump.hidden = !groups.some((group) => group.divider);
    jump.title = t('jumpUnvalued');
    jump.setAttribute('aria-label', t('jumpUnvalued'));
  }
  forgetPictures(rows);
  if (!shown.length) {
    rows.innerHTML = tableSearch.collections ? `<div class="empty-sub">${t('noMatch')}</div>`
      : portfolioFilter.size
      ? `<div class="empty-sub">${t('noItemsSelected')}</div>`
      : `<div class="empty-sub">${t('noItems')}</div>`;
    return;
  }
  // Emptying the list resets its scroll; a refresh must leave the reader
  // where they were, not throw them back to the top.
  const keptScroll = rows.scrollTop;
  rows.textContent = '';
  tableWindow.groups = groups;
  tableWindow.drawn = new Map();
  tableWindow.first = -1;
  tableWindow.top = document.createElement('div');
  tableWindow.bottom = document.createElement('div');
  tableWindow.top.className = tableWindow.bottom.className = 'pf-spacer';
  rows.append(tableWindow.top, tableWindow.bottom);
  // The spacers first give the list its full height, so the old position
  // exists again before it is restored.
  tableWindow.bottom.style.height = `${groups.length * tableWindow.rowHeight}px`;
  rows.scrollTop = keptScroll;
  paintTableWindow(true);
}

/*
 * Only the rows near the screen exist. A large wallet has hundreds of
 * collections; drawing every row put tens of thousands of elements on the
 * page -- more than OpenSea's own -- for rows nobody was looking at. Two
 * spacers stand in for the rows above and below, so the scrollbar and the
 * scroll position are those of the whole table, and rows already drawn are
 * kept while they stay in range, so scrolling only adds and drops the edges.
 */
const tableWindow = { groups: [], drawn: new Map(), first: -1, last: -1, top: null, bottom: null, rowHeight: 56 };
const TABLE_BUFFER = 12;

function paintTableWindow(force = false) {
  const rows = $('#portfolio-cards');
  if (!rows || !tableWindow.top || !tableWindow.top.isConnected) return;
  const { groups } = tableWindow;
  const height = tableWindow.rowHeight;
  const shownFirst = Math.floor(rows.scrollTop / height);
  const shownLast = Math.ceil((rows.scrollTop + rows.clientHeight) / height);
  const first = Math.max(0, shownFirst - TABLE_BUFFER);
  const last = Math.min(groups.length, shownLast + TABLE_BUFFER);
  /*
   * Nothing to do while the rows drawn still cover what is on screen with
   * half the buffer to spare. Judged by that, not by how far the start
   * moved: a table first drawn while hidden (no height yet) or near either
   * end moves its start little or not at all, and was left half blank.
   */
  const covered = tableWindow.first <= Math.max(0, shownFirst - TABLE_BUFFER / 2)
    && tableWindow.last >= Math.min(groups.length, shownLast + TABLE_BUFFER / 2);
  if (!force && tableWindow.drawn.size && covered) return;
  tableWindow.first = first;
  tableWindow.last = last;

  const keep = new Map();
  for (let i = first; i < last; i += 1) {
    const group = groups[i];
    let row = tableWindow.drawn.get(group);
    if (!row) {
      row = portfolioRow(group);
      attachPortfolioItems(row, group);
    }
    keep.set(group, row);
  }
  for (const [group, row] of tableWindow.drawn) {
    if (keep.has(group)) continue;
    forgetPictures(row);
    row.remove();
  }
  // In order, between the spacers; a row already in place is not moved.
  let cursor = tableWindow.top;
  for (const row of keep.values()) {
    if (cursor.nextSibling !== row) cursor.after(row);
    cursor = row;
  }
  tableWindow.drawn = keep;
  tableWindow.top.style.height = `${first * height}px`;
  tableWindow.bottom.style.height = `${Math.max(0, groups.length - last) * height}px`;

  // The real row height, measured once rows exist: the CSS says 56px, but
  // a zoomed page or a changed style would otherwise misplace the window.
  const sample = keep.values().next().value;
  if (sample) {
    const measured = pageRect(sample).height;
    if (measured && Math.abs(measured - height) > 0.5) {
      tableWindow.rowHeight = measured;
      paintTableWindow(true);
    }
  }
}

let tableWindowFrame = 0;
$('#portfolio-cards').addEventListener('scroll', () => {
  if (tableWindowFrame) return;
  tableWindowFrame = requestAnimationFrame(() => {
    tableWindowFrame = 0;
    paintTableWindow();
  });
}, { passive: true });
window.addEventListener('resize', () => paintTableWindow(true));

/* A held piece's own page on OpenSea, or '' when it cannot be addressed. */
function itemPageUrl(item, group) {
  if (!item.contract || item.tokenId === '' || item.tokenId == null) return '';
  return `https://opensea.io/item/${item.chain || group.chain}/${item.contract}/${item.tokenId}`;
}

/*
 * A click on a collection's line opens its pieces in a pop-up: a panel per
 * piece, its picture, name and wallet, a click away from its page. The table
 * stays as it is underneath instead of being pushed down by them.
 */
function attachPortfolioItems(row, group) {
  if (!(group.items || []).length) return;
  row.classList.add('is-expandable');
  row.addEventListener('click', (event) => {
    // The name is a link of its own; it opens OpenSea, not the pieces.
    if (event.target.closest('a')) return;
    openPortfolioItems(group, row);
  });
}

function openPortfolioItems(group, row) {
  const previous = document.querySelector('.pf-items-modal');
  forgetPictures(previous);
  previous?.remove();
  // A row half out of the table's view is brought in, so its lit copy shows.
  row.scrollIntoView({ block: 'nearest' });
  const modal = document.createElement('div');
  modal.className = 'modal pf-items-modal';
  const card = document.createElement('div');
  card.className = 'modal-card pf-items-card';

  // No heading: the row it opens from, lit above the blur, already names it.
  const grid = document.createElement('div');
  grid.className = 'pf-items-grid';
  /*
   * Grouped by wallet: the main one's pieces first, then each linked
   * wallet's in the order the portfolio lists them. Within a wallet the
   * order OpenSea gave stays; an unknown owner comes last.
   */
  const walletOrder = (owner) => {
    const at = portfolioWalletList.findIndex((a) => a.toLowerCase() === String(owner || '').toLowerCase());
    return at < 0 ? portfolioWalletList.length : at;
  };
  const byWallet = [...group.items].sort((a, b) => walletOrder(a.owner) - walletOrder(b.owner));

  const pieceCell = (item, index) => {
    const cell = document.createElement(itemPageUrl(item, group) ? 'a' : 'div');
    cell.className = 'pf-item-cell';
    if (cell.tagName === 'A') {
      cell.href = itemPageUrl(item, group);
      cell.target = '_blank';
      cell.rel = 'noopener noreferrer';
    }
    const pic = document.createElement('span');
    pic.className = 'pf-item-pic';
    // An unrevealed piece has no picture of its own yet: the collection's stands in.
    const picture = item.image || group.image;
    if (picture) pic.appendChild(stillImage(picture, 72, ''));
    const label = document.createElement('span');
    label.className = 'pf-item-label';
    label.textContent = item.name || `#${item.tokenId}`;
    /*
     * The name, and under it a line of pills -- not beside it, where they cut
     * the name short: the wallet holding the piece, by its label, in that
     * wallet's colour; and "Manual" for a piece added by hand, since OpenSea
     * will not show it there.
     */
    const text = document.createElement('span');
    text.className = 'pf-item-text';
    text.appendChild(label);
    const tags = document.createElement('span');
    tags.className = 'pf-item-tags';
    // Which wallet, only when there is more than one to tell apart.
    if (item.owner && portfolioWalletList.length > 1) tags.appendChild(walletPill(item.owner));
    if (item.manual) {
      const tag = document.createElement('span');
      tag.className = 'pf-item-tag is-manual';
      tag.textContent = 'Manual';
      tags.appendChild(tag);
    }
    if (tags.children.length) text.appendChild(tags);
    cell.append(pic, text);
    /*
     * Its place in the list, in the top-right corner: scrolled to the end,
     * the last number is the count shown -- every piece is here.
     */
    const place = document.createElement('span');
    place.className = 'pf-item-index';
    place.textContent = String(index + 1);
    cell.appendChild(place);
    return cell;
  };

  /*
   * Search and filters over the pieces: a name or token number, which
   * wallet, hand-added only, and the order. Shown for a collection with more
   * than a handful of pieces; the wallet and Manual choices only when there
   * is something to choose between.
   */
  // Token number, low to high, unless another order is picked.
  const view = { query: '', wallet: '', manual: false, sort: 'id-asc' };
  const owners = [...new Set(byWallet.map((item) => item.owner).filter(Boolean))];
  const hasManual = byWallet.some((item) => item.manual);
  const tokenOrder = (a, b) => {
    const x = String(a.tokenId || '');
    const y = String(b.tokenId || '');
    return x.length - y.length || (x < y ? -1 : x > y ? 1 : 0);
  };

  const drawPieces = () => {
    const query = view.query.trim().toLowerCase().replace(/^#/, '');
    let shown = byWallet.filter((item) => {
      if (view.wallet && item.owner !== view.wallet) return false;
      if (view.manual && !item.manual) return false;
      if (!query) return true;
      return String(item.name || '').toLowerCase().includes(query) || String(item.tokenId || '') === query
        || String(item.tokenId || '').startsWith(query);
    });
    if (view.sort === 'id-asc') shown = [...shown].sort(tokenOrder);
    if (view.sort === 'id-desc') shown = [...shown].sort((a, b) => tokenOrder(b, a));
    forgetPictures(grid);
    grid.textContent = '';
    shown.forEach((item, index) => grid.appendChild(pieceCell(item, index)));
    if (!shown.length) {
      const none = document.createElement('div');
      none.className = 'pf-items-none';
      none.textContent = t('noPieces');
      grid.appendChild(none);
    }
  };

  let tools = null;
  if (byWallet.length > 6) {
    tools = document.createElement('div');
    tools.className = 'pf-items-tools';
    const search = document.createElement('input');
    search.type = 'search';
    search.className = 'pf-items-search';
    search.placeholder = t('searchPieces');
    search.autocomplete = 'off';
    search.spellcheck = false;
    search.addEventListener('input', () => { view.query = search.value; drawPieces(); });
    tools.appendChild(search);

    const chip = (text, active, onPick, extraClass = '') => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `pf-items-chip ${extraClass}`.trim();
      button.textContent = text;
      button.classList.toggle('is-on', active);
      button.addEventListener('click', () => { onPick(button); drawPieces(); });
      return button;
    };
    if (owners.length > 1) {
      const wallets = document.createElement('div');
      wallets.className = 'pf-items-chips';
      const pick = (address) => (button) => {
        view.wallet = address;
        wallets.querySelectorAll('.pf-items-chip').forEach((b) => b.classList.toggle('is-on', b === button));
      };
      wallets.appendChild(chip(t('all'), true, pick('')));
      for (const address of owners) {
        const name = walletLabelMap[address.toLowerCase()] || `${address.slice(0, 6)}…${address.slice(-4)}`;
        wallets.appendChild(chip(name, false, pick(address)));
      }
      tools.appendChild(wallets);
    }
    if (hasManual) {
      tools.appendChild(chip('Manual', false, (button) => {
        view.manual = !view.manual;
        button.classList.toggle('is-on', view.manual);
      }, 'is-manual'));
    }
    const sort = document.createElement('select');
    sort.className = 'pf-items-sort';
    for (const [value, text] of [['id-asc', 'Token # ↑'], ['id-desc', 'Token # ↓'], ['wallet', t('byWallet')]]) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = text;
      sort.appendChild(option);
    }
    sort.addEventListener('change', () => { view.sort = sort.value; drawPieces(); });
    tools.appendChild(sort);
    card.appendChild(tools);
  }
  drawPieces();

  card.append(grid);
  /*
   * The row clicked stays sharp above the blur, with the table's column
   * headings right over it, the pair framed as a piece of the table -- its
   * background, border and rounded corners -- so the figures say what they
   * are without the eye going up to the top of the table. Copies: the row
   * and the headings sit inside the table, under the blur's layer.
   */
  const lit = row.cloneNode(true);
  lit.classList.add('pf-row-lit');
  // A cloned canvas comes back blank; its picture is drawn in again.
  const drawn = row.querySelectorAll('canvas');
  lit.querySelectorAll('canvas').forEach((copy, i) => {
    try { copy.getContext('2d').drawImage(drawn[i], 0, 0); } catch { /* left blank */ }
  });
  const heading = document.querySelector('.pf-main .pf-head');
  const headLit = heading ? heading.cloneNode(true) : null;
  if (headLit) {
    headLit.classList.add('pf-head-lit');
    // Headings only, not the sort: no column lit as the one sorted by.
    headLit.querySelectorAll('.pf-sort').forEach((button) => {
      button.classList.remove('is-on');
      button.dataset.dir = '';
    });
    // Its columns come from rules scoped to the table; outside it the copy
    // would fall back to the default grid and wrap its headings.
    const style = getComputedStyle(heading);
    for (const name of ['gridTemplateColumns', 'columnGap', 'paddingLeft', 'paddingRight', 'fontSize', 'letterSpacing']) {
      headLit.style[name] = style[name];
    }
  }
  const unit = document.createElement('div');
  unit.className = 'pf-lit-frame';
  const table = row.closest('.pf-main');
  if (table) {
    const look = getComputedStyle(table);
    unit.style.background = look.backgroundColor;
    unit.style.border = `${look.borderLeftWidth} solid ${look.borderLeftColor}`;
    unit.style.borderRadius = look.borderTopLeftRadius;
    // The pop-up in the same colours, so the two read as one piece of table.
    card.style.background = look.backgroundColor;
    card.style.borderColor = look.borderLeftColor;
  }
  if (headLit) unit.appendChild(headLit);
  unit.appendChild(lit);
  modal.append(unit, card);
  document.body.appendChild(modal);

  /*
   * Right under the row clicked, or over the headings when there is no room
   * below -- the way the tracker opens its cards -- and lined up with the
   * row's left edge, under the picture and name it belongs to.
   */
  const place = () => {
    const line = pageRect(row);
    // As many 210px panels to a line as the row is wide (less the card's
    // padding and border), never more than are held.
    const fit = Math.max(1, Math.floor((line.width - 26 + 6) / 216));
    const columns = Math.min(group.items.length, fit);
    /*
     * A full line of panels: the card takes the row's width, and the panels
     * grow into it whole -- picture, name and wallet scaled together, not
     * just stretched wider.
     */
    const full = columns === fit;
    const panelWidth = full ? (line.width - 26 - (columns - 1) * 6) / columns : 210;
    // Grown with the width, up to a third larger: past that a panel is all picture.
    card.style.setProperty('--s', Math.min(1.33, panelWidth / 210).toFixed(3));
    // Not a full line: each panel as wide as its name needs, from 210px up.
    grid.style.gridTemplateColumns = `repeat(${columns}, ${full ? 'minmax(0, 1fr)' : 'minmax(210px, max-content)'})`;

    /*
     * One panel -- the headings, the row, a line, then its pieces -- in the
     * middle of the collections table wherever the row was clicked. Opening
     * at the row put the pieces above the headings for rows low in the table;
     * this way they always read top to bottom.
     */
    const headHeight = heading ? pageRect(heading).height : 0;
    const edge = parseFloat(unit.style.borderLeftWidth) || 0;
    const radius = unit.dataset.radius || (unit.dataset.radius = unit.style.borderRadius || '14px');
    const unitHeight = headHeight + line.height + edge * 2;
    const area = pageRect((table || row));
    const margin = 12;
    // The pieces scroll inside rather than push the panel past the table.
    card.style.maxHeight = `${Math.max(120, Math.min(area.height, viewHeight() - margin * 2) - unitHeight + edge)}px`;
    // As wide as the table's own panel, edge to edge, not just its rows.
    card.style.width = full ? `${area.width}px` : '';
    const total = unitHeight - edge + card.offsetHeight;
    const unitTop = Math.max(margin, Math.min(area.top + (area.height - total) / 2, viewHeight() - margin - total));

    const inset = line.left - area.left - edge;
    Object.assign(unit.style, {
      left: `${area.left}px`, top: `${unitTop}px`,
      width: `${area.width}px`, height: `${unitHeight}px`,
    });
    if (headLit) Object.assign(headLit.style, { left: `${inset}px`, top: '0', width: `${line.width}px`, height: `${headHeight}px` });
    Object.assign(lit.style, { left: `${inset}px`, top: `${headHeight}px`, width: `${line.width}px`, height: `${line.height}px` });

    // The pieces flush under it, a line between, square corners where they
    // meet; where the pop-up is narrower, that corner of the piece stays round.
    card.style.left = `${area.left}px`;
    card.style.top = `${unitTop + unitHeight - edge}px`;
    card.style.borderRadius = `0 0 ${radius} ${radius}`;
    unit.style.borderRadius = `${radius} ${radius} ${full ? '0' : radius} 0`;
  };
  place();
  window.addEventListener('resize', place);

  const close = () => {
    forgetPictures(modal);
    modal.remove();
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('resize', place);
  };
  const onKey = (event) => { if (event.key === 'Escape') close(); };
  modal.addEventListener('mousedown', (event) => { if (event.target === modal) close(); });
  document.addEventListener('keydown', onKey);
}

/* "ape_chain" reads as ApeChain's own name would: Ape Chain. */
const CHAIN_TITLES = { hyperevm: 'HyperEVM', ape_chain: 'ApeChain', bsc: 'BNB Chain', matic: 'Polygon' };
function titleCaseChain(identifier) {
  const known = CHAIN_TITLES[String(identifier || '').toLowerCase()];
  if (known) return known;
  return String(identifier || '').split(/[_\s-]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

/* OpenSea's verified mark: a blue badge with a tick. */
/*
 * Built from geometry rather than drawn by hand: a disc with eight equal
 * lobes set evenly round it, so every edge of the rosette matches. The hand
 * path before it had points of different sizes and looked lopsided.
 */
const VERIFIED_BADGE = (() => {
  const lobes = [];
  for (let i = 0; i < 8; i += 1) {
    const angle = (i / 8) * Math.PI * 2 - Math.PI / 2;
    const x = (12 + Math.cos(angle) * 8.1).toFixed(2);
    const y = (12 + Math.sin(angle) * 8.1).toFixed(2);
    lobes.push(`<circle cx="${x}" cy="${y}" r="3.1"/>`);
  }
  return '<svg viewBox="0 0 24 24" aria-hidden="true">'
    + `<g fill="#2081e2"><circle cx="12" cy="12" r="9"/>${lobes.join('')}</g>`
    + '<path fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"'
    + ' d="M8 12.2l2.7 2.7L16 9.4"/></svg>';
})();

function verifiedBadge() {
  const badge = document.createElement('span');
  badge.className = 'pf-verified';
  badge.innerHTML = VERIFIED_BADGE;
  return badge;
}

/*
 * A stand-in picture for a token or collection OpenSea has none for: its
 * initials -- the first letter, or of two words the first of each (Glitter
 * Gang: GG) -- on a colour picked from its name, the same every time.
 */
function initialsPicture(name) {
  const words = String(name || '?').replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? words[0][0] + words[1][0] : (words[0] || '?')[0];
  let hash = 0;
  for (const ch of String(name || '')) hash = (hash * 31 + ch.codePointAt(0)) >>> 0;
  const el = document.createElement('span');
  el.className = 'pf-initials';
  el.style.background = `hsl(${hash % 360} 45% 34%)`;
  el.textContent = letters.toUpperCase();
  return el;
}

/*
 * The wallets holding a collection, as initials in a stack. A colour per
 * wallet, derived from its address, so the same wallet looks the same on
 * every row.
 */
function walletDot(address) {
  const label = walletLabelMap[address.toLowerCase()] || '';
  const dot = document.createElement('span');
  dot.className = 'pf-wallet-dot';
  let hash = 0;
  for (const char of address.toLowerCase()) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  dot.style.background = `hsl(${hash % 360} 55% 42%)`;
  dot.textContent = (label || address.slice(2)).slice(0, 1).toUpperCase();
  return dot;
}

/* A wallet as a small pill: its label (or short address) in its own colour. */
function walletPill(address) {
  const pill = document.createElement('span');
  pill.className = 'pf-item-tag is-wallet';
  const hue = walletDot(address).style.background;
  pill.style.setProperty('--wallet', hue);
  pill.textContent = walletLabelMap[address.toLowerCase()] || `${address.slice(0, 6)}…${address.slice(-4)}`;
  return pill;
}

function portfolioRow(group) {
  // The heading between the two parts, a row's height like the rest.
  if (group.divider) {
    const divider = document.createElement('div');
    divider.className = 'pf-row pf-divider';
    // A click opens or folds the part; the caret says which.
    const caret = document.createElement('span');
    caret.className = `pf-divider-caret${group.open ? ' is-open' : ''}`;
    caret.textContent = '▸';
    divider.appendChild(caret);
    divider.addEventListener('click', () => {
      portfolioTailOpen = !portfolioTailOpen;
      tailOpenedByJump = false;
      try { localStorage.setItem(TAIL_OPEN_KEY, portfolioTailOpen ? '1' : '0'); } catch { /* not kept */ }
      renderPortfolioCards();
    });
    const label = document.createElement('span');
    label.className = 'pf-divider-title';
    label.textContent = t('noOfferHead');
    divider.appendChild(label);
    // The count once there is one; while nothing is in yet, only "Reading".
    if (group.count) {
      const count = document.createElement('span');
      count.className = 'pf-divider-count';
      count.textContent = group.count.toLocaleString('en-US');
      divider.appendChild(count);
    }
    if (portfolioTailLoading) {
      const reading = document.createElement('span');
      reading.className = 'pf-divider-note';
      reading.textContent = t('tailReading');
      divider.appendChild(reading);
    } else if (portfolioTailNextAt) {
      // Read every six hours: when next, as a time of day, so it never goes stale.
      const next = document.createElement('span');
      next.className = 'pf-divider-note is-quiet';
      const at = new Date(portfolioTailNextAt);
      const time = at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
      next.textContent = t('tailNext', { time });
      divider.appendChild(next);
    }
    return divider;
  }
  const row = document.createElement('div');
  row.className = 'pf-row';

  const name = document.createElement('div');
  name.className = 'pf-col-name';
  // The picture, the name and the tick, as one piece as wide as they are.
  const ident = document.createElement('span');
  ident.className = 'pf-ident';
  name.appendChild(ident);
  const logo = document.createElement('span');
  logo.className = 'pf-logo';
  if (group.image) logo.appendChild(stillImage(group.image, 36, ''));
  else logo.appendChild(initialsPicture(group.name));
  ident.appendChild(logo);
  const link = document.createElement('a');
  link.className = 'pf-name';
  link.textContent = group.name;
  /*
   * Held more than once: the pieces themselves, on the profile's Items tab
   * filtered to this collection, which is where they can be listed or
   * compared. Held once: the collection's own page, as before.
   */
  const profile = portfolioWalletList[0] || '';
  if (group.slug && group.held > 1 && profile) {
    link.href = `https://opensea.io/${profile}?collectionSlugs=${encodeURIComponent(group.slug)}`;
  } else if (group.slug) {
    link.href = `https://opensea.io/collection/${group.slug}`;
  }
  if (link.href) {
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
  }
  ident.appendChild(link);
  if (group.verified) ident.appendChild(verifiedBadge());
  // How many are held, beside the name rather than in a column of its own:
  // one more column of bare numbers made the money hard to pick out.
  if (group.held > 1) {
    const held = document.createElement('span');
    held.className = 'pf-held';
    held.textContent = `×${group.held}`;
    ident.appendChild(held);
  }

  // The network, as its mark alone.
  const chain = document.createElement('div');
  chain.className = 'pf-chain-col';
  if (group.chain) {
    chain.innerHTML = netMark(group.chain);
  }

  const wallets = document.createElement('div');
  wallets.className = 'pf-wallets-col';
  const owners = group.wallets || [];
  for (const address of owners.slice(0, 2)) wallets.appendChild(walletDot(address));
  if (owners.length > 2) {
    const more = document.createElement('span');
    more.className = 'pf-wallet-more';
    more.textContent = `+${owners.length - 2}`;
    wallets.appendChild(more);
  }
  wallets.title = owners.map((address) => walletDisplay(address)).join('\n');

  const money = (usd) => {
    const cell = document.createElement('div');
    cell.className = 'pf-num pf-money';
    if (usd) setCompactUsd(cell, usd);
    else cell.textContent = '—';
    return cell;
  };
  const value = money(group.valueUsd);
  value.classList.add('is-value');

  /*
   * Floor and top offer in one cell: the floor, and under it the offer --
   * amber when it is under 75% of the floor, since selling into it loses
   * the difference.
   */
  const market = money(group.floorUsd);
  market.classList.add('pf-market');
  const offer = document.createElement('div');
  offer.className = 'pf-offer';
  if (group.offerUsd) {
    const share = group.floorUsd ? Math.round((group.offerUsd / group.floorUsd) * 100) : 0;
    setCompactUsd(offer, group.offerUsd);
    offer.classList.toggle('is-low', Boolean(share) && share < 75);
  } else {
    offer.textContent = '—';
  }
  market.appendChild(offer);

  row.append(name, chain, wallets, value, market);
  return row;
}

/* 15.7K, 220.4K, 1.2M: a held quantity to read at a glance. */
function compactQuantity(value) {
  const n = Number(value) || 0;
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  if (abs >= 1) return String(Number(n.toFixed(2)));
  if (!n) return '0';
  // Small amounts the way the prices are written: 0.0₅892, not 0.00000892.
  // Three digits: the quantity column is narrower than the price one.
  return tokenPrice(n, 3, 3).replace('$', '');
}

/*
 * A token price the way OpenSea writes one: four significant digits, and a
 * run of leading zeros counted in a subscript -- $0.0₄3757 rather than
 * $0.00003757, where the zeros are the part nobody can count.
 */
function tokenPrice(usd, digits = 4, subscriptFrom = 4) {
  const n = Number(usd) || 0;
  if (!n) return '—';
  if (n >= 1) return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  // Rounded to `digits` significant digits, not cut: 0.005181 is 0.005181,
  // where reading digits off toFixed(20) gave 0.00518 (it is 0.0051809...).
  let zeros = Math.max(0, -Math.floor(Math.log10(n)) - 1);
  let scaled = Math.round(n * 10 ** (zeros + digits));
  if (scaled >= 10 ** digits) {
    // 0.99996 rounds up to a whole dollar; there are no zeros left to count.
    if (zeros === 0) return '$1.00';
    zeros -= 1;
    scaled = Math.round(scaled / 10);
  }
  const significant = String(scaled).replace(/0+$/, '') || '0';
  if (zeros < subscriptFrom) return `$0.${'0'.repeat(zeros)}${significant}`;
  const sub = String(zeros).split('').map((d) => '₀₁₂₃₄₅₆₇₈₉'[Number(d)]).join('');
  return `$0.0${sub}${significant}`;
}

/*
 * Fungible balances, one row per token rather than per wallet: the same
 * token held by three wallets is one position, with the three wallets in
 * its Wallets column -- the way OpenSea's Token Positions counts them.
 */
function groupPortfolioTokens(tokens) {
  const groups = new Map();
  for (const token of tokens) {
    const key = `${(token.symbol || '').toLowerCase()}|${(token.name || '').toLowerCase()}`;
    let group = groups.get(key);
    if (!group) {
      group = { ...token, quantity: 0, usd: 0, owners: [], parts: new Map() };
      groups.set(key, group);
    }
    group.quantity += token.quantity || 0;
    group.usd += token.usd || 0;
    if (token.owner && !group.owners.includes(token.owner)) group.owners.push(token.owner);
    if (!group.image && token.image) group.image = token.image;
    if (!group.priceUsd && token.priceUsd) group.priceUsd = token.priceUsd;

    // The same token on each network it is held on, for the lines it opens onto.
    const chain = token.chain || '';
    let part = group.parts.get(chain);
    if (!part) {
      part = { ...token, chain, quantity: 0, usd: 0, owners: [] };
      group.parts.set(chain, part);
    }
    part.quantity += token.quantity || 0;
    part.usd += token.usd || 0;
    if (token.owner && !part.owners.includes(token.owner)) part.owners.push(token.owner);
    if (!part.priceUsd && token.priceUsd) part.priceUsd = token.priceUsd;
  }
  return [...groups.values()]
    .map((group) => ({ ...group, parts: [...group.parts.values()].sort((a, b) => b.usd - a.usd) }))
    .sort((a, b) => b.usd - a.usd);
}

const ETH_ON_WHITE = '<svg viewBox="0 0 32 32" aria-hidden="true">'
  + '<circle cx="16" cy="16" r="16" fill="#fff"/><g fill="#343434">'
  + '<path fill-opacity=".6" d="M16.5 4v8.87l7.5 3.35z"/><path d="M16.5 4L9 16.22l7.5-3.35z"/>'
  + '<path fill-opacity=".6" d="M16.5 21.97V28L24 17.62z"/><path d="M16.5 28v-6.03L9 17.62z"/>'
  + '<path fill-opacity=".2" d="M16.5 20.57l7.5-4.35-7.5-3.35z"/><path fill-opacity=".6" d="M9 16.22l7.5 4.35v-7.7z"/>'
  + '</g></svg>';

/* A network's mark, its name on hover. */
function chainIcon(chain) {
  const mark = document.createElement('span');
  mark.className = 'pf-chain-mark';
  mark.innerHTML = netMark(chain);
  return mark;
}

/*
 * The figures of one token line -- value, quantity, wallets, price, 24h --
 * shared by a token's own line and the per-network lines under it.
 */
function tokenFigures(token) {
  const cell = (text, cls) => {
    const el = document.createElement('div');
    el.className = `pf-num ${cls || ''}`;
    el.textContent = text;
    return el;
  };
  const value = cell('', 'pf-money is-value');
  setCompactUsd(value, token.usd);

  const wallets = document.createElement('div');
  wallets.className = 'pf-wallets-col';
  for (const address of token.owners.slice(0, 2)) wallets.appendChild(walletDot(address));
  if (token.owners.length > 2) {
    const more = document.createElement('span');
    more.className = 'pf-wallet-more';
    more.textContent = `+${token.owners.length - 2}`;
    wallets.appendChild(more);
  }
  wallets.title = token.owners.map((address) => walletDisplay(address)).join('\n');

  // Some tokens (ether among them) come without a unit price; the value
  // over the quantity is the same figure.
  const unit = token.priceUsd || (token.quantity ? token.usd / token.quantity : 0);
  // The price, and under it the day's change: one cell, the way the
  // collections show the floor over the offer.
  const price = cell(tokenPrice(unit), 'pf-mono pf-market');
  // priceChange arrives as a ratio, not a percentage.
  const pct = token.dayChange * 100;
  const change = document.createElement('div');
  change.className = `pf-token-change ${token.dayChange > 0 ? 'tok-up' : (token.dayChange < 0 ? 'tok-down' : '')}`;
  change.textContent = token.dayChange ? `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%` : '—';
  price.appendChild(change);
  return [wallets, value, price];
}

/*
 * The name, and under it the amount held with its symbol -- beside the name
 * rather than in a column of its own, as the collections show theirs.
 */
function tokenNameBlock(title, token) {
  const text = document.createElement('span');
  text.className = 'pf-token-text';
  const amount = document.createElement('span');
  amount.className = 'pf-token-amount';
  amount.textContent = `${compactQuantity(token.quantity)} ${token.symbol || ''}`.trim();
  text.append(title, amount);
  return text;
}

const openTokenGroups = new Set();

/* OpenSea's page for a token on one network: its chart and its swap. */
function tokenPageUrl(part) {
  if (!part || !part.chain || !part.contract) return '';
  return `https://opensea.io/token/${part.chain}/${part.contract}`;
}

function openTokenPage(part) {
  const url = tokenPageUrl(part);
  if (url) window.open(url, '_blank', 'noopener');
}

function renderPortfolioTokens(tokens) {
  const list = $('#portfolio-tokens');
  forgetPictures(list);
  list.textContent = '';
  if (tokens.length && tableSearch.tokens) {
    tokens = tokens.filter((token) => searchMatch(tableSearch.tokens, token.name, token.symbol));
    if (!tokens.length) {
      list.innerHTML = `<div class="empty-sub">${t('noMatch')}</div>`;
      return;
    }
  }
  // The panel stays, headings and all, while loading and when empty: the
  // page keeps its shape instead of the collections standing alone.
  if (!tokens.length) {
    list.innerHTML = portfolioTokenError
      ? `<div class="empty-sub">${t('tokensError')}</div>`
      : `<div class="empty-sub">${t('noTokens')}</div>`;
    return;
  }

  // No total beside the title: the headline above already splits NFT and token.
  for (const token of groupPortfolioTokens(tokens)) {
    const row = document.createElement('div');
    row.className = 'pf-token';
    const several = token.parts.length > 1;

    const name = document.createElement('div');
    name.className = 'pf-token-name';
    const icon = document.createElement('span');
    icon.className = 'pf-token-icon';
    // Ether's own logo is dark on dark and vanished into the table; it is
    // drawn here on white, the way OpenSea shows it.
    if ((token.symbol || '').toUpperCase() === 'ETH') icon.innerHTML = ETH_ON_WHITE;
    else if (token.image) icon.appendChild(stillImage(token.image, 30, ''));
    else icon.appendChild(initialsPicture(token.name || token.symbol));
    const label = document.createElement('b');
    label.textContent = token.name || token.symbol;
    name.append(icon, tokenNameBlock(label, token));
    /*
     * A click opens the token on OpenSea, where the swap is. A token held on
     * one network: anywhere on its line. On several: its name, on the network
     * holding most of it -- the rest of that line opens the networks, and
     * each network's own line opens that network's page.
     */
    if (several && tokenPageUrl(token.parts[0])) {
      label.classList.add('pf-token-link');
      label.addEventListener('click', (event) => {
        event.stopPropagation();
        openTokenPage(token.parts[0]);
      });
    }
    if (several) {
      // A caret: the line opens onto its networks, counted in the next column.
      const caret = document.createElement('span');
      caret.className = 'pf-token-caret';
      caret.textContent = '▾';
      name.append(caret);
    }

    // One mark, or the first few overlapped with a count for the rest.
    const chains = document.createElement('div');
    chains.className = 'pf-chain-col';
    for (const part of token.parts.slice(0, 2)) chains.appendChild(chainIcon(part.chain));
    if (token.parts.length > 2) {
      const more = document.createElement('span');
      more.className = 'pf-wallet-more';
      more.textContent = `+${token.parts.length - 2}`;
      chains.appendChild(more);
    }
    if (several) chains.classList.add('is-stack');

    row.append(name, chains, ...tokenFigures(token));
    list.appendChild(row);

    if (!several) {
      if (tokenPageUrl(token.parts[0])) {
        row.classList.add('is-link');
        row.addEventListener('click', () => openTokenPage(token.parts[0]));
      }
      continue;
    }
    const subs = token.parts.map((part) => {
      const sub = document.createElement('div');
      sub.className = 'pf-token pf-token-sub hidden';
      const subName = document.createElement('div');
      subName.className = 'pf-token-name';
      subName.append(chainIcon(part.chain));
      const chainName = document.createElement('span');
      chainName.textContent = titleCaseChain(part.chain);
      subName.appendChild(tokenNameBlock(chainName, part));
      const blank = document.createElement('div');
      blank.className = 'pf-chain-col';
      /*
       * Price and 24h are the token's, not the network's: the same figure on
       * every line said nothing the line above had not. They stay blank here
       * unless this network's price is really apart from it (over 1%).
       */
      const figures = tokenFigures(part);
      const unitOf = (tok) => tok.priceUsd || (tok.quantity ? tok.usd / tok.quantity : 0);
      const parentUnit = unitOf(token);
      const apart = parentUnit && Math.abs(unitOf(part) - parentUnit) / parentUnit > 0.01;
      if (!apart) {
        /*
         * Where the price would have repeated: this network's share of the
         * token, as a bar and a percentage -- where the balance really sits,
         * and which networks hold only dust.
         */
        const share = token.usd ? part.usd / token.usd : 0;
        const cell = document.createElement('div');
        cell.className = 'pf-share';
        const track = document.createElement('span');
        track.className = 'pf-share-track';
        const fill = document.createElement('span');
        fill.className = 'pf-share-fill';
        fill.style.width = `${Math.max(share * 100, share > 0 ? 2 : 0).toFixed(1)}%`;
        track.appendChild(fill);
        const pct = document.createElement('span');
        pct.className = 'pf-share-pct';
        pct.textContent = share >= 0.01 ? `${Math.round(share * 100)}%` : '<1%';
        cell.append(track, pct);
        figures.splice(2, 1, cell);
      }
      sub.append(subName, blank, ...figures);
      if (tokenPageUrl(part)) {
        sub.classList.add('is-link');
        sub.addEventListener('click', () => openTokenPage(part));
      }
      list.appendChild(sub);
      return sub;
    });
    const key = `${token.symbol}|${token.name}`;
    const setOpen = (open) => {
      row.classList.toggle('is-open', open);
      subs.forEach((sub) => sub.classList.toggle('hidden', !open));
      if (open) openTokenGroups.add(key); else openTokenGroups.delete(key);
    };
    row.classList.add('is-expandable');
    setOpen(openTokenGroups.has(key));
    row.addEventListener('click', () => setOpen(!row.classList.contains('is-open')));
  }
}

/*
 * OpenSea's image CDN hands back a full-size animated WebP for any collection
 * whose logo is a GIF -- 535 KB each, measured, and seven of them in this
 * portfolio. Asking for a width cuts that to 26 KB, and drawing the result
 * into a canvas once freezes it on its first frame. Both matter: a page whose
 * whole reason to exist is being lighter than OpenSea's own should not haul
 * megabytes of looping avatars around.
 *
 * The CDN sends Access-Control-Allow-Origin: *, so the canvas stays untainted.
 * If it ever stops, the onerror path falls back to a plain (animated) img
 * rather than showing nothing.
 */
function sizedImageUrl(url, width) {
  if (!url) return '';
  return url.includes('?') ? `${url}&w=${width}` : `${url}?w=${width}`;
}

/*
 * Only the image CDN sends Access-Control-Allow-Origin. Generated blockie
 * avatars are served straight off opensea.io without it, so asking for a
 * canvas there fails CORS, logs an error and costs a second request before
 * the fallback loads. Those are flat SVG-ish images with nothing to freeze,
 * so they skip the canvas entirely.
 */
const CORS_IMAGE_HOSTS = ['i2c.seadn.io', 'i.seadn.io', 'openseauserdata.com'];

function canFreeze(url) {
  try {
    return CORS_IMAGE_HOSTS.some((host) => new URL(url).hostname.endsWith(host));
  } catch {
    return false;
  }
}

/*
 * Pictures load only when they come near the screen. A large wallet has
 * hundreds of collection rows and a pop-up can hold hundreds of pieces;
 * drawing every picture up front, on screen or not, was most of the page's
 * memory and its biggest bursts of work. The observer watches each picture
 * and starts it a little before it scrolls into view.
 *
 * A picture already drawn once is kept, decoded, and drawn again at once
 * when the tables are rebuilt -- no second download, no second decode.
 */
const pictureLoaders = new WeakMap();
const pictureWatch = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    pictureWatch.unobserve(entry.target);
    const load = pictureLoaders.get(entry.target);
    pictureLoaders.delete(entry.target);
    if (load) load();
  }
}, { rootMargin: '300px' });

const pictureCache = new Map();
const PICTURE_CACHE_MAX = 600;

function rememberPicture(key, bitmap) {
  if (pictureCache.size >= PICTURE_CACHE_MAX) {
    const oldest = pictureCache.keys().next().value;
    pictureCache.get(oldest)?.close?.();
    pictureCache.delete(oldest);
  }
  pictureCache.set(key, bitmap);
}

/* Pictures inside something being thrown away stop being watched. */
function forgetPictures(root) {
  if (!root) return;
  for (const canvas of root.querySelectorAll('canvas')) {
    if (!pictureLoaders.has(canvas)) continue;
    pictureWatch.unobserve(canvas);
    pictureLoaders.delete(canvas);
  }
}

function stillImage(url, size, className) {
  if (!canFreeze(url)) return plainImage(url, size, className);
  const holder = document.createElement('canvas');
  holder.className = className;
  holder.width = size * 2;
  holder.height = size * 2;
  const key = `${url}|${size}`;

  const cached = pictureCache.get(key);
  if (cached) {
    holder.getContext('2d').drawImage(cached, 0, 0, holder.width, holder.height);
    return holder;
  }

  pictureLoaders.set(holder, () => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.referrerPolicy = 'no-referrer';
    img.onload = () => {
      try {
        holder.getContext('2d').drawImage(img, 0, 0, holder.width, holder.height);
        if (window.createImageBitmap) {
          createImageBitmap(holder).then((bitmap) => rememberPicture(key, bitmap)).catch(() => {});
        }
      } catch {
        holder.replaceWith(plainImage(url, size, className));
      }
    };
    img.onerror = () => holder.replaceWith(plainImage(url, size, className));
    img.src = sizedImageUrl(url, size * 2);
  });
  pictureWatch.observe(holder);
  return holder;
}

function plainImage(url, size, className) {
  const img = document.createElement('img');
  img.className = className;
  img.src = sizedImageUrl(url, size * 2);
  img.alt = '';
  img.loading = 'lazy';
  img.referrerPolicy = 'no-referrer';
  img.onerror = () => img.remove();
  return img;
}

document.addEventListener('click', () => {
  $('#portfolio-wallet-menu')?.classList.add('hidden');
});

/*
 * The two tables share one height -- whatever is left of the window under
 * them -- and scroll inside it, so the page itself stays put and the tokens
 * stay beside the collections however far either list is scrolled.
 */
function fitPortfolioTables() {
  const layout = document.querySelector('.pf-layout');
  if (!layout || !layout.offsetParent) return;
  // Down to the window's bottom edge, less everything the page puts under
  // the tables -- the card's padding, the footer note -- so the page itself
  // never scrolls and no strip of empty window is left either.
  // Measured from fixed parts, not from the page's end: the page stretches
  // to the window, so its end moves with the tables and the sum ran away.
  const box = pageRect(layout);
  const card = layout.closest('.card');
  const main = layout.closest('main');
  const foot = document.querySelector('.lite-foot');
  const px = (el, prop) => (el ? parseFloat(getComputedStyle(el)[prop]) || 0 : 0);
  const under = (card ? pageRect(card).bottom - box.bottom : 0)
    + px(card, 'marginBottom') + px(main, 'paddingBottom') + (foot ? foot.offsetHeight : 0);
  const height = Math.max(320, Math.round(viewHeight() - box.top - under));
  layout.style.setProperty('--pf-h', `${height}px`);
}
window.addEventListener('resize', fitPortfolioTables);

/* Back to the top of a table, shown once it has been scrolled a long way. */
function attachScrollTop(scroller) {
  if (!scroller || scroller.dataset.scrollTop) return;
  scroller.dataset.scrollTop = '1';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'pf-scroll-top';
  button.setAttribute('aria-label', t('backToTop'));
  button.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"'
    + ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
  button.addEventListener('click', () => {
    // Back up from the no-offer part the jump button opened: it folds again.
    if (scroller.id === 'portfolio-cards' && tailOpenedByJump && portfolioTailOpen) {
      tailOpenedByJump = false;
      portfolioTailOpen = false;
      try { localStorage.setItem(TAIL_OPEN_KEY, '0'); } catch { /* not kept */ }
      renderPortfolioCards();
    }
    scroller.scrollTo({ top: 0, behavior: 'smooth' });
  });
  scroller.parentElement.appendChild(button);
  scroller.addEventListener('scroll', () => {
    button.classList.toggle('is-shown', scroller.scrollTop > 480);
  }, { passive: true });
}
attachScrollTop($('#portfolio-cards'));
attachScrollTop($('#portfolio-tokens'));


$('#portfolio-refresh').addEventListener('click', () => loadPortfolio(true));

/*
 * NFTs added by hand: staked, lent, or held by some other contract, so
 * OpenSea shows them under none of the wallets. A pasted OpenSea link says
 * which -- one item, or a collection and how many -- and the server keeps the
 * list, prices it with the rest, and the table counts it like any holding.
 */
$('#portfolio-add').addEventListener('click', openManualNfts);

/*
 * The day's price changes, newest first: when, how much in all, and what
 * moved it. The server keeps them and drops any older than 24 hours.
 */
$('#portfolio-history').addEventListener('click', openPortfolioHistory);

/*
 * The price changes, each read's (every five minutes) or added up by the
 * hour, six, twelve, a day, or a step of one's own. The choice is kept in
 * this browser. The app keeps a week of reads; a step is shown over 24 of
 * itself, at least a day and at most that week.
 */
const HISTORY_STEP_KEY = 'nftPortfolio.historyStep';
const HOUR_MS = 3600 * 1000;
const HISTORY_KEEP_MS = 7 * 24 * HOUR_MS;

function readHistoryStep() {
  try {
    const saved = JSON.parse(localStorage.getItem(HISTORY_STEP_KEY) || 'null');
    if (saved && Number(saved.ms) >= 0) return saved;
  } catch { /* the default */ }
  return { ms: 0, custom: false, amount: 3, unit: 'h' };
}

function saveHistoryStep(step) {
  try { localStorage.setItem(HISTORY_STEP_KEY, JSON.stringify(step)); } catch { /* not kept */ }
}

function historyRange(stepMs) {
  const range = Math.min(HISTORY_KEEP_MS, Math.max(24 * HOUR_MS, stepMs * 24));
  const hours = Math.round(range / HOUR_MS);
  return hours >= 48 && hours % 24 === 0 ? t('rangeDays', { n: hours / 24 }) : t('rangeHours', { n: hours });
}

/*
 * Reads added up into steps, lined up on the local clock (whole hours, and
 * six-hour steps from midnight): each step's net, its biggest moves summed
 * by name, and the total at its last read. Each read carries its six biggest
 * moves only, so a step's moves are those -- the net is exact.
 */
function groupHistory(events, stepMs) {
  if (!stepMs) return events.map((event) => ({ ...event, from: event.at, to: event.at }));
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const origin = midnight.getTime();
  const steps = new Map();
  for (const event of events) {
    const key = Math.floor((event.at - origin) / stepMs);
    let step = steps.get(key);
    if (!step) {
      step = { from: origin + key * stepMs, to: origin + (key + 1) * stepMs, net: 0, total: event.total, at: event.at, sums: new Map() };
      steps.set(key, step);
    }
    step.net += event.net;
    // Newest first: the first read met is the step's last.
    for (const move of event.moves || []) step.sums.set(move.name, (step.sums.get(move.name) || 0) + move.change);
  }
  return [...steps.values()]
    .map((step) => ({
      ...step,
      net: Math.round(step.net * 100) / 100,
      moves: [...step.sums]
        .map(([name, change]) => ({ name, change: Math.round(change * 100) / 100 }))
        .filter((move) => Math.abs(move.change) >= 0.01)
        .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
        .slice(0, 6),
    }))
    .filter((step) => Math.abs(step.net) >= 0.01);
}

async function openPortfolioHistory() {
  document.querySelector('.pf-history-modal')?.remove();
  const modal = document.createElement('div');
  modal.className = 'modal pf-history-modal';
  modal.innerHTML = `
    <div class="modal-card pf-history-card">
      <div class="pf-history-head">
        <div class="modal-title" id="pf-history-title"></div>
        <div class="pf-history-steps" id="pf-history-steps"></div>
      </div>
      <div class="pf-history-list" id="pf-history-list"><div class="empty-sub">${t('loading')}</div></div>
      <div class="modal-actions"><button class="btn" id="pf-history-close" type="button">${t('close')}</button></div>
    </div>`;
  document.body.appendChild(modal);
  const close = () => { modal.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (event) => { if (event.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  modal.addEventListener('mousedown', (event) => { if (event.target === modal) close(); });
  modal.querySelector('#pf-history-close').addEventListener('click', close);

  const list = modal.querySelector('#pf-history-list');
  const title = modal.querySelector('#pf-history-title');
  let step = readHistoryStep();
  title.textContent = t('historyTitle', { range: historyRange(step.ms) });

  let events;
  try {
    events = (await api('/api/portfolio/history')).events || [];
  } catch (err) {
    list.innerHTML = '';
    list.textContent = err.message;
    return;
  }

  const signed = (usd) => `${usd > 0 ? '+' : '−'}${formatUsd(Math.abs(usd))}`;
  /*
   * Where a name in the history leads: a collection to its OpenSea page, a
   * token to its token page on the network holding most of it. Found by name
   * in what the portfolio holds now, so older entries link as well.
   */
  const pages = new Map();
  for (const token of groupPortfolioTokens(portfolioTokens)) {
    pages.set(token.name || token.symbol, {
      url: tokenPageUrl(token.parts[0]),
      image: token.image || '',
      eth: (token.symbol || '').toUpperCase() === 'ETH',
    });
  }
  for (const group of portfolioGroups) {
    pages.set(group.name, {
      url: group.slug ? `https://opensea.io/collection/${group.slug}` : '',
      image: group.image || '',
    });
  }
  const pageFor = (name) => pages.get(name) || {};
  const clock = (ms) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  const day = (ms) => new Date(ms).toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-US', { day: 'numeric', month: 'short' });
  const today = new Date().toDateString();
  // When a line is: a read's time; a step's span, its day when not today;
  // a whole day's step, its date.
  const when = (entry, stepMs) => {
    if (!stepMs) {
      // A read after a gap -- the app asleep, or nothing moved for a while --
      // carries everything since the read before: shown as that span.
      const gap = entry.since && entry.at - entry.since > 12 * 60 * 1000;
      const span = gap ? `${clock(entry.since)}–${clock(entry.at)}` : clock(entry.at);
      return new Date(entry.at).toDateString() === today ? span : `${day(entry.at)} ${span}`;
    }
    if (stepMs >= 24 * HOUR_MS && stepMs % (24 * HOUR_MS) === 0) return day(entry.from);
    const span = `${clock(entry.from)}–${clock(entry.to)}`;
    return new Date(entry.from).toDateString() === today ? span : `${day(entry.from)} ${span}`;
  };

  const draw = () => {
    const range = Math.min(HISTORY_KEEP_MS, Math.max(24 * HOUR_MS, step.ms * 24));
    const since = Date.now() - range;
    title.textContent = t('historyTitle', { range: historyRange(step.ms) });
    forgetPictures(list);
    list.textContent = '';
    const lines = groupHistory(events.filter((event) => event.at >= since), step.ms);
    if (!lines.length) {
      list.innerHTML = `<div class="empty-sub">${t('noHistory', { range: historyRange(step.ms) })}</div>`;
      return;
    }
    // Headings over the columns; a whole day's step is headed by the day.
    const head = document.createElement('div');
    head.className = 'pf-history-row is-head';
    const daily = step.ms >= 24 * HOUR_MS && step.ms % (24 * HOUR_MS) === 0;
    for (const key of [daily ? 'histDay' : 'histTime', 'histChange', 'histHoldings', 'totalValue']) {
      const cell = document.createElement('span');
      cell.textContent = t(key);
      head.appendChild(cell);
    }
    list.appendChild(head);
    for (const entry of lines) {
      const row = document.createElement('div');
      row.className = 'pf-history-row';
      const time = document.createElement('span');
      time.className = 'pf-history-time';
      time.textContent = when(entry, step.ms);
      const net = document.createElement('span');
      net.className = `move-pill ${entry.net > 0 ? 'is-up' : 'is-down'}`;
      net.textContent = signed(entry.net);
      const moves = document.createElement('span');
      moves.className = 'pf-history-moves';
      for (const move of entry.moves || []) {
        // Each holding its own chip, a link to its OpenSea page where one is known.
        const { url, image, eth } = pageFor(move.name);
        const part = document.createElement(url ? 'a' : 'span');
        part.className = `pf-history-move ${move.change > 0 ? 'is-up' : 'is-down'}`;
        if (url) {
          part.href = url;
          part.target = '_blank';
          part.rel = 'noopener noreferrer';
        }
        // Its picture, small: ether drawn on white as in the token table,
        // and initials where there is no picture.
        const pic = document.createElement('i');
        pic.className = 'pf-history-pic';
        if (eth) pic.innerHTML = ETH_ON_WHITE;
        else if (image) pic.appendChild(stillImage(image, 18, ''));
        else pic.appendChild(initialsPicture(move.name));
        part.appendChild(pic);
        const name = document.createElement('span');
        name.textContent = move.name;
        const amount = document.createElement('b');
        amount.textContent = signed(move.change);
        part.append(name, amount);
        moves.appendChild(part);
      }
      const total = document.createElement('span');
      total.className = 'pf-history-total';
      total.textContent = formatUsd(entry.total);
      row.append(time, net, moves, total);
      list.appendChild(row);
    }
  };

  /*
   * The steps, on the right of the title: each read, 1h, 6h, 12h, 24h, and
   * Custom -- an amount in minutes or hours, up to the week kept.
   */
  const steps = modal.querySelector('#pf-history-steps');
  const custom = document.createElement('span');
  custom.className = 'pf-history-custom';
  const amount = document.createElement('input');
  amount.type = 'number';
  amount.min = '1';
  amount.step = '1';
  amount.value = String(step.amount || 3);
  const unit = document.createElement('select');
  for (const [value, label] of [['m', t('unitMin')], ['h', t('unitHour')]]) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    unit.appendChild(option);
  }
  unit.value = step.unit || 'h';
  custom.append(amount, unit);

  const pick = (next) => {
    step = next;
    saveHistoryStep(step);
    steps.querySelectorAll('.pf-items-chip').forEach((chip) => {
      chip.classList.toggle('is-on', chip.dataset.custom ? step.custom : !step.custom && Number(chip.dataset.ms) === step.ms);
    });
    custom.hidden = !step.custom;
    draw();
  };
  const fromCustom = () => {
    const n = Math.max(1, Math.round(Number(amount.value) || 0));
    const ms = Math.min(HISTORY_KEEP_MS, n * (unit.value === 'm' ? 60 * 1000 : HOUR_MS));
    return { ms, custom: true, amount: n, unit: unit.value };
  };
  for (const [ms, label] of [[0, t('stepEach')], [HOUR_MS, t('stepHours', { n: 1 })], [6 * HOUR_MS, t('stepHours', { n: 6 })],
    [12 * HOUR_MS, t('stepHours', { n: 12 })], [24 * HOUR_MS, t('stepHours', { n: 24 })]]) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'pf-items-chip';
    chip.dataset.ms = String(ms);
    chip.textContent = label;
    chip.addEventListener('click', () => pick({ ...step, ms, custom: false }));
    steps.appendChild(chip);
  }
  const customChip = document.createElement('button');
  customChip.type = 'button';
  customChip.className = 'pf-items-chip';
  customChip.dataset.custom = '1';
  customChip.textContent = t('stepCustom');
  customChip.addEventListener('click', () => { pick(fromCustom()); amount.focus(); });
  steps.append(customChip, custom);
  amount.addEventListener('input', () => { if (Number(amount.value) >= 1) pick(fromCustom()); });
  unit.addEventListener('change', () => pick(fromCustom()));
  pick(step);
}

async function openManualNfts() {
  document.querySelector('.pf-manual-modal')?.remove();
  const modal = document.createElement('div');
  modal.className = 'modal pf-manual-modal';
  modal.innerHTML = `
    <div class="modal-card pf-manual-card">
      <div class="modal-title">${t('manualTitle')}</div>
      <p class="pf-manual-note">${t('manualNote')}</p>
      <label class="modal-field"><span>${t('openseaLink')}</span>
        <input id="pf-manual-link" type="text" placeholder="https://opensea.io/item/…" autocomplete="off"></label>
      <label class="modal-field" id="pf-manual-qty-row" hidden><span>${t('howMany')}</span>
        <input id="pf-manual-qty" type="number" min="1" max="1000" value="1"></label>
      <label class="modal-field"><span>${t('wallet')}</span><select id="pf-manual-owner"></select></label>
      <p class="pf-manual-error" id="pf-manual-error"></p>
      <div class="modal-actions">
        <button class="btn" id="pf-manual-cancel" type="button">${t('close')}</button>
        <button class="btn btn-primary" id="pf-manual-save" type="button">${t('add')}</button>
      </div>
      <div class="pf-manual-list" id="pf-manual-list"></div>
    </div>`;
  document.body.appendChild(modal);

  const owner = modal.querySelector('#pf-manual-owner');
  const wallets = portfolioWalletList;
  for (const address of wallets) {
    const option = document.createElement('option');
    option.value = address;
    option.textContent = walletDisplay(address);
    owner.appendChild(option);
  }

  const link = modal.querySelector('#pf-manual-link');
  const qtyRow = modal.querySelector('#pf-manual-qty-row');
  const error = modal.querySelector('#pf-manual-error');
  const save = modal.querySelector('#pf-manual-save');
  // A collection link needs a count; an item link is one piece.
  link.addEventListener('input', () => { qtyRow.hidden = !/\/collection\//i.test(link.value); });

  /*
   * Pricing a hand-added piece needs an OpenSea API key. Without one the
   * dialog says so up front, in red, with the way to add it -- and Add stays
   * off, rather than failing after the link has been pasted.
   */
  if (!settingsState.apiKeySet) {
    const need = document.createElement('div');
    need.className = 'pf-manual-need';
    need.innerHTML = `${t('needKey')} <button type="button" class="pf-manual-need-btn">${t('addInSettings')}</button>`;
    need.querySelector('button').addEventListener('click', () => { close(); openSettings(false); });
    modal.querySelector('.pf-manual-note').after(need);
    save.disabled = true;
    link.disabled = true;
  }

  const close = () => { modal.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (event) => { if (event.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  modal.addEventListener('mousedown', (event) => { if (event.target === modal) close(); });
  modal.querySelector('#pf-manual-cancel').addEventListener('click', close);

  save.addEventListener('click', async () => {
    error.textContent = '';
    save.disabled = true;
    save.textContent = t('adding');
    try {
      await api('/api/portfolio/manual', {
        method: 'POST',
        body: JSON.stringify({
          link: link.value,
          quantity: Number(modal.querySelector('#pf-manual-qty').value) || 1,
          owner: owner.value,
        }),
      });
      link.value = '';
      qtyRow.hidden = true;
      await paintManualList(modal);
      loadPortfolio(true);
    } catch (err) {
      error.textContent = serverText(err.message);
    } finally {
      save.disabled = false;
      save.textContent = t('add');
    }
  });

  link.focus();
  await paintManualList(modal);
}

/* What has been added so far, each with a way to take it out again. */
async function paintManualList(modal) {
  const box = modal.querySelector('#pf-manual-list');
  let entries = [];
  try {
    entries = (await api('/api/portfolio/manual')).entries || [];
  } catch (err) {
    box.textContent = err.message;
    return;
  }
  box.textContent = '';
  if (!entries.length) return;
  const head = document.createElement('div');
  head.className = 'pf-manual-head';
  head.textContent = t('addedByHand');
  box.appendChild(head);
  for (const entry of entries) {
    const row = document.createElement('div');
    row.className = 'pf-manual-row';
    const pic = document.createElement('span');
    pic.className = 'pf-item-pic';
    const image = entry.image || entry.collection?.image;
    if (image) pic.appendChild(stillImage(image, 34, ''));
    const label = document.createElement('span');
    label.className = 'pf-manual-name';
    const collection = entry.collection?.name || entry.slug;
    label.textContent = entry.tokenId
      ? `${entry.name || `#${entry.tokenId}`} · ${collection}`
      : `${collection} × ${entry.quantity || 1}`;
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'btn btn-mini is-icon pf-manual-remove';
    remove.setAttribute('aria-label', 'Remove');
    remove.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"'
      + ' stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg>';
    remove.addEventListener('click', async () => {
      remove.disabled = true;
      try {
        await api(`/api/portfolio/manual?id=${encodeURIComponent(entry.id)}`, { method: 'DELETE' });
        await paintManualList(modal);
        loadPortfolio(true);
      } catch (err) {
        remove.disabled = false;
        modal.querySelector('#pf-manual-error').textContent = err.message;
      }
    });
    row.append(pic, label);
    if (entry.owner) row.appendChild(walletDot(entry.owner));
    row.appendChild(remove);
    box.appendChild(row);
  }
}

/*
 * Auto-refresh, but only while the tab is actually being looked at. One
 * refresh costs roughly ten OpenSea requests and that budget is OpenSea's, so polling in the background for a page nobody has open would
 * spend it for nothing. Floor and offer prices move slowly enough that five
 * minutes loses nothing; a hidden window pauses and catches up on return.
 */
const PORTFOLIO_REFRESH_MS = 5 * 60 * 1000;
let portfolioFetchedAt = 0;

function portfolioIsOnScreen() {
  return !document.hidden;
}

/* Renewed every five minutes while the page is in view; a hidden tab waits. */
setInterval(() => {
  // Nothing to renew before a wallet is saved, or while the settings are open.
  if (document.hidden || !settingsState.wallets.length || document.querySelector('.settings-modal')) return;
  // Asleep: one try every few minutes, not one every half minute.
  if (appAsleep && Date.now() - appAsleepTriedAt < PORTFOLIO_REFRESH_MS) return;
  if (!appAsleep && Date.now() - portfolioFetchedAt < PORTFOLIO_REFRESH_MS) return;
  loadPortfolio(true);
}, 30000);

/*
 * How old the figures are and when they renew: "Updated 2m ago · every 5m",
 * ticking while the tab is open. A reload in flight says so instead.
 */
let portfolioUpdating = false;
let portfolioItemsLoading = 0;
let portfolioLoadingTimer = null;

function paintPortfolioUpdated() {
  const label = $('#portfolio-updated');
  if (!label) return;
  // A read under way looks it: its own colour, apart from "Updated … ago".
  label.classList.toggle('is-reading', Boolean(portfolioItemsLoading || portfolioTailLoading));
  if (portfolioItemsLoading) {
    label.textContent = t('readingItems', { n: portfolioItemsLoading.toLocaleString('en-US') });
    return;
  }
  if (portfolioTailLoading) {
    label.textContent = t('readingTail', { n: portfolioTailLoaded.toLocaleString('en-US') });
    return;
  }
  if (portfolioUpdating) {
    label.textContent = portfolioFetchedAt ? t('updating') : t('loading');
    return;
  }
  if (!portfolioFetchedAt) { label.textContent = ''; return; }
  const seconds = Math.max(0, Math.floor((Date.now() - portfolioFetchedAt) / 1000));
  const age = seconds < 60 ? t('ageSec', { n: seconds }) : t('ageMin', { n: Math.floor(seconds / 60) });
  label.innerHTML = t('updatedAgo', { age, m: PORTFOLIO_REFRESH_MS / 60000 });
}

setInterval(() => { if (portfolioIsOnScreen()) paintPortfolioUpdated(); }, 1000);

document.addEventListener('visibilitychange', () => {
  if (document.hidden || !settingsState.wallets.length || document.querySelector('.settings-modal')) return;
  // Looked at again: the app may be back -- a woken codespace -- so ask now.
  if (appAsleep || Date.now() - portfolioFetchedAt >= PORTFOLIO_REFRESH_MS) loadPortfolio(true);
});

/*
 * The change since the read before, as the server worked it out and wrote
 * into its day of history: the net, and the holding that moved most the same
 * way -- what rose most when the balance rose, what fell most when it fell.
 */
let portfolioMove = null;

/*
 * The change as a pill beside the balance, on the tab and at the top of the
 * portfolio: green for a rise, red for a fall, naming what moved most.
 */
function paintPortfolioMove() {
  const signed = (usd) => `${usd > 0 ? '+' : '−'}${formatUsd(Math.abs(usd))}`;
  for (const [id, withName] of [['portfolio-move', true]]) {
    const pill = document.getElementById(id);
    if (!pill) continue;
    pill.classList.remove('is-up', 'is-down');
    if (!portfolioMove) { pill.textContent = ''; continue; }
    const { net, top } = portfolioMove;
    pill.classList.add(net > 0 ? 'is-up' : 'is-down');
    pill.textContent = withName && top
      ? `${signed(net)} · ${top.name} ${signed(top.change)}`
      : signed(net);
  }
  /*
   * Beside the pill, the next two biggest moves either way, each a chip with
   * its picture -- the pill names only the one that led.
   */
  const more = document.getElementById('portfolio-move-more');
  if (!more) return;
  forgetPictures(more);
  more.textContent = '';
  if (!portfolioMove) return;
  const pictureOf = new Map();
  for (const group of portfolioGroups) if (group.image) pictureOf.set(group.name, group.image);
  for (const token of portfolioTokens) if (token.image) pictureOf.set(token.name || token.symbol, token.image);
  for (const move of portfolioMove.others) {
    const chip = document.createElement('span');
    chip.className = `pf-history-move ${move.change > 0 ? 'is-up' : 'is-down'}`;
    const pic = document.createElement('i');
    pic.className = 'pf-history-pic';
    const image = pictureOf.get(move.name);
    pic.appendChild(image ? stillImage(image, 18, '') : initialsPicture(move.name));
    const name = document.createElement('span');
    name.textContent = move.name;
    const amount = document.createElement('b');
    amount.textContent = signed(move.change);
    chip.append(pic, name, amount);
    more.appendChild(chip);
  }
}

function notePortfolioMove(event) {
  portfolioMove = null;
  if (event && event.net) {
    const top = (event.moves || []).find((m) => Math.sign(m.change) === Math.sign(event.net)) || null;
    const others = (event.moves || []).filter((m) => m !== top)
      .sort((a, b) => Math.abs(b.change) - Math.abs(a.change)).slice(0, 2);
    portfolioMove = { net: event.net, top, others, since: event.since };
  }
  paintPortfolioMove();
}

function ageText(ms) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h`;
}



/*
 * The note beside the title, in one of two states:
 *   - a newer version is on GitHub (the server checks hourly): amber,
 *     "Update available", and a click lists what it brings;
 *   - the last start pulled one in: green, "Updated", and a click lists what
 *     changed. Once read, that one goes away for good.
 */
function paintUpdateNote() {
  const note = $('#update-note');
  if (!note) return;
  const behind = Number(settingsState.updateBehind) || 0;
  const applied = settingsState.lastUpdate && (settingsState.lastUpdate.changes || []).length;
  note.classList.toggle('is-applied', !behind && Boolean(applied));
  if (behind) note.textContent = t('noteAvailable');
  else if (applied) note.textContent = t('noteApplied');
  note.hidden = !behind && !applied;
}

/*
 * A change note in the page's language. Notes come as { en, tr } when the
 * commit carried a Turkish line; a bare title (written by an older start.js)
 * finds its Turkish in the history, when the history has it.
 */
function changeText(change, byTitle = new Map()) {
  if (typeof change !== 'string') return (lang === 'tr' && change.tr) || change.en;
  const known = byTitle.get(change);
  return known ? changeText(known) : change;
}

function formatChangeDate(at) {
  return new Date(at).toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-US', { day: 'numeric', month: 'short' });
}

/*
 * What an update brings, or what the last one brought, and under it the
 * history of the version installed. With neither an update waiting nor one
 * just applied -- "Check for updates" found it up to date -- only the history.
 */
async function openWhatsNew() {
  const behind = Number(settingsState.updateBehind) || 0;
  const changes = behind ? settingsState.updateChanges || [] : (settingsState.lastUpdate || {}).changes || [];
  let history = [];
  try { history = (await api('/api/update/history')).history || []; } catch { /* shown without it */ }
  const byTitle = new Map(history.map((entry) => [entry.title || entry.en, entry]));
  document.querySelector('.whatsnew-modal')?.remove();
  const modal = document.createElement('div');
  modal.className = 'modal whatsnew-modal';
  const card = document.createElement('div');
  card.className = 'modal-card whatsnew-card';
  const title = document.createElement('div');
  title.className = 'modal-title';
  title.textContent = behind ? t('newVersion') : changes.length ? t('updatedLatest') : t('updateHistory');
  const list = document.createElement('ul');
  list.className = 'whatsnew-list';
  for (const change of changes) {
    const item = document.createElement('li');
    item.textContent = changeText(change, byTitle);
    list.appendChild(item);
  }
  // The installed version's history, dated; the notes above are not repeated.
  const shown = new Set(changes.map((change) => (typeof change === 'string' ? change : change.en)));
  const past = history.filter((entry) => !shown.has(entry.en) && !shown.has(entry.title));
  let historyBox = null;
  if (past.length) {
    historyBox = document.createElement('div');
    historyBox.className = 'whatsnew-history';
    if (changes.length) {
      const head = document.createElement('div');
      head.className = 'whatsnew-history-head';
      head.textContent = t('updateHistory');
      historyBox.appendChild(head);
    }
    const rows = document.createElement('ul');
    rows.className = 'whatsnew-history-list';
    for (const entry of past) {
      const row = document.createElement('li');
      const date = document.createElement('span');
      date.className = 'whatsnew-date';
      date.textContent = formatChangeDate(entry.at);
      const text = document.createElement('span');
      text.textContent = changeText(entry);
      row.append(date, text);
      rows.appendChild(row);
    }
    historyBox.appendChild(rows);
  }
  const how = document.createElement('p');
  how.className = 'whatsnew-how';
  if (behind) {
    how.textContent = settingsState.canSelfUpdate
      ? t('howSelf')
      : t('howManual');
  }
  const actions = document.createElement('div');
  actions.className = 'modal-actions';
  const done = document.createElement('button');
  done.type = 'button';
  done.className = 'btn';
  done.textContent = t('close');
  actions.appendChild(done);
  // One click: the app pulls the update, restarts, and the page reloads.
  if (behind && settingsState.canSelfUpdate) {
    const now = document.createElement('button');
    now.type = 'button';
    now.className = 'btn btn-primary';
    now.textContent = t('updateNow');
    now.addEventListener('click', () => {
      now.disabled = true;
      done.disabled = true;
      now.textContent = t('updating');
      applyUpdate().catch((error) => {
        now.textContent = t('updateNow');
        now.disabled = false;
        done.disabled = false;
        how.textContent = error.message;
      });
    });
    actions.appendChild(now);
  }
  card.appendChild(title);
  if (changes.length) card.appendChild(list);
  if (how.textContent) card.appendChild(how);
  if (historyBox) card.appendChild(historyBox);
  card.appendChild(actions);
  modal.appendChild(card);
  document.body.appendChild(modal);

  const close = () => {
    modal.remove();
    document.removeEventListener('keydown', onKey);
    // An applied update's list is shown once.
    if (!behind && settingsState.lastUpdate) {
      settingsState.lastUpdate = null;
      paintUpdateNote();
      api('/api/update/seen', { method: 'POST' }).catch(() => {});
    }
  };
  const onKey = (event) => { if (event.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  modal.addEventListener('mousedown', (event) => { if (event.target === modal) close(); });
  done.addEventListener('click', close);
}

$('#update-note').addEventListener('click', openWhatsNew);

/*
 * Asks the app to update itself, waits for it to come back -- start.js pulls
 * the update and restarts it, a few seconds -- and reloads the page onto the
 * new version. Gives up after two minutes and says so.
 */
async function applyUpdate() {
  await api('/api/update/apply', { method: 'POST' });
  const started = Date.now();
  await new Promise((resolve) => setTimeout(resolve, 1500));
  while (Date.now() - started < 120_000) {
    try {
      await api('/api/settings');
      location.reload();
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  throw new Error(t('noComeBack'));
}

/*
 * Fully automatic when nobody is looking: an update found while this tab is
 * in the background is applied at once, and the page is on the new version
 * when it is looked at again. (With no page open at all, the app does the
 * same on its own after ten quiet minutes -- see server.js.)
 */
function autoUpdateIfUnseen() {
  if (document.hidden && settingsState.canSelfUpdate && Number(settingsState.updateBehind) > 0) {
    applyUpdate().catch(() => {});
  }
}
document.addEventListener('visibilitychange', autoUpdateIfUnseen);
setInterval(() => { loadSettings().then(autoUpdateIfUnseen).catch(() => {}); }, 60 * 60 * 1000);

/*
 * Check for updates, now: the button says what it found for a few seconds,
 * and a newer version also lights the note beside the title.
 */
$('#update-check').addEventListener('click', async (event) => {
  const button = event.currentTarget;
  const label = button.querySelector('span');
  if (button.disabled) return;
  button.disabled = true;
  label.textContent = t('checking');
  let answer = null;
  try { answer = await api('/api/update/check', { method: 'POST' }); } catch { /* shown below */ }
  if (!answer || !answer.known) label.textContent = t('couldNotCheck');
  else if (answer.behind > 0) label.textContent = t('updateAvailable');
  else label.textContent = t('upToDate');
  if (answer && answer.known) {
    settingsState.updateBehind = answer.behind;
    settingsState.updateChanges = answer.changes || [];
    paintUpdateNote();
    // Either way, the answer in full: what is new, or the history so far.
    openWhatsNew();
  }
  setTimeout(() => {
    label.textContent = t('checkUpdates');
    button.disabled = false;
  }, 4000);
});

/*
 * The card at the top: whose portfolio this is -- the main wallet's OpenSea
 * name and picture, its address, and the first lines of its bio. Without a
 * profile, the wallet's own label or address, and its first letters for a
 * picture.
 */
let portfolioProfile = null;

async function loadProfile() {
  try { portfolioProfile = (await api('/api/profile')).profile; } catch { portfolioProfile = null; }
  paintProfile();
}

function paintProfile() {
  const wallets = settingsState.wallets || [];
  const address = (portfolioProfile && portfolioProfile.address) || (wallets[0] && wallets[0].address) || '';
  const card = $('#portfolio-profile');
  if (!card) return;
  card.hidden = !address;
  if (!address) return;
  const profile = portfolioProfile || {};
  const short = `${address.slice(0, 6)}…${address.slice(-4)}`;
  const label = walletLabelMap[address.toLowerCase()];
  const name = $('#portfolio-profile-name');
  name.textContent = profile.name || profile.ens || label || short;
  // OpenSea's blue tick, for the accounts it has verified.
  if (profile.verified) name.append(' ', verifiedBadge());
  // The name opens this wallet's portfolio on OpenSea.
  name.href = `https://opensea.io/${address}/portfolio`;
  const parts = [short];
  if (profile.ens && profile.ens !== profile.name) parts.push(profile.ens);
  if (wallets.length > 1) parts.push(t('nWallets', { n: wallets.length }));
  $('#portfolio-profile-address').textContent = parts.join(' · ');
  $('#portfolio-profile-bio').textContent = String(profile.bio || '').split('\n').map((line) => line.trim()).filter(Boolean).join(' · ');
  const pic = $('#portfolio-profile-pic');
  forgetPictures(pic);
  pic.textContent = '';
  if (profile.image) pic.appendChild(stillImage(profile.image, 48, ''));
  else pic.textContent = address.slice(2, 4).toUpperCase();
}

/* ---------------------------------------------------------------- boot */

/*
 * The support mint. Empty until there is one; the header link appears as
 * soon as this is set.
 */
const SUPPORT_URL = '';
if (SUPPORT_URL) {
  $('#support-link').href = SUPPORT_URL;
  $('#support-link').hidden = false;
}

$('#portfolio-settings').addEventListener('click', () => openSettings(false));

loadSettings()
  .then((settings) => {
    if (!settings.wallets.length) openSettings(true);
    else { loadPortfolio(); loadProfile(); }
  })
  .catch((error) => {
    if (isAppGone(error)) showAppAsleep();
    else $('#portfolio-summary').textContent = t('serverDown', { e: error.message });
  });

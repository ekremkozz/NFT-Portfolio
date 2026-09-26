// ==UserScript==
// @name         Page Meter
// @namespace    https://github.com/ekremkozz/NFT-Portfolio
// @version      1.0
// @description  The same measurements on any page, in a small box: how busy the page keeps the browser, its memory, its size and what it downloaded. For comparing OpenSea's portfolio page with NFT Portfolio Lite fairly.
// @match        https://opensea.io/*
// @match        http://localhost:4180/*
// @match        http://127.0.0.1:4180/*
// @match        https://*.app.github.dev/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

/*
 * What it measures, and what it cannot:
 *
 *  - Busy: the share of the last 10 seconds the page's main thread spent in
 *    long tasks (50 ms or more), as the browser itself reports them. It is a
 *    floor, not the CPU figure: short work, and work outside the main thread
 *    (image decoding, the compositor), is not in it. The browser's own task
 *    manager (Shift+Esc in Chrome and Brave) stays the authority on CPU.
 *  - FPS: frames the page drew in the last second. A page at rest that keeps
 *    drawing is spending power on animation.
 *  - Memory: the page's JavaScript heap (Chromium browsers only).
 *  - DOM: how many elements the page holds.
 *  - Downloaded: requests since the page opened and the bytes the browser can
 *    count. Other sites' files often report 0 bytes, so the request count is
 *    the steadier of the two.
 *
 * Peaks are kept for the whole visit; Reset starts them over, Copy puts a
 * one-line summary on the clipboard. Alt+M hides and shows the box.
 * The meter runs identically on both pages, so its own small cost cancels out.
 */
(function pageMeter() {
  'use strict';

  const WINDOW_MS = 10_000;
  const longTasks = [];            // [end time, duration]
  let frames = 0;
  let fps = 0;
  let peak = { busy: 0, heap: 0, dom: 0 };
  let busySum = 0;
  let busySamples = 0;
  const started = performance.now();

  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        longTasks.push([entry.startTime + entry.duration, entry.duration]);
      }
    }).observe({ type: 'longtask', buffered: true });
  } catch {
    /* Not a Chromium browser: Busy stays blank. */
  }

  function countFrames() {
    frames += 1;
    requestAnimationFrame(countFrames);
  }
  requestAnimationFrame(countFrames);
  setInterval(() => { fps = frames; frames = 0; }, 1000);

  function busyShare() {
    const now = performance.now();
    while (longTasks.length && longTasks[0][0] < now - WINDOW_MS) longTasks.shift();
    const span = Math.min(WINDOW_MS, now - started);
    if (span <= 0) return 0;
    // Only the part of each task inside the window counts.
    let busy = 0;
    for (const [end, duration] of longTasks) {
      busy += Math.min(duration, end - (now - span));
    }
    return Math.max(0, Math.min(100, (busy / span) * 100));
  }

  function downloads() {
    const entries = performance.getEntriesByType('resource');
    const nav = performance.getEntriesByType('navigation')[0];
    let bytes = nav ? nav.transferSize || 0 : 0;
    for (const entry of entries) bytes += entry.transferSize || 0;
    return { requests: entries.length + 1, bytes };
  }

  const mb = (n) => `${(n / 1048576).toFixed(1)} MB`;

  function build() {
    const box = document.createElement('div');
    box.id = 'page-meter';
    box.style.cssText = [
      'position:fixed', 'right:12px', 'bottom:12px', 'z-index:2147483647',
      'font:12px/1.5 ui-monospace,Consolas,monospace', 'color:#eaeaea',
      'background:rgba(12,12,12,.92)', 'border:1px solid #333', 'border-radius:10px',
      'padding:9px 12px', 'min-width:210px', 'box-shadow:0 6px 20px rgba(0,0,0,.4)',
      'pointer-events:auto', 'user-select:none',
    ].join(';');
    box.innerHTML = '<div style="display:flex;justify-content:space-between;gap:10px;margin-bottom:4px">'
      + '<b style="font:600 12px system-ui,sans-serif">Page Meter</b>'
      + '<span><button data-act="copy">Copy</button> <button data-act="reset">Reset</button></span></div>'
      + '<div data-out></div>';
    for (const button of box.querySelectorAll('button')) {
      button.style.cssText = 'font:11px system-ui,sans-serif;color:#eaeaea;background:#222;'
        + 'border:1px solid #444;border-radius:6px;padding:1px 7px;cursor:pointer';
    }
    box.addEventListener('click', (event) => {
      const act = event.target.dataset && event.target.dataset.act;
      if (act === 'reset') {
        peak = { busy: 0, heap: 0, dom: 0 };
        busySum = 0;
        busySamples = 0;
      }
      if (act === 'copy') navigator.clipboard?.writeText(summary()).catch(() => {});
    });
    document.documentElement.appendChild(box);
    return box;
  }

  let box = null;
  let last = {};

  function summary() {
    return `${location.hostname} | busy now ${last.busy}% avg ${last.avg}% peak ${last.peakBusy}%`
      + ` | fps ${last.fps} | heap ${last.heap} (peak ${last.peakHeap}) | DOM ${last.dom}`
      + ` (peak ${last.peakDom}) | ${last.requests} requests, ${last.bytes}`;
  }

  function paint() {
    if (!document.documentElement) return;
    if (!box || !box.isConnected) box = build();
    const busy = busyShare();
    busySum += busy;
    busySamples += 1;
    const heap = performance.memory ? performance.memory.usedJSHeapSize : 0;
    const dom = document.getElementsByTagName('*').length;
    peak.busy = Math.max(peak.busy, busy);
    peak.heap = Math.max(peak.heap, heap);
    peak.dom = Math.max(peak.dom, dom);
    const net = downloads();
    last = {
      busy: busy.toFixed(0),
      avg: (busySum / busySamples).toFixed(0),
      peakBusy: peak.busy.toFixed(0),
      fps,
      heap: heap ? mb(heap) : 'n/a',
      peakHeap: heap ? mb(peak.heap) : 'n/a',
      dom: dom.toLocaleString('en-US'),
      peakDom: peak.dom.toLocaleString('en-US'),
      requests: net.requests.toLocaleString('en-US'),
      bytes: mb(net.bytes),
    };
    box.querySelector('[data-out]').innerHTML = [
      `Busy      ${last.busy}%  avg ${last.avg}%  peak ${last.peakBusy}%`,
      `FPS       ${last.fps}`,
      `Memory    ${last.heap}  peak ${last.peakHeap}`,
      `DOM       ${last.dom}  peak ${last.peakDom}`,
      `Downloads ${last.requests} req · ${last.bytes}`,
    ].map((line) => `<div style="white-space:pre">${line}</div>`).join('');
  }

  setInterval(paint, 1000);

  document.addEventListener('keydown', (event) => {
    if (event.altKey && (event.key === 'm' || event.key === 'M') && box) {
      box.style.display = box.style.display === 'none' ? '' : 'none';
    }
  });
})();

// Mini cliente del protocolo de Chrome (CDP) para la verificación en navegador. Sin dependencias.
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function launch({ port = 9333, userDir } = {}) {
  const dir = userDir || mkdtempSync(join(process.env.TMPDIR || tmpdir(), 'cdp-'));
  const proc = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-gpu', 'about:blank'], { stdio: 'ignore' });
  let list;
  for (let i = 0; i < 60; i++) {
    try { list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); if (list.length) break; } catch { /* esperar */ }
    await sleep(250);
  }
  const page = list.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0;
  const pending = new Map();
  const events = [];
  const logs = [];
  const requests = [];
  const handlers = new Map();
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) { const { res, rej } = pending.get(d.id); pending.delete(d.id); d.error ? rej(new Error(d.error.message)) : res(d.result); return; }
    if (d.method) {
      events.push(d);
      for (const f of handlers.get(d.method) || []) f(d.params);
      if (d.method === 'Network.requestWillBeSent') requests.push(d.params.request.url);
      if (d.method === 'Runtime.consoleAPICalled') logs.push({ type: d.params.type, text: d.params.args.map((a) => a.value ?? a.description ?? '').join(' ') });
      if (d.method === 'Runtime.exceptionThrown') logs.push({ type: 'exception', text: d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text });
      if (d.method === 'Log.entryAdded') logs.push({ type: `log-${d.params.entry.level}`, text: d.params.entry.text + ' ' + (d.params.entry.url || '') });
    }
  };
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable'); await send('Network.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__csp=[];document.addEventListener('securitypolicyviolation',e=>window.__csp.push(e.violatedDirective+' '+e.blockedURI));` });
  const api = {
    logs, events, send, requests,
    on(method, fn) { handlers.set(method, [...(handlers.get(method) || []), fn]); },
    async viewport(width, height = 844, mobile = true) { await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile }); },
    async goto(url) { await send('Page.navigate', { url }); await sleep(300); await api.waitFor(() => document.readyState === 'complete'); },
    async eval(fn, ...args) {
      const expr = typeof fn === 'function' ? `(${fn})(...${JSON.stringify(args)})` : fn;
      const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
      return r.result.value;
    },
    async waitFor(fn, ...args) {
      let timeout = 8000;
      for (let t = 0; t < timeout; t += 100) {
        let v = false;
        try { v = await api.eval(fn, ...args); } catch { /* aún no */ }
        if (v) return v;
        await sleep(100);
      }
      throw new Error('Tiempo agotado esperando: ' + String(fn).slice(0, 160) + ' args=' + JSON.stringify(args));
    },
    async screenshot(path) { const r = await send('Page.captureScreenshot', { format: 'png' }); (await import('node:fs')).writeFileSync(path, Buffer.from(r.data, 'base64')); },
    sleep,
    async close() { try { await send('Browser.close'); } catch { /* nada */ } try { ws.close(); } catch { /* nada */ } proc.kill(); },
  };
  return api;
}

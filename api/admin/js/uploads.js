// Cola de fotos: se prepara y se sube UNA a la vez. Si algo falla, queda en la lista para reintentar.
import { t } from './i18n.js';
import { app } from './app.js';
import { S, set } from './store.js';
import { prepareImage } from './image.js';
import { apiErrorMessage } from './lib/errors.js';
import { addItem, makeId } from './lib/listops.js';

export const Q = { jobs: [], running: false, total: 0, finished: 0, onChange: () => {}, onItem: () => {} };
let seq = 0;

export function enqueue(files) {
  if (!Q.running && !Q.jobs.some((j) => j.status === 'wait' || j.status === 'error')) { Q.total = 0; Q.finished = 0; Q.jobs = Q.jobs.filter((j) => j.status === 'error'); }
  for (const f of files) { Q.jobs.push({ id: ++seq, file: f, name: f.name || '', status: 'wait', progress: 0, error: '', prepared: null, mainKey: '', thumbKey: '' }); Q.total++; }
  Q.onChange();
  run();
}
export function retry(job) { job.status = 'wait'; job.error = ''; Q.onChange(); run(); }
export function drop(job) { Q.jobs = Q.jobs.filter((j) => j !== job); Q.total = Math.max(0, Q.total - 1); Q.onChange(); run(); }
export const pending = () => Q.jobs.some((j) => j.status === 'wait' || j.status === 'prep' || j.status === 'up');

async function run() {
  if (Q.running) return;
  Q.running = true;
  try {
    for (;;) {
      if (Q.jobs.some((j) => j.status === 'error' && j.stop)) break; // un error de conexión detiene la cola
      const job = Q.jobs.find((j) => j.status === 'wait');
      if (!job) break;
      await one(job);
    }
  } finally { Q.running = false; Q.onChange(); }
}

async function one(job) {
  try {
    job.status = 'prep'; job.stop = false; Q.onChange();
    if (!job.prepared) job.prepared = await prepareImage(job.file, { withThumb: true });
    job.status = 'up'; job.progress = 0; Q.onChange();
    const { main, thumb } = job.prepared;
    if (!job.mainKey) {
      const r = await app.api.upload(main.blob, 'photo', (p) => { job.progress = p * 0.75; Q.onChange(); });
      job.mainKey = r.key;
    }
    if (!job.thumbKey) {
      const r = await app.api.upload(thumb.blob, 'thumb', (p) => { job.progress = 0.75 + p * 0.25; Q.onChange(); });
      job.thumbKey = r.key;
    }
    app.blobUrls.set(job.mainKey, URL.createObjectURL(main.blob));
    app.blobUrls.set(job.thumbKey, URL.createObjectURL(thumb.blob));
    const id = makeId(new Set(S.state.gallery.map((x) => x.id)));
    set('gallery', addItem(S.state.gallery, {
      id, type: 'image', category: '', src: job.mainKey, poster: job.thumbKey, w: main.w, h: main.h,
      caption: { es: '', en: '' }, alt: { es: '', en: '' }, hidden: false,
    }, { atStart: true }));
    Q.jobs = Q.jobs.filter((j) => j !== job);
    Q.finished++;
    job.prepared = null;
    Q.onItem();
  } catch (e) {
    job.status = 'error';
    if (e && e.code) { job.error = t(e.code === 'heic' ? 'errHeic' : e.code === 'jpeg' ? 'errJpeg' : 'errDecode'); job.prepared = null; job.stop = false; }
    else { job.error = apiErrorMessage(e || { network: true }, 'upload'); job.stop = true; }
  }
  Q.onChange();
}

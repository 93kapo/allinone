// Llamadas a la API del Worker (mismo origen). El token va SOLO en Authorization: Bearer.
export class ApiError extends Error {
  constructor(status, body, network = false) { super(network ? 'network' : `http-${status}`); this.status = status; this.body = body; this.network = network; }
}

export function createApi(auth) {
  async function send(doFetch) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const token = await auth.getToken(attempt === 1);
      if (!token) throw new ApiError(401, null);
      const r = await doFetch(token);
      if (r.status === 401 && attempt === 0) continue; // un reintento con token nuevo
      return r;
    }
    throw new ApiError(401, null);
  }
  const parse = async (res) => { try { return await res.json(); } catch { return null; } };

  async function json(method, path, { body, headers = {} } = {}) {
    const ctl = new AbortController();
    const to = setTimeout(() => ctl.abort(), 30000);
    try {
      const res = await send((token) => fetch(path, {
        method, signal: ctl.signal, cache: 'no-store',
        headers: { ...headers, authorization: `Bearer ${token}`, ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      }));
      const data = await parse(res);
      if (!res.ok) throw new ApiError(res.status, data);
      return data;
    } catch (e) {
      if (e instanceof ApiError) throw e;
      throw new ApiError(0, null, true);
    } finally { clearTimeout(to); }
  }

  return {
    // Público: sin token. 404 {empty:true} => null.
    async getContent() {
      let res;
      try { res = await fetch('/api/content', { cache: 'no-store' }); } catch { throw new ApiError(0, null, true); }
      if (res.status === 404) return null;
      const data = await parse(res);
      if (!res.ok || !data) throw new ApiError(res.status, data);
      return data;
    },
    putContent: (payload, ifMatch) => json('PUT', '/api/content', { body: payload, headers: { 'if-match': ifMatch } }),
    history: () => json('GET', '/api/history'),
    restore: (version) => json('POST', '/api/restore', { body: { version } }),
    me: () => json('GET', '/api/me'),
    // Subida con progreso (fetch no da progreso de subida). Responde 201 {key,size,contentType,kind}.
    upload(blob, kind, onProgress) {
      return new Promise((resolve, reject) => {
        let tries = 0;
        const run = async (force) => {
          let token;
          try { token = await auth.getToken(force); } catch { reject(new ApiError(0, null, true)); return; }
          if (!token) { reject(new ApiError(401, null)); return; }
          const x = new XMLHttpRequest();
          x.open('POST', '/api/upload');
          x.setRequestHeader('Authorization', `Bearer ${token}`);
          x.setRequestHeader('X-Kind', kind);
          x.setRequestHeader('Content-Type', 'image/jpeg');
          x.timeout = 120000;
          x.upload.onprogress = (ev) => { if (ev.lengthComputable && onProgress) onProgress(ev.loaded / ev.total); };
          x.onerror = x.ontimeout = x.onabort = () => reject(new ApiError(0, null, true));
          x.onload = () => {
            let data = null;
            try { data = JSON.parse(x.responseText); } catch { /* nada */ }
            if (x.status === 401 && tries++ === 0) { run(true); return; }
            if (x.status === 201 && data && typeof data.key === 'string') resolve(data);
            else reject(new ApiError(x.status, data));
          };
          x.send(blob);
        };
        run(false);
      });
    },
  };
}

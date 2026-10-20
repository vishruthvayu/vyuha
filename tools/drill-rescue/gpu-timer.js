// Injected before page scripts: GPU time of each animation frame's WebGL2 work,
// measured with EXT_disjoint_timer_query_webgl2 (robust to vsync and CPU noise;
// preemption by other GPU clients can still inflate individual samples).
(() => {
  const T = window.__gt = { ms: [], ctx: null, ext: null, active: false, pending: [] };
  const getContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
    const c = getContext.call(this, type, ...rest);
    if (type === 'webgl2' && c && !T.ctx) { T.ctx = c; T.ext = c.getExtension('EXT_disjoint_timer_query_webgl2'); }
    return c;
  };
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = cb => raf(t => {
    const gl = T.ctx, ext = T.ext;
    let q = null;
    if (gl && ext && !T.active && !gl.isContextLost()) { q = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, q); T.active = true; }
    try { cb(t); } finally {
      if (q) { gl.endQuery(ext.TIME_ELAPSED_EXT); T.active = false; T.pending.push(q); }
      while (gl && T.pending.length) {
        const p = T.pending[0];
        if (!gl.getQueryParameter(p, gl.QUERY_RESULT_AVAILABLE)) break;
        if (!gl.getParameter(ext.GPU_DISJOINT_EXT)) { const v = gl.getQueryParameter(p, gl.QUERY_RESULT) / 1e6; if (v > 0.02) T.ms.push(v); }
        gl.deleteQuery(p); T.pending.shift();
      }
      if (T.ms.length > 20000) T.ms.splice(0, 10000);
    }
  });
})();

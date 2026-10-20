// Injected before page scripts: counts WebGL draw calls and triangles per animation frame.
(() => {
  const stat = window.__gl = { calls: 0, tris: 0, frames: [], last: 0, on: true };
  const wrap = (proto) => {
    if (!proto) return;
    const tri = (mode, count, inst = 1) => { if (mode === 4) stat.tris += (count / 3) * inst; else if (mode === 5 || mode === 6) stat.tris += Math.max(0, count - 2) * inst; };
    const de = proto.drawElements; proto.drawElements = function (m, c, t, o) { stat.calls++; tri(m, c); return de.call(this, m, c, t, o); };
    const da = proto.drawArrays; proto.drawArrays = function (m, f, c) { stat.calls++; tri(m, c); return da.call(this, m, f, c); };
    if (proto.drawElementsInstanced) { const dei = proto.drawElementsInstanced; proto.drawElementsInstanced = function (m, c, t, o, n) { stat.calls++; tri(m, c, n); return dei.call(this, m, c, t, o, n); }; }
    if (proto.drawArraysInstanced) { const dai = proto.drawArraysInstanced; proto.drawArraysInstanced = function (m, f, c, n) { stat.calls++; tri(m, c, n); return dai.call(this, m, f, c, n); }; }
  };
  wrap(window.WebGL2RenderingContext && WebGL2RenderingContext.prototype);
  wrap(window.WebGLRenderingContext && WebGLRenderingContext.prototype);
  const f = t => { if (stat.last) stat.frames.push([t - stat.last, stat.calls, stat.tris]); if (stat.frames.length > 20000) stat.frames.splice(0, 10000); stat.last = t; stat.calls = 0; stat.tris = 0; requestAnimationFrame(f); };
  requestAnimationFrame(f);
})();

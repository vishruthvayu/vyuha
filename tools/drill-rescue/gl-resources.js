// Injected before page scripts: live counts of WebGL textures, buffers,
// framebuffers and programs (created minus deleted), for leak checks.
(() => {
  const R = window.__glr = { texture: 0, buffer: 0, framebuffer: 0, program: 0 };
  const wrap = (proto) => {
    if (!proto) return;
    for (const [kind, create, del] of [['texture', 'createTexture', 'deleteTexture'], ['buffer', 'createBuffer', 'deleteBuffer'], ['framebuffer', 'createFramebuffer', 'deleteFramebuffer'], ['program', 'createProgram', 'deleteProgram']]) {
      const c = proto[create], d = proto[del];
      proto[create] = function (...a) { const r = c.apply(this, a); if (r) R[kind]++; return r; };
      proto[del] = function (o) { if (o) R[kind]--; return d.call(this, o); };
    }
  };
  wrap(window.WebGL2RenderingContext && WebGL2RenderingContext.prototype);
})();

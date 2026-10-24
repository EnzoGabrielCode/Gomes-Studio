// Specular button (React Bits) em JS puro: um reflexo de luz corre sozinho pela
// borda do botão, sem seguir o mouse. Uso: class="specular-button".
(() => {
  const PAD = 24;
  const TAU = Math.PI * 2;

  const VERTEX = `#version 300 es
in vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

  const FRAGMENT = `#version 300 es
precision highp float;
uniform vec2 uCenter;
uniform vec2 uHalf;
uniform float uRadius;
uniform float uPx;
uniform float uSpot;
uniform vec2 uEntry;
uniform vec3 uLineColor;
uniform vec3 uBaseColor;
uniform float uIntensity;
uniform vec2 uWindow;
uniform float uThickness;
uniform float uGlow;
out vec4 outColor;

float roundedBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

float loopPosition(vec2 p, vec2 b, float r) {
  vec2 inner = b - r;
  float arc = 1.5707963 * r;
  float quarter = inner.x + inner.y + arc;
  vec2 a = abs(p);
  vec2 q = a - inner;
  float s = q.x > 0.0 && q.y > 0.0
    ? inner.y + atan(q.y, q.x) * r
    : (q.x > q.y ? min(a.y, inner.y) : inner.y + arc + inner.x - min(a.x, inner.x));
  if (p.x < 0.0) s = p.y >= 0.0 ? 2.0 * quarter - s : 2.0 * quarter + s;
  else if (p.y < 0.0) s = 4.0 * quarter - s;
  return s / max(4.0 * quarter, 0.0001);
}

float lobe(float position, float center) {
  float gap = abs(fract(position - center + 0.5) - 0.5);
  return 1.0 - smoothstep(uWindow.x, uWindow.x + uWindow.y, gap);
}

void main() {
  vec2 p = gl_FragCoord.xy - uCenter;
  float d = roundedBox(p, uHalf, uRadius);
  float position = loopPosition(p, uHalf, uRadius);
  float key = lobe(position, uSpot);
  float back = lobe(position, uSpot + 0.5);
  float streak = key + back * 0.45;
  float width = max(uThickness * uPx * mix(1.0, max(key, back), 0.6), 0.35);
  float band = smoothstep(-width - 0.6, -width + 0.6, d) * (1.0 - smoothstep(-0.6, 0.6, d));
  float hair = smoothstep(-uPx - 0.6, -uPx + 0.6, d) * (1.0 - smoothstep(-0.6, 0.6, d));
  float inside = 1.0 - smoothstep(-0.6, 0.6, d);
  vec2 pool = (p - uEntry) / (uHalf.y * vec2(1.6, 1.1));
  float glow = streak * 0.2 * exp(-abs(d + width * 0.5) / (5.0 * uPx)) + inside * 0.08 * exp(-dot(pool, pool));
  float light = clamp((band * streak + glow * uGlow) * uIntensity, 0.0, 1.0);
  vec4 base = vec4(uBaseColor, 1.0) * hair * 0.6;
  outColor = vec4(uLineColor, 1.0) * light + base * (1.0 - light);
}`;

  const UNIFORMS = ['uCenter', 'uHalf', 'uRadius', 'uPx', 'uSpot', 'uEntry', 'uLineColor', 'uBaseColor', 'uIntensity', 'uWindow', 'uThickness', 'uGlow'];

  const DEFAULTS = {
    lineColor: [1, 1, 1],
    baseColor: [0.42, 0.40, 0.52],
    intensity: 1,
    shineSize: 10,
    shineFade: 34,
    thickness: 1.2,
    glow: 1,
    speed: 1.1
  };

  const wrap = value => value - Math.floor(value);

  const rimPoint = (position, halfX, halfY, r) => {
    const innerX = halfX - r;
    const innerY = halfY - r;
    const arc = (Math.PI / 2) * r;
    const quarter = innerX + innerY + arc;
    let s = wrap(position) * 4 * quarter;
    let signX = 1;
    let signY = 1;
    if (s > 3 * quarter) {
      s = 4 * quarter - s;
      signY = -1;
    } else if (s > 2 * quarter) {
      s -= 2 * quarter;
      signX = -1;
      signY = -1;
    } else if (s > quarter) {
      s = 2 * quarter - s;
      signX = -1;
    }
    let x = innerX - (s - innerY - arc);
    let y = halfY;
    if (s <= innerY) {
      x = halfX;
      y = s;
    } else if (s <= innerY + arc) {
      const angle = (s - innerY) / Math.max(r, 0.0001);
      x = innerX + Math.cos(angle) * r;
      y = innerY + Math.sin(angle) * r;
    }
    return [x * signX, y * signY];
  };

  const setup = button => {
    const canvas = document.createElement('canvas');
    canvas.className = 'specular-button__light';
    canvas.setAttribute('aria-hidden', 'true');
    const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false });
    if (!gl) return;

    const compile = (type, source) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
      gl.deleteShader(shader);
      return null;
    };
    const vertex = compile(gl.VERTEX_SHADER, VERTEX);
    const fragment = compile(gl.FRAGMENT_SHADER, FRAGMENT);
    if (!vertex || !fragment) return;
    const program = gl.createProgram();
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.bindAttribLocation(program, 0, 'aPosition');
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;

    const uniforms = {};
    for (const name of UNIFORMS) uniforms[name] = gl.getUniformLocation(program, name);
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    const s = DEFAULTS;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const view = { width: 1, height: 1, ratio: 1, radius: 0 };
    let spot = 0.12;
    let raf = 0;
    let last = 0;
    let visible = true;

    const draw = () => {
      const { width, height } = view;
      const scaleX = canvas.width / (width + PAD * 2);
      const scaleY = canvas.height / (height + PAD * 2);
      const r = Math.min(view.radius, width / 2, height / 2);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);
      gl.uniform2f(uniforms.uCenter, (PAD + width / 2) * scaleX, (PAD + height / 2) * scaleY);
      gl.uniform2f(uniforms.uHalf, (width / 2) * scaleX, (height / 2) * scaleY);
      gl.uniform1f(uniforms.uRadius, r * scaleX);
      gl.uniform1f(uniforms.uPx, view.ratio);
      const [rimX, rimY] = rimPoint(spot, width / 2, height / 2, r);
      const pull = 1 - Math.min(0.35 * (height / 2), Math.hypot(rimX, rimY)) / Math.max(Math.hypot(rimX, rimY), 0.0001);
      gl.uniform1f(uniforms.uSpot, spot);
      gl.uniform2f(uniforms.uEntry, rimX * pull * scaleX, rimY * pull * scaleY);
      gl.uniform3fv(uniforms.uLineColor, s.lineColor);
      gl.uniform3fv(uniforms.uBaseColor, s.baseColor);
      gl.uniform1f(uniforms.uIntensity, s.intensity);
      gl.uniform2f(uniforms.uWindow, s.shineSize / 360, s.shineFade / 360 + 0.0001);
      gl.uniform1f(uniforms.uThickness, s.thickness);
      gl.uniform1f(uniforms.uGlow, s.glow);
      gl.bindVertexArray(vao);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindVertexArray(null);
    };

    const frame = now => {
      raf = 0;
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;
      spot = wrap(spot + (s.speed / TAU) * dt);
      draw();
      if (visible && !reduce) raf = requestAnimationFrame(frame);
      else last = 0;
    };
    const wake = () => { if (!raf) raf = requestAnimationFrame(frame); };

    const measure = () => {
      view.width = Math.max(1, button.offsetWidth);
      view.height = Math.max(1, button.offsetHeight);
      view.radius = parseFloat(getComputedStyle(button).borderTopLeftRadius) || 0;
      view.ratio = Math.min(window.devicePixelRatio || 1, 3);
      canvas.width = Math.max(1, Math.round((view.width + PAD * 2) * view.ratio));
      canvas.height = Math.max(1, Math.round((view.height + PAD * 2) * view.ratio));
      draw();
      wake();
    };

    button.prepend(canvas);
    new ResizeObserver(measure).observe(button);
    new IntersectionObserver(entries => {
      visible = entries.some(entry => entry.isIntersecting);
      if (visible) {
        last = 0;
        wake();
      }
    }).observe(button);
    measure();
  };

  document.querySelectorAll('.specular-button').forEach(setup);
})();

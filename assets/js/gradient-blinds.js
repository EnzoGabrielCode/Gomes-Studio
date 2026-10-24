// Fundo do hero: Gradient Blinds (React Bits) em JS puro. As persianas abrem na
// entrada, balançam e uma luz passeia sozinha por elas, sem seguir o mouse.
// Sem WebGL 2, a imagem da cortina em CSS continua aparecendo.
(() => {
  const hero = document.querySelector('.hero');
  if (!hero) return;

  const SETTINGS = {
    colors: ['#6e2a4c', '#4a3d9e'],
    angle: 0,
    noise: 0.12,
    blindCount: 16,
    blindMinWidth: 60,
    spotlightRadius: 0.6,
    spotlightSoftness: 1,
    spotlightOpacity: 0.8,
    shine: 0.4,
    relief: 0.5,
    glow: 0.4,
    sway: 0.35,
    speed: 1,
    lightColor: [1, 1, 1],
    damping: 0.15
  };
  const INTRO_SECONDS = 1.8;

  const VERTEX = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

  const FRAGMENT = `#version 300 es
precision highp float;
precision highp int;

uniform vec2 uResolution;
uniform float uTime;
uniform vec2 uMouse;
uniform float uAngle;
uniform float uNoise;
uniform float uBlindCount;
uniform float uSpotlightRadius;
uniform float uSpotlightSoftness;
uniform float uSpotlightOpacity;
uniform float uMirror;
uniform float uDistort;
uniform float uShineFlip;
uniform vec3 uColors[8];
uniform int uColorCount;
uniform float uLightMode;
uniform float uShine;
uniform float uRelief;
uniform float uGlow;
uniform float uSway;
uniform float uSwayTime;
uniform float uHover;
uniform vec4 uWaves[4];
uniform float uIntro;
uniform float uGrainTime;
uniform vec3 uLightColor;
uniform float uPerspective;
uniform float uGradientShift;

out vec4 outColor;

float hash(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}

vec2 rotate2D(vec2 p, float a) {
  float c = cos(a);
  float s = sin(a);
  return mat2(c, -s, s, c) * p;
}

vec2 blindSpace(vec2 uv0) {
  float aspect = uResolution.x / uResolution.y;
  vec2 p = uv0 * 2.0 - 1.0;
  p.x *= aspect;
  vec2 pr = rotate2D(p, uAngle);
  pr.x /= aspect;
  vec2 uv = pr * 0.5 + 0.5;
  if (abs(uPerspective) > 0.001) {
    float k = uPerspective * 2.2;
    uv.x = (exp(k * uv.x) - 1.0) / (exp(k) - 1.0);
  }
  if (uDistort > 0.0) {
    float a = uv.y * 6.0;
    float b = uv.x * 6.0;
    float w = 0.01 * uDistort;
    uv.x += sin(a) * w;
    uv.y += cos(b) * w;
  }
  return uv;
}

vec3 gradientColor(float t) {
  float tt = clamp(t, 0.0, 1.0);
  int count = max(uColorCount, 2);
  float scaled = tt * float(count - 1);
  int seg = min(int(floor(scaled)), count - 2);
  float f = scaled - float(seg);
  if (tt >= 1.0) return uColors[count - 1];
  return mix(uColors[seg], uColors[seg + 1], f);
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 uv0 = frag / uResolution;
  vec2 uvMod = blindSpace(uv0);

  float count = max(uBlindCount, 1.0);
  float stripePhase = uvMod.x * count;
  float pixel = max(fwidth(stripePhase), 1e-5);

  float t = uvMod.x;
  if (uGradientShift != 0.0) {
    t = 1.0 - abs(1.0 - fract((t + uGradientShift) * 0.5) * 2.0);
  }
  if (uMirror > 0.5) {
    t = 1.0 - abs(1.0 - 2.0 * fract(t));
  }
  vec3 base = gradientColor(t);

  vec2 offset = uMouse / uResolution;
  float d = length(uv0 - offset);
  float r = max(uSpotlightRadius, 1e-4);
  float spot = (1.0 - 2.0 * pow(d / r, uSpotlightSoftness)) * uSpotlightOpacity;

  float slat = floor(stripePhase);
  float s = stripePhase - slat;
  float stripeAA = clamp(count * 1.25 / min(uResolution.x, uResolution.y), 0.001, 0.12);
  float edgeBlend = 1.0 - smoothstep(0.0, stripeAA, min(s, 1.0 - s));
  float across = mix(s, 0.5, edgeBlend);
  float ramp = uShineFlip > 0.5 ? 1.0 - across : across;

  float unit = min(uResolution.x, uResolution.y);
  float reach = max(uSpotlightRadius, 0.05) * unit;
  vec2 toLight = uMouse - frag;
  float nearLight = exp(-dot(toLight, toLight) / (reach * reach));

  float tilt = 0.0;
  float pulse = 0.0;
  if (uSway > 0.0) {
    tilt += uSway * 0.5 * sin(uSwayTime * 0.9 + slat * 0.55) * (0.6 + 0.4 * sin(uSwayTime * 0.37 + slat * 0.21));
  }
  tilt += uHover * nearLight * 0.7;
  float aspect = uResolution.x / uResolution.y;
  for (int i = 0; i < 4; i++) {
    vec4 wave = uWaves[i];
    if (wave.w <= 0.0) continue;
    float age = uTime - wave.z;
    if (age < 0.0 || age > 1.60) continue;
    float life = age / 1.60;
    vec2 origin = blindSpace(wave.xy / uResolution);
    float slats = abs(slat + 0.5 - origin.x * count);
    float front = age * max(count, 4.0) * 0.95;
    float k = (slats - front) / (0.8 + life * 1.2);
    float along = (uvMod.y - origin.y) / max(0.42 + life * 0.5, 0.01);
    float fade = (1.0 - life) * (1.0 - life);
    float ring = exp(-k * k) * exp(-along * along) * fade * smoothstep(0.0, 0.2, age);
    tilt += ring * 0.9;
    pulse += ring;
  }
  if (uIntro < 1.0) {
    float settle = smoothstep(0.0, 1.0, clamp(uIntro * 1.5 - uv0.x * 0.5, 0.0, 1.0));
    tilt -= (1.0 - settle) * 1.2;
  }

  float edge = ramp;
  float calm = 1.0 - 0.6 * clamp(spot, 0.0, 1.0);
  ramp = pow(clamp(ramp, 0.0, 1.0), exp(tilt * 0.9));
  ramp *= 1.0 - 0.3 * min(pulse, 1.0) * calm;
  float crease = uRelief * 0.38 * smoothstep(0.62, 1.0, ramp);
  float sheen = uShine * exp(-pow((edge - 0.035) / 0.07, 2.0)) * (0.3 + 0.7 * nearLight) * (1.0 - edgeBlend);

  vec3 lit = spot > 0.0 ? uLightColor * spot : vec3(spot);
  lit += uLightColor * min(pulse, 1.0) * 0.35 * calm;
  vec3 revealSignal = lit + base - vec3(ramp + crease);

  vec3 col;
  if (uLightMode > 0.5) {
    vec3 luma = vec3(0.2126, 0.7152, 0.0722);
    float peak = max(base.r, max(base.g, base.b));
    float low = min(base.r, min(base.g, base.b));
    float chroma = (peak - low) / max(peak, 0.0001);
    vec3 hue = base / max(peak, 0.0001);
    hue = clamp(mix(vec3(dot(hue, luma)), hue, 1.3), 0.0, 1.0);
    hue *= mix(1.0, 0.82, smoothstep(0.55, 0.9, dot(hue, luma)));
    vec3 tint = mix(base, hue, smoothstep(0.06, 0.28, chroma));
    vec3 revealed = clamp(revealSignal, 0.0, 1.0);
    float coverage = max(revealed.r, max(revealed.g, revealed.b));
    float stroke = 1.0 - smoothstep(pixel, pixel * 2.2, edge);
    col = mix(vec3(1.0), tint, 0.72 * smoothstep(0.0, 1.0, coverage));
    col = mix(col, tint * 0.85, stroke * clamp(coverage * 1.5, 0.0, 1.0) * 0.7);
    col = mix(col, vec3(1.0), clamp(sheen, 0.0, 1.0) * 0.5);
    float grain = max(0.5 * (hash(frag + uGrainTime) + hash(frag.yx + uGrainTime * 1.7)) - 0.5, 0.0);
    col = clamp(col - vec3(grain * uNoise * 0.12 * coverage), 0.0, 1.0);
  } else {
    vec3 haze = base * uGlow * 0.4 * smoothstep(0.0, 1.0, spot) * (0.4 + 0.6 * ramp);
    col = revealSignal + haze + mix(base, uLightColor, 0.45) * sheen * 0.7;
    vec3 over = max(col - 0.8, 0.0);
    col = min(col, vec3(0.8)) + 0.2 * (1.0 - exp(-over / 0.2));
    float luma = dot(clamp(col, 0.0, 1.0), vec3(0.2126, 0.7152, 0.0722));
    float grain = 0.5 * (hash(frag + uGrainTime) + hash(frag.yx + uGrainTime * 1.7)) - 0.5;
    col += grain * uNoise * (0.45 + 0.55 * smoothstep(0.0, 0.5, luma));
  }

  float presence = smoothstep(0.0, 0.65, uIntro);
  col = uLightMode > 0.5 ? mix(vec3(1.0), col, presence) : col * presence;
  outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

  const canvas = document.createElement('canvas');
  canvas.className = 'hero-bg';
  canvas.setAttribute('aria-hidden', 'true');
  const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false });
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
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
  const u = {};
  const total = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < total; i++) {
    const name = gl.getActiveUniform(program, i).name.replace(/\[0\]$/, '');
    u[name] = gl.getUniformLocation(program, name);
  }
  const vao = gl.createVertexArray();

  const hexToRGB = hex => {
    const c = hex.replace('#', '');
    return [0, 2, 4].map(i => parseInt(c.slice(i, i + 2), 16) / 255);
  };
  const stops = new Float32Array(8 * 3);
  for (let i = 0; i < 8; i++) stops.set(hexToRGB(SETTINGS.colors[Math.min(i, SETTINGS.colors.length - 1)]), i * 3);

  const s = SETTINGS;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const view = { width: 1, height: 1, ratio: 1 };
  const light = { x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0, ready: false };
  const waves = new Float32Array(16);
  let time = 0;
  let swayTime = 0;
  let grainTime = 0;
  let introClock = reduce ? 1 : 0;
  let raf = 0;
  let last = 0;
  let visible = true;

  const blindTotal = () => Math.max(1, Math.min(s.blindCount, Math.floor(view.width / s.blindMinWidth)));

  const draw = () => {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(program);
    gl.bindVertexArray(vao);
    gl.uniform2f(u.uResolution, canvas.width, canvas.height);
    gl.uniform1f(u.uTime, time);
    gl.uniform2f(u.uMouse, light.x * view.ratio, (view.height - light.y) * view.ratio);
    gl.uniform1f(u.uAngle, (s.angle * Math.PI) / 180);
    gl.uniform1f(u.uNoise, s.noise);
    gl.uniform1f(u.uBlindCount, blindTotal());
    gl.uniform1f(u.uSpotlightRadius, s.spotlightRadius);
    gl.uniform1f(u.uSpotlightSoftness, s.spotlightSoftness);
    gl.uniform1f(u.uSpotlightOpacity, s.spotlightOpacity);
    gl.uniform1f(u.uMirror, 0);
    gl.uniform1f(u.uDistort, 0);
    gl.uniform1f(u.uShineFlip, 0);
    gl.uniform3fv(u.uColors, stops);
    gl.uniform1i(u.uColorCount, Math.max(2, s.colors.length));
    gl.uniform1f(u.uLightMode, 0);
    gl.uniform1f(u.uShine, s.shine);
    gl.uniform1f(u.uRelief, s.relief);
    gl.uniform1f(u.uGlow, s.glow);
    gl.uniform1f(u.uSway, reduce ? 0 : s.sway);
    gl.uniform1f(u.uSwayTime, swayTime);
    gl.uniform1f(u.uHover, 0);
    gl.uniform4fv(u.uWaves, waves);
    gl.uniform1f(u.uIntro, introClock);
    gl.uniform1f(u.uGrainTime, grainTime);
    gl.uniform3fv(u.uLightColor, s.lightColor);
    gl.uniform1f(u.uPerspective, 0);
    gl.uniform1f(u.uGradientShift, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  };

  // a luz passeia sozinha (modo "drift" do original), com uma mola suavizando o caminho
  const aim = () => {
    light.tx = view.width * (0.5 + 0.22 * Math.sin(swayTime * 0.23) + 0.05 * Math.sin(swayTime * 0.61 + 1.3));
    light.ty = view.height * (0.42 + 0.16 * Math.sin(swayTime * 0.31 + 0.7) + 0.04 * Math.sin(swayTime * 0.83));
  };
  const follow = dt => {
    const omega = 2.4 / s.damping;
    const k = omega * omega;
    const c = 2 * omega;
    const steps = Math.max(1, Math.ceil(dt / 0.008));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      light.vx += (k * (light.tx - light.x) - c * light.vx) * h;
      light.vy += (k * (light.ty - light.y) - c * light.vy) * h;
      light.x += light.vx * h;
      light.y += light.vy * h;
    }
  };

  const frame = now => {
    raf = 0;
    if (!visible || document.hidden) return;
    const dt = last ? Math.min(Math.max((now - last) / 1000, 0.001), 1 / 20) : 1 / 60;
    last = now;
    time += dt;
    if (!reduce) swayTime += dt * s.speed;
    grainTime = Math.floor(time * 24) * 17.13;
    if (introClock < 1) introClock = Math.min(1, introClock + dt / INTRO_SECONDS);
    if (!reduce) {
      aim();
      follow(dt);
    }
    draw();
    if (!reduce || introClock < 1) raf = requestAnimationFrame(frame);
  };
  const wake = () => {
    if (!raf && visible && !document.hidden) {
      last = 0;
      raf = requestAnimationFrame(frame);
    }
  };

  const resize = () => {
    view.width = Math.max(1, hero.clientWidth);
    view.height = Math.max(1, hero.clientHeight);
    view.ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(view.width * view.ratio);
    canvas.height = Math.round(view.height * view.ratio);
    if (!light.ready) {
      light.ready = true;
      light.x = light.tx = view.width / 2;
      light.y = light.ty = view.height / 2;
    }
    draw();
    wake();
  };

  hero.prepend(canvas);
  new ResizeObserver(resize).observe(hero);
  new IntersectionObserver(entries => {
    visible = entries.some(entry => entry.isIntersecting);
    if (visible) wake();
  }).observe(hero);
  document.addEventListener('visibilitychange', wake);
  resize();
  canvas.classList.add('is-ready');
})();

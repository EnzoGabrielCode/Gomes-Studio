// Cortina animada do hero (WebGL). A imagem da cortina vira textura e ganha
// balanço nas dobras e uma luz que passeia sozinha pelo tecido, sem seguir o mouse.
// Sem WebGL, o fundo estático em CSS continua aparecendo.
(() => {
  const hero = document.querySelector('.hero');
  if (!hero) return;

  const canvas = document.createElement('canvas');
  canvas.className = 'hero-bg';
  canvas.setAttribute('aria-hidden', 'true');
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false, premultipliedAlpha: false });
  if (!gl) return;

  const VERTEX = `
attribute vec2 aPosition;
void main(){ gl_Position = vec4(aPosition, 0.0, 1.0); }`;

  const FRAGMENT = `
precision highp float;
uniform sampler2D uTex;
uniform vec2 uRes;
uniform vec2 uImg;
uniform float uTime;

vec3 sampleCover(vec2 p){
  // mesmo enquadramento do CSS: center top / cover
  float scale = max(uRes.x / uImg.x, uRes.y / uImg.y);
  vec2 size = uImg * scale;
  vec2 uv = vec2((p.x - (uRes.x - size.x) * 0.5) / size.x, p.y / size.y);
  return texture2D(uTex, clamp(uv, 0.001, 0.999)).rgb;
}

float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

void main(){
  float t = uTime;
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);   // px, y para baixo
  vec2 n = p / uRes;
  float aspect = uRes.x / uRes.y;

  // balanço da cortina: mais forte embaixo, como tecido preso no alto
  float sway = 0.25 + 0.75 * n.y;
  float dx = sin(p.y * 0.004 + t * 0.55 + p.x * 0.0021) * 7.0
           + sin(p.x * 0.011 - t * 0.33) * 4.0;
  vec3 col = sampleCover(p + vec2(dx * sway, 0.0));

  // dobras que respiram
  float fold = sin(p.x * 0.042 + sin(p.y * 0.0028 + t * 0.45) * 2.2 + t * 0.35)
             * 0.6 + sin(p.x * 0.017 - t * 0.21) * 0.4;
  col *= 1.0 + 0.16 * fold * sway;

  // brilhos vinho e índigo que flutuam devagar
  vec2 c1 = vec2(0.30 + 0.14 * sin(t * 0.11), 0.88 + 0.07 * sin(t * 0.17));
  vec2 c2 = vec2(0.72 + 0.12 * sin(t * 0.13 + 1.7), 0.72 + 0.10 * sin(t * 0.19 + 0.6));
  vec2 d1 = (n - c1) * vec2(aspect, 1.0);
  vec2 d2 = (n - c2) * vec2(aspect, 1.0);
  col += vec3(0.20, 0.06, 0.11) * exp(-dot(d1, d1) * 3.5) * 0.35;
  col += vec3(0.10, 0.10, 0.24) * exp(-dot(d2, d2) * 4.0) * 0.35;

  // feixe de luz que passeia pelo tecido sozinho
  vec2 s = vec2(0.5 + 0.38 * sin(t * 0.16) + 0.06 * sin(t * 0.41), 0.55 + 0.18 * sin(t * 0.23 + 0.8));
  float bx = (n.x - s.x) * aspect;
  float beam = exp(-bx * bx * 9.0) * exp(-pow(n.y - s.y, 2.0) * 2.2);
  col += vec3(0.42, 0.36, 0.62) * beam * (0.05 + 0.04 * fold);

  // grão de filme
  col += (hash(p + fract(t) * 91.7) - 0.5) * 0.022;

  gl_FragColor = vec4(col, 1.0);
}`;

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
  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const uRes = gl.getUniformLocation(program, 'uRes');
  const uImg = gl.getUniformLocation(program, 'uImg');
  const uTime = gl.getUniformLocation(program, 'uTime');

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let raf = 0;
  let visible = true;
  let ready = false;
  const start = performance.now() - 20000; // começa já no meio do movimento

  const draw = now => {
    raf = 0;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uTime, (now - start) / 1000);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (!reduce && visible) raf = requestAnimationFrame(draw);
  };
  const wake = () => { if (ready && !raf) raf = requestAnimationFrame(draw); };

  const resize = () => {
    // a cortina é desfocada; meia resolução basta e poupa a GPU
    const ratio = Math.min(window.devicePixelRatio || 1, 2) * 0.5;
    canvas.width = Math.max(1, Math.round(hero.clientWidth * ratio));
    canvas.height = Math.max(1, Math.round(hero.clientHeight * ratio));
    wake();
  };

  const img = new Image();
  img.onload = () => {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform2f(uImg, img.naturalWidth, img.naturalHeight);

    hero.prepend(canvas);
    ready = true;
    resize();
    new ResizeObserver(resize).observe(hero);
    new IntersectionObserver(entries => {
      visible = entries.some(entry => entry.isIntersecting);
      if (visible) wake();
    }).observe(hero);
    requestAnimationFrame(() => canvas.classList.add('is-ready'));
  };
  img.src = 'assets/img/hero-cortina.webp';
})();

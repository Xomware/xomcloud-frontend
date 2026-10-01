// The sky: three sheets of cloud at different depths, lit from behind by a low warm light.
// A fragment shader, because vapour needs per-pixel noise and lighting that a sprite can't fake,
// and a phone GPU does this at a reduced resolution with room to spare.

export interface CloudFrame {
  time: number;
  light: number;
  enter: number;
  inhale: number;
  blast: number;
  shake: number;
}

const VERTEX = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAGMENT = `
precision highp float;
varying vec2 vUv;
uniform vec2 uRes;
uniform float uTime;
uniform float uLight;
uniform float uEnter;
uniform float uInhale;
uniform float uBlast;
uniform float uShake;

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

const mat2 ROT = mat2(1.6, 1.2, -1.2, 1.6);

float fbm(vec2 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 6; i++) {
    s += a * noise(p);
    p = ROT * p;
    a *= 0.5;
  }
  return s;
}

// Density of one sheet at p. Cumulus come from thresholding warped fbm: the warp rolls the
// edges into billows, the threshold gives them a defined but soft boundary.
float sheet(vec2 p, float cover) {
  vec2 w = vec2(noise(p * 0.7 + 3.1), noise(p * 0.7 + 8.7)) - 0.5;
  float n = fbm(p + w * 0.9);
  return clamp((n - (1.0 - cover)) * 4.5, 0.0, 1.0);
}

void main() {
  float aspect = uRes.x / uRes.y;
  // y grows downward, as on the page.
  vec2 p = (vec2(vUv.x, 1.0 - vUv.y) - 0.5) * vec2(aspect, 1.0);
  p.y += uShake;
  vec2 sun = vec2(0.0, 0.0);
  float r = length((p - sun) * vec2(1.0, 1.25));

  vec3 col = mix(vec3(0.016, 0.02, 0.04), vec3(0.05, 0.058, 0.09), smoothstep(-0.5, 0.5, p.y));
  float glow = uLight * (1.2 * exp(-r * 14.0) + 0.5 * exp(-r * 4.0) + 0.08 * exp(-r * 1.5));
  col += vec3(1.0, 0.86, 0.72) * uLight * 0.9 * exp(-r * 30.0);
  col += mix(vec3(0.28, 0.2, 0.28), vec3(1.0, 0.7, 0.48), exp(-r * 3.0)) * glow;
  float prox = exp(-r * 3.2);

  // far, mid, near. Each moves at its own speed (parallax), grows as the camera pushes in,
  // and clears outward from the centre on the drop, the nearest fastest.
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float depth = 0.35 + fi * 0.33;
    float scale = 4.2 - fi * 1.3;
    float zoom = 1.0 + 0.3 * (1.0 - uEnter) * depth - 0.03 * uInhale * depth + 0.05 * uTime * depth
      + uBlast * depth * depth * 1.4;
    vec2 q = p / zoom;
    vec2 off = vec2(uTime * (0.02 + 0.05 * depth) * (mod(fi, 2.0) * 2.0 - 1.0), fi * 7.3);
    float band;
    if (i == 0) band = 0.3 + 0.36 * smoothstep(0.12, 0.26, q.y) * smoothstep(0.7, 0.32, q.y);
    else if (i == 1) band = 0.34 + 0.1 * smoothstep(0.4, 0.0, length(q));
    else band = 0.2 + 0.36 * smoothstep(0.22, 0.55, abs(q.y))
      + 0.2 * smoothstep(0.45, 0.9, abs(q.x) / aspect * 1.6);
    float reach = uBlast * (i == 0 ? 0.2 : 0.3 + depth * depth * 1.6);
    float cover = band * smoothstep(reach - 0.3, reach, length(q * vec2(0.75, 1.0)));

    vec2 sp = q * scale + off;
    float d = sheet(sp, cover);
    if (d <= 0.0) continue;
    vec2 toSun = normalize(sun - q + 1e-4);
    float dl = sheet(sp + toSun * 0.06, cover);

    float trans = exp(-d * 4.0);
    float edge = clamp((d - dl) * 3.0, 0.0, 1.0);
    float top = clamp(0.5 + (d - sheet(sp + vec2(0.0, -0.08), cover)) * 2.0, 0.0, 1.0);
    vec3 body = mix(vec3(0.03, 0.035, 0.055), vec3(0.15, 0.165, 0.22), top * (1.0 - fi * 0.2));
    vec3 lit = vec3(1.0, 0.6, 0.36) * uLight * prox * (trans * 1.1 + edge * 0.9)
      + vec3(1.0, 0.88, 0.76) * uLight * pow(prox, 4.0) * trans * 1.4;
    vec3 cloud = body + lit;
    // Atmospheric perspective: the far sheet sits in more air, so it leans toward the sky.
    cloud = mix(cloud, col, 0.32 * (1.0 - depth));
    float alpha = smoothstep(0.0, 0.3, d) * uEnter;
    col = mix(col, cloud, alpha);
  }

  col = 1.0 - exp(-col * 1.35);
  gl_FragColor = vec4(col, 1.0);
}`;

export function createClouds(canvas: HTMLCanvasElement): ((f: CloudFrame) => void) | null {
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false });
  if (!gl) return null;
  const program = gl.createProgram()!;
  for (const [type, src] of [
    [gl.VERTEX_SHADER, VERTEX],
    [gl.FRAGMENT_SHADER, FRAGMENT],
  ] as const) {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return null;
    gl.attachShader(program, shader);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);

  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const pos = gl.getAttribLocation(program, 'aPos');
  gl.enableVertexAttribArray(pos);
  gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

  const u = (name: string): WebGLUniformLocation | null => gl.getUniformLocation(program, name);
  const res = u('uRes');
  const time = u('uTime');
  const light = u('uLight');
  const enter = u('uEnter');
  const inhale = u('uInhale');
  const blast = u('uBlast');
  const shake = u('uShake');

  return (f) => {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(res, canvas.width, canvas.height);
    gl.uniform1f(time, f.time);
    gl.uniform1f(light, f.light);
    gl.uniform1f(enter, f.enter);
    gl.uniform1f(inhale, f.inhale);
    gl.uniform1f(blast, f.blast);
    gl.uniform1f(shake, f.shake);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
}

import { useEffect, useRef } from "react";
import {
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  Vector4,
  WebGLRenderer,
} from "three";
import type { Mood } from "../content/types";

/**
 * Full-screen shader overlay (mix-blend-mode: screen) that dresses the video
 * renders: a fiery sun glow with slowly wheeling god rays for the sunlit
 * moods, and a twinkling star field for midnight. Everything is positioned
 * in the *video's* UV space — the crop uniform replicates the backdrop's
 * `object-fit: cover; object-position: 63%` so effects stay pinned to the
 * rendered sun/sky as the viewport resizes. Mood changes ease all parameters
 * over ~0.9s, matching the video crossfade.
 *
 * Sun positions / star masks were measured off the poster frames:
 * sunrise sun at uv(0.04, 0.27) (big disc), golden hour at uv(0.935, 0.36)
 * (small disc), high noon off-frame above, midnight machine body spanning
 * roughly x 0.45–0.67 below y 0.18 (stars are masked off it).
 */

const SRC_ASPECT = 16 / 9;

interface FxParams {
  sun: [number, number]; // aspect-corrected source uv: x in [0, 16/9], y down
  sunRadius: number;
  glowColor: [number, number, number];
  glow: number;
  rays: number;
  rayColor: [number, number, number];
  stars: number;
  flicker: number;
}

const FX_BY_MOOD: Record<Mood, FxParams> = {
  sunrise: {
    sun: [0.04 * SRC_ASPECT, 0.27],
    sunRadius: 0.2,
    glowColor: [1.0, 0.58, 0.28],
    glow: 0.5,
    rays: 0.42,
    rayColor: [1.0, 0.52, 0.3],
    stars: 0,
    flicker: 0.5,
  },
  "high-noon": {
    sun: [0.5 * SRC_ASPECT, -0.32],
    sunRadius: 0.35,
    glowColor: [1.0, 0.97, 0.88],
    glow: 0.2,
    rays: 0.14,
    rayColor: [0.93, 0.96, 1.0],
    stars: 0,
    flicker: 0.15,
  },
  "golden-hour": {
    sun: [0.935 * SRC_ASPECT, 0.36],
    sunRadius: 0.065,
    glowColor: [1.0, 0.42, 0.12],
    glow: 0.8,
    rays: 0.6,
    rayColor: [1.0, 0.48, 0.16],
    stars: 0,
    flicker: 1,
  },
  midnight: {
    sun: [0.5 * SRC_ASPECT, 0.5],
    sunRadius: 0.05,
    glowColor: [0, 0, 0],
    glow: 0,
    rays: 0,
    rayColor: [0, 0, 0],
    stars: 1,
    flicker: 0,
  },
};

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform vec4 uCrop;      // offsetX, offsetY, fracX, fracY: screen uv -> source uv
  uniform vec2 uSun;
  uniform float uSunRadius;
  uniform vec3 uGlowColor;
  uniform float uGlow;
  uniform float uRays;
  uniform vec3 uRayColor;
  uniform float uStars;
  uniform float uFlicker;

  varying vec2 vUv;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  void main() {
    vec2 screen = vec2(vUv.x, 1.0 - vUv.y);                       // y down
    vec2 su = uCrop.xy + screen * uCrop.zw;                       // source uv
    vec2 p = vec2(su.x * ${SRC_ASPECT.toFixed(4)}, su.y);          // aspect space
    vec3 col = vec3(0.0);

    // --- sun glow + god rays ---
    if (uGlow > 0.001) {
      vec2 d = p - uSun;
      float dist = length(d);
      float flick = 1.0 + uFlicker * (0.05 * sin(uTime * 3.1)
                                    + 0.03 * sin(uTime * 5.7 + 1.3)
                                    + 0.02 * sin(uTime * 9.3 + 4.1));

      float core = exp(-pow(max(dist - uSunRadius, 0.0) / (uSunRadius * 0.8 + 0.05), 1.6) * 3.0);
      float halo = exp(-dist * 2.2);

      float ang = atan(d.y, d.x);
      float r1 = sin(ang * 11.0 + uTime * 0.13);
      float r2 = sin(ang * 17.0 - uTime * 0.09 + 2.0);
      float r3 = sin(ang * 5.0 + uTime * 0.05 + 4.0);
      float rays = pow(max(0.0, 0.55 * r1 + 0.30 * r2 + 0.35 * r3), 2.0);
      float rayFall = exp(-dist * 1.4) * smoothstep(uSunRadius * 0.4, uSunRadius * 1.1, dist);

      col += uGlowColor * (core * 0.85 + halo * 0.35) * uGlow * flick;
      col += uRayColor * rays * rayFall * uRays * flick;
    }

    // --- twinkling stars (midnight) ---
    if (uStars > 0.001) {
      float skyMask = 1.0 - smoothstep(0.30, 0.40, su.y);
      float inMachine = step(0.452, su.x) * step(su.x, 0.672) * step(0.175, su.y);
      skyMask *= 1.0 - inMachine;
      if (skyMask > 0.0) {
        vec2 grid = p * 42.0;
        vec2 cell = floor(grid);
        float h = hash21(cell);
        if (h > 0.82) {
          vec2 starPos = vec2(hash21(cell + 7.1), hash21(cell + 3.7));
          float sd = length(fract(grid) - starPos);
          float tw = 0.55 + 0.45 * sin(uTime * (0.6 + 2.4 * hash21(cell + 9.3))
                                       + hash21(cell + 5.5) * 6.2831);
          float star = exp(-sd * sd * 90.0) * tw;
          float bright = 0.35 + 0.65 * hash21(cell + 1.9);
          col += vec3(0.9, 0.95, 1.0) * star * bright * skyMask * uStars;
        }
      }
    }

    gl_FragColor = vec4(col, 1.0);
  }
`;

/** screen uv -> source uv transform for object-fit: cover at 63% horizontal. */
function coverCrop(width: number, height: number): [number, number, number, number] {
  const vpAspect = width / height;
  if (vpAspect < SRC_ASPECT) {
    const fracX = vpAspect / SRC_ASPECT;
    return [(1 - fracX) * 0.63, 0, fracX, 1];
  }
  const fracY = SRC_ASPECT / vpAspect;
  return [0, (1 - fracY) * 0.5, 1, fracY];
}

export function EffectsOverlay({ mood }: { mood: Mood }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const moodRef = useRef(mood);
  moodRef.current = mood;

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

    const start = FX_BY_MOOD[moodRef.current];
    const uniforms = {
      uTime: { value: 0 },
      uCrop: { value: new Vector4(...coverCrop(window.innerWidth, window.innerHeight)) },
      uSun: { value: new Vector2(...start.sun) },
      uSunRadius: { value: start.sunRadius },
      uGlowColor: { value: new Vector3(...start.glowColor) },
      uGlow: { value: start.glow },
      uRays: { value: start.rays },
      uRayColor: { value: new Vector3(...start.rayColor) },
      uStars: { value: start.stars },
      uFlicker: { value: start.flicker },
    };

    const scene = new Scene();
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const geometry = new PlaneGeometry(2, 2);
    const material = new ShaderMaterial({ uniforms, vertexShader, fragmentShader });
    scene.add(new Mesh(geometry, material));

    const resize = () => {
      renderer.setSize(window.innerWidth, window.innerHeight, false);
      uniforms.uCrop.value.set(...coverCrop(window.innerWidth, window.innerHeight));
    };
    resize();
    window.addEventListener("resize", resize);

    let last = performance.now();
    renderer.setAnimationLoop((now) => {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      // ease all params toward the active mood, matching the video crossfade
      const k = 1 - Math.exp(-dt / 0.35);
      const t = FX_BY_MOOD[moodRef.current];
      uniforms.uSun.value.lerp(new Vector2(...t.sun), k);
      uniforms.uGlowColor.value.lerp(new Vector3(...t.glowColor), k);
      uniforms.uRayColor.value.lerp(new Vector3(...t.rayColor), k);
      uniforms.uSunRadius.value += (t.sunRadius - uniforms.uSunRadius.value) * k;
      uniforms.uGlow.value += (t.glow - uniforms.uGlow.value) * k;
      uniforms.uRays.value += (t.rays - uniforms.uRays.value) * k;
      uniforms.uStars.value += (t.stars - uniforms.uStars.value) * k;
      uniforms.uFlicker.value += (t.flicker - uniforms.uFlicker.value) * k;
      uniforms.uTime.value = now / 1000;
      renderer.render(scene, camera);
    });

    return () => {
      renderer.setAnimationLoop(null);
      window.removeEventListener("resize", resize);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, []);

  return <canvas ref={canvasRef} className="fx" aria-hidden="true" />;
}

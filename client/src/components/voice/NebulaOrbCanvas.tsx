import React, { useEffect, useRef } from "react";
import { type BotOrbTheme } from "@/lib/botOrbTheme";

const VERTEX_SHADER_SRC = `
attribute vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER_SRC = `
precision highp float;
uniform vec2 u_resolution;
uniform float u_time;
uniform vec3 u_color_primary;
uniform vec3 u_color_secondary;
uniform vec3 u_color_accent;
uniform float u_brightness;
uniform float u_speed;

float hash21(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

float smoothNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);

  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));

  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbmSmooth(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 rot = mat2(cos(0.48), sin(0.48), -sin(0.48), cos(0.48));
  for (int i = 0; i < 4; i++) {
    v += a * smoothNoise(p);
    p = rot * p * 2.05 + vec2(0.35, 0.45);
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / (0.5 * min(u_resolution.x, u_resolution.y));
  float dist = length(uv);

  if (dist > 1.0) {
    discard;
  }

  // Soft glass edge keeps the light contained in a crisp sphere.
  float edgeAlpha = 1.0 - smoothstep(0.965, 1.0, dist);

  // Smooth color falloff so energy clouds stay softly inside the glass sphere
  float colorPerimeterFade = 1.0 - smoothstep(0.72, 1.0, dist);

  // 3D spherical perspective refraction
  float z = sqrt(max(0.0, 1.0 - dist * dist));
  vec2 sphereUv = uv / (1.0 + 0.35 * z);

  // Spiral vortex twist into center eye
  float angle = atan(sphereUv.y, sphereUv.x);
  float swirlTwist = 2.4 * pow(1.0 - dist * 0.85, 1.4);
  float spiral = angle + swirlTwist + u_time * u_speed * 0.15;

  vec2 p = vec2(cos(spiral), sin(spiral)) * dist * 2.4;

  // Domain warping for silky, smoky fluid wisps and organic cloud ribbons
  vec2 q = vec2(
    fbmSmooth(p + vec2(0.8, 1.2) + u_time * u_speed * 0.08),
    fbmSmooth(p + vec2(3.1, 2.4) - u_time * u_speed * 0.07)
  );

  vec2 r = vec2(
    fbmSmooth(p + 2.8 * q + vec2(1.5, 0.0) + u_time * u_speed * 0.09),
    fbmSmooth(p + 2.8 * q + vec2(4.2, 1.9) - u_time * u_speed * 0.08)
  );

  // Silky ribbon wave modulation
  float ribbon = sin((p.x * 0.8 + p.y * 0.6 + q.x * 2.5 + r.x * 1.5) * 3.14159);
  ribbon = 0.5 + 0.5 * ribbon;

  float f = fbmSmooth(p + 2.5 * r);
  f = f * 0.65 + ribbon * 0.35;

  // A diagonal aurora current, with enough dark space to keep the sphere dimensional.
  float bias = 0.52 + 0.48 * sin(angle + 1.1) - 0.22 * uv.x * uv.y;
  float cloudDensity = clamp(f * 1.62 * (0.34 + 0.66 * bias), 0.0, 1.0) * colorPerimeterFade;

  // Midnight glass base volume.
  vec3 col = vec3(0.004, 0.008, 0.022);

  // Sapphire shadows and cyan aurora ribbons build a single signature palette.
  float secWeight = smoothstep(0.08, 0.72, cloudDensity);
  col = mix(col, u_color_secondary, secWeight);

  float primWeight = smoothstep(0.27, 0.86, cloudDensity + 0.24 * q.x);
  col = mix(col, u_color_primary, primWeight);

  // Pearl highlights trace the aurora filaments and catch a soft upper-left light.
  float coreGlow =
    pow(cloudDensity, 2.0) * (1.0 - smoothstep(0.08, 0.9, dist)) * 1.25;
  float crestGlow = pow(clamp(ribbon * q.y * 1.7, 0.0, 1.0), 3.2) * 1.35;
  float pearlGlint = pow(
    max(0.0, 1.0 - length(uv - vec2(-0.38, 0.42)) * 3.3),
    8.0
  ) * 0.6;
  col = mix(
    col,
    u_color_accent,
    clamp(coreGlow + crestGlow + pearlGlint, 0.0, 1.0)
  );

  // Fine cool rim light gives the orb a polished glass silhouette.
  float rimLight = pow(1.0 - z, 2.5) * 0.34;
  col += u_color_primary * rimLight;

  // Volumetric spherical depth and soft upper-left illumination.
  float factor = (0.62 + 0.38 * z) * u_brightness;
  col = clamp(col * factor, 0.0, 1.0);

  gl_FragColor = vec4(col, edgeAlpha);
}
`;

export function NebulaOrbCanvas({
  theme,
  size = 96,
  fill = false,
  active = false,
  activity = 0,
  className,
}: {
  theme: BotOrbTheme;
  size?: number;
  /** Stretch to fill the parent box instead of using a fixed pixel size. */
  fill?: boolean;
  active?: boolean;
  activity?: number;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const themeRef = useRef(theme);
  themeRef.current = theme;

  const activeRef = useRef(active);
  activeRef.current = active;

  const activityRef = useRef(activity);
  activityRef.current = activity;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let gl: WebGLRenderingContext | null = null;
    let program: WebGLProgram | null = null;
    let vs: WebGLShader | null = null;
    let fs: WebGLShader | null = null;
    let positionBuffer: WebGLBuffer | null = null;
    let animationFrameId: number;
    let isDisposed = false;

    const cleanupGL = () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      if (gl) {
        try {
          if (positionBuffer) gl.deleteBuffer(positionBuffer);
          if (program) gl.deleteProgram(program);
          if (vs) gl.deleteShader(vs);
          if (fs) gl.deleteShader(fs);
          const loseExt = gl.getExtension("WEBGL_lose_context");
          if (loseExt) {
            loseExt.loseContext();
          }
        } catch {
          // ignore
        }
      }
    };

    const initGL = () => {
      if (isDisposed) return;
      cleanupGL();

      try {
        gl = canvas.getContext("webgl", {
          alpha: true,
          antialias: true,
          powerPreference: "low-power",
        });
      } catch {
        gl = null;
      }

      if (!gl) return;

      vs = gl.createShader(gl.VERTEX_SHADER);
      if (!vs) return;
      gl.shaderSource(vs, VERTEX_SHADER_SRC);
      gl.compileShader(vs);

      fs = gl.createShader(gl.FRAGMENT_SHADER);
      if (!fs) return;
      gl.shaderSource(fs, FRAGMENT_SHADER_SRC);
      gl.compileShader(fs);

      program = gl.createProgram();
      if (!program) return;
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);

      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        gl.deleteProgram(program);
        program = null;
        return;
      }

      gl.useProgram(program);

      positionBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
        gl.STATIC_DRAW
      );

      const aPosition = gl.getAttribLocation(program, "a_position");
      gl.enableVertexAttribArray(aPosition);
      gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

      const uResolution = gl.getUniformLocation(program, "u_resolution");
      const uTime = gl.getUniformLocation(program, "u_time");
      const uColorPrimary = gl.getUniformLocation(program, "u_color_primary");
      const uColorSecondary = gl.getUniformLocation(
        program,
        "u_color_secondary"
      );
      const uColorAccent = gl.getUniformLocation(program, "u_color_accent");
      const uBrightness = gl.getUniformLocation(program, "u_brightness");
      const uSpeed = gl.getUniformLocation(program, "u_speed");

      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

      const startTime = performance.now();

      const render = () => {
        if (isDisposed || !gl || !canvas || gl.isContextLost()) return;

        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const width = Math.round(size * dpr);
        const height = Math.round(size * dpr);

        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
          gl.viewport(0, 0, width, height);
        }

        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.useProgram(program);

        const elapsed = (performance.now() - startTime) * 0.001;
        const currentTheme = themeRef.current;
        const isActive = activeRef.current;
        const act = activityRef.current;

        gl.uniform2f(uResolution, width, height);
        gl.uniform1f(uTime, elapsed);

        gl.uniform3fv(
          uColorPrimary,
          currentTheme.primaryGl || [0.06, 0.92, 0.54]
        );
        gl.uniform3fv(
          uColorSecondary,
          currentTheme.secondaryGl || [0.015, 0.42, 0.28]
        );
        gl.uniform3fv(uColorAccent, currentTheme.accentGl || [0.38, 1.0, 0.78]);

        const baseBrightness = isActive ? 1.12 : 0.98;
        gl.uniform1f(uBrightness, baseBrightness + act * 0.35);

        const baseSpeed = isActive ? 0.92 : 0.48;
        gl.uniform1f(uSpeed, baseSpeed + act * 0.65);

        gl.drawArrays(gl.TRIANGLES, 0, 6);

        animationFrameId = requestAnimationFrame(render);
      };

      animationFrameId = requestAnimationFrame(render);
    };

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };

    const handleContextRestored = () => {
      initGL();
    };

    canvas.addEventListener("webglcontextlost", handleContextLost, false);
    canvas.addEventListener(
      "webglcontextrestored",
      handleContextRestored,
      false
    );

    initGL();

    return () => {
      isDisposed = true;
      canvas.removeEventListener("webglcontextlost", handleContextLost);
      canvas.removeEventListener("webglcontextrestored", handleContextRestored);
      cleanupGL();
    };
  }, [size]);

  return (
    <div
      className={className}
      style={{
        width: fill ? "100%" : size,
        height: fill ? "100%" : size,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        borderRadius: "50%",
        backgroundColor: "transparent",
        position: "relative",
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: fill ? "100%" : size,
          height: fill ? "100%" : size,
          display: "block",
          borderRadius: "50%",
          position: "relative",
          zIndex: 1,
        }}
      />
    </div>
  );
}

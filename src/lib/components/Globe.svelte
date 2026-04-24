<!--
  src/lib/components/Globe.svelte
  Globo rotante Canvas 2D. Zero dipendenze runtime, SSR-safe.
  Visualmente ricostruito dal mockup di design system:
    - proiezione sferica manuale (no d3-geo) — è un motivo, non una mappa
    - land paths astratti, non mappa reale: evitiamo il debito di un topojson
    - stelle con twinkle, 18% rosse (stella rossa = linguaggio comunista)
    - pulsazione rosso sul bordo, grid lat/lon tenue
-->
<script lang="ts">
  import { onMount } from 'svelte';

  interface Props {
    width?: number;
    height?: number;
    label?: string;
  }

  let { width = 260, height = 280, label = 'IT · 2026' }: Props = $props();

  let canvasEl: HTMLCanvasElement | undefined = $state();

  const RED = '#c8291e';
  const INK = '#f0ede6';

  onMount(() => {
    if (!canvasEl) return;
    const ctx = canvasEl.getContext('2d');
    if (!ctx) return;

    const W = width;
    const H = height;
    const cx = W / 2;
    const cy = H / 2 - 10;
    const R = Math.min(W, H) * 0.35;
    let angle = 0;
    let rafId: number;

    const landPaths: Array<Array<[number, number]>> = [
      [[0.18, 0.12], [0.35, 0.08], [0.45, 0.18], [0.42, 0.32], [0.28, 0.38], [0.16, 0.28]],
      [[0.48, 0.22], [0.62, 0.18], [0.7, 0.3], [0.68, 0.48], [0.55, 0.52], [0.46, 0.38]],
      [[0.2, 0.55], [0.38, 0.5], [0.44, 0.62], [0.35, 0.75], [0.22, 0.72], [0.14, 0.62]],
      [[0.52, 0.58], [0.64, 0.55], [0.7, 0.66], [0.6, 0.78], [0.5, 0.72]],
      [[0.72, 0.12], [0.82, 0.1], [0.88, 0.2], [0.8, 0.28], [0.7, 0.22]]
    ];

    const stars = Array.from({ length: 28 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 1.2 + 0.3,
      twinkle: Math.random() * Math.PI * 2,
      speed: 0.03 + Math.random() * 0.04,
      isRed: Math.random() < 0.18
    }));

    function project(lat: number, lon: number, rot: number) {
      const phi = (lat - 0.5) * Math.PI;
      const theta = (lon - 0.5) * Math.PI * 2 + rot;
      return {
        x: Math.cos(phi) * Math.sin(theta),
        y: -Math.sin(phi),
        z: Math.cos(phi) * Math.cos(theta)
      };
    }

    function toCanvas(p: { x: number; y: number; z: number }) {
      return { x: cx + p.x * R, y: cy + p.y * R };
    }

    function drawStar5(
      c: CanvasRenderingContext2D,
      x: number,
      y: number,
      r: number,
      color: string
    ) {
      c.beginPath();
      for (let i = 0; i < 5; i++) {
        const outerX = x + r * Math.cos((i * 4 * Math.PI) / 5 - Math.PI / 2);
        const outerY = y + r * Math.sin((i * 4 * Math.PI) / 5 - Math.PI / 2);
        const innerX = x + r * 0.4 * Math.cos(((i * 4 + 2) * Math.PI) / 5 - Math.PI / 2);
        const innerY = y + r * 0.4 * Math.sin(((i * 4 + 2) * Math.PI) / 5 - Math.PI / 2);
        if (i === 0) c.moveTo(outerX, outerY);
        else c.lineTo(outerX, outerY);
        c.lineTo(innerX, innerY);
      }
      c.closePath();
      c.fillStyle = color;
      c.fill();
    }

    function drawFrame() {
      ctx!.clearRect(0, 0, W, H);

      for (const s of stars) {
        s.twinkle += s.speed;
        const alpha = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(s.twinkle));
        if (s.isRed) {
          ctx!.save();
          ctx!.globalAlpha = alpha;
          drawStar5(ctx!, s.x, s.y, s.r * 1.6, RED);
          ctx!.restore();
        } else {
          ctx!.beginPath();
          ctx!.arc(s.x, s.y, s.r, 0, Math.PI * 2);
          ctx!.fillStyle = `rgba(240,237,230,${alpha * 0.6})`;
          ctx!.fill();
        }
      }

      ctx!.save();
      ctx!.beginPath();
      ctx!.arc(cx, cy, R, 0, Math.PI * 2);
      ctx!.fillStyle = '#111110';
      ctx!.fill();
      ctx!.restore();

      ctx!.save();
      ctx!.beginPath();
      ctx!.arc(cx, cy, R, 0, Math.PI * 2);
      ctx!.clip();

      for (let lat = 0; lat <= 1; lat += 0.1667) {
        ctx!.beginPath();
        let first = true;
        for (let lon = 0; lon <= 1; lon += 0.02) {
          const p = project(lat, lon, angle);
          if (p.z < 0) {
            first = true;
            continue;
          }
          const cp = toCanvas(p);
          if (first) {
            ctx!.moveTo(cp.x, cp.y);
            first = false;
          } else ctx!.lineTo(cp.x, cp.y);
        }
        ctx!.strokeStyle = 'rgba(240,237,230,0.05)';
        ctx!.lineWidth = 0.5;
        ctx!.stroke();
      }
      for (let lon = 0; lon <= 1; lon += 0.1) {
        ctx!.beginPath();
        let first = true;
        for (let lat = 0; lat <= 1; lat += 0.02) {
          const p = project(lat, lon, angle);
          if (p.z < 0) {
            first = true;
            continue;
          }
          const cp = toCanvas(p);
          if (first) {
            ctx!.moveTo(cp.x, cp.y);
            first = false;
          } else ctx!.lineTo(cp.x, cp.y);
        }
        ctx!.strokeStyle = 'rgba(240,237,230,0.05)';
        ctx!.lineWidth = 0.5;
        ctx!.stroke();
      }

      for (const path of landPaths) {
        const projected = path.map(([lat, lon]) => {
          const p = project(lat, lon, angle);
          return { ...p, c: toCanvas(p) };
        });
        const visible = projected.filter((p) => p.z > 0);
        if (visible.length < 3) continue;

        ctx!.beginPath();
        projected.forEach((p, i) => {
          if (p.z <= 0) return;
          if (i === 0 || projected[i - 1].z <= 0) ctx!.moveTo(p.c.x, p.c.y);
          else ctx!.lineTo(p.c.x, p.c.y);
        });
        ctx!.closePath();
        ctx!.fillStyle = 'rgba(200,41,30,0.22)';
        ctx!.fill();
        ctx!.strokeStyle = 'rgba(200,41,30,0.55)';
        ctx!.lineWidth = 0.8;
        ctx!.stroke();
      }

      ctx!.restore();

      ctx!.beginPath();
      ctx!.arc(cx, cy, R, 0, Math.PI * 2);
      ctx!.strokeStyle = 'rgba(200,41,30,0.35)';
      ctx!.lineWidth = 1;
      ctx!.stroke();

      const highlight = ctx!.createRadialGradient(
        cx - R * 0.3,
        cy - R * 0.3,
        0,
        cx,
        cy,
        R
      );
      highlight.addColorStop(0, 'rgba(240,237,230,0.06)');
      highlight.addColorStop(1, 'rgba(0,0,0,0)');
      ctx!.beginPath();
      ctx!.arc(cx, cy, R, 0, Math.PI * 2);
      ctx!.fillStyle = highlight;
      ctx!.fill();

      const pulseR = R + 4 + 2 * Math.sin(angle * 3);
      ctx!.beginPath();
      ctx!.arc(cx, cy, pulseR, 0, Math.PI * 2);
      ctx!.strokeStyle = `rgba(200,41,30,${0.12 + 0.08 * Math.sin(angle * 3)})`;
      ctx!.lineWidth = 1;
      ctx!.stroke();

      ctx!.fillStyle = INK;
      ctx!.font = '600 11px "IBM Plex Mono", monospace';
      ctx!.textAlign = 'center';
      ctx!.fillText(label, cx, cy + R + 20);

      angle += 0.006;
      rafId = requestAnimationFrame(drawFrame);
    }

    drawFrame();

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  });
</script>

<div class="tdv-globe-wrap">
  <canvas bind:this={canvasEl} {width} {height}></canvas>
</div>

<style>
  .tdv-globe-wrap {
    position: relative;
    display: inline-block;
    line-height: 0;
  }
  canvas {
    display: block;
  }
</style>

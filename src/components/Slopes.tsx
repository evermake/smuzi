import { onMount, onCleanup } from "solid-js";

// Helper to interpolate between two colors
function lerpColor(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

export function Slopes({ size, analyserNode }: { size: number; analyserNode: AnalyserNode }) {
  let canvas!: HTMLCanvasElement;
  let animationId: number;
  const bufferLength = analyserNode.frequencyBinCount;
  const dataArray = new Float32Array(bufferLength);

  const step = 8;
  const randoms: Record<string, number> = {};
  for (let i = step; i <= size - step; i += step) {
    for (let j = step; j <= size - step; j += step) {
      randoms[`${i}-${j}`] = Math.random();
    }
  }

  // Dark purple: rgb(76, 44, 255)
  // Toxic pink: rgb(255, 26, 255)
  // White: rgb(255,255,255)
  const colorStart: [number, number, number] = [76, 44, 255];
  const colorEnd: [number, number, number] = [255, 26, 255];
  const colorWhite: [number, number, number] = [255, 255, 255];

  const draw = () => {
    const ctx = canvas.getContext('2d')!;
    
    // Clear the canvas
    ctx.clearRect(0, 0, size, size);
    
    // Get frequency data
    analyserNode.getFloatFrequencyData(dataArray);
    
    ctx.lineWidth = 1.5;

    const cuttedLines = 8
    const lines: Array<Array<{ x: number; y: number }>> = [];
    const lineAmplitudes: number[] = [];

    let lineIdx = 0
    const totalSteps = size / step
    for (let i = step; i <= size - step; i += step) {
      let line: Array<{ x: number; y: number }> = [];
      let xIdx = 0
      let sum = 0;
      let count = 0;
      for (let j = step; j <= size - step; j += step) {
        // Map j to frequency array index
        const freqIndex = Math.floor(mapRange(lineIdx * totalSteps + xIdx, cuttedLines * totalSteps, totalSteps * totalSteps, 0, bufferLength - 1));
        // Normalize frequency value from dB scale (-100 to 0) to a reasonable amplitude
        let amplitude = Math.max(0, Math.min(1, (dataArray[freqIndex] + 140) / 140))
        amplitude = lineIdx > cuttedLines ? Number.isNaN(amplitude) ? 0 : amplitude : 0

        const distanceToCenter = Math.abs(j - size / 2);
        const variance = Math.max(size / 2 - 10 - distanceToCenter, 0);
        const displacement = amplitude * variance / 2 * -1

        line.push({ x: j, y: i + displacement });
        sum += amplitude;
        count++;
        xIdx++
      }
      lines.push(line);
      // Compute and store average amplitude for this line
      lineAmplitudes.push(count > 0 ? sum / count : 0);
      lineIdx++
    }

    // Draw the lines
    const totalLines = lines.length - cuttedLines;
    // For color interpolation by line index
    const minLine = cuttedLines + 1;
    const maxLine = lines.length - 7; // lines.length - 6 is exclusive in the loop
    const lineRange = maxLine - minLine;

    for (let i = minLine; i < lines.length - 6; i++) {
      // How far down the canvas is this line? 0 = top, 1 = bottom
      const lineT = lineRange > 0 ? (i - minLine) / lineRange : 0;
      // Interpolate from dark purple (top) to toxic pink (bottom)
      const baseColor = lerpColor(colorStart, colorEnd, lineT);

      // Amplitude for this line
      const amp = Math.max(0, Math.min(1, lineAmplitudes[i]));

      // If amplitude is low, color is white and transparent (as before)
      // If amplitude is high, color is between baseColor and white, depending on amp
      // So: color = lerp(white, baseColor, amp)
      const [r, g, b] = lerpColor(colorWhite, baseColor, amp);

      // Opacity: non-linear amplification dependency with Bezier easing (slow start, then faster)
      // Use cubic Bezier (0.42, 0, 1, 1) for easeIn
      function cubicBezier(t: number, p0: number, p1: number, p2: number, p3: number): number {
        const u = 1 - t;
        return u * u * u * p0 +
               3 * u * u * t * p1 +
               3 * u * t * t * p2 +
               t * t * t * p3;
      }
      // EaseIn cubic-bezier(0.42, 0, 1, 1)
      const alpha = cubicBezier(amp, 0, 0, 1, 1);

      // --- GLOW EFFECT ---
      // Draw a glow behind the line using shadowBlur and shadowColor
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(lines[i][0].x, lines[i][0].y);
      let j: number;
      for (j = 0; j < lines[i].length - 2; j++) {
        let xc = (lines[i][j].x + lines[i][j + 1].x) / 2;
        let yc = (lines[i][j].y + lines[i][j + 1].y) / 2;
        ctx.quadraticCurveTo(lines[i][j].x, lines[i][j].y, xc, yc);
      }
      ctx.quadraticCurveTo(
        lines[i][j].x,
        lines[i][j].y,
        lines[i][j + 1].x,
        lines[i][j + 1].y
      );

      // Set shadow for glow
      ctx.shadowColor = `rgba(${r},${g},${b},${Math.max(alpha, 0.3)})`;
      ctx.shadowBlur = 16 + 32 * alpha; // More blur for higher amplitude

      ctx.strokeStyle = `rgba(${r},${g},${b},${alpha * 0.5})`; // Slightly less alpha for glow
      ctx.lineWidth = 4.5; // Thicker for glow
      ctx.globalAlpha = 1;
      ctx.stroke();
      ctx.restore();

      // --- MAIN LINE ---
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(lines[i][0].x, lines[i][0].y);
      for (j = 0; j < lines[i].length - 2; j++) {
        let xc = (lines[i][j].x + lines[i][j + 1].x) / 2;
        let yc = (lines[i][j].y + lines[i][j + 1].y) / 2;
        ctx.quadraticCurveTo(lines[i][j].x, lines[i][j].y, xc, yc);
      }
      ctx.quadraticCurveTo(
        lines[i][j].x,
        lines[i][j].y,
        lines[i][j + 1].x,
        lines[i][j + 1].y
      );

      ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 1;
      ctx.stroke();
      ctx.restore();

      // --- FILL (destination-out) ---
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(lines[i][0].x, lines[i][0].y);
      for (j = 0; j < lines[i].length - 2; j++) {
        let xc = (lines[i][j].x + lines[i][j + 1].x) / 2;
        let yc = (lines[i][j].y + lines[i][j + 1].y) / 2;
        ctx.quadraticCurveTo(lines[i][j].x, lines[i][j].y, xc, yc);
      }
      ctx.quadraticCurveTo(
        lines[i][j].x,
        lines[i][j].y,
        lines[i][j + 1].x,
        lines[i][j + 1].y
      );
      ctx.globalCompositeOperation = 'destination-out';
      ctx.globalAlpha = alpha; // Also apply opacity to fill
      ctx.fill();
      ctx.restore();
    }

    animationId = requestAnimationFrame(draw);
  };

  onMount(() => {
    const dpr = window.devicePixelRatio;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';

    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);
    
    draw();
  });

  onCleanup(() => {
    if (animationId) {
      cancelAnimationFrame(animationId);
    }
  });

  return (
    <canvas ref={canvas}></canvas>
  )
}

function mapRange(value: number, inMin: number, inMax: number, outMin: number, outMax: number) {
  return (value - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
}

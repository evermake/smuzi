import { onMount, onCleanup, type Accessor } from "solid-js";
import bezier from "bezier-easing";

export type RGB = [number, number, number];

// Helper to interpolate between two colors
function lerpColor(a: RGB, b: RGB, t: number): RGB {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

const COLOR_WHITE: RGB = [255, 255, 255];

export function Slopes({
  size,
  analyserNode,
  colorStart = () => COLOR_WHITE,
  colorEnd = () => COLOR_WHITE,
}: {
  size: number;
  analyserNode: AnalyserNode;
  colorStart?: Accessor<RGB>;
  colorEnd?: Accessor<RGB>;
}) {
  let canvas!: HTMLCanvasElement;
  let ctx!: CanvasRenderingContext2D;
  let animationId: number;
  const bufferLength = analyserNode.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  const maxFreqIndex = Math.floor(bufferLength * 0.9) - 1 // cut high frequencies
  const alphaBezier = bezier(0.5, 0, 0.5, 1)

  const step = 10;
  const totalSteps = size / step
  const totalSteps2 = totalSteps * totalSteps

  const draw = () => {
    ctx.clearRect(0, 0, size, size);
    analyserNode.getByteFrequencyData(dataArray);
    ctx.globalAlpha = 1;

    const cuttedLines = 0
    const lines: Array<Array<{ x: number; y: number }>> = [];
    const lineAmplitudes: number[] = [];

    let lineIdx = 0
    for (let i = step; i <= size - step; i += step) {
      let line: Array<{ x: number; y: number }> = [];
      let xIdx = 0
      let sum = 0;
      let count = 0;
      for (let j = 0; j <= size; j += step) {
        // Map j to frequency array index - reversed mapping
        const freqIndex = Math.floor(mapRange(
          (totalSteps - lineIdx) * totalSteps + xIdx, 
          0, 
          totalSteps2, 
          0, 
          maxFreqIndex
        ));
        // Normalize frequency value from dB scale (-100 to 0) to a reasonable amplitude
        let amplitude = Math.max(0, Math.min(1, dataArray[freqIndex] / 255))
        amplitude = lineIdx > cuttedLines ? Number.isNaN(amplitude) ? 0 : amplitude : 0

        const distanceToCenter = Math.abs(j - size / 2);
        const variance = Math.max(size / 2 - 10 - distanceToCenter, 0);
        const displacement = amplitude * variance / 2

        line.push({ x: j, y: i - displacement });
        sum += amplitude;
        count++;
        xIdx++
      }
      lines.push(line);
      lineAmplitudes.push(count > 0 ? sum / count : 0);
      lineIdx++
    }

    const lineColors = []
    const colorStart_ = colorStart()
    const colorEnd_ = colorEnd()
    for (let i = 0; i < lines.length; i++) {
      const lineT = i / lines.length;
      lineColors.push(lerpColor(colorEnd_, colorStart_, lineT)); // swap to reverse
    }

    for (let i = 0; i < lines.length; i++) {
      const amp = Math.max(0, Math.min(1, lineAmplitudes[i]));
      const [r, g, b] = lerpColor(COLOR_WHITE, lineColors[i], amp);
      const alpha = alphaBezier(amp)
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`;

      let j: number;
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
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fill();
      ctx.restore();
      ctx.stroke();
    }

    animationId = requestAnimationFrame(draw);
  };

  onMount(() => {
    const dpr = window.devicePixelRatio;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';

    ctx = canvas.getContext('2d')!;
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

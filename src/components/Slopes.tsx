import { onMount, onCleanup } from "solid-js";

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

  const draw = () => {
    const ctx = canvas.getContext('2d')!;
    
    // Clear the canvas
    ctx.clearRect(0, 0, size, size);
    
    // Get frequency data
    analyserNode.getFloatFrequencyData(dataArray);
    
    ctx.lineWidth = 1.5;

    const cuttedLines = 8
    const lines: Array<Array<{ x: number; y: number }>> = [];

    const doLog = Math.random() > 0.99
    
    let lineIdx = 0
    const totalSteps = size / step
    for (let i = step; i <= size - step; i += step) {
      let line: Array<{ x: number; y: number }> = [];
      let xIdx = 0
      for (let j = step; j <= size - step; j += step) {
        // Map j to frequency array index
        const freqIndex = Math.floor(mapRange(lineIdx * totalSteps + xIdx, cuttedLines * totalSteps, totalSteps * totalSteps, 0, bufferLength - 1));
        // Normalize frequency value from dB scale (-100 to 0) to a reasonable amplitude
        let amplitude = Math.max(0, Math.min(1, (dataArray[freqIndex] + 140) / 140))
        amplitude = lineIdx > cuttedLines ? Number.isNaN(amplitude) ? 0 : amplitude : 0

        // if (doLog) {
        //   console.log(lineIdx * totalSteps + xIdx, '/', totalSteps * totalSteps, '->', freqIndex, '=', amplitude)
        // }

        const distanceToCenter = Math.abs(j - size / 2);
        const variance = Math.max(size / 2 - 20 - distanceToCenter, 0);
        // const random = randoms[`${i}-${j}`] * variance / 2 * -1
        const displacement = amplitude * variance / 2 * -1

        line.push({ x: j, y: i + displacement });
        xIdx++
      }
      lines.push(line);
      lineIdx++
    }

    // Draw the lines
    const totalLines = lines.length - cuttedLines;
    for (let i = cuttedLines; i < lines.length - 6; i++) {
      // Calculate color: interpolate from red (first) to white (last)
      // Red: rgb(255,0,0), White: rgb(255,255,255)
      const t = totalLines > 0 ? (i - cuttedLines) / (totalLines - 1) : 0;
      const r = 255;
      const g = Math.round(255 * t);
      const b = Math.round(255 * t);
      ctx.strokeStyle = `rgb(${r},${g},${b})`;

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

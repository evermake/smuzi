import { createEffect, onCleanup } from 'solid-js';

interface AudioVisualizerProps {
  analyserNode: AnalyserNode;
  width?: number;
  height?: number;
}

export function AudioVisualizer(props: AudioVisualizerProps) {
  let canvasRef: HTMLCanvasElement | undefined;
  let animationId: number;
  let previousData: Float32Array | null = null;

  // Helper to set up canvas for high-DPI (retina) displays
  const setupCanvasResolution = () => {
    if (!canvasRef) return;
    const dpr = window.devicePixelRatio || 1;
    const width = props.width || 800;
    const height = props.height || 200;
    // Only update if needed
    if (
      canvasRef.width !== width * dpr ||
      canvasRef.height !== height * dpr
    ) {
      canvasRef.width = width * dpr;
      canvasRef.height = height * dpr;
      canvasRef.style.width = width + 'px';
      canvasRef.style.height = height + 'px';
    }
    const ctx = canvasRef.getContext('2d');
    if (ctx) {
      ctx.setTransform(1, 0, 0, 1, 0, 0); // reset
      ctx.scale(dpr, dpr);
    }
  };

  const interpolateValue = (current: number, previous: number, factor: number) => {
    return previous + (current - previous) * factor;
  };

  const draw = () => {
    if (!canvasRef) return;

    const ctx = canvasRef.getContext('2d')!;
    const width = props.width || 800;
    const height = props.height || 200;

    // Get frequency data with higher precision
    const bufferLength = props.analyserNode.frequencyBinCount;
    const dataArray = new Float32Array(bufferLength);
    props.analyserNode.getFloatFrequencyData(dataArray);

    // Initialize previous data if needed
    if (!previousData) {
      previousData = new Float32Array(bufferLength);
      previousData.set(dataArray);
    }

    // Clear canvas with a slight fade effect
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.fillRect(0, 0, width, height);

    // Draw frequency spectrum
    const barWidth = (width / bufferLength) * 1.5;
    const interpolationFactor = 0.9;
    let x = 0;

    ctx.beginPath();
    ctx.moveTo(0, height);

    for (let i = 0; i < bufferLength; i++) {
      // Normalize the data from dB scale (-100 to 0) to 0-1
      // Clamp values to prevent NaN or Infinity
      const normalizedCurrent = Math.max(0, Math.min(1, (dataArray[i] + 140) / 140));
      const normalizedPrevious = Math.max(0, Math.min(1, (previousData[i] + 140) / 140));
      
      // Interpolate between previous and current values
      const value = interpolateValue(
        normalizedCurrent,
        normalizedPrevious,
        interpolationFactor
      );

      const barHeight = Math.max(0, Math.min(height, value * height));

      // Ensure x coordinates are valid
      const safeX = Math.max(0, Math.min(width, x));

      // Create gradient for each bar
      const gradient = ctx.createLinearGradient(
        safeX,
        Math.max(0, height - barHeight),
        safeX,
        height
      );
      gradient.addColorStop(0, `hsla(${(i / bufferLength) * 360}, 100%, 50%, 0.8)`);
      gradient.addColorStop(1, `hsla(${(i / bufferLength) * 360}, 100%, 50%, 0.2)`);

      // Draw bar with rounded corners
      ctx.fillStyle = gradient;
      const radius = Math.min(barWidth / 2, 4);
      
      ctx.beginPath();
      ctx.moveTo(safeX + radius, height - barHeight);
      ctx.lineTo(safeX + barWidth - radius, height - barHeight);
      ctx.quadraticCurveTo(safeX + barWidth, height - barHeight, safeX + barWidth, height - barHeight + radius);
      ctx.lineTo(safeX + barWidth, height);
      ctx.lineTo(safeX, height);
      ctx.lineTo(safeX, height - barHeight + radius);
      ctx.quadraticCurveTo(safeX, height - barHeight, safeX + radius, height - barHeight);
      ctx.fill();

      x += barWidth + 1;
    }

    // Update previous data
    previousData.set(dataArray);

    animationId = requestAnimationFrame(draw);
  };

  createEffect(() => {
    if (canvasRef) {
      setupCanvasResolution();
      draw();
    }
  });

  // Also update canvas resolution if width/height props change
  createEffect(() => {
    if (canvasRef) {
      setupCanvasResolution();
    }
  });

  onCleanup(() => {
    if (animationId) {
      cancelAnimationFrame(animationId);
    }
    previousData = null;
  });

  return (
    <canvas
      ref={el => (canvasRef = el)}
      width={(props.width || 800) * (window.devicePixelRatio || 1)}
      height={(props.height || 200) * (window.devicePixelRatio || 1)}
      style={{
        'background-color': 'black',
        'border-radius': '8px',
        'margin-top': '20px',
        width: (props.width || 800) + 'px',
        height: (props.height || 200) + 'px',
        display: 'block',
      }}
    />
  );
} 

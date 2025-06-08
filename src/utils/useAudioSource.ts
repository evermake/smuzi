import type { Accessor } from "solid-js";
import { createEffect, createSignal } from "solid-js";

export function useAudioSource(
  context: AudioContext, 
  buffer: Accessor<AudioBuffer | null>,
  analyserNode: AnalyserNode
) {
  let sourceNode: AudioBufferSourceNode | null = null;

  const [startedAt, setStartedAt] = createSignal(0);
  const [pausedAt, setPausedAt] = createSignal(0);
  const [playing, setPlaying] = createSignal(false);

  createEffect(() => {
    if (!buffer() && sourceNode) {
      setStartedAt(0);
      setPausedAt(0);
      setPlaying(false);
      sourceNode.disconnect();
      sourceNode.stop(0);
      sourceNode = null;
    }
  });

  const play = () => {
    if (!buffer()) {
      return;
    }

    const offset = pausedAt();

    sourceNode = context.createBufferSource();
    sourceNode.connect(analyserNode);
    analyserNode.connect(context.destination);
    sourceNode.buffer = buffer()!;
    sourceNode.start(0, offset);

    setStartedAt(context.currentTime - offset);
    setPausedAt(0);
    setPlaying(true);
  };

  const stop = () => {
    if (sourceNode) {
      sourceNode.disconnect();
      sourceNode.stop(0);
      sourceNode = null;
    }
    setPausedAt(0);
    setStartedAt(0);
    setPlaying(false);
  };

  const pause = () => {
    const elapsed = context.currentTime - startedAt();
    stop();
    setPausedAt(elapsed);
  };

  const getCurrentTime = () => {
    if (pausedAt()) {
      return pausedAt();
    }
    if (startedAt()) {
      return context.currentTime - startedAt();
    }
    return 0;
  };

  const duration = () => buffer()?.duration || NaN;

  return {
    getCurrentTime,
    duration,
    play,
    pause,
    stop,
    playing,
  };
}

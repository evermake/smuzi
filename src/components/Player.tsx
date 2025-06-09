import { createSignal, Match, Switch, createEffect } from "solid-js";
import { Slopes, type RGB } from "./Slopes";
import { useAudioSource } from "../utils/useAudioSource";

type PlayState = 'playing' | 'paused' | 'loading'

function hexToRgb(hex: string): RGB {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) {
    throw new Error(`Invalid hex color: ${hex}`);
  }
  return [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16)
  ];
}

type Gradient = {
  id: string;
  colors: string[];
};

const GRADIENTS: Gradient[] = [
  { id: 'white', colors: ['#ffffff'] },
  { id: 'sunset', colors: ['#ff7e5f', '#feb47b'] },
  { id: 'aqua', colors: ['#43e97b', '#38f9d7'] },
  { id: 'ruby', colors: ['#ff0000', '#ff512f'] },
  { id: 'pink', colors: ['#db29ff', '#ff00bf'] },
];

export function Player() {
  const audioCtx = new AudioContext();
  const analyserNode = audioCtx.createAnalyser();
  analyserNode.fftSize = 2 ** 14;
  analyserNode.smoothingTimeConstant = 0.01;

  const [selectedFile, setSelectedFile] = createSignal<File | null>(null);
  const [audioBuffer, setAudioBuffer] = createSignal<AudioBuffer | null>(null);
  const [state, setState] = createSignal<PlayState>('loading');
  const [isDragging, setIsDragging] = createSignal(false);
  const [selectedGradient, setSelectedGradient] = createSignal<Gradient>(GRADIENTS[0]);

  const colorStart = () => hexToRgb(selectedGradient().colors[0]);
  const colorEnd = () => {
    const colors = selectedGradient().colors;
    return hexToRgb(colors[colors.length - 1]);
  };

  const audio = useAudioSource(audioCtx, audioBuffer, analyserNode);

  createEffect(async () => {
    setState('loading');
    audio.stop();

    const file = selectedFile();

    if (!file) {
      setAudioBuffer(null);
      return;
    }

    try {
      const arrayBuffer = await file.arrayBuffer();
      const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      setAudioBuffer(decodedBuffer);
      setState('paused');
    } catch (error) {
      console.error('Error loading audio file:', error);
      setAudioBuffer(null);
      setState('loading');
    }
  });

  const handleFileSelect = (file: File) => {
    if (file.type.startsWith("audio/")) {
      setSelectedFile(file);
    }
  };

  const handlePlayPause = () => {
    if (audio.playing()) {
      audio.pause();
      setState('paused');
    } else {
      audio.play();
      setState('playing');
    }
  };

  return (
    <div class="player">
      <div class="player-gradients">
        {GRADIENTS.map(gradient => (
          <button
            class="player-gradients__item"
            data-selected={gradient.id === selectedGradient().id ? '' : undefined}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedGradient(gradient);
            }}
            style={{
              "background": gradient.colors.length > 1
                ? `linear-gradient(0deg, ${gradient.colors.join(', ')})`
                : gradient.colors[0]
            }}
          />
        ))}
      </div>
      <div
        class="player-root"
        data-has-file={selectedFile() ? '' : undefined}
        data-dragging={isDragging() ? '' : undefined}
        data-state={state()}
        onDragOver={e => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragging(true);
        }}
        onDragLeave={e => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragging(false);
        }}
        onDrop={e => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragging(false);
          const files = e.dataTransfer?.files;
          if (files && files.length > 0) {
            handleFileSelect(files[0]);
          }
        }}
        onClick={() => {
          if (selectedFile()) {
            handlePlayPause();
            return;
          }
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = '.wav,.aif,.aiff,.flac,.alac,.aac,.ogg,.mp3';
          input.onchange = (e) => {
            const files = (e.target as HTMLInputElement).files;
            if (files && files.length > 0) {
              handleFileSelect(files[0]);
            }
          };
          input.click();
        }}
      >
        <Switch>
          <Match when={!selectedFile()}>
            <div class="player-root__icon">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 17V3m-6 8l6 6l6-6m1 10H5"/>
              </svg>
            </div>
          </Match>
          <Match when={selectedFile()}>
            {(file) => (
              <div class="player-root__cover">
                <span class="player-root__cover-title">{file().name}</span>
                <Slopes 
                  size={400} 
                  analyserNode={analyserNode} 
                  colorStart={colorStart}
                  colorEnd={colorEnd}
                />
              </div>
            )}
          </Match>
        </Switch>
      </div>
    </div>
  )
}

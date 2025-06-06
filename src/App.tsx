import { createSignal, createEffect, Show, type Accessor } from 'solid-js'
import { Slopes } from './components/Slopes';

function App() {
  const audioCtx = new AudioContext();
  const analyserNode = audioCtx.createAnalyser();
  analyserNode.fftSize = 2 ** 14;
  analyserNode.smoothingTimeConstant = 0.005;
  
  const [selectedFile, setSelectedFile] = createSignal<File | null>(null);
  const [audioBuffer, setAudioBuffer] = createSignal<AudioBuffer | null>(null);
  const audio = useAudioSource(audioCtx, audioBuffer, analyserNode);

  createEffect(async () => {
    const file = selectedFile();

    if (!file) {
      setAudioBuffer(null);
      return;
    }

    try {
      const arrayBuffer = await file.arrayBuffer();
      const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      setAudioBuffer(decodedBuffer);
    } catch (error) {
      console.error('Error loading audio file:', error);
      setAudioBuffer(null);
    }
  });

  const handleFileChange = (event: Event) => {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    setSelectedFile(file || null);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <>
      <div style={{ padding: '20px' }}>
        <input 
          type="file" 
          accept="audio/*" 
          onChange={handleFileChange}
        />

        <Show when={selectedFile()}>
          {(selectedFile) => (
            <div style={{ 'margin-top': '20px' }}>
              <p>Selected: {selectedFile().name}</p>

              <Show
                when={audioBuffer()}
                fallback={<p>Loading audio...</p>}
              >
                {(audioBuffer) => (
                  <div style={{ 'margin-top': '10px' }}>
                    <div style={{ 'margin-bottom': '10px' }}>
                      <span>
                        {formatTime(audio.getCurrentTime())} / {formatTime(audio.duration())}
                      </span>
                    </div>

                    <button
                      onClick={() => {
                        if (audio.playing()) {
                          audio.pause();
                        } else {
                          audio.play();
                        }
                      }}
                      disabled={!audioBuffer()}
                    >
                      {audio.playing() ? 'Pause' : 'Play'}
                    </button>

                    <button 
                      onClick={audio.stop}
                      disabled={!audio.playing() && audio.getCurrentTime() === 0}
                      style={{ 'margin-left': '10px' }}
                    >
                      Stop
                    </button>
                  </div>
                )}
              </Show>
            </div>
          )}
        </Show>

        <div class='slopes'>
          <Slopes size={400} analyserNode={analyserNode} />
        </div>
      </div>
    </>
  )
}

function useAudioSource(
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

export default App

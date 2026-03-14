/**
 * 语音 UI — 麦克风录制 + TTS 音频播放 + 口型同步
 */
const micBtn = document.getElementById("mic-btn");
let mediaStream = null;
let audioCtx = null;
let processor = null;
let isRecording = false;

micBtn.addEventListener("click", async () => {
  if (isRecording) {
    stopRecording();
  } else {
    await startRecording();
  }
});

async function startRecording() {
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: { sampleRate: 16000, channelCount: 1 },
    });
    audioCtx = new AudioContext({ sampleRate: 16000 });
    const source = audioCtx.createMediaStreamSource(mediaStream);
    processor = audioCtx.createScriptProcessor(4096, 1, 1);

    processor.onaudioprocess = (e) => {
      const f32 = e.inputBuffer.getChannelData(0);
      const i16 = new Int16Array(f32.length);
      for (let i = 0; i < f32.length; i++) {
        i16[i] = Math.max(-32768, Math.min(32767, f32[i] * 32768));
      }
      const b64 = arrayBufferToBase64(i16.buffer);
      wsSend({ type: "audio_chunk", payload: { audio_base64: b64 } });
    };

    source.connect(processor);
    processor.connect(audioCtx.destination);
    isRecording = true;
    micBtn.classList.add("recording");
    micBtn.textContent = "STOP";
  } catch (err) {
    console.error("麦克风启动失败:", err);
  }
}

function stopRecording() {
  if (processor) processor.disconnect();
  if (audioCtx) audioCtx.close();
  if (mediaStream) mediaStream.getTracks().forEach((t) => t.stop());
  isRecording = false;
  micBtn.classList.remove("recording");
  micBtn.textContent = "MIC";
}

function arrayBufferToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

const audioQueue = [];
let isPlaying = false;
let lipSyncCtx = null;
let lipSyncAnalyser = null;
let lipSyncAnimId = null;

wsOn("reply_audio", (p) => {
  audioQueue.push({ buffer: p.audio_buffer });
  if (!isPlaying) playNext();
});

wsOn("status", (p) => {
  if (p.state === "listening") {
    audioQueue.length = 0;
  }
});

function playNext() {
  if (audioQueue.length === 0) {
    isPlaying = false;
    stopLipSync();
    return;
  }
  isPlaying = true;
  const { buffer } = audioQueue.shift();

  if (!lipSyncCtx) {
    lipSyncCtx = new AudioContext();
    lipSyncAnalyser = lipSyncCtx.createAnalyser();
    lipSyncAnalyser.fftSize = 256;
    lipSyncAnalyser.connect(lipSyncCtx.destination);
  }

  lipSyncCtx.decodeAudioData(
    buffer.slice(0),
    (audioBuffer) => {
      const source = lipSyncCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(lipSyncAnalyser);
      source.onended = () => {
        stopLipSync();
        playNext();
      };
      source.start();
      startLipSync();
    },
    (err) => {
      console.error("音频解码失败:", err);
      playNext();
    }
  );
}

function startLipSync() {
  if (lipSyncAnimId) return;
  const dataArray = new Uint8Array(lipSyncAnalyser.frequencyBinCount);

  function tick() {
    lipSyncAnalyser.getByteFrequencyData(dataArray);
    let sum = 0;
    const count = Math.min(16, dataArray.length);
    for (let i = 0; i < count; i++) sum += dataArray[i];
    const volume = sum / count / 255;
    const mouthOpen = Math.min(1, volume * 2.5);

    if (typeof live2dModel !== "undefined" && live2dModel) {
      const core = live2dModel.internalModel?.coreModel;
      if (core) {
        try {
          core.setParameterValueById("ParamMouthOpenY", mouthOpen);
        } catch (_) {}
      }
    }

    lipSyncAnimId = requestAnimationFrame(tick);
  }

  tick();
}

function stopLipSync() {
  if (lipSyncAnimId) {
    cancelAnimationFrame(lipSyncAnimId);
    lipSyncAnimId = null;
  }
  if (typeof live2dModel !== "undefined" && live2dModel) {
    const core = live2dModel.internalModel?.coreModel;
    if (core) {
      try {
        core.setParameterValueById("ParamMouthOpenY", 0);
      } catch (_) {}
    }
  }
}

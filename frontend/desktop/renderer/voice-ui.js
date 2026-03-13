/**
 * 语音 UI — 麦克风录制 + TTS 音频播放
 */
const micBtn = document.getElementById("mic-btn");
let mediaStream = null;
let audioCtx = null;
let processor = null;
let isRecording = false;

// --- 麦克风录制 ---
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

// --- TTS 音频播放 ---
const audioQueue = [];
let isPlaying = false;

wsOn("reply_audio", (p) => {
  audioQueue.push({ b64: p.audio_base64, fmt: p.format || "mp3" });
  if (!isPlaying) playNext();
});

function playNext() {
  if (audioQueue.length === 0) { isPlaying = false; return; }
  isPlaying = true;
  const { b64, fmt } = audioQueue.shift();
  const audio = new Audio("data:audio/" + fmt + ";base64," + b64);
  audio.onended = playNext;
  audio.onerror = playNext;
  audio.play().catch(playNext);
}

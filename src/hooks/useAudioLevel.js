import { useEffect, useRef, useState } from "react";

export default function useAudioLevel(stream, enabled) {
  const [speaking, setSpeaking] = useState(false);
  const ctxRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    if (!stream || !enabled) {
      setSpeaking(false);
      return;
    }

    const audioTracks = stream.getAudioTracks();
    if (!audioTracks.length || !audioTracks[0].enabled) {
      setSpeaking(false);
      return;
    }

    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    const source = ctx.createMediaStreamSource(stream);
    source.connect(analyser);

    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.5;
    const data = new Uint8Array(analyser.frequencyBinCount);

    ctxRef.current = ctx;

    const tick = () => {
      analyser.getByteFrequencyData(data);
      const avg = data.reduce((a, b) => a + b, 0) / data.length;
      setSpeaking(avg > 12);
      rafRef.current = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(rafRef.current);
      source.disconnect();
      ctx.close().catch(() => {});
    };
  }, [stream, enabled]);

  return speaking;
}
import { trpc } from "@/lib/trpc";
import {
  playRecordingCancel,
  playRecordingStart,
  playRecordingStop,
} from "@/lib/recordingSounds";
import { useCallback, useEffect, useRef, useState } from "react";

export type VoiceState = "idle" | "recording" | "transcribing";

function chooseRecorderType() {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ];
  return candidates.find(type => MediaRecorder.isTypeSupported(type));
}

async function toBase64(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const chunk = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunk)
    binary += String.fromCharCode.apply(
      null,
      bytes.subarray(offset, offset + chunk) as unknown as number[]
    );
  return window.btoa(binary);
}

export function useVoiceInput({
  onTranscript,
  onError,
}: {
  onTranscript: (text: string) => void;
  onError: (message: string) => void;
}) {
  const [state, setState] = useState<VoiceState>("idle");
  const [seconds, setSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const mutation = trpc.voice.transcribe.useMutation({
    onSuccess: result => {
      setState("idle");
      setSeconds(0);
      if (result.text.trim()) onTranscript(result.text.trim());
      else onError("No speech was detected. Please try again.");
    },
    onError: error => {
      setState("idle");
      setSeconds(0);
      onError(error.message || "KSEMO could not transcribe that recording.");
    },
  });

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  const start = useCallback(async () => {
    if (state !== "idle") return;
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      onError(
        "Voice input is not supported in this browser. Use a current desktop or mobile browser with microphone support."
      );
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;
      chunksRef.current = [];
      const mimeType = chooseRecorderType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.ondataavailable = event => {
        if (event.data.size) chunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        releaseStream();
        setState("idle");
        onError("The microphone stopped unexpectedly. Please try again.");
      };
      recorder.onstop = async () => {
        releaseStream();
        const audioType = (recorder.mimeType || mimeType || "audio/webm").split(
          ";"
        )[0];
        const recording = new Blob(chunksRef.current, { type: audioType });
        recorderRef.current = null;
        if (!recording.size) {
          setState("idle");
          onError(
            "No audio was captured. Check your microphone and try again."
          );
          return;
        }
        if (recording.size > 12 * 1024 * 1024) {
          setState("idle");
          onError(
            "That recording is too large to transcribe. Please keep messages shorter than 12 MB."
          );
          return;
        }
        setState("transcribing");
        mutation.mutate({
          audioBase64: await toBase64(recording),
          mimeType: audioType,
        });
      };
      recorder.start(250);
      setSeconds(0);
      setState("recording");
      playRecordingStart();
      timerRef.current = window.setInterval(
        () => setSeconds(current => current + 1),
        1_000
      );
    } catch (error) {
      releaseStream();
      setState("idle");
      if ((error as DOMException).name === "NotAllowedError")
        onError(
          "Microphone access is blocked. Allow microphone access in your browser settings, then try again."
        );
      else
        onError(
          "KSEMO could not access a microphone. Check that a microphone is connected and available."
        );
    }
  }, [onError, releaseStream, state]);

  const stop = useCallback(() => {
    if (state === "recording" && recorderRef.current?.state === "recording") {
      playRecordingStop();
      // Flip the UI to "transcribing" immediately — onstop only fires after
      // the MediaRecorder finalizes the blob, which can take several hundred
      // milliseconds and makes the recording feel like it's stuck.
      setState("transcribing");
      recorderRef.current.stop();
    }
  }, [state]);

  const cancel = useCallback(() => {
    chunksRef.current = [];
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      playRecordingCancel();
      recorderRef.current.onstop = null;
      recorderRef.current.stop();
    }
    recorderRef.current = null;
    releaseStream();
    setState("idle");
    setSeconds(0);
  }, [releaseStream]);

  useEffect(() => () => cancel(), [cancel]);

  return { state, seconds, start, stop, cancel };
}

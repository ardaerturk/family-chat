"use client";
import { useI18n } from "./language-provider";
import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, PhoneOff, AudioLines } from "lucide-react";
import { errorMessage } from "@/lib/client";
import { Modal, Spinner } from "./ui";
export default function Voice({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const [state, setState] = useState(t("Ready when you are")),
    [active, setActive] = useState(false),
    [busy, setBusy] = useState(false),
    [muted, setMuted] = useState(false),
    [error, setError] = useState(""),
    [transcript, setTranscript] = useState("");
  const peer = useRef<RTCPeerConnection | null>(null),
    stream = useRef<MediaStream | null>(null),
    audio = useRef<HTMLAudioElement | null>(null),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    alive = useRef(true);
  function cleanup() {
    peer.current?.close();
    peer.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    if (audio.current) {
      audio.current.pause();
      audio.current.srcObject = null;
    }
    if (timer.current) clearTimeout(timer.current);
  }
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      cleanup();
    };
  }, []);
  async function start() {
    setBusy(true);
    setError("");
    setState("Connecting…");
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      if (!alive.current) {
        media.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = media;
      const pc = new RTCPeerConnection();
      peer.current = pc;
      audio.current = new Audio();
      audio.current.autoplay = true;
      pc.ontrack = (e) => {
        if (audio.current) {
          audio.current.srcObject = e.streams[0];
          audio.current
            .play()
            .catch(() =>
              setError(
                "Tap the speaker control on your phone to enable audio.",
              ),
            );
        }
      };
      media.getTracks().forEach((t) => pc.addTrack(t, media));
      const channel = pc.createDataChannel("oai-events");
      channel.onopen = () => {
        setActive(true);
        setState("Listening");
        setBusy(false);
      };
      channel.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data);
          if (event.type === "input_audio_buffer.speech_started")
            setState("Listening");
          if (event.type === "response.created") {
            setState("Thinking…");
            setTranscript("");
          }
          if (event.type === "response.output_audio_transcript.delta") {
            setState("Speaking");
            setTranscript((t) => t + event.delta);
          }
          if (event.type === "response.done") setState("Listening");
          if (event.type === "error")
            setError("Voice encountered an error. End the call and try again.");
        } catch {}
      };
      pc.onconnectionstatechange = () => {
        if (
          pc.connectionState === "failed" ||
          pc.connectionState === "disconnected"
        ) {
          setError("The voice connection was interrupted.");
          setActive(false);
          cleanup();
        }
      };
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const response = await fetch("/api/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sdp: offer.sdp }),
      });
      if (!response.ok) {
        const value = await response.json();
        throw new Error(value.error || "Voice could not connect.");
      }
      const sdp = await response.text();
      if (!alive.current) return;
      await pc.setRemoteDescription({ type: "answer", sdp });
      timer.current = setTimeout(
        () => {
          cleanup();
          setActive(false);
          setState("Session ended");
          setBusy(false);
        },
        10 * 60 * 1000,
      );
    } catch (e) {
      cleanup();
      setError(errorMessage(e));
      setState("Ready when you are");
      setBusy(false);
    }
  }
  return (
    <Modal
      title={t("Voice conversation")}
      onClose={onClose}
      className="voice-modal"
    >
      <div className="voice-body">
        <div className={`voice-orb ${active ? "active" : ""}`}>
          <AudioLines size={65} strokeWidth={1.25} />
        </div>
        <h3>{t(state)}</h3>
        <p className="voice-transcript" aria-live="polite">
          {transcript || t("A little space to talk things through.")}
        </p>
        {error ? (
          <p className="error-box" role="alert">
            {t(error)}
          </p>
        ) : null}
        <div className="voice-controls">
          {active ? (
            <>
              <button
                className={`voice-control ${muted ? "muted-mic" : ""}`}
                aria-label={
                  muted ? t("Unmute microphone") : t("Mute microphone")
                }
                onClick={() => {
                  const value = !muted;
                  stream.current
                    ?.getAudioTracks()
                    .forEach((t) => (t.enabled = !value));
                  setMuted(value);
                }}
              >
                {muted ? <MicOff /> : <Mic />}
              </button>
              <button
                className="voice-control end-call"
                aria-label={t("End voice conversation")}
                onClick={onClose}
              >
                <PhoneOff />
              </button>
            </>
          ) : (
            <button className="primary" onClick={start} disabled={busy}>
              {busy ? <Spinner /> : <Mic size={18} />}{" "}
              {busy ? t("Connecting") : t("Start talking")}
            </button>
          )}
        </div>
        <small>
          {t("Separate from your text chat · not saved")}
          <br />
          {t("Sessions end after 10 minutes")}
        </small>
      </div>
    </Modal>
  );
}

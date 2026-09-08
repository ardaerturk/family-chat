"use client";
import { useRef, useEffect, useLayoutEffect, useState } from "react";
import {
  Plus,
  ArrowUp,
  Square,
  AudioLines,
  X,
  FileText,
  Paperclip,
  Camera,
  Image as ImageIcon,
  Keyboard,
} from "lucide-react";
import type { Attachment } from "@/lib/types";
import { ActionMenu, IconButton, Spinner } from "./ui";
import { dismissKeyboard } from "@/lib/mobile";
export default function Composer({
  text,
  setText,
  files,
  onFiles,
  onCameraPhoto,
  onRemove,
  onSend,
  onStop,
  busy,
  uploading,
  temporary,
  voice,
  onVoice,
  editing,
  onCancelEdit,
}: {
  text: string;
  setText: (s: string) => void;
  files: Attachment[];
  onFiles: (f: FileList) => void;
  onCameraPhoto: (photo: File) => void;
  onRemove: (id: string) => void;
  onSend: () => void;
  onStop: () => void;
  busy: boolean;
  uploading: boolean;
  temporary: boolean;
  voice: boolean;
  onVoice: () => void;
  editing: boolean;
  onCancelEdit: () => void;
}) {
  const areaRef = useRef<HTMLDivElement>(null);
  const ref = useRef<HTMLTextAreaElement>(null),
    fileRef = useRef<HTMLInputElement>(null),
    cameraRef = useRef<HTMLInputElement>(null);
  const [menu, setMenu] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    function resize() {
      if (!el) return;
      const limit = Math.max(
        64,
        Math.min(180, (window.visualViewport?.height ?? innerHeight) * 0.3),
      );
      el.style.height = "0px";
      const height = el.scrollHeight;
      el.style.height = `${Math.min(height, limit)}px`;
      el.style.overflowY = height > limit ? "auto" : "hidden";
    }
    resize();
    window.visualViewport?.addEventListener("resize", resize);
    window.addEventListener("resize", resize);
    return () => {
      window.visualViewport?.removeEventListener("resize", resize);
      window.removeEventListener("resize", resize);
    };
  }, [text]);
  useEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    const observer = new ResizeObserver(() => {
      area.parentElement?.style.setProperty(
        "--composer-height",
        `${area.offsetHeight}px`,
      );
    });
    observer.observe(area);
    return () => observer.disconnect();
  }, []);
  function keepKeyboard(e: React.PointerEvent<HTMLButtonElement>) {
    if (document.activeElement === ref.current) e.preventDefault();
  }
  return (
    <div className="composer-area" ref={areaRef}>
      {editing ? (
        <div className="edit-banner">
          Editing message
          <IconButton label="Cancel edit" onClick={onCancelEdit}>
            <X size={16} />
          </IconButton>
        </div>
      ) : null}
      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy && !uploading && text.trim()) onSend();
        }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (!busy && !uploading && !temporary) onFiles(e.dataTransfer.files);
        }}
      >
        {files.length || uploading ? (
          <div className="attachments">
            {files.map((f) => (
              <div key={f.id} className="attachment">
                <div
                  className={`file-icon ${f.mime.startsWith("image/") ? "image" : ""}`}
                >
                  {f.mime.startsWith("image/") ? (
                    <ImageIcon size={21} />
                  ) : (
                    <FileText size={21} />
                  )}
                </div>
                <span>
                  <strong>{f.name}</strong>
                  <small>{(f.size / 1024).toFixed(0)} KB</small>
                </span>
                <IconButton
                  label={`Remove ${f.name}`}
                  onClick={() => onRemove(f.id)}
                  disabled={busy}
                >
                  <X size={14} />
                </IconButton>
              </div>
            ))}
            {uploading ? (
              <span className="uploading">
                <Spinner /> Uploading…
              </span>
            ) : null}
          </div>
        ) : null}
        <textarea
          ref={ref}
          aria-label="Message"
          placeholder="Ask anything"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={1}
          enterKeyHint="enter"
          autoCapitalize="sentences"
          autoCorrect="on"
          spellCheck
          onKeyDown={(e) => {
            if (
              e.key === "Enter" &&
              !e.shiftKey &&
              !e.nativeEvent.isComposing &&
              e.nativeEvent.keyCode !== 229 &&
              window.matchMedia("(hover: hover) and (pointer: fine)").matches
            ) {
              e.preventDefault();
              if (!busy && !uploading && text.trim()) onSend();
            }
          }}
        />
        <div className="composer-toolbar">
          <div className="attachment-menu-wrap">
            <IconButton
              label="Add attachments"
              disabled={busy || uploading || temporary || files.length >= 4}
              onClick={() => {
                dismissKeyboard();
                setMenu(!menu);
              }}
              aria-expanded={menu}
              aria-haspopup="dialog"
            >
              <Plus size={24} />
            </IconButton>
            {menu ? (
              <ActionMenu
                title="Add attachments"
                className="attachment-menu"
                onClose={() => setMenu(false)}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.currentTarget.closest("dialog")?.close();
                    cameraRef.current?.click();
                    setMenu(false);
                  }}
                >
                  <Camera size={18} /> Take photo
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.currentTarget.closest("dialog")?.close();
                    fileRef.current?.click();
                    setMenu(false);
                  }}
                >
                  <Paperclip size={18} /> Add photos & files
                </button>
                <p>
                  PDF, images, text & code
                  <br />
                  Up to 3 MB each · 4 files per message
                </p>
              </ActionMenu>
            ) : null}
          </div>
          <input
            ref={cameraRef}
            className="sr-only"
            tabIndex={-1}
            type="file"
            aria-label="Take a photo with your camera"
            accept="image/*"
            capture="environment"
            disabled={busy || uploading || temporary || files.length >= 4}
            onChange={(e) => {
              const photo = e.target.files?.[0];
              if (photo) onCameraPhoto(photo);
              e.target.value = "";
            }}
          />
          <input
            ref={fileRef}
            className="sr-only"
            tabIndex={-1}
            type="file"
            aria-label="Upload files"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.webp,.txt,.md,.csv,.tsv,.json,.py,.js,.ts,.tsx,.jsx,.css,.html,.xml,.yaml,.yml,.log,.sql"
            onChange={(e) => {
              if (e.target.files) onFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <div className="composer-right">
            <IconButton
              label="Hide keyboard"
              className="keyboard-dismiss"
              onClick={dismissKeyboard}
            >
              <Keyboard size={20} />
            </IconButton>
            {voice && !text && !busy ? (
              <IconButton
                label="Start voice conversation"
                className="voice-button"
                onClick={onVoice}
              >
                <AudioLines size={23} />
              </IconButton>
            ) : null}
            {busy ? (
              <IconButton
                label="Stop generating"
                className="send-button"
                onClick={onStop}
                onPointerDown={keepKeyboard}
              >
                <Square size={14} fill="currentColor" />
              </IconButton>
            ) : text || !voice ? (
              <button
                className="send-button icon-button"
                type="submit"
                aria-label="Send message"
                disabled={!text.trim() || uploading}
                onPointerDown={keepKeyboard}
              >
                <ArrowUp size={22} strokeWidth={2.4} />
              </button>
            ) : null}
          </div>
        </div>
      </form>
      <p className="composer-disclaimer">
        {temporary
          ? "Temporary chat · not saved to your history"
          : "AI can make mistakes. Check important information."}
      </p>
    </div>
  );
}

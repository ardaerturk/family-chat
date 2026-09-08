"use client";
import { useRef, useEffect, useState } from "react";
import {
  Plus,
  ArrowUp,
  Square,
  AudioLines,
  X,
  FileText,
  Paperclip,
  Image as ImageIcon,
} from "lucide-react";
import type { Attachment } from "@/lib/types";
import { IconButton, Spinner } from "./ui";
export default function Composer({
  text,
  setText,
  files,
  onFiles,
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
  const ref = useRef<HTMLTextAreaElement>(null),
    fileRef = useRef<HTMLInputElement>(null);
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (el) {
      el.style.height = "0px";
      el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
    }
  }, [text]);
  return (
    <div className="composer-area">
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
          if (!busy && !temporary) onFiles(e.dataTransfer.files);
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
          disabled={busy}
          onKeyDown={(e) => {
            if (
              e.key === "Enter" &&
              !e.shiftKey &&
              !e.nativeEvent.isComposing &&
              window.matchMedia("(min-width: 768px)").matches
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
              onClick={() => setMenu(!menu)}
              aria-expanded={menu}
            >
              <Plus size={24} />
            </IconButton>
            {menu ? (
              <>
                <button
                  className="menu-dismiss"
                  aria-label="Close attachment menu"
                  onClick={() => setMenu(false)}
                />
                <div className="popover attachment-menu">
                  <button
                    type="button"
                    onClick={() => {
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
                </div>
              </>
            ) : null}
          </div>
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
            {voice && !text && !busy ? (
              <IconButton label="Start voice conversation" onClick={onVoice}>
                <AudioLines size={23} />
              </IconButton>
            ) : null}
            {busy ? (
              <IconButton
                label="Stop generating"
                className="send-button"
                onClick={onStop}
              >
                <Square size={14} fill="currentColor" />
              </IconButton>
            ) : (
              <button
                className="send-button icon-button"
                type="submit"
                aria-label="Send message"
                disabled={!text.trim() || uploading}
              >
                <ArrowUp size={22} strokeWidth={2.4} />
              </button>
            )}
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

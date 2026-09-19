"use client";
import { useState } from "react";
import { Pin, PinOff } from "lucide-react";
import { api, errorMessage } from "@/lib/client";
import type { ConversationSummary, Folder } from "@/lib/types";
import { Modal } from "./ui";
import { useI18n } from "./language-provider";
export default function ChatOrganizer({
  chat,
  folders,
  onChanged,
  onClose,
}: {
  chat: ConversationSummary;
  folders: Folder[];
  onChanged: () => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [title, setTitle] = useState(chat.title),
    [folderId, setFolder] = useState(chat.folderId ?? ""),
    [pinned, setPinned] = useState(!!chat.pinned),
    [useMemory, setUse] = useState(chat.useMemory !== false),
    [generateMemory, setGenerate] = useState(chat.generateMemory === true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <Modal
      title={t("Organize conversation")}
      onClose={onClose}
      className="organizer-modal"
    >
      <form
        className="organizer-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await api(`chats/${chat.id}`, "PATCH", {
              title: title.trim(),
              folderId: folderId || null,
              pinned,
              useMemory,
              generateMemory,
            });
            await onChanged();
            onClose();
          } catch (e) {
            setError(errorMessage(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          {t("Chat name")}
          <input
            value={title}
            maxLength={100}
            required
            onChange={(e) => setTitle(e.target.value)}
            disabled={busy}
          />
        </label>
        <label>
          {t("Folder")}
          <select
            aria-label={t("Folder")}
            value={folderId}
            onChange={(e) => setFolder(e.target.value)}
            disabled={busy}
          >
            <option value="">{t("Unfiled")}</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="secondary pin-control"
          aria-pressed={pinned}
          disabled={busy}
          onClick={() => setPinned(!pinned)}
        >
          {pinned ? <PinOff size={17} /> : <Pin size={17} />}{" "}
          {t(pinned ? "Unpin chat" : "Pin chat")}
        </button>
        <fieldset className="memory-controls">
          <legend>{t("Memory for this conversation")}</legend>
          <label>
            <input
              type="checkbox"
              checked={useMemory}
              disabled={busy}
              onChange={(e) => setUse(e.target.checked)}
            />
            {t("Use saved memories")}
          </label>
          <label>
            <input
              type="checkbox"
              checked={generateMemory}
              disabled={busy}
              onChange={(e) => setGenerate(e.target.checked)}
            />
            {t("Learn from this conversation")}
          </label>
          <p>{t("These choices apply when memory is enabled in Settings.")}</p>
        </fieldset>
        {error ? (
          <p className="error-box" role="alert">
            {t(error)}
          </p>
        ) : null}
        <div className="modal-actions">
          <button className="secondary" type="button" onClick={onClose}>
            {t("Cancel")}
          </button>
          <button className="primary" disabled={busy || !title.trim()}>
            {t(busy ? "Saving…" : "Save")}
          </button>
        </div>
      </form>
    </Modal>
  );
}

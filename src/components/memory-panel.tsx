"use client";
import { useEffect, useState } from "react";
import { Brain, Pencil, Trash2, Plus, RefreshCw } from "lucide-react";
import type { MemorySettings, MemoryState, MemoryEntry } from "@/lib/types";
import { api, errorMessage } from "@/lib/client";
import { useI18n } from "./language-provider";
import { IconButton, Spinner } from "./ui";
type Data = { state: MemoryState; settings: MemorySettings };
export default function MemoryPanel({
  onOpenChat,
}: {
  onOpenChat: (id: string) => void;
}) {
  const { t } = useI18n();
  const [data, setData] = useState<Data | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [editing, setEditing] = useState<MemoryEntry | "new" | null>(null),
    [text, setText] = useState(""),
    [clear, setClear] = useState(false);
  async function load() {
    setData(await api<Data>("memories"));
  }
  useEffect(() => {
    load().catch((e) => setError(errorMessage(e)));
  }, []);
  async function action(fn: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await fn();
      await load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function setting(key: keyof MemorySettings, value: boolean) {
    await action(() =>
      api("preferences", "PATCH", { memory: { [key]: value } }),
    );
  }
  return (
    <div className="memory-panel">
      <div className="memory-intro">
        <Brain size={23} />
        <div>
          <h3>{t("Memory")}</h3>
          <p>
            {t(
              "Useful context that carries into your next conversation. Private to your account.",
            )}
          </p>
        </div>
        <IconButton
          label={t("Refresh memories")}
          disabled={busy}
          onClick={() => action(load)}
        >
          <RefreshCw size={17} />
        </IconButton>
      </div>
      {error ? (
        <p className="error-box" role="alert">
          {t(error)}
        </p>
      ) : null}
      {!data ? (
        <Spinner />
      ) : (
        <>
          <div className="memory-controls">
            <label>
              <input
                type="checkbox"
                checked={data.settings.enabled}
                disabled={busy}
                onChange={(e) => setting("enabled", e.target.checked)}
              />
              <strong>{t("Enable memory")}</strong>
            </label>
            <label>
              <input
                type="checkbox"
                checked={data.settings.use}
                disabled={busy || !data.settings.enabled}
                onChange={(e) => setting("use", e.target.checked)}
              />
              {t("Use saved memories")}
            </label>
            <label>
              <input
                type="checkbox"
                checked={data.settings.generate}
                disabled={busy || !data.settings.enabled}
                onChange={(e) => setting("generate", e.target.checked)}
              />
              {t("Learn from new conversations")}
            </label>
            <label>
              <input
                type="checkbox"
                checked={data.settings.excludeSearch}
                disabled={busy || !data.settings.enabled}
                onChange={(e) => setting("excludeSearch", e.target.checked)}
              />
              {t("Exclude conversations that use web search")}
            </label>
          </div>
          <p className="memory-explanation">
            {t(
              "Automatic memory updates run in the background after a conversation has been idle for at least six hours. Temporary chats never use or create memories.",
            )}
          </p>
          <div className="memory-list-heading">
            <h3>
              {t("Saved memories")} <span>{data.state.entries.length}/30</span>
            </h3>
            <button
              type="button"
              className="secondary"
              disabled={busy || data.state.entries.length >= 30}
              onClick={() => {
                setEditing("new");
                setText("");
              }}
            >
              <Plus size={16} />
              {t("Add memory")}
            </button>
          </div>
          {editing ? (
            <form
              className="memory-editor"
              onSubmit={(e) => {
                e.preventDefault();
                void action(async () => {
                  await api(
                    editing === "new" ? "memories" : `memories/${editing.id}`,
                    editing === "new" ? "POST" : "PATCH",
                    { text: text.trim() },
                  );
                  setEditing(null);
                });
              }}
            >
              <label>
                {t("What should be remembered?")}
                <textarea
                  value={text}
                  maxLength={500}
                  required
                  rows={4}
                  onChange={(e) => setText(e.target.value)}
                  disabled={busy}
                />
              </label>
              <p>{t("Do not add passwords, keys, or other secrets.")}</p>
              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setEditing(null)}
                >
                  {t("Cancel")}
                </button>
                <button className="primary" disabled={busy || !text.trim()}>
                  {t("Save memory")}
                </button>
              </div>
            </form>
          ) : null}
          {data.state.entries.length ? (
            <ul className="memory-list">
              {data.state.entries.map((m) => (
                <li key={m.id}>
                  <p>{m.text}</p>
                  {m.sourceChatId ? (
                    <details>
                      <summary>{t("Source")}</summary>
                      <blockquote>{m.quote}</blockquote>
                      <button
                        className="text-button"
                        onClick={() => onOpenChat(m.sourceChatId!)}
                      >
                        {t("View source conversation")}
                      </button>
                    </details>
                  ) : (
                    <small>{t("Saved by you")}</small>
                  )}
                  <div className="memory-entry-actions">
                    <IconButton
                      label={t("Edit memory")}
                      disabled={busy}
                      onClick={() => {
                        setEditing(m);
                        setText(m.text);
                      }}
                    >
                      <Pencil size={16} />
                    </IconButton>
                    <IconButton
                      label={t("Delete memory")}
                      disabled={busy}
                      onClick={() =>
                        action(() => api(`memories/${m.id}`, "DELETE"))
                      }
                    >
                      <Trash2 size={16} />
                    </IconButton>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="memory-empty">
              {t(
                "No saved memories yet. Add one now, or let eligible conversations build them over time.",
              )}
            </p>
          )}
          {data.state.entries.length ? (
            <>
              {clear ? (
                <div className="confirmation">
                  <p>
                    {t(
                      "Delete all memories? Previous conversations will not be used to rebuild them.",
                    )}
                  </p>
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() => setClear(false)}
                  >
                    {t("Cancel")}
                  </button>
                  <button
                    className="secondary danger"
                    disabled={busy}
                    onClick={() =>
                      action(async () => {
                        await api("memories", "DELETE");
                        setClear(false);
                        setEditing(null);
                      })
                    }
                  >
                    {t("Delete all memories")}
                  </button>
                </div>
              ) : (
                <button
                  className="secondary danger"
                  disabled={busy}
                  onClick={() => setClear(true)}
                >
                  {t("Delete all memories")}
                </button>
              )}
            </>
          ) : null}
          <p className="memory-explanation">
            {t(
              "Turning memory off keeps saved entries. Editing or deleting an automatic entry stops that source conversation from generating it again.",
            )}
          </p>
        </>
      )}
    </div>
  );
}

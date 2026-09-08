"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  PanelLeft,
  SquarePen,
  ChevronDown,
  Check,
  MessageCircleDashed,
  MoreHorizontal,
  Pencil,
  Pin,
  Trash2,
  X,
  Lightbulb,
  BookOpen,
  Code2,
  Compass,
} from "lucide-react";
import type {
  Attachment,
  Conversation,
  ConversationSummary,
  Message,
  Model,
  Person,
} from "@/lib/types";
import { api, ApiError, errorMessage } from "@/lib/client";
import Welcome from "./welcome";
import Sidebar from "./sidebar";
import Composer from "./composer";
import Messages from "./messages";
import { IconButton, Modal, Spinner } from "./ui";
const Settings = dynamic(() => import("./settings"));
const Voice = dynamic(() => import("./voice"));
type Identity = { person: Person; models: Model[]; voice: boolean };
const suggestions = [
  {
    icon: Lightbulb,
    label: "Make a plan",
    prompt:
      "Help me make a realistic plan for my week. Ask me what I need to get done first.",
  },
  {
    icon: BookOpen,
    label: "Learn something",
    prompt:
      "Teach me something interesting. Start by asking what I’m curious about.",
  },
  {
    icon: Code2,
    label: "Write or code",
    prompt:
      "Help me turn an idea into something useful. Ask me what I would like to write or build.",
  },
  {
    icon: Compass,
    label: "Explore an idea",
    prompt:
      "I have an idea I’d like to think through. Help me explore it by asking a thoughtful first question.",
  },
];
export default function ChatApp() {
  const [identity, setIdentity] = useState<Identity | null>(null),
    [loading, setLoading] = useState(true),
    [bootError, setBootError] = useState(""),
    [invite, setInvite] = useState<string | null>(null),
    [chats, setChats] = useState<ConversationSummary[]>([]),
    [active, setActive] = useState<string | null>(null),
    [messages, setMessages] = useState<Message[]>([]),
    [text, setText] = useState(""),
    [files, setFiles] = useState<Attachment[]>([]),
    [model, setModel] = useState(""),
    [reasoning, setReasoning] = useState("medium"),
    [busy, setBusy] = useState(false),
    [uploading, setUploading] = useState(false),
    [error, setError] = useState(""),
    [sidebar, setSidebar] = useState(false),
    [modelMenu, setModelMenu] = useState(false),
    [moreMenu, setMoreMenu] = useState(false),
    [settings, setSettings] = useState(false),
    [voice, setVoice] = useState(false),
    [temporary, setTemporary] = useState(false),
    [theme, setThemeState] = useState("system"),
    [editing, setEditing] = useState<string | null>(null),
    [rename, setRename] = useState<string | null>(null),
    [confirmDelete, setConfirmDelete] = useState(false),
    [offline, setOffline] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const streamingId = useRef<string | null>(null);
  async function refreshChats() {
    setChats(await api<ConversationSummary[]>("chats"));
  }
  async function boot() {
    setBootError("");
    try {
      const me = await api<Identity>("me");
      setIdentity(me);
      setModel((current) =>
        me.models.some((m) => m.id === current) ? current : me.models[0].id,
      );
      await refreshChats();
      setInvite(null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setIdentity(null);
      else setBootError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    const hash = new URLSearchParams(location.hash.slice(1));
    const token = hash.get("invite");
    if (token) {
      setInvite(token);
      history.replaceState(null, "", location.pathname);
    }
    const saved = localStorage.getItem("family-theme");
    if (["light", "dark", "system"].includes(saved ?? "")) {
      setThemeState(saved!);
      document.documentElement.dataset.theme = saved!;
    }
    boot();
    if ("serviceWorker" in navigator)
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    const online = () => setOffline(!navigator.onLine);
    online();
    window.addEventListener("online", online);
    window.addEventListener("offline", online);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", online);
      abort.current?.abort();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const viewport = window.visualViewport;
    const resize = () =>
      document.documentElement.style.setProperty(
        "--app-height",
        `${viewport?.height ?? window.innerHeight}px`,
      );
    resize();
    viewport?.addEventListener("resize", resize);
    return () => viewport?.removeEventListener("resize", resize);
  }, []);
  useEffect(() => {
    function keys(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSidebar(true);
        setTimeout(
          () =>
            document
              .querySelector<HTMLInputElement>('[aria-label="Search chats"]')
              ?.focus(),
          100,
        );
      }
    }
    window.addEventListener("keydown", keys);
    return () => window.removeEventListener("keydown", keys);
  }, []);
  function setTheme(v: string) {
    setThemeState(v);
    document.documentElement.dataset.theme = v;
    localStorage.setItem("family-theme", v);
  }
  function newChat(temp = false) {
    if (busy || uploading) return;
    files.forEach((f) => api(`files/${f.id}`, "DELETE").catch(() => {}));
    setActive(null);
    setMessages([]);
    setText("");
    setFiles([]);
    setTemporary(temp);
    setEditing(null);
    setError("");
    setSidebar(false);
    setMoreMenu(false);
  }
  async function select(id: string) {
    if (busy || uploading) return;
    setError("");
    try {
      const c = await api<Conversation>(`chats/${id}`);
      setActive(id);
      setMessages(c.messages);
      setModel(c.model);
      setTemporary(false);
      setFiles([]);
      setText("");
      setEditing(null);
      setSidebar(false);
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  async function upload(list: FileList | File[], camera = false) {
    if (temporary || busy || uploading) return;
    const selected = Array.from(list);
    if (selected.length + files.length > 4) {
      setError("Attach up to four files per message.");
      return;
    }
    setUploading(true);
    setError("");
    try {
      for (const source of selected) {
        const f = camera
          ? await (
              await import("@/lib/camera-photo")
            ).prepareCameraPhoto(source)
          : source;
        if (f.size > 3 * 1024 * 1024)
          throw new Error("Files can be up to 3 MB each.");
        const form = new FormData();
        form.append("file", f);
        const r = await fetch("/api/files", { method: "POST", body: form });
        const result = await r.json();
        if (!r.ok) throw new Error(result.error || "The upload failed.");
        setFiles((current) => [...current, result]);
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setUploading(false);
    }
  }
  function removeFile(id: string) {
    setFiles((current) => current.filter((f) => f.id !== id));
    api(`files/${id}`, "DELETE").catch(() => {});
  }
  async function send(retry = false) {
    if (busy || uploading || !identity) return;
    const prompt = retry
      ? ([...messages].reverse().find((m) => m.role === "user")?.content ??
        "Continue")
      : text.trim();
    if (!prompt) return;
    setError("");
    setBusy(true);
    setModelMenu(false);
    const previous = messages;
    let base = retry
      ? messages.slice(0, -1)
      : editing
        ? messages.slice(
            0,
            messages.findIndex((m) => m.id === editing),
          )
        : messages;
    const existingFiles = editing
      ? messages.find((m) => m.id === editing)?.files
      : undefined;
    if (!retry)
      base = [
        ...base,
        {
          id: crypto.randomUUID(),
          role: "user",
          content: prompt,
          files: files.length ? files : existingFiles,
          createdAt: new Date().toISOString(),
        },
      ];
    const responseId = crypto.randomUUID();
    setMessages([
      ...base,
      {
        id: responseId,
        role: "assistant",
        content: "",
        model: identity.models.find((m) => m.id === model)?.label,
        createdAt: new Date().toISOString(),
      },
    ]);
    const controller = new AbortController();
    abort.current = controller;
    streamingId.current = null;
    let started = false;
    let failed = false;
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: active ?? undefined,
          message: prompt,
          files: files.map((f) => f.id),
          model,
          reasoning,
          temporary,
          temporaryMessages: temporary
            ? previous.map(({ role, content }) => ({ role, content }))
            : undefined,
          retry,
          editMessageId: editing ?? undefined,
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const value = await response.json();
        throw new Error(value.error || "The message could not be sent.");
      }
      setText("");
      setFiles([]);
      setEditing(null);
      const reader = response.body?.getReader();
      if (!reader) throw new Error("The connection ended. Please try again.");
      const decoder = new TextDecoder();
      let pending = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        pending += decoder.decode(value, { stream: true });
        let newline;
        while ((newline = pending.indexOf("\n")) >= 0) {
          const line = pending.slice(0, newline);
          pending = pending.slice(newline + 1);
          if (!line) continue;
          const event = JSON.parse(line);
          if (event.type === "start") {
            started = true;
            streamingId.current = event.conversationId;
            if (!temporary) setActive(event.conversationId);
          }
          if (event.type === "delta")
            setMessages((current) =>
              current.map((m) =>
                m.id === responseId
                  ? { ...m, content: m.content + event.text }
                  : m,
              ),
            );
          if (event.type === "error" || event.type === "notice") {
            setError(event.message);
            if (event.type === "error") failed = true;
          }
          if (event.type === "done")
            setMessages((current) =>
              current.map((m) =>
                m.id === responseId ? { ...m, status: event.status } : m,
              ),
            );
        }
      }
    } catch (e) {
      if (controller.signal.aborted) {
        setMessages((current) =>
          current.map((m) =>
            m.id === responseId ? { ...m, status: "stopped" } : m,
          ),
        );
      } else {
        setError(errorMessage(e));
        if (!started) setMessages(previous);
        failed = true;
      }
    } finally {
      setBusy(false);
      abort.current = null;
      if (!temporary) {
        try {
          await refreshChats();
          if (streamingId.current && !controller.signal.aborted) {
            const c = await api<Conversation>(`chats/${streamingId.current}`);
            setMessages(c.messages);
          }
        } catch {
          if (!failed) setError("Could not refresh saved chat history.");
        }
      }
    }
  }
  async function renameChat() {
    if (!active || !rename?.trim()) return;
    try {
      await api(`chats/${active}`, "PATCH", { title: rename.trim() });
      setRename(null);
      await refreshChats();
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  async function deleteChat() {
    if (!active) return;
    try {
      await api(`chats/${active}`, "DELETE");
      setConfirmDelete(false);
      newChat();
      await refreshChats();
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  function logout() {
    setIdentity(null);
    setChats([]);
    setMessages([]);
    setActive(null);
    setSettings(false);
    setText("");
    setFiles([]);
  }
  if (loading)
    return (
      <div className="loading-screen">
        <Spinner />
        <span>Opening your space…</span>
      </div>
    );
  if (bootError)
    return (
      <main className="loading-screen">
        <p role="alert">{bootError}</p>
        <button className="primary" onClick={boot}>
          Try again
        </button>
      </main>
    );
  if (!identity || invite)
    return (
      <Welcome
        invite={invite}
        onSuccess={() => {
          setInvite(null);
          boot();
        }}
      />
    );
  const current = chats.find((c) => c.id === active),
    selectedModel =
      identity.models.find((m) => m.id === model) || identity.models[0];
  return (
    <div className="app-shell">
      <Sidebar
        person={identity.person}
        chats={chats}
        active={active}
        open={sidebar}
        busy={busy}
        onClose={() => setSidebar(false)}
        onNew={() => newChat()}
        onSelect={select}
        onSettings={() => {
          setSettings(true);
          setSidebar(false);
        }}
      />
      <main className="chat-main">
        <header className="chat-header">
          <IconButton
            label="Open sidebar"
            className="mobile-only"
            onClick={() => setSidebar(true)}
          >
            <PanelLeft size={23} />
          </IconButton>
          <div className="model-picker">
            <button
              className="model-trigger"
              onClick={() => setModelMenu(!modelMenu)}
              aria-expanded={modelMenu}
              disabled={busy}
            >
              {selectedModel.label}
              <ChevronDown size={17} />
            </button>
            {modelMenu ? (
              <>
                <button
                  className="menu-dismiss"
                  aria-label="Close model menu"
                  onClick={() => setModelMenu(false)}
                />
                <div className="popover model-menu">
                  <h3>Choose a model</h3>
                  {identity.models.map((m) => (
                    <button
                      key={m.id}
                      className="model-option"
                      onClick={() => {
                        setModel(m.id);
                        setModelMenu(false);
                      }}
                    >
                      <div>
                        <strong>{m.label}</strong>
                        <span>{m.description}</span>
                      </div>
                      {m.id === model ? <Check size={18} /> : null}
                    </button>
                  ))}
                  {selectedModel.reasoning ? (
                    <div className="reasoning-option">
                      <label htmlFor="reasoning">Thinking effort</label>
                      <select
                        id="reasoning"
                        value={reasoning}
                        onChange={(e) => setReasoning(e.target.value)}
                      >
                        <option value="low">Quick</option>
                        <option value="medium">Balanced</option>
                        <option value="high">Deep</option>
                      </select>
                    </div>
                  ) : null}
                  <p>Available through your private Azure connection</p>
                </div>
              </>
            ) : null}
          </div>
          <div className="header-right">
            {temporary ? (
              <span className="temporary-label">Temporary</span>
            ) : null}
            <IconButton
              label="Temporary chat"
              className={`${temporary ? "is-active" : ""} desktop-only`}
              disabled={busy}
              onClick={() => newChat(!temporary)}
            >
              <MessageCircleDashed size={22} />
            </IconButton>
            <IconButton
              label="New chat"
              onClick={() => newChat()}
              disabled={busy}
            >
              <SquarePen size={22} />
            </IconButton>
            <div className="more-wrap">
              <IconButton
                label="Chat options"
                onClick={() => setMoreMenu(!moreMenu)}
                disabled={busy}
              >
                <MoreHorizontal size={23} />
              </IconButton>
              {moreMenu ? (
                <>
                  <button
                    className="menu-dismiss"
                    aria-label="Close chat options"
                    onClick={() => setMoreMenu(false)}
                  />
                  <div className="popover more-menu">
                    {active ? (
                      <>
                        <button
                          onClick={() => {
                            setRename(current?.title ?? "");
                            setMoreMenu(false);
                          }}
                        >
                          <Pencil size={17} />
                          Rename
                        </button>
                        <button
                          onClick={async () => {
                            try {
                              await api(`chats/${active}`, "PATCH", {
                                pinned: !current?.pinned,
                              });
                              await refreshChats();
                              setMoreMenu(false);
                            } catch (e) {
                              setError(errorMessage(e));
                            }
                          }}
                        >
                          <Pin size={17} />
                          {current?.pinned ? "Unpin chat" : "Pin chat"}
                        </button>
                        <button
                          className="danger"
                          onClick={() => {
                            setConfirmDelete(true);
                            setMoreMenu(false);
                          }}
                        >
                          <Trash2 size={17} />
                          Delete chat
                        </button>
                      </>
                    ) : null}
                    <button
                      onClick={() => {
                        newChat(!temporary);
                        setMoreMenu(false);
                      }}
                    >
                      <MessageCircleDashed size={17} />
                      {temporary ? "Saved chat" : "Temporary chat"}
                    </button>
                    <button
                      onClick={() => {
                        setSettings(true);
                        setMoreMenu(false);
                      }}
                    >
                      Settings
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </header>
        {offline ? (
          <div className="offline-banner" role="status">
            You’re offline. Reconnect to send a message.
          </div>
        ) : null}
        {!messages.length ? (
          <div className="empty-state">
            <div className="empty-content">
              {temporary ? (
                <MessageCircleDashed className="empty-icon" size={36} />
              ) : null}
              <h1>
                {temporary
                  ? "A little off the record."
                  : "What’s on your mind?"}
              </h1>
              {temporary ? (
                <p>This chat won’t appear in your history.</p>
              ) : (
                <div className="suggestions">
                  {suggestions.map((s) => (
                    <button
                      key={s.label}
                      onClick={() => {
                        setText(s.prompt);
                        document
                          .querySelector<HTMLTextAreaElement>(
                            '[aria-label="Message"]',
                          )
                          ?.focus();
                      }}
                    >
                      <s.icon size={17} />
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <Messages
            messages={messages}
            busy={busy}
            onRetry={() => send(true)}
            onEdit={(m) => {
              setEditing(m.id);
              setText(m.content);
              setFiles([]);
              document
                .querySelector<HTMLTextAreaElement>('[aria-label="Message"]')
                ?.focus();
            }}
          />
        )}
        {error ? (
          <div className="chat-error" role="alert">
            <span>{error}</span>
            <IconButton label="Dismiss error" onClick={() => setError("")}>
              <X size={16} />
            </IconButton>
          </div>
        ) : null}
        <Composer
          text={text}
          setText={setText}
          files={files}
          onFiles={upload}
          onCameraPhoto={(photo) => upload([photo], true)}
          onRemove={removeFile}
          onSend={() => send()}
          onStop={() => abort.current?.abort()}
          busy={busy}
          uploading={uploading}
          temporary={temporary}
          voice={identity.voice}
          onVoice={() => setVoice(true)}
          editing={!!editing}
          onCancelEdit={() => {
            setEditing(null);
            setText("");
          }}
        />
      </main>
      {settings ? (
        <Settings
          person={identity.person}
          theme={theme}
          setTheme={setTheme}
          onClose={() => setSettings(false)}
          onLogout={logout}
          onCleared={() => {
            newChat();
            refreshChats();
          }}
        />
      ) : null}
      {voice ? <Voice onClose={() => setVoice(false)} /> : null}
      {rename !== null ? (
        <Modal title="Rename chat" onClose={() => setRename(null)}>
          <form
            className="simple-form"
            onSubmit={(e) => {
              e.preventDefault();
              renameChat();
            }}
          >
            <input
              aria-label="Chat name"
              value={rename}
              maxLength={100}
              onChange={(e) => setRename(e.target.value)}
              autoFocus
            />
            <button className="primary">Save</button>
          </form>
        </Modal>
      ) : null}
      {confirmDelete ? (
        <Modal title="Delete chat?" onClose={() => setConfirmDelete(false)}>
          <div className="simple-form">
            <p>
              This removes this conversation and its attachments. It cannot be
              undone.
            </p>
            <button className="primary danger-button" onClick={deleteChat}>
              Delete chat
            </button>
            <button
              className="secondary"
              onClick={() => setConfirmDelete(false)}
            >
              Keep chat
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

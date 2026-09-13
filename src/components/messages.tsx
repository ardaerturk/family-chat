"use client";
import { useI18n } from "./language-provider";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Check,
  Copy,
  Pencil,
  RotateCcw,
  Volume2,
  FileText,
  ChevronDown,
  Globe,
} from "lucide-react";
import type { Message } from "@/lib/types";
import { IconButton, Mark } from "./ui";
import { safeSourceUrl } from "@/lib/web-search";
import { dismissKeyboard } from "@/lib/mobile";
function CodeBlock({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const ref = useRef<HTMLPreElement>(null),
    [copied, setCopied] = useState(false);
  return (
    <div className="code-block">
      <div className="code-header">
        <span>{t("Code")}</span>
        <button
          onClick={async () => {
            await navigator.clipboard.writeText(ref.current?.textContent ?? "");
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          }}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}{" "}
          {copied ? t("Copied") : t("Copy")}
        </button>
      </div>
      <pre ref={ref}>{children}</pre>
    </div>
  );
}
export default function Messages({
  messages,
  busy,
  activity,
  onRetry,
  onEdit,
}: {
  messages: Message[];
  busy: boolean;
  activity: "searching" | "reading" | null;
  onRetry: () => void;
  onEdit: (m: Message) => void;
}) {
  const { t } = useI18n();
  const content = useRef<HTMLDivElement>(null),
    area = useRef<HTMLDivElement>(null),
    [follow, setFollow] = useState(true),
    [copied, setCopied] = useState(""),
    [speaking, setSpeaking] = useState("");
  const following = useRef(true);
  const lastTop = useRef(0);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const lastUser = useRef<{ index: number; content: string } | null>(null);
  function scrollToBottom() {
    const el = area.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
      lastTop.current = el.scrollTop;
    }
  }
  useLayoutEffect(() => {
    const index = messages.findLastIndex((m) => m.role === "user");
    const content = messages[index]?.content ?? "";
    // Saved IDs replace optimistic IDs after streaming; that reconciliation
    // must not move a reader who has scrolled back through the conversation.
    if (
      index !== lastUser.current?.index ||
      content !== lastUser.current?.content
    ) {
      lastUser.current = { index, content };
      following.current = true;
      setFollow(true);
    }
    if (following.current) scrollToBottom();
  }, [messages]);
  useEffect(() => {
    const observer = new ResizeObserver(() => {
      if (following.current) scrollToBottom();
    });
    if (area.current) observer.observe(area.current);
    if (content.current) observer.observe(content.current);
    return () => observer.disconnect();
  }, []);
  useEffect(
    () => () => {
      window.speechSynthesis?.cancel();
    },
    [],
  );
  async function copy(m: Message) {
    try {
      await navigator.clipboard.writeText(m.content);
      setCopied(m.id);
      setTimeout(() => setCopied(""), 1800);
    } catch {}
  }
  function speak(m: Message) {
    if (!window.speechSynthesis) return;
    if (speaking === m.id) {
      window.speechSynthesis.cancel();
      setSpeaking("");
      return;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(m.content);
    u.onend = () => setSpeaking("");
    u.onerror = () => setSpeaking("");
    setSpeaking(m.id);
    window.speechSynthesis.speak(u);
  }
  return (
    <div
      className="message-scroller"
      ref={area}
      onTouchStart={(e) => {
        const typing = document.activeElement?.matches(".composer textarea");
        touch.current =
          typing && e.touches.length === 1
            ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
            : null;
      }}
      onTouchMove={(e) => {
        if (!touch.current || e.touches.length !== 1) return;
        const point = e.touches[0];
        if (
          point.clientY - touch.current.y > 40 &&
          Math.abs(point.clientX - touch.current.x) < 30
        ) {
          touch.current = null;
          if (!window.getSelection()?.toString()) dismissKeyboard();
        }
      }}
      onTouchEnd={() => {
        touch.current = null;
      }}
      onTouchCancel={() => {
        touch.current = null;
      }}
      onScroll={() => {
        const el = area.current;
        if (!el) return;
        const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
        // Only disengage when the reader moves upward, not when the keyboard
        // or a growing response changes the height of the scroll container.
        if (atBottom) following.current = true;
        else if (el.scrollTop < lastTop.current - 2) following.current = false;
        lastTop.current = el.scrollTop;
        setFollow(following.current);
      }}
    >
      <div className="messages" ref={content}>
        {messages.map((m, index) => (
          <article
            className={`message ${m.role}`}
            key={m.id}
            aria-label={m.role === "user" ? t("You") : t("Assistant")}
          >
            {m.role === "assistant" &&
            busy &&
            index === messages.length - 1 &&
            activity ? (
              <div className="search-activity" role="status">
                <Globe size={17} className="search-pulse" />
                {t(
                  activity === "searching"
                    ? "Searching the web…"
                    : "Reading sources…",
                )}
              </div>
            ) : null}
            <div className="message-content">
              {m.role === "user" ? (
                <>
                  {m.files?.length ? (
                    <div className="message-files">
                      {m.files.map((f) => (
                        <a
                          key={f.id}
                          href={`/api/files/${f.id}`}
                          className="message-file"
                        >
                          <FileText size={21} />
                          <span>{f.name}</span>
                        </a>
                      ))}
                    </div>
                  ) : null}
                  <div className="user-bubble">{m.content}</div>
                </>
              ) : (
                <div className="markdown">
                  {m.content ? (
                    <Markdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        pre: ({ children }) => (
                          <CodeBlock>{children}</CodeBlock>
                        ),
                        a: ({ href, children }) => (
                          <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {children}
                          </a>
                        ),
                        img: ({ alt }) => (
                          <span className="muted">
                            [{t("Image")}: {alt || t("external image")}]
                          </span>
                        ),
                      }}
                    >
                      {m.content}
                    </Markdown>
                  ) : busy && index === messages.length - 1 && !activity ? (
                    <div className="thinking">
                      <Mark size={22} />
                      <span>
                        {t("Thinking")}
                        <span className="thinking-dots">…</span>
                      </span>
                    </div>
                  ) : busy && activity ? null : (
                    <span className="muted">
                      {m.status === "error"
                        ? t("Couldn’t generate a response. Try again.")
                        : t("Response stopped.")}
                    </span>
                  )}
                </div>
              )}
            </div>
            {m.sources?.length ? (
              <details className="message-sources">
                <summary>
                  <Globe size={15} />
                  {t("Sources")} · {m.sources.length}
                </summary>
                <ol>
                  {m.sources
                    .filter((source) => safeSourceUrl(source.url))
                    .map((source) => (
                      <li key={source.url}>
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <strong>{source.title}</strong>
                          <span>{new URL(source.url).hostname}</span>
                        </a>
                      </li>
                    ))}
                </ol>
              </details>
            ) : null}
            {!(busy && index === messages.length - 1) && (
              <div
                className={`message-actions ${m.role === "user" ? "user-actions" : ""}`}
              >
                <IconButton label={t("Copy message")} onClick={() => copy(m)}>
                  {copied === m.id ? <Check size={16} /> : <Copy size={16} />}
                </IconButton>
                {m.role === "user" ? (
                  <IconButton
                    label={t("Edit message")}
                    disabled={busy}
                    onClick={() => onEdit(m)}
                  >
                    <Pencil size={16} />
                  </IconButton>
                ) : (
                  <>
                    <IconButton
                      label={
                        speaking === m.id ? t("Stop reading") : t("Read aloud")
                      }
                      onClick={() => speak(m)}
                    >
                      <Volume2 size={17} />
                    </IconButton>
                    {index === messages.length - 1 ? (
                      <IconButton
                        label={t("Regenerate response")}
                        disabled={busy}
                        onClick={onRetry}
                      >
                        <RotateCcw size={16} />
                      </IconButton>
                    ) : null}
                    <span className="message-model">{m.model}</span>
                    {m.status === "stopped" ? (
                      <small>{t("Stopped")}</small>
                    ) : null}
                  </>
                )}
              </div>
            )}
          </article>
        ))}
      </div>
      {!follow ? (
        <IconButton
          label={t("Scroll to latest message")}
          className="scroll-bottom"
          onClick={() => {
            following.current = true;
            setFollow(true);
            scrollToBottom();
          }}
        >
          <ChevronDown size={20} />
        </IconButton>
      ) : null}
    </div>
  );
}

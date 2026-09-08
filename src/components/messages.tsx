"use client";
import { useEffect, useRef, useState } from "react";
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
} from "lucide-react";
import type { Message } from "@/lib/types";
import { IconButton, Mark } from "./ui";
function CodeBlock({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLPreElement>(null),
    [copied, setCopied] = useState(false);
  return (
    <div className="code-block">
      <div className="code-header">
        <span>Code</span>
        <button
          onClick={async () => {
            await navigator.clipboard.writeText(ref.current?.textContent ?? "");
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          }}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}{" "}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre ref={ref}>{children}</pre>
    </div>
  );
}
export default function Messages({
  messages,
  busy,
  onRetry,
  onEdit,
}: {
  messages: Message[];
  busy: boolean;
  onRetry: () => void;
  onEdit: (m: Message) => void;
}) {
  const end = useRef<HTMLDivElement>(null),
    area = useRef<HTMLDivElement>(null),
    [follow, setFollow] = useState(true),
    [copied, setCopied] = useState(""),
    [speaking, setSpeaking] = useState("");
  useEffect(() => {
    if (follow)
      end.current?.scrollIntoView({ behavior: "instant", block: "end" });
  }, [messages, follow]);
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
      onScroll={() => {
        const el = area.current;
        if (el)
          setFollow(el.scrollHeight - el.scrollTop - el.clientHeight < 130);
      }}
    >
      <div className="messages">
        {messages.map((m, index) => (
          <article
            className={`message ${m.role}`}
            key={m.id}
            aria-label={m.role === "user" ? "You" : "Assistant"}
          >
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
                            [Image: {alt || "external image"}]
                          </span>
                        ),
                      }}
                    >
                      {m.content}
                    </Markdown>
                  ) : busy && index === messages.length - 1 ? (
                    <div className="thinking">
                      <Mark size={22} />
                      <span>
                        Thinking<span className="thinking-dots">…</span>
                      </span>
                    </div>
                  ) : (
                    <span className="muted">
                      {m.status === "error"
                        ? "Couldn’t generate a response. Try again."
                        : "Response stopped."}
                    </span>
                  )}
                </div>
              )}
            </div>
            {!(busy && index === messages.length - 1) && (
              <div
                className={`message-actions ${m.role === "user" ? "user-actions" : ""}`}
              >
                <IconButton label="Copy message" onClick={() => copy(m)}>
                  {copied === m.id ? <Check size={16} /> : <Copy size={16} />}
                </IconButton>
                {m.role === "user" ? (
                  <IconButton
                    label="Edit message"
                    disabled={busy}
                    onClick={() => onEdit(m)}
                  >
                    <Pencil size={16} />
                  </IconButton>
                ) : (
                  <>
                    <IconButton
                      label={speaking === m.id ? "Stop reading" : "Read aloud"}
                      onClick={() => speak(m)}
                    >
                      <Volume2 size={17} />
                    </IconButton>
                    {index === messages.length - 1 ? (
                      <IconButton
                        label="Regenerate response"
                        disabled={busy}
                        onClick={onRetry}
                      >
                        <RotateCcw size={16} />
                      </IconButton>
                    ) : null}
                    <span className="message-model">{m.model}</span>
                    {m.status === "stopped" ? <small>Stopped</small> : null}
                  </>
                )}
              </div>
            )}
          </article>
        ))}
        <div ref={end} />
      </div>
      {!follow ? (
        <IconButton
          label="Scroll to latest message"
          className="scroll-bottom"
          onClick={() => {
            setFollow(true);
            end.current?.scrollIntoView({ behavior: "smooth" });
          }}
        >
          <ChevronDown size={20} />
        </IconButton>
      ) : null}
    </div>
  );
}

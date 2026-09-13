"use client";
import { useI18n } from "./language-provider";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import {
  Search,
  SquarePen,
  PanelLeftClose,
  Settings,
  Pin,
  MessageCircle,
} from "lucide-react";
import type { ConversationSummary, Person } from "@/lib/types";
import { IconButton, Mark } from "./ui";
import { useMobile } from "@/lib/mobile";
export default function Sidebar({
  person,
  chats,
  active,
  open,
  busy,
  onClose,
  onNew,
  onSelect,
  onSettings,
}: {
  person: Person;
  chats: ConversationSummary[];
  active: string | null;
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onNew: () => void;
  onSelect: (id: string) => void;
  onSettings: () => void;
}) {
  const { t, language } = useI18n();
  const [search, setSearch] = useState("");
  const [now] = useState(() => Date.now());
  const mobile = useMobile();
  const closeFromKey = useEffectEvent(onClose);
  const panel = useRef<HTMLElement>(null);
  const gesture = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    if (!open || !mobile) return;
    const previous = document.activeElement;
    const el = panel.current;
    el?.querySelector<HTMLElement>("button")?.focus({ preventScroll: true });
    function key(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        closeFromKey();
      }
      if (e.key !== "Tab" || !el) return;
      const buttons = Array.from(
        el.querySelectorAll<HTMLElement>("button:not(:disabled), input"),
      );
      const first = buttons[0],
        last = buttons[buttons.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      }
      if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    }
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus({ preventScroll: true });
    };
  }, [open, mobile]);
  const filtered = chats.filter((c) =>
    c.title
      .toLocaleLowerCase(language)
      .includes(search.toLocaleLowerCase(language)),
  );
  let previous = "";
  return (
    <>
      <button
        className={`sidebar-backdrop ${open ? "visible" : ""}`}
        aria-label={t("Close chat history")}
        onClick={onClose}
        tabIndex={open ? 0 : -1}
      />
      <aside
        ref={panel}
        role={mobile && open ? "dialog" : undefined}
        aria-modal={mobile && open ? true : undefined}
        onTouchStart={(e) => {
          if (!mobile || !open || e.touches.length !== 1) return;
          gesture.current = {
            x: e.touches[0].clientX,
            y: e.touches[0].clientY,
          };
        }}
        onTouchEnd={(e) => {
          if (!gesture.current) return;
          const start = gesture.current;
          gesture.current = null;
          const touch = e.changedTouches[0];
          if (
            touch &&
            start.x - touch.clientX > 80 &&
            Math.abs(start.y - touch.clientY) < 45
          )
            onClose();
        }}
        onTouchCancel={() => {
          gesture.current = null;
        }}
        className={`sidebar ${open ? "open" : ""}`}
        aria-label={t("Chat history")}
        inert={!open && mobile ? true : undefined}
        aria-hidden={!open && mobile ? true : undefined}
      >
        <div className="sidebar-brand">
          <div>
            <Mark size={24} />
            <span>ChatGPT</span>
          </div>
          <IconButton
            label={t("Close sidebar")}
            className="mobile-only"
            onClick={onClose}
          >
            <PanelLeftClose size={20} />
          </IconButton>
        </div>
        <button className="sidebar-action" onClick={onNew} disabled={busy}>
          <SquarePen size={20} />
          {t("New chat")}
        </button>
        <label className="search-box">
          <Search size={19} />
          <input
            placeholder={t("Search chats")}
            aria-label={t("Search chats")}
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <kbd>⌘ K</kbd>
        </label>
        <nav className="chat-history">
          {filtered.length ? (
            filtered.map((c) => {
              const day = new Date(c.updatedAt).toDateString();
              const group = c.pinned
                ? t("Pinned")
                : day === new Date(now).toDateString()
                  ? t("Today")
                  : now - Date.parse(c.updatedAt) < 7 * 86400000
                    ? t("Previous 7 days")
                    : t("Earlier");
              const heading = group !== previous;
              previous = group;
              return (
                <div key={c.id}>
                  {heading ? <h3>{group}</h3> : null}
                  <button
                    className={`history-item ${active === c.id ? "selected" : ""}`}
                    disabled={busy}
                    onClick={() => onSelect(c.id)}
                  >
                    <span>{c.title}</span>
                    {c.pinned ? <Pin size={13} /> : null}
                  </button>
                </div>
              );
            })
          ) : (
            <div className="history-empty">
              <MessageCircle size={24} />
              <p>
                {search
                  ? t("No matching chats")
                  : t("Your conversations will appear here.")}
              </p>
            </div>
          )}
        </nav>
        <button className="profile-button" onClick={onSettings}>
          <span className="avatar">
            {person.name.slice(0, 1).toUpperCase()}
          </span>
          <span>
            <strong>{person.name}</strong>
            <small>
              {person.role === "owner"
                ? t("Personal account")
                : t("Personal account")}
            </small>
          </span>
          <Settings size={18} />
        </button>
      </aside>
    </>
  );
}

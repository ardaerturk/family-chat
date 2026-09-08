"use client";
import { useEffect, useState } from "react";
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
  const [search, setSearch] = useState("");
  const [now] = useState(() => Date.now());
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const q = window.matchMedia("(max-width:767px)");
    const update = () => setMobile(q.matches);
    update();
    q.addEventListener("change", update);
    return () => q.removeEventListener("change", update);
  }, []);
  const filtered = chats.filter((c) =>
    c.title.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  );
  let previous = "";
  return (
    <>
      <button
        className={`sidebar-backdrop ${open ? "visible" : ""}`}
        aria-label="Close chat history"
        onClick={onClose}
        tabIndex={open ? 0 : -1}
      />
      <aside
        className={`sidebar ${open ? "open" : ""}`}
        aria-label="Chat history"
        inert={!open && mobile ? true : undefined}
      >
        <div className="sidebar-brand">
          <div>
            <Mark size={24} />
            <span>Family Chat</span>
          </div>
          <IconButton
            label="Close sidebar"
            className="mobile-only"
            onClick={onClose}
          >
            <PanelLeftClose size={20} />
          </IconButton>
        </div>
        <button className="sidebar-action" onClick={onNew} disabled={busy}>
          <SquarePen size={20} />
          New chat
        </button>
        <label className="search-box">
          <Search size={19} />
          <input
            placeholder="Search chats"
            aria-label="Search chats"
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
                ? "Pinned"
                : day === new Date(now).toDateString()
                  ? "Today"
                  : now - Date.parse(c.updatedAt) < 7 * 86400000
                    ? "Previous 7 days"
                    : "Earlier";
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
                  ? "No matching chats"
                  : "Your conversations will appear here."}
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
              {person.role === "owner" ? "Personal account" : "Family account"}
            </small>
          </span>
          <Settings size={18} />
        </button>
      </aside>
    </>
  );
}

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
  Folder as FolderIcon,
  FolderPlus,
  MoreHorizontal,
  ChevronDown,
  ChevronRight,
  Layers,
} from "lucide-react";
import type { ConversationSummary, Person, Folder } from "@/lib/types";
import { api, errorMessage } from "@/lib/client";
import ChatOrganizer from "./chat-organizer";
import { IconButton, Mark, Modal } from "./ui";
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
  folders,
  selectedFolder,
  onFolder,
  onUpdated,
}: {
  folders: Folder[];
  selectedFolder: string | null;
  onFolder: (id: string | null) => void;
  onUpdated: () => Promise<void>;
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
  const [organize, setOrganize] = useState<ConversationSummary | null>(null),
    [folderEdit, setFolderEdit] = useState<Folder | "new" | null>(null),
    [folderName, setFolderName] = useState(""),
    [folderBusy, setFolderBusy] = useState(false),
    [folderError, setFolderError] = useState(""),
    [deleteFolder, setDeleteFolder] = useState(false),
    [foldersOpen, setFoldersOpen] = useState(true);
  function editFolder(folder: Folder | "new") {
    setFolderName(folder === "new" ? "" : folder.name);
    setFolderEdit(folder);
    setFolderError("");
    setDeleteFolder(false);
  }
  async function saveFolder(remove = false) {
    if (!folderEdit) return;
    setFolderBusy(true);
    setFolderError("");
    try {
      if (remove && folderEdit !== "new") {
        await api(`folders/${folderEdit.id}`, "DELETE");
        if (selectedFolder === folderEdit.id) onFolder(null);
      } else
        await api(
          folderEdit === "new" ? "folders" : `folders/${folderEdit.id}`,
          folderEdit === "new" ? "POST" : "PATCH",
          { name: folderName.trim() },
        );
      await onUpdated();
      setFolderEdit(null);
    } catch (e) {
      setFolderError(errorMessage(e));
    } finally {
      setFolderBusy(false);
    }
  }

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
      if (document.querySelector("dialog[open]")) return;
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
  const filtered = chats.filter(
    (c) =>
      c.title
        .toLocaleLowerCase(language)
        .includes(search.toLocaleLowerCase(language)) &&
      (!!search ||
        selectedFolder === null ||
        (selectedFolder === "unfiled"
          ? !c.folderId
          : c.folderId === selectedFolder)),
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
          <div className="folder-navigation">
            <button
              className={`folder-row ${selectedFolder === null ? "selected" : ""}`}
              onClick={() => onFolder(null)}
            >
              <Layers size={17} />
              <span>{t("All conversations")}</span>
              <small>{chats.length}</small>
            </button>
            <button
              className={`folder-row ${selectedFolder === "unfiled" ? "selected" : ""}`}
              onClick={() => onFolder("unfiled")}
            >
              <MessageCircle size={17} />
              <span>{t("Unfiled")}</span>
              <small>{chats.filter((c) => !c.folderId).length}</small>
            </button>
            <div className="folder-heading">
              <button
                onClick={() => setFoldersOpen(!foldersOpen)}
                aria-expanded={foldersOpen}
              >
                {foldersOpen ? (
                  <ChevronDown size={14} />
                ) : (
                  <ChevronRight size={14} />
                )}{" "}
                {t("Folders")}
              </button>
              <IconButton
                label={t("New folder")}
                disabled={busy}
                onClick={() => editFolder("new")}
              >
                <FolderPlus size={17} />
              </IconButton>
            </div>
            {foldersOpen
              ? folders.map((f) => (
                  <div className="history-row" key={f.id}>
                    <button
                      className={`folder-row ${selectedFolder === f.id ? "selected" : ""}`}
                      onClick={() => onFolder(f.id)}
                    >
                      <FolderIcon size={17} />
                      <span>{f.name}</span>
                      <small>
                        {chats.filter((c) => c.folderId === f.id).length}
                      </small>
                    </button>
                    <IconButton
                      className="history-options"
                      label={t("Folder options: {name}", { name: f.name })}
                      disabled={busy}
                      onClick={() => editFolder(f)}
                    >
                      <MoreHorizontal size={18} />
                    </IconButton>
                  </div>
                ))
              : null}
          </div>

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
                  <div className="history-row">
                    <button
                      className={`history-item ${active === c.id ? "selected" : ""}`}
                      disabled={busy}
                      onClick={() => onSelect(c.id)}
                    >
                      <span>{c.title}</span>
                      {c.pinned ? <Pin size={13} /> : null}
                    </button>
                    <IconButton
                      className="history-options"
                      label={t("Conversation options: {name}", {
                        name: c.title,
                      })}
                      disabled={busy}
                      onClick={() => setOrganize(c)}
                    >
                      <MoreHorizontal size={18} />
                    </IconButton>
                  </div>
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
      {organize ? (
        <ChatOrganizer
          chat={organize}
          folders={folders}
          onChanged={onUpdated}
          onClose={() => setOrganize(null)}
        />
      ) : null}
      {folderEdit ? (
        <Modal
          title={t(folderEdit === "new" ? "New folder" : "Edit folder")}
          onClose={() => setFolderEdit(null)}
          className="organizer-modal"
        >
          <form
            className="organizer-form"
            onSubmit={(e) => {
              e.preventDefault();
              void saveFolder();
            }}
          >
            <label>
              {t("Folder name")}
              <input
                value={folderName}
                maxLength={60}
                required
                disabled={folderBusy}
                onChange={(e) => setFolderName(e.target.value)}
              />
            </label>
            {folderError ? (
              <p className="error-box" role="alert">
                {t(folderError)}
              </p>
            ) : null}
            {deleteFolder ? (
              <div className="confirmation">
                <p>
                  {t(
                    "Delete this folder? Your conversations will be kept in Unfiled.",
                  )}
                </p>
                <button
                  type="button"
                  className="secondary danger"
                  disabled={folderBusy}
                  onClick={() => saveFolder(true)}
                >
                  {t("Delete folder")}
                </button>
              </div>
            ) : folderEdit !== "new" ? (
              <button
                type="button"
                className="secondary danger"
                onClick={() => setDeleteFolder(true)}
              >
                {t("Delete folder")}
              </button>
            ) : null}
            <div className="modal-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => setFolderEdit(null)}
              >
                {t("Cancel")}
              </button>
              <button
                className="primary"
                disabled={folderBusy || !folderName.trim()}
              >
                {t(folderBusy ? "Saving…" : "Save")}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
    </>
  );
}

"use client";
import { useI18n } from "./language-provider";
import { useEffect, useState } from "react";
import {
  Fingerprint,
  LogOut,
  Download,
  Smartphone,
  UserPlus,
  Copy,
  Check,
  ShieldCheck,
  Trash2,
  Link2,
  RotateCcw,
} from "lucide-react";
import {
  api,
  errorMessage,
  login,
  register,
  passkeyError,
  ApiError,
} from "@/lib/client";
import type { Person, SessionView } from "@/lib/types";
import MemoryPanel from "./memory-panel";
import { Modal, Spinner } from "./ui";
type PeopleData = {
  people: Person[];
  invitations: { id: string; name: string; expiresAt: number }[];
};
export default function Settings({
  person,
  theme,
  setTheme,
  onClose,
  onLogout,
  onCleared,
  onOpenChat,
  initialTab = "general",
}: {
  initialTab?: string;
  onOpenChat: (id: string) => void;
  person: Person;
  theme: string;
  setTheme: (s: string) => void;
  onClose: () => void;
  onLogout: () => void;
  onCleared: () => void;
}) {
  const { t, language, setLanguage } = useI18n();
  const [savingLanguage, setSavingLanguage] = useState(false);
  const [tab, setTab] = useState(initialTab),
    [sessions, setSessions] = useState<SessionView[]>([]),
    [people, setPeople] = useState<PeopleData>({ people: [], invitations: [] }),
    [name, setName] = useState(""),
    [invite, setInvite] = useState(""),
    [copied, setCopied] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [reauth, setReauth] = useState(false),
    [confirmClear, setConfirmClear] = useState(false);
  async function load() {
    if (tab === "security") setSessions(await api("sessions"));
    if (tab === "family") setPeople(await api("admin/people"));
  }
  useEffect(() => {
    load().catch((e) => {
      setError(errorMessage(e));
      if (e instanceof ApiError && e.status === 428) setReauth(true);
    });
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps
  async function act(fn: () => Promise<void>) {
    setError("");
    setMessage("");
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError(errorMessage(e));
      if (e instanceof ApiError && e.status === 428) setReauth(true);
    } finally {
      setBusy(false);
    }
  }
  async function exportData() {
    const data = await api("export");
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "my-conversations.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function device(ua: string) {
    return /iPhone/.test(ua)
      ? "iPhone"
      : /iPad/.test(ua)
        ? "iPad"
        : /Android/.test(ua)
          ? "Android"
          : /Macintosh/.test(ua)
            ? "Mac"
            : "Browser";
  }
  return (
    <Modal title={t("Settings")} onClose={onClose} className="settings-modal">
      <div className="settings-tabs" role="tablist">
        {[
          ["general", t("General")],
          ["memory", t("Memory")],
          ["security", t("Security")],
          ...(person.role === "owner" ? [["family", t("Family")]] : []),
        ].map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => {
              setTab(id);
              setError("");
              setMessage("");
            }}
          >
            {t(label)}
          </button>
        ))}
      </div>
      <div className="settings-content">
        {tab === "memory" ? <MemoryPanel onOpenChat={onOpenChat} /> : null}
        {error ? (
          <div className="error-box" role="alert">
            {t(error)}
          </div>
        ) : null}
        {message ? (
          <div className="success-box" role="status">
            {t(message)}
          </div>
        ) : null}
        {reauth ? (
          <button
            className="primary"
            onClick={() =>
              act(async () => {
                await login();
                setReauth(false);
                await load();
              })
            }
          >
            <Fingerprint size={18} /> {t("Unlock again")}
          </button>
        ) : null}
        {tab === "general" ? (
          <>
            <div className="settings-row">
              <div>
                <strong>{t("Language")}</strong>
                <p>{t("Saved to your account on all devices.")}</p>
              </div>
              <select
                aria-label={t("Language")}
                value={language}
                disabled={savingLanguage}
                onChange={async (e) => {
                  const value = e.target.value as "en" | "tr";
                  setSavingLanguage(true);
                  setError("");
                  try {
                    await api("preferences", "PATCH", { language: value });
                    setLanguage(value);
                  } catch (e) {
                    setError(errorMessage(e));
                  } finally {
                    setSavingLanguage(false);
                  }
                }}
              >
                <option value="en" lang="en">
                  English
                </option>
                <option value="tr" lang="tr">
                  Türkçe
                </option>
              </select>
            </div>
            <div className="settings-row">
              <div>
                <strong>{t("Appearance")}</strong>
                <p>{t("Make yourself at home.")}</p>
              </div>
              <select
                aria-label={t("Appearance")}
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
              >
                <option value="system">{t("System")}</option>
                <option value="light">{t("Light")}</option>
                <option value="dark">{t("Dark")}</option>
              </select>
            </div>
            <div className="settings-row">
              <div>
                <strong>{t("Export conversations")}</strong>
                <p>{t("Download your chat history as JSON.")}</p>
              </div>
              <button
                className="secondary"
                disabled={busy}
                onClick={() => act(exportData)}
              >
                <Download size={16} />
                {t("Export")}
              </button>
            </div>
            <div className="settings-row">
              <div>
                <strong>{t("Delete all chats")}</strong>
                <p>{t("Remove your saved chats and attachments.")}</p>
              </div>
              <button
                className="secondary danger"
                disabled={busy}
                onClick={() => setConfirmClear(true)}
              >
                <Trash2 size={16} />
                {t("Delete")}
              </button>
            </div>
            {confirmClear ? (
              <div className="confirmation">
                <p>
                  {t(
                    "Delete all your conversations permanently? This cannot be undone.",
                  )}
                </p>
                <button
                  className="primary danger-button"
                  disabled={busy}
                  onClick={() =>
                    act(async () => {
                      await api("chats", "DELETE");
                      setConfirmClear(false);
                      onCleared();
                      setMessage(t("Your conversations were deleted."));
                    })
                  }
                >
                  {t("Delete all chats")}
                </button>
                <button
                  className="secondary"
                  onClick={() => setConfirmClear(false)}
                >
                  {t("Keep chats")}
                </button>
              </div>
            ) : null}
            <div className="settings-note">
              <Smartphone size={20} />
              <div>
                <strong>{t("Install on your phone")}</strong>
                <p>
                  {t("iPhone: Safari → Share → Add to Home Screen.")}
                  <br />
                  {t("Android: browser menu → Install app.")}
                </p>
              </div>
            </div>
            <div className="settings-about">
              <strong>ChatGPT</strong>
              <p>
                {t("Private Azure-powered client. Not affiliated with OpenAI.")}
              </p>
              <p>
                {t(
                  "Web search with sources, photos, PDFs, and text/code files. Voice is separate and is not saved. No code execution or image generation.",
                )}
              </p>
            </div>
          </>
        ) : null}
        {tab === "security" ? (
          <>
            <div className="settings-row">
              <div>
                <strong>{t("Passkeys")}</strong>
                <p>
                  {t("Use your device’s Face ID, fingerprint, or screen lock.")}
                </p>
              </div>
              <button
                className="secondary"
                disabled={busy}
                onClick={() =>
                  act(async () => {
                    try {
                      await register();
                      setMessage(t("Passkey added."));
                    } catch (e) {
                      throw new Error(passkeyError(e));
                    }
                  })
                }
              >
                <Fingerprint size={17} />
                {t("Add")}
              </button>
            </div>
            <div className="section-heading">{t("Signed-in devices")}</div>
            {sessions.map((s) => (
              <div className="settings-row" key={s.id}>
                <div>
                  <strong>
                    {t(device(s.device))}{" "}
                    {s.current ? (
                      <span className="tag">{t("This device")}</span>
                    ) : null}
                  </strong>
                  <p>
                    {t("Signed in {date} · Trusted device", {
                      date: new Date(s.createdAt).toLocaleDateString(language),
                    })}
                  </p>
                </div>
                <button
                  className="text-button danger"
                  disabled={busy}
                  onClick={() =>
                    act(async () => {
                      await api(`sessions/${s.id}`, "DELETE");
                      if (s.current) onLogout();
                      else await load();
                    })
                  }
                >
                  {s.current ? t("Sign out") : t("Revoke")}
                </button>
              </div>
            ))}
            <div className="settings-note">
              <ShieldCheck size={21} />
              <div>
                <strong>{t("Private by design")}</strong>
                <p>
                  {t(
                    "Only invited people can join. Your chats are separate. You stay signed in while you use this device. After a year without using it, unlock again. Lost access? Ask the owner for a recovery invitation.",
                  )}
                </p>
              </div>
            </div>
            <button
              className="secondary"
              disabled={busy}
              onClick={() =>
                act(async () => {
                  await api("auth/logout", "POST", {});
                  onLogout();
                })
              }
            >
              <LogOut size={17} />
              {t("Sign out")}
            </button>
          </>
        ) : null}
        {tab === "family" ? (
          <>
            <p className="section-intro">
              {t(
                "Only you can invite someone. Each person gets their own private chat history. There is no public signup.",
              )}
            </p>
            <form
              className="invite-form"
              onSubmit={(e) => {
                e.preventDefault();
                act(async () => {
                  const result = await api<{ url: string }>(
                    "admin/invites",
                    "POST",
                    { name },
                  );
                  setInvite(result.url);
                  setName("");
                  await load();
                });
              }}
            >
              <input
                placeholder={t("Name, e.g. Mom")}
                aria-label={t("Person’s name")}
                maxLength={60}
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <button className="primary" disabled={busy || !name.trim()}>
                {busy ? <Spinner /> : <UserPlus size={17} />}
                {t("Invite")}
              </button>
            </form>
            {invite ? (
              <div className="invitation-result">
                <strong>{t("Personal invitation ready")}</strong>
                <p>
                  {t("Share privately. Works once and expires in 24 hours.")}
                </p>
                <div>
                  <input
                    readOnly
                    value={invite}
                    aria-label={t("Invitation link")}
                  />
                  <button
                    className="secondary"
                    onClick={() =>
                      act(async () => {
                        await navigator.clipboard.writeText(invite);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      })
                    }
                  >
                    {copied ? <Check size={17} /> : <Copy size={17} />}{" "}
                    {copied ? t("Copied") : t("Copy")}
                  </button>
                </div>
                {typeof navigator !== "undefined" && !!navigator.share ? (
                  <button
                    className="text-button"
                    onClick={() =>
                      act(async () =>
                        navigator.share({
                          title: t("Join ChatGPT"),
                          url: invite,
                        }),
                      )
                    }
                  >
                    {t("Share invitation")}
                  </button>
                ) : null}
              </div>
            ) : null}
            <div className="section-heading">{t("People")}</div>
            {people.people.map((p) => (
              <div className="settings-row" key={p.id}>
                <div>
                  <strong>{p.name}</strong>
                  <p>
                    {p.role === "owner"
                      ? t("Owner")
                      : p.disabled
                        ? t("Access revoked")
                        : t("Member")}
                  </p>
                </div>
                {p.id !== person.id ? (
                  <div className="person-actions">
                    <button
                      className="text-button"
                      disabled={busy || p.disabled}
                      title={t("Create a recovery invitation")}
                      onClick={() =>
                        act(async () => {
                          const result = await api<{ url: string }>(
                            `admin/people/${p.id}`,
                            "POST",
                            {},
                          );
                          setInvite(result.url);
                          await load();
                        })
                      }
                    >
                      <Link2 size={15} />
                      {t("Recover")}
                    </button>
                    <button
                      className={`text-button ${p.disabled ? "" : "danger"}`}
                      disabled={busy}
                      onClick={() =>
                        act(async () => {
                          await api(`admin/people/${p.id}`, "PATCH", {
                            disabled: !p.disabled,
                          });
                          await load();
                        })
                      }
                    >
                      {p.disabled ? (
                        <>
                          <RotateCcw size={15} />
                          {t("Restore")}
                        </>
                      ) : (
                        t("Revoke")
                      )}
                    </button>
                  </div>
                ) : (
                  <span className="tag">{t("You")}</span>
                )}
              </div>
            ))}
            {people.invitations.length ? (
              <>
                <div className="section-heading">
                  {t("Pending invitations")}
                </div>
                {people.invitations.map((i) => (
                  <div className="settings-row" key={i.id}>
                    <div>
                      <strong>{i.name}</strong>
                      <p>
                        {t("Expires {date}", {
                          date: new Date(i.expiresAt).toLocaleString(language),
                        })}
                      </p>
                    </div>
                    <button
                      className="text-button danger"
                      disabled={busy}
                      onClick={() =>
                        act(async () => {
                          await api(`admin/invites/${i.id}`, "DELETE");
                          await load();
                        })
                      }
                    >
                      {t("Cancel")}
                    </button>
                  </div>
                ))}
              </>
            ) : null}
          </>
        ) : null}
      </div>
    </Modal>
  );
}

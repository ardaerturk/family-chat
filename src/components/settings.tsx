"use client";
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
}: {
  person: Person;
  theme: string;
  setTheme: (s: string) => void;
  onClose: () => void;
  onLogout: () => void;
  onCleared: () => void;
}) {
  const [tab, setTab] = useState("general"),
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
    <Modal title="Settings" onClose={onClose} className="settings-modal">
      <div className="settings-tabs" role="tablist">
        {[
          ["general", "General"],
          ["security", "Security"],
          ...(person.role === "owner" ? [["family", "Family"]] : []),
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
            {label}
          </button>
        ))}
      </div>
      <div className="settings-content">
        {error ? (
          <div className="error-box" role="alert">
            {error}
          </div>
        ) : null}
        {message ? (
          <div className="success-box" role="status">
            {message}
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
            <Fingerprint size={18} /> Unlock again
          </button>
        ) : null}
        {tab === "general" ? (
          <>
            <div className="settings-row">
              <div>
                <strong>Appearance</strong>
                <p>Make yourself at home.</p>
              </div>
              <select
                aria-label="Appearance"
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
              >
                <option value="system">System</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </div>
            <div className="settings-row">
              <div>
                <strong>Export conversations</strong>
                <p>Download your chat history as JSON.</p>
              </div>
              <button
                className="secondary"
                disabled={busy}
                onClick={() => act(exportData)}
              >
                <Download size={16} />
                Export
              </button>
            </div>
            <div className="settings-row">
              <div>
                <strong>Delete all chats</strong>
                <p>Remove your saved chats and attachments.</p>
              </div>
              <button
                className="secondary danger"
                disabled={busy}
                onClick={() => setConfirmClear(true)}
              >
                <Trash2 size={16} />
                Delete
              </button>
            </div>
            {confirmClear ? (
              <div className="confirmation">
                <p>
                  Delete all your conversations permanently? This cannot be
                  undone.
                </p>
                <button
                  className="primary danger-button"
                  disabled={busy}
                  onClick={() =>
                    act(async () => {
                      await api("chats", "DELETE");
                      setConfirmClear(false);
                      onCleared();
                      setMessage("Your conversations were deleted.");
                    })
                  }
                >
                  Delete all chats
                </button>
                <button
                  className="secondary"
                  onClick={() => setConfirmClear(false)}
                >
                  Keep chats
                </button>
              </div>
            ) : null}
            <div className="settings-note">
              <Smartphone size={20} />
              <div>
                <strong>Install on your phone</strong>
                <p>
                  iPhone: Safari → Share → Add to Home Screen.
                  <br />
                  Android: browser menu → Install app.
                </p>
              </div>
            </div>
            <div className="settings-about">
              <strong>Family Chat</strong>
              <p>Your private assistant, powered by Azure AI.</p>
              <p>
                Supports PDF, images, and text/code files up to 3 MB each. No
                live web search or code execution. Voice is a separate
                conversation and isn’t saved. AI responses may be inaccurate.
              </p>
            </div>
          </>
        ) : null}
        {tab === "security" ? (
          <>
            <div className="settings-row">
              <div>
                <strong>Passkeys</strong>
                <p>Use your device’s Face ID, fingerprint, or screen lock.</p>
              </div>
              <button
                className="secondary"
                disabled={busy}
                onClick={() =>
                  act(async () => {
                    try {
                      await register();
                      setMessage("Passkey added.");
                    } catch (e) {
                      throw new Error(passkeyError(e));
                    }
                  })
                }
              >
                <Fingerprint size={17} />
                Add
              </button>
            </div>
            <div className="section-heading">Signed-in devices</div>
            {sessions.map((s) => (
              <div className="settings-row" key={s.id}>
                <div>
                  <strong>
                    {device(s.device)}{" "}
                    {s.current ? (
                      <span className="tag">This device</span>
                    ) : null}
                  </strong>
                  <p>
                    Signed in {new Date(s.createdAt).toLocaleDateString()} ·
                    30-day session
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
                  {s.current ? "Sign out" : "Revoke"}
                </button>
              </div>
            ))}
            <div className="settings-note">
              <ShieldCheck size={21} />
              <div>
                <strong>Private by design</strong>
                <p>
                  Only invited people can join. Your chats are separate.
                  Sessions expire after 30 days. Lost access? Ask the owner for
                  a recovery invitation.
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
              Sign out
            </button>
          </>
        ) : null}
        {tab === "family" ? (
          <>
            <p className="section-intro">
              Only you can invite someone. Each person gets their own private
              chat history. There is no public signup.
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
                placeholder="Name, e.g. Mom"
                aria-label="Person’s name"
                maxLength={60}
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <button className="primary" disabled={busy || !name.trim()}>
                {busy ? <Spinner /> : <UserPlus size={17} />}Invite
              </button>
            </form>
            {invite ? (
              <div className="invitation-result">
                <strong>Personal invitation ready</strong>
                <p>Share privately. Works once and expires in 24 hours.</p>
                <div>
                  <input readOnly value={invite} aria-label="Invitation link" />
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
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
                {typeof navigator !== "undefined" && !!navigator.share ? (
                  <button
                    className="text-button"
                    onClick={() =>
                      act(async () =>
                        navigator.share({
                          title: "Join Family Chat",
                          url: invite,
                        }),
                      )
                    }
                  >
                    Share invitation
                  </button>
                ) : null}
              </div>
            ) : null}
            <div className="section-heading">People</div>
            {people.people.map((p) => (
              <div className="settings-row" key={p.id}>
                <div>
                  <strong>{p.name}</strong>
                  <p>
                    {p.role === "owner"
                      ? "Owner"
                      : p.disabled
                        ? "Access revoked"
                        : "Member"}
                  </p>
                </div>
                {p.id !== person.id ? (
                  <div className="person-actions">
                    <button
                      className="text-button"
                      disabled={busy || p.disabled}
                      title="Create a recovery invitation"
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
                      Recover
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
                          Restore
                        </>
                      ) : (
                        "Revoke"
                      )}
                    </button>
                  </div>
                ) : (
                  <span className="tag">You</span>
                )}
              </div>
            ))}
            {people.invitations.length ? (
              <>
                <div className="section-heading">Pending invitations</div>
                {people.invitations.map((i) => (
                  <div className="settings-row" key={i.id}>
                    <div>
                      <strong>{i.name}</strong>
                      <p>Expires {new Date(i.expiresAt).toLocaleString()}</p>
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
                      Cancel
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

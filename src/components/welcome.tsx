"use client";
import { useState } from "react";
import { Fingerprint, ArrowUpRight, LockKeyhole } from "lucide-react";
import { login, register, passkeyError } from "@/lib/client";
import { Mark, Spinner } from "./ui";
export default function Welcome({
  invite,
  onSuccess,
}: {
  invite: string | null;
  onSuccess: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function unlock() {
    setBusy(true);
    setError("");
    try {
      if (invite) await register(invite);
      else await login();
      onSuccess();
    } catch (e) {
      setError(passkeyError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="welcome">
      <header className="welcome-header">
        <Mark size={25} />
        <span>Family Chat</span>
      </header>
      <section className="welcome-main">
        <div className="welcome-mark">
          <Mark size={42} />
        </div>
        <h1>
          {invite ? "A space just for you." : "Your thoughts.\nYour own space."}
        </h1>
        <p>
          {invite
            ? "You’ve been invited to Family Chat. Save a passkey to make this space yours."
            : "Ask a question. Work through an idea.\nPick up right where you left off."}
        </p>
        <button
          className="primary welcome-cta"
          onClick={unlock}
          disabled={busy}
        >
          {busy ? <Spinner /> : <Fingerprint size={22} />}{" "}
          {busy
            ? "Waiting for your device…"
            : invite
              ? "Accept invitation"
              : "Unlock with passkey"}
        </button>
        <span className="passkey-hint">
          Use Face ID, your fingerprint, or device screen lock.
        </span>
        {error ? (
          <p className="error-box" role="alert">
            {error}
          </p>
        ) : null}
        <div className="private-note">
          <LockKeyhole size={14} />
          <span>Private and invitation only</span>
        </div>
      </section>
      <footer className="welcome-footer">
        <span>Already invited? Open your personal invitation link.</span>
        <details>
          <summary>
            How to add this to your phone <ArrowUpRight size={13} />
          </summary>
          <p>
            On iPhone, open in Safari, tap Share, then Add to Home Screen. On
            Android, open the browser menu and choose Install app.
          </p>
        </details>
        <small>
          Independent app powered by your family’s Azure AI. Not affiliated with
          ChatGPT.
        </small>
      </footer>
    </main>
  );
}

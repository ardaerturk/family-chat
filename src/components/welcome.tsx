"use client";
import { useI18n } from "./language-provider";
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
  const { t } = useI18n();
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
        <span>ChatGPT</span>
      </header>
      <section className="welcome-main">
        <div className="welcome-mark">
          <Mark size={42} />
        </div>
        <h1>
          {invite
            ? t("A space just for you.")
            : t("Your thoughts.\nYour own space.")}
        </h1>
        <p>
          {invite
            ? t(
                "You’ve been invited to ChatGPT. Save a passkey to make this space yours.",
              )
            : t(
                "Ask a question. Work through an idea.\nPick up right where you left off.",
              )}
        </p>
        <button
          className="primary welcome-cta"
          onClick={unlock}
          disabled={busy}
        >
          {busy ? <Spinner /> : <Fingerprint size={22} />}{" "}
          {busy
            ? t("Waiting for your device…")
            : invite
              ? t("Accept invitation")
              : t("Unlock with passkey")}
        </button>
        <span className="passkey-hint">
          {t("Use Face ID, your fingerprint, or device screen lock.")}
        </span>
        {error ? (
          <p className="error-box" role="alert">
            {t(error)}
          </p>
        ) : null}
        <div className="private-note">
          <LockKeyhole size={14} />
          <span>{t("Private and invitation only")}</span>
        </div>
      </section>
      <footer className="welcome-footer">
        <span>{t("Already invited? Open your personal invitation link.")}</span>
        <details>
          <summary>
            {t("How to add this to your phone")}
            <ArrowUpRight size={13} />
          </summary>
          <p>
            {t(
              "On iPhone, open in Safari, tap Share, then Add to Home Screen. On Android, open the browser menu and choose Install app.",
            )}
          </p>
        </details>
        <small>{t("Your private Azure-powered chat.")}</small>
      </footer>
    </main>
  );
}

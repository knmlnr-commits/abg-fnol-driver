"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

/** Mock login until Microsoft Entra ID is connected: your name plus the demo password. */
export function LoginForm({ available }: { available: boolean }) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!available) return <main className="page"><p className="alert">{t("login_unavailable")}</p></main>;
  return (
    <main className="page stack">
      <h1>{t("login_title")}</h1>
      <p className="help">{t("login_help")}</p>
      <form className="stack" onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        const res = await fetch("/api/admin/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, password }) });
        if (res.ok) router.replace("/admin/themes");
        else {
          const d = await res.json().catch(() => ({}));
          setError(d.error ?? "server_error");
          setBusy(false);
        }
      }}>
        <div className="field">
          <label htmlFor="name">{t("your_name")}</label>
          <input id="name" className="input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required />
        </div>
        <div className="field">
          <label htmlFor="pw">{t("password")}</label>
          <input id="pw" className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {error && <p className="alert" role="alert">{t.has(`errors.${error}`) ? t(`errors.${error}`) : t("errors.server_error")}</p>}
        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>{t("login")}</button>
      </form>
    </main>
  );
}

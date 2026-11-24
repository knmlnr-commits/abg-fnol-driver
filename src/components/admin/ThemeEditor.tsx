"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { checkTheme } from "@/lib/theme/contrast";
import { checkLogo } from "@/lib/theme/logo";
import { FONT_PAIR_IDS, ThemeInputSchema, type FontPair, type PublicTheme, type ThemeInput } from "@/lib/theme/model";
import { TenantShell } from "../TenantShell";
import { ThemeSample } from "./ThemeSample";

type Logo = { mime: string; base64: string; previewUrl: string } | null | undefined;

const COLOR_FIELDS = ["primary", "accent", "background", "text", "surface"] as const;

function toBase64(buf: ArrayBuffer): string {
  let s = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

/**
 * Edit a tenant theme with a live preview and a live WCAG check. The server checks again on save.
 * A theme with a logo needs the permission tick box; without the tick a theme is saved as a draft
 * that is only visible behind login.
 */
export function ThemeEditor({ tenant, initial, permission }: {
  tenant: { id: string; name: string };
  initial: PublicTheme;
  permission: { by: string; at: string } | null;
}) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [input, setInput] = useState<ThemeInput>(() => ({
    displayName: initial.displayName,
    primary: initial.primary,
    accent: initial.accent,
    background: initial.background,
    text: initial.text,
    surface: initial.surface ?? "",
    fontPair: initial.fontPair,
    contactPhone: initial.contactPhone ?? "",
    contactEmail: initial.contactEmail ?? "",
    footerText: initial.footerText ?? "",
  }));
  const [logo, setLogo] = useState<Logo>(undefined);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const valid = ThemeInputSchema.safeParse(input);
  const report = useMemo(() => (valid.success ? checkTheme(valid.data) : null), [valid.success, valid.data]);
  const logoUrl = logo === undefined ? initial.logoUrl : logo === null ? null : logo.previewUrl;
  const hasLogo = Boolean(logoUrl);
  const previewTheme: PublicTheme = { ...(valid.success ? valid.data : input), id: initial.id, isDefault: false, logoUrl };
  const set = <K extends keyof ThemeInput>(k: K, v: ThemeInput[K]) => {
    setMessage(null);
    setInput((x) => ({ ...x, [k]: v }));
  };

  async function onLogo(file: File | undefined) {
    if (!file) return;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const c = checkLogo(bytes, file.type);
    if (!c.ok) {
      setMessage({ kind: "error", text: t(`errors.${c.code}`) });
      return;
    }
    setLogo({ mime: c.mime, base64: toBase64(bytes.buffer), previewUrl: URL.createObjectURL(new Blob([bytes], { type: c.mime })) });
    setConfirmed(false);
  }

  async function save() {
    setBusy(true);
    setMessage(null);
    const res = await fetch(`/api/admin/themes/${tenant.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ theme: input, permission: confirmed, ...(logo === undefined ? {} : { logo: logo && { mime: logo.mime, base64: logo.base64 } }) }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) {
      setMessage({ kind: "ok", text: d.published ? t("saved_published") : t("saved_draft") });
      router.refresh();
    } else {
      setMessage({ kind: "error", text: t.has(`errors.${d.error}`) ? t(`errors.${d.error}`) : t("errors.server_error") });
    }
  }

  const canSave = valid.success && report?.ok && (!hasLogo || confirmed) && !busy;

  return (
    <div className="editor">
      <section className="stack">
        <h1>{t("edit_title", { name: tenant.name })}</h1>
        <div className="field">
          <label htmlFor="dn">{t("fields.displayName")}</label>
          <input id="dn" className="input" value={input.displayName} maxLength={60} onChange={(e) => set("displayName", e.target.value)} />
        </div>
        <div className="grid2">
          {COLOR_FIELDS.map((k) => (
            <div className="field" key={k}>
              <label htmlFor={`c-${k}`}>{t(`fields.${k}`)}</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input type="color" aria-label={t(`fields.${k}`)} value={input[k] || "#FFFFFF"} onChange={(e) => set(k, e.target.value.toUpperCase())} style={{ width: 56, height: 56, padding: 0, border: 0 }} />
                <input id={`c-${k}`} className="input" value={input[k] ?? ""} maxLength={7} placeholder={k === "surface" ? t("optional") : "#000000"} onChange={(e) => set(k, e.target.value.toUpperCase())} />
              </div>
            </div>
          ))}
          <div className="field">
            <label htmlFor="fp">{t("fields.fontPair")}</label>
            <select id="fp" className="input" value={input.fontPair} onChange={(e) => set("fontPair", e.target.value as FontPair)}>
              {FONT_PAIR_IDS.map((f) => <option key={f} value={f}>{t(`fonts.${f}`)}</option>)}
            </select>
          </div>
        </div>
        <div className="grid2">
          <div className="field">
            <label htmlFor="ph">{t("fields.contactPhone")}</label>
            <input id="ph" className="input" type="tel" value={input.contactPhone ?? ""} maxLength={30} onChange={(e) => set("contactPhone", e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="em">{t("fields.contactEmail")}</label>
            <input id="em" className="input" type="email" value={input.contactEmail ?? ""} maxLength={254} onChange={(e) => set("contactEmail", e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="ft">{t("fields.footerText")}</label>
          <input id="ft" className="input" value={input.footerText ?? ""} maxLength={160} onChange={(e) => set("footerText", e.target.value)} />
        </div>

        <div className="field">
          <span className="label">{t("fields.logo")}</span>
          <p className="help">{t("logo_help")}</p>
          <div className="filebtns">
            <label className="btn btn-secondary" htmlFor="logo">{hasLogo ? t("logo_replace") : t("logo_upload")}</label>
            <input id="logo" className="sr-only" type="file" accept=".svg,.png,image/svg+xml,image/png" onChange={(e) => { onLogo(e.target.files?.[0]); e.target.value = ""; }} />
            {hasLogo && <button type="button" className="btn btn-secondary" onClick={() => setLogo(null)}>{t("logo_remove")}</button>}
          </div>
        </div>

        <section className="card stack" aria-labelledby="perm-h">
          <h2 id="perm-h" style={{ fontSize: "1rem" }}>{t("permission_title")}</h2>
          {permission && <p className="help" style={{ margin: 0 }}>{t("permission_recorded", { name: permission.by, date: new Date(permission.at).toLocaleDateString() })}</p>}
          <label className="check">
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
            <span>{t("permission_label")}</span>
          </label>
          <p className="help" style={{ margin: 0 }}>{hasLogo ? t("permission_required") : t("permission_draft")}</p>
        </section>

        <section className="card" aria-labelledby="wcag-h">
          <h2 id="wcag-h" style={{ fontSize: "1rem" }}>{t("contrast_title")}</h2>
          {!valid.success && <p className="alert">{t("errors.invalid_input")}</p>}
          {report && (
            <table className="contrast">
              <tbody>
                {[...report.checks, ...report.info].map((c) => (
                  <tr key={c.key}>
                    <td><span className="swatch" style={{ background: c.bg, color: c.fg }}>Aa</span></td>
                    <td>{t(`checks.${c.key}`)}</td>
                    <td className={c.ok ? "pass" : "fail"}>{c.ratio.toFixed(2)} : 1</td>
                    <td>{report.info.includes(c) ? t("info_only") : c.ok ? t("pass", { req: c.required }) : t("fail", { req: c.required })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {report && !report.ok && <p className="alert" role="alert">{t("contrast_blocked")}</p>}
        </section>

        {message && <p className={message.kind === "ok" ? "notice" : "alert"} role={message.kind === "ok" ? "status" : "alert"}>{message.text}</p>}
        <button type="button" className="btn btn-primary btn-block" onClick={save} disabled={!canSave}>{busy ? t("saving") : t("save")}</button>
      </section>

      <section aria-labelledby="prev-h">
        <h2 id="prev-h" style={{ fontSize: "1rem" }}>{t("live_preview")}</h2>
        <div className="preview-frame">
          <TenantShell theme={previewTheme}>
            <ThemeSample />
          </TenantShell>
        </div>
      </section>
    </div>
  );
}

import { useTranslations } from "next-intl";

/** A static sample screen to judge a theme: heading, progress, choices, tag, alert and button. */
export function ThemeSample() {
  const t = useTranslations();
  return (
    <main className="page stack">
      <div className="stepcount">{t("common.step", { current: 5, total: 12 })}</div>
      <div className="progress" aria-hidden="true"><span style={{ width: "42%" }} /></div>
      <h1>{t("steps.incident_type.title")}</h1>
      <div className="choices">
        <button type="button" className="choice" aria-pressed="true">
          <span>{t("steps.incident_type.collision")}</span>
          <small>{t("steps.incident_type.collision_hint")}</small>
        </button>
        <button type="button" className="choice" aria-pressed="false">
          <span>{t("steps.incident_type.glass")}</span>
          <small>{t("steps.incident_type.glass_hint")}</small>
        </button>
      </div>
      <div className="meta" style={{ display: "flex", gap: 8 }}>
        <span className="tag tag-required">{t("common.required")}</span>
        <span className="tag tag-ok">{t("steps.photos.uploaded")}</span>
      </div>
      <p className="panel-surface" style={{ margin: 0 }}>{t("start.resume_hint")}</p>
      <p className="alert" style={{ margin: 0 }}>{t("errors.network")}</p>
      <div style={{ display: "flex", gap: 10 }}>
        <button type="button" className="btn btn-secondary">{t("common.back")}</button>
        <button type="button" className="btn btn-primary">{t("common.next")}</button>
      </div>
    </main>
  );
}

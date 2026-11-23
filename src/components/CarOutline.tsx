"use client";
import { useTranslations } from "next-intl";
import { DAMAGE_ZONES, type DamageZone } from "@/lib/domain/constants";

/** Simple top view of a car. Front at the top. Each zone is a toggle (role checkbox). */
const SHAPES: Record<Exclude<DamageZone, "wheels">, { d: string; label: [number, number] }> = {
  front_bumper: { d: "M60 20 Q120 0 180 20 L180 44 L60 44 Z", label: [120, 36] },
  bonnet: { d: "M60 44 L180 44 L176 112 L64 112 Z", label: [120, 82] },
  windscreen: { d: "M64 112 L176 112 L166 150 L74 150 Z", label: [120, 136] },
  roof: { d: "M74 150 L166 150 L166 262 L74 262 Z", label: [120, 210] },
  rear_window: { d: "M74 262 L166 262 L174 292 L66 292 Z", label: [120, 281] },
  boot: { d: "M66 292 L174 292 L178 336 L62 336 Z", label: [120, 318] },
  rear_bumper: { d: "M62 336 L178 336 L178 356 Q120 376 62 356 Z", label: [120, 352] },
  left_front: { d: "M30 50 L60 44 L64 112 L74 150 L74 190 L30 190 Z", label: [50, 140] },
  left_rear: { d: "M30 190 L74 190 L74 262 L66 292 L62 336 L30 330 Z", label: [50, 262] },
  right_front: { d: "M210 50 L180 44 L176 112 L166 150 L166 190 L210 190 Z", label: [190, 140] },
  right_rear: { d: "M210 190 L166 190 L166 262 L174 292 L178 336 L210 330 Z", label: [190, 262] },
};

export function CarOutline({ value, onChange }: { value: DamageZone[]; onChange: (v: DamageZone[]) => void }) {
  const t = useTranslations("steps.damage");
  const toggle = (z: DamageZone) => onChange(value.includes(z) ? value.filter((x) => x !== z) : [...value, z]);
  const onKey = (z: DamageZone) => (e: React.KeyboardEvent) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      toggle(z);
    }
  };
  return (
    <div className="stack">
      <svg className="car" viewBox="0 0 240 380" role="group" aria-label={t("title")}>
        <text x="120" y="12" textAnchor="middle">{t("front")} ▲</text>
        {(Object.keys(SHAPES) as (keyof typeof SHAPES)[]).map((z) => (
          <path
            key={z}
            className="zone"
            d={SHAPES[z].d}
            role="checkbox"
            tabIndex={0}
            aria-checked={value.includes(z)}
            aria-label={t(`zones.${z}`)}
            onClick={() => toggle(z)}
            onKeyDown={onKey(z)}
          />
        ))}
        {[[22, 70], [218, 70], [22, 280], [218, 280]].map(([cx, cy], i) => (
          <rect
            key={i}
            className="zone"
            x={cx - 10}
            y={cy - 26}
            width={20}
            height={52}
            rx={8}
            role="checkbox"
            tabIndex={i === 0 ? 0 : -1}
            aria-checked={value.includes("wheels")}
            aria-label={t("zones.wheels")}
            onClick={() => toggle("wheels")}
            onKeyDown={onKey("wheels")}
          />
        ))}
      </svg>
      <p className="help" aria-live="polite">{t("selected", { count: value.length })}</p>
      {/* Same choice as a list, for screen readers and for anyone who prefers text. */}
      <div className="chips" role="group" aria-label={t("title")}>
        {DAMAGE_ZONES.map((z) => (
          <button key={z} type="button" className="chip" role="checkbox" aria-checked={value.includes(z)} onClick={() => toggle(z)}>
            {t(`zones.${z}`)}
          </button>
        ))}
      </div>
    </div>
  );
}

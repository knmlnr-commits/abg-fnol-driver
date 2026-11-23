import type { EvidenceSlot } from "@/lib/domain/constants";

/** Example outline per shot: shows the driver what the picture should contain. */
const navy = "#07017E";
const accent = "#00D8B9";

function CarSide({ highlight }: { highlight?: "front" | "rear" | "middle" }) {
  return (
    <g fill="none" stroke={navy} strokeWidth="2.5">
      <path d="M6 40 L10 28 L22 22 L44 22 L54 30 L60 32 L60 40 Z" />
      <circle cx="18" cy="42" r="5" fill="#fff" />
      <circle cx="48" cy="42" r="5" fill="#fff" />
      {highlight && (
        <circle
          cx={highlight === "front" ? 56 : highlight === "rear" ? 9 : 32}
          cy="33"
          r="8"
          stroke={accent}
          strokeWidth="3"
        />
      )}
    </g>
  );
}

function Corner({ side }: { side: "fl" | "fr" | "rl" | "rr" }) {
  const x = side.endsWith("l") ? 14 : 50;
  const y = side.startsWith("f") ? 12 : 52;
  return (
    <g fill="none" stroke={navy} strokeWidth="2.5">
      <rect x="20" y="10" width="24" height="44" rx="6" />
      <circle cx={x} cy={y} r="7" fill={accent} stroke="none" />
      <path d={`M${x} ${y} L32 32`} strokeDasharray="3 3" />
    </g>
  );
}

function Plate() {
  return (
    <g fill="none" stroke={navy} strokeWidth="2.5">
      <rect x="6" y="22" width="52" height="20" rx="3" />
      <rect x="6" y="22" width="8" height="20" fill={accent} stroke="none" />
      <path d="M20 32 H52" strokeWidth="3" />
    </g>
  );
}

function Doc({ back }: { back?: boolean }) {
  return (
    <g fill="none" stroke={navy} strokeWidth="2.5">
      <rect x="14" y="6" width="36" height="52" rx="3" />
      {back ? <path d="M20 18 L44 40 M20 40 L32 28" stroke={accent} strokeWidth="3" /> : <path d="M20 16 H44 M20 24 H44 M20 32 H38 M34 48 Q40 42 44 48" />}
    </g>
  );
}

function Scene() {
  return (
    <g fill="none" stroke={navy} strokeWidth="2.5">
      <path d="M2 50 L62 50" />
      <rect x="6" y="30" width="22" height="14" rx="4" />
      <rect x="34" y="30" width="22" height="14" rx="4" transform="rotate(-15 45 37)" />
      <path d="M28 20 l4 6 l4 -6" stroke={accent} strokeWidth="3" />
    </g>
  );
}

function Glass() {
  return (
    <g fill="none" stroke={navy} strokeWidth="2.5">
      <path d="M8 46 L16 16 H48 L56 46 Z" />
      <path d="M30 26 l4 6 l-5 3 l6 6" stroke={accent} strokeWidth="3" />
      <circle cx="46" cy="40" r="4" />
    </g>
  );
}

function Files() {
  return (
    <g fill="none" stroke={navy} strokeWidth="2.5">
      <rect x="18" y="10" width="30" height="40" rx="3" />
      <path d="M14 16 V54 H42" />
    </g>
  );
}

export function SlotIcon({ slot }: { slot: EvidenceSlot }) {
  const inner = (() => {
    switch (slot) {
      case "scene_overview": return <Scene />;
      case "own_plate":
      case "other_plate": return <Plate />;
      case "own_damage": return <CarSide highlight="middle" />;
      case "other_damage": return <CarSide highlight="front" />;
      case "corner_front_left": return <Corner side="fl" />;
      case "corner_front_right": return <Corner side="fr" />;
      case "corner_rear_left": return <Corner side="rl" />;
      case "corner_rear_right": return <Corner side="rr" />;
      case "irf_front":
      case "police_report": return <Doc />;
      case "irf_back": return <Doc back />;
      case "glass_closeup": return <Glass />;
      default: return <Files />;
    }
  })();
  return <svg viewBox="0 0 64 64" aria-hidden="true">{inner}</svg>;
}

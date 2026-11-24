"use client";
import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

type Point = { lat: number; lng: number };

/**
 * OpenStreetMap with one draggable pin. Tap the map to move the pin.
 * No address lookup: we keep the coordinates from the device. [CONFIRM] tile provider for production.
 */
export function MapPicker({ value, center, onChange, label }: { value: Point | null; center: Point; onChange: (p: Point) => void; label: string }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<import("leaflet").Map | null>(null);
  const marker = useRef<import("leaflet").Marker | null>(null);
  const cb = useRef(onChange);
  useEffect(() => {
    cb.current = onChange;
  }, [onChange]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !el.current || map.current) return;
      const start = value ?? center;
      const m = L.map(el.current, { zoomControl: true, attributionControl: true }).setView([start.lat, start.lng], value ? 17 : 13);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        // OpenStreetMap's tile policy needs a referrer. Send only the site's origin, never the
        // page path, because personal links carry a token in the path.
        referrerPolicy: "strict-origin",
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(m);
      const icon = L.divIcon({
        className: "",
        html: '<svg width="36" height="48" viewBox="0 0 36 48" aria-hidden="true"><path d="M18 0C8 0 0 8 0 18c0 13 18 30 18 30s18-17 18-30C36 8 28 0 18 0z" style="fill:var(--primary)"/><circle cx="18" cy="18" r="7" style="fill:var(--accent)"/></svg>',
        iconSize: [36, 48],
        iconAnchor: [18, 48],
      });
      const mk = L.marker([start.lat, start.lng], { draggable: true, icon, keyboard: true, title: label });
      if (value) mk.addTo(m);
      mk.on("dragend", () => {
        const p = mk.getLatLng();
        cb.current({ lat: p.lat, lng: p.lng });
      });
      m.on("click", (e: import("leaflet").LeafletMouseEvent) => {
        mk.setLatLng(e.latlng);
        if (!m.hasLayer(mk)) mk.addTo(m);
        cb.current({ lat: e.latlng.lat, lng: e.latlng.lng });
      });
      map.current = m;
      marker.current = mk;
    })();
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Follow outside changes (for example a GPS fix arriving).
  useEffect(() => {
    const m = map.current;
    const mk = marker.current;
    if (!m || !mk || !value) return;
    const cur = mk.getLatLng();
    if (Math.abs(cur.lat - value.lat) > 1e-7 || Math.abs(cur.lng - value.lng) > 1e-7 || !m.hasLayer(mk)) {
      mk.setLatLng([value.lat, value.lng]);
      if (!m.hasLayer(mk)) mk.addTo(m);
      m.setView([value.lat, value.lng], Math.max(m.getZoom(), 17));
    }
  }, [value]);

  return <div ref={el} className="map" role="application" aria-label={label} />;
}

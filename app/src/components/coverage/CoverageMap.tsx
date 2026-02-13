import { useEffect, useRef, useState } from "react";
import type { Locale } from "@/types";

interface ProvinceMarker {
  code: string;
  name: string;
  lat: number;
  lng: number;
  ispCount: number;
  cityCount: number;
}

interface CoverageMapProps {
  locale: Locale;
  apiKey: string;
  provinces: ProvinceMarker[];
}

/* Minimal Google Maps type declarations — avoids @types/google.maps dependency */
interface GMap {
  new (el: HTMLElement, opts: Record<string, unknown>): GMapInstance;
}
interface GMapInstance {
  // marker needs it
}
interface GMarker {
  new (opts: Record<string, unknown>): GMarkerInstance;
}
interface GMarkerInstance {
  addListener(event: string, handler: () => void): void;
}
interface GInfoWindow {
  new (): GInfoWindowInstance;
}
interface GInfoWindowInstance {
  setContent(html: string): void;
  open(map: GMapInstance, marker: GMarkerInstance): void;
}
interface GSymbolPath {
  CIRCLE: number;
}
interface GControlPosition {
  RIGHT_BOTTOM: number;
}
interface GMaps {
  Map: GMap;
  Marker: GMarker;
  InfoWindow: GInfoWindow;
  SymbolPath: GSymbolPath;
  ControlPosition: GControlPosition;
}
interface GoogleNamespace {
  maps: GMaps;
}

function getGoogle(): GoogleNamespace | undefined {
  return (window as unknown as { google?: GoogleNamespace }).google;
}

const MAP_STYLES = [
  { elementType: "geometry", stylers: [{ color: "#f5f7fa" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#4A5567" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#ffffff" }] },
  { featureType: "administrative.province", elementType: "geometry.stroke", stylers: [{ color: "#C5E4ED" }, { weight: 1.5 }] },
  { featureType: "administrative.country", elementType: "geometry.stroke", stylers: [{ color: "#9DD1E0" }, { weight: 2 }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#E8F4F8" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#9DD1E0" }] },
  { featureType: "road", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
];

export function CoverageMap({ locale, apiKey, provinces }: CoverageMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (getGoogle()) {
      setLoaded(true);
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&v=weekly`;
    script.async = true;
    script.defer = true;
    script.onload = () => setLoaded(true);
    script.onerror = () => setError(true);
    document.head.appendChild(script);
  }, [apiKey]);

  useEffect(() => {
    const google = getGoogle();
    if (!loaded || !mapRef.current || !google) return;

    const map = new google.maps.Map(mapRef.current, {
      center: { lat: 58, lng: -96 },
      zoom: 3.5,
      minZoom: 3,
      maxZoom: 7,
      styles: MAP_STYLES,
      disableDefaultUI: true,
      zoomControl: true,
      zoomControlOptions: { position: google.maps.ControlPosition.RIGHT_BOTTOM },
      gestureHandling: "cooperative",
      backgroundColor: "#E8F4F8",
    });

    const prefix = locale === "fr" ? "/fr" : "";
    const ispLabel = locale === "fr" ? "FSI" : "ISPs";
    const cityLabel = locale === "fr" ? "villes" : "cities";
    const viewLabel = locale === "fr" ? "Voir la couverture" : "View coverage";

    const infoWindow = new google.maps.InfoWindow();

    for (const prov of provinces) {
      const marker = new google.maps.Marker({
        position: { lat: prov.lat, lng: prov.lng },
        map,
        title: prov.name,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: "#1B8FAF",
          fillOpacity: 0.9,
          strokeColor: "#FFFFFF",
          strokeWeight: 2,
        },
      });

      marker.addListener("click", () => {
        infoWindow.setContent(
          `<div style="font-family: system-ui, sans-serif; padding: 4px 0;">` +
            `<div style="font-weight: 700; font-size: 15px; color: #1A2332;">${prov.name}</div>` +
            `<div style="margin-top: 4px; font-size: 13px; color: #4A5567;">${prov.ispCount} ${ispLabel} · ${prov.cityCount} ${cityLabel}</div>` +
            `<a href="${prefix}/coverage/${prov.code}" style="display: inline-block; margin-top: 8px; font-size: 13px; font-weight: 600; color: #1B8FAF; text-decoration: none;">${viewLabel} →</a>` +
          `</div>`
        );
        infoWindow.open(map, marker);
      });
    }
  }, [loaded, locale, provinces]);

  if (error) {
    return null;
  }

  return (
    <div
      ref={mapRef}
      className="h-[400px] w-full rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] shadow-[var(--shadow-card)] md:h-[500px]"
      aria-label={locale === "fr" ? "Carte de couverture du Canada" : "Canada coverage map"}
      role="application"
    >
      {!loaded && (
        <div className="flex h-full items-center justify-center bg-[var(--color-surface-sunken)] rounded-[var(--radius-xl)]">
          <div className="flex items-center gap-3 text-sm text-[var(--color-text-muted)]">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--color-primary-300)] border-t-[var(--color-primary-600)]" />
            {locale === "fr" ? "Chargement de la carte…" : "Loading map…"}
          </div>
        </div>
      )}
    </div>
  );
}

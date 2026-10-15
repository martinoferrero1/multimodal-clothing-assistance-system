"use client";

import { geoDistance, geoGraticule10, geoOrthographic, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { Topology } from "topojson-specification";
import atlas from "world-atlas/countries-110m.json";
import { LocateFixed, Minus, Plus, RotateCcw, Search, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { useLocale } from "@/components/providers/locale-provider";
import type { Language } from "@/lib/i18n";
import { regionalLocations } from "./regional-style-data";
import type { CountryId, RegionalLocation } from "./regional-style-data";

type Localized = { en: string; es: string };
type StyleProfile = {
  title: Localized;
  summary: Localized;
  palette: Localized;
  materials: Localized;
  silhouette: Localized;
  suggestion: Localized;
};

const profiles: Record<RegionalLocation["profile"], StyleProfile> = {
  warm: {
    title: { en: "Light layers, expressive color", es: "Capas livianas y color expresivo" },
    summary: { en: "A warm-weather direction built around breathable pieces and a clear color accent.", es: "Una dirección de clima cálido que combina prendas frescas con un acento de color definido." },
    palette: { en: "Terracotta · leaf green · warm neutrals", es: "Terracota · verde hoja · neutros cálidos" },
    materials: { en: "Linen · cotton · open-weave knits", es: "Lino · algodón · tejidos abiertos" },
    silhouette: { en: "Easy volume with a defined waist or hem", es: "Volumen relajado con cintura o ruedo definidos" },
    suggestion: { en: "Keep the base light and let one saturated accessory lead.", es: "Mantené una base liviana y dejá que un accesorio intenso sea protagonista." },
  },
  central: {
    title: { en: "Everyday structure, relaxed fit", es: "Estructura cotidiana y calce relajado" },
    summary: { en: "A versatile city-to-open-air mix: practical layers softened by comfortable proportions.", es: "Una mezcla versátil entre ciudad y aire libre: capas prácticas con proporciones cómodas." },
    palette: { en: "Indigo · stone · muted blue", es: "Índigo · piedra · azul apagado" },
    materials: { en: "Denim · cotton twill · midweight jersey", es: "Denim · sarga de algodón · jersey de peso medio" },
    silhouette: { en: "Straight leg with a roomier top layer", es: "Pierna recta con una capa superior más amplia" },
    suggestion: { en: "Pair a clean base with one useful overshirt or light jacket.", es: "Combiná una base simple con una sobrecamisa práctica o una chaqueta liviana." },
  },
  coastal: {
    title: { en: "Coastal ease, tactile basics", es: "Frescura costera y básicos con textura" },
    summary: { en: "An easygoing direction with airy fabrics, sun-faded tones, and a polished finish.", es: "Una dirección descontracturada con tejidos frescos, tonos gastados por el sol y un cierre cuidado." },
    palette: { en: "Sea blue · chalk · soft sand", es: "Azul mar · tiza · arena suave" },
    materials: { en: "Washed cotton · linen · canvas", es: "Algodón lavado · lino · lona" },
    silhouette: { en: "Fluid top with a neat, shorter proportion", es: "Parte superior fluida con una proporción inferior más definida" },
    suggestion: { en: "Mix a breathable shirt with a structured short or straight trouser.", es: "Mezclá una camisa fresca con un short estructurado o un pantalón recto." },
  },
  north: {
    title: { en: "Considered layers, soft utility", es: "Capas pensadas y utility suave" },
    summary: { en: "A layer-friendly direction balancing warmth, movement, and durable everyday pieces.", es: "Una dirección para superponer que equilibra abrigo, movimiento y prendas cotidianas resistentes." },
    palette: { en: "Moss · charcoal · oatmeal", es: "Musgo · carbón · avena" },
    materials: { en: "Wool blend · brushed cotton · sturdy denim", es: "Mezcla de lana · algodón cepillado · denim firme" },
    silhouette: { en: "A compact base under a generous outer layer", es: "Una base compacta bajo una capa exterior amplia" },
    suggestion: { en: "Build warmth with two light layers instead of one bulky piece.", es: "Sumá abrigo con dos capas livianas en lugar de una sola prenda voluminosa." },
  },
  south: {
    title: { en: "Weather-ready, functional layers", es: "Capas funcionales para el clima" },
    summary: { en: "A practical direction shaped by changing conditions, strong outerwear, and adaptable basics.", es: "Una dirección práctica para condiciones cambiantes, con abrigo protagonista y básicos adaptables." },
    palette: { en: "Deep navy · rust · glacier grey", es: "Azul profundo · óxido · gris glaciar" },
    materials: { en: "Water-resistant shell · merino · dense knit", es: "Tejido exterior repelente al agua · merino · punto compacto" },
    silhouette: { en: "A protective outer layer over a flexible base", es: "Una capa exterior protectora sobre una base flexible" },
    suggestion: { en: "Choose a weather-ready jacket with room for a fine knit beneath.", es: "Elegí una chaqueta preparada para el clima con espacio para un tejido fino debajo." },
  },
  urban: {
    title: { en: "Urban tailoring, personal details", es: "Sastrería urbana y detalles propios" },
    summary: { en: "A city-led direction pairing clear lines with individual accessories and flexible layers.", es: "Una dirección urbana que une líneas limpias, accesorios personales y capas versátiles." },
    palette: { en: "Black · cream · one vivid accent", es: "Negro · crema · un acento vibrante" },
    materials: { en: "Fine wool · crisp poplin · polished leather", es: "Lana fina · poplín firme · cuero pulido" },
    silhouette: { en: "Relaxed tailoring with a defined shoulder", es: "Sastrería relajada con hombros definidos" },
    suggestion: { en: "Anchor a fluid trouser with a precise jacket and one expressive detail.", es: "Combiná un pantalón fluido con una chaqueta precisa y un detalle expresivo." },
  },
};

const countryCopy: Record<CountryId, Localized> = {
  ar: { en: "Argentina", es: "Argentina" },
  us: { en: "United States", es: "Estados Unidos" },
};

const topology = atlas as unknown as Topology;
const countryFeatureCollection = feature(topology, topology.objects.countries as never) as unknown as FeatureCollection<Geometry, { name: string }>;
const countryFeatures = countryFeatureCollection.features as Feature<Geometry, { name: string }>[];
const allCountries = countryFeatures.filter((country) => country.properties?.name !== "Antarctica");

const initialRotations: Record<CountryId, [number, number, number]> = {
  ar: [64, 22, 0],
  us: [100, -39, 0],
};

function label(value: Localized, language: Language) {
  return value[language];
}

function normalizeSearch(value: string) {
  return value.toLocaleLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function RegionalStyleMap() {
  const { language, t } = useLocale();
  const [country, setCountry] = useState<CountryId>("ar");
  const [selectedId, setSelectedId] = useState("ar-caba");
  const [locationQuery, setLocationQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  const [rotation, setRotation] = useState<[number, number, number]>(initialRotations.ar);
  const [zoom, setZoom] = useState(188);
  const rotationRef = useRef(rotation);
  const zoomRef = useRef(zoom);
  const flightFrameRef = useRef<number | null>(null);
  const [dragOrigin, setDragOrigin] = useState<{ x: number; y: number; rotation: [number, number, number] } | null>(null);
  const activeLocation = regionalLocations.find((location) => location.id === selectedId) ?? regionalLocations[0];
  const activeProfile = profiles[activeLocation.profile];
  const visibleLocations = regionalLocations.filter((location) => location.country === country);
  const normalizedQuery = normalizeSearch(locationQuery.trim());
  const suggestions = regionalLocations
    .filter((location) => !normalizedQuery || normalizeSearch(location.name).includes(normalizedQuery) || normalizeSearch(label(countryCopy[location.country], language)).includes(normalizedQuery))
    .slice(0, 8);

  const projection = useMemo(
    () => geoOrthographic().translate([220, 220]).scale(zoom).clipAngle(90).rotate(rotation),
    [rotation, zoom],
  );
  const path = useMemo(() => geoPath(projection), [projection]);
  const graticule = path(geoGraticule10()) ?? "";
  const sphere = path({ type: "Sphere" }) ?? "";
  const center: [number, number] = [-rotation[0], -rotation[1]];

  useEffect(() => () => {
    if (flightFrameRef.current !== null) window.cancelAnimationFrame(flightFrameRef.current);
  }, []);

  const cancelFlight = () => {
    if (flightFrameRef.current !== null) {
      window.cancelAnimationFrame(flightFrameRef.current);
      flightFrameRef.current = null;
    }
  };

  const setZoomImmediately = (nextZoom: number) => {
    cancelFlight();
    zoomRef.current = nextZoom;
    setZoom(nextZoom);
  };

  const flyTo = (targetRotation: [number, number, number], targetZoom: number) => {
    cancelFlight();
    const startRotation = rotationRef.current;
    const longitudeDelta = ((targetRotation[0] - startRotation[0] + 180) % 360 + 360) % 360 - 180;
    const endRotation: [number, number, number] = [
      startRotation[0] + longitudeDelta,
      targetRotation[1],
      targetRotation[2],
    ];
    const startZoom = zoomRef.current;
    const startedAt = performance.now();
    const duration = 1250;

    const animate = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;
      const nextRotation: [number, number, number] = [
        startRotation[0] + (endRotation[0] - startRotation[0]) * eased,
        startRotation[1] + (endRotation[1] - startRotation[1]) * eased,
        startRotation[2] + (endRotation[2] - startRotation[2]) * eased,
      ];
      const nextZoom = startZoom + (targetZoom - startZoom) * eased;
      rotationRef.current = nextRotation;
      zoomRef.current = nextZoom;
      setRotation(nextRotation);
      setZoom(nextZoom);

      if (progress < 1) {
        flightFrameRef.current = window.requestAnimationFrame(animate);
      } else {
        rotationRef.current = endRotation;
        zoomRef.current = targetZoom;
        flightFrameRef.current = null;
      }
    };

    flightFrameRef.current = window.requestAnimationFrame(animate);
  };

  const focusLocation = (location: RegionalLocation) => {
    setCountry(location.country);
    setSelectedId(location.id);
    setLocationQuery(location.name);
    setIsSearchOpen(false);
    setActiveSuggestionIndex(0);
    flyTo([-location.longitude, -location.latitude, 0], 290);
  };

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIsSearchOpen(true);
      setActiveSuggestionIndex((index) => Math.min(suggestions.length - 1, index + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setIsSearchOpen(true);
      setActiveSuggestionIndex((index) => Math.max(0, index - 1));
    } else if (event.key === "Enter" && isSearchOpen && suggestions.length > 0) {
      event.preventDefault();
      focusLocation(suggestions[Math.max(0, activeSuggestionIndex)]);
    } else if (event.key === "Escape") {
      setIsSearchOpen(false);
      setActiveSuggestionIndex(0);
    }
  };

  const resetGlobe = () => {
    flyTo(initialRotations[country], 188);
  };

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!dragOrigin) return;
    const deltaX = event.clientX - dragOrigin.x;
    const deltaY = event.clientY - dragOrigin.y;
    const nextRotation: [number, number, number] = [
      dragOrigin.rotation[0] + deltaX * 0.42,
      Math.max(-88, Math.min(88, dragOrigin.rotation[1] - deltaY * 0.42)),
      0,
    ];
    rotationRef.current = nextRotation;
    setRotation(nextRotation);
  };

  const handleWheel = (event: React.WheelEvent<SVGSVGElement>) => {
    event.preventDefault();
    setZoomImmediately(Math.max(145, Math.min(380, zoomRef.current - event.deltaY * 0.12)));
  };

  const selectedPoint = projection([activeLocation.longitude, activeLocation.latitude]);
  const selectedIsVisible = geoDistance([activeLocation.longitude, activeLocation.latitude], center) < Math.PI / 2;

  return (
    <section id="regional-style" className="scroll-mt-28 border-t border-[var(--line)] py-16 sm:py-20 lg:py-24">
      <div className="mb-9 max-w-3xl sm:mb-11">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--muted-soft)]">
          {t("home.regionalMapEyebrow")}
        </p>
        <h2 className="serif mt-4 text-4xl leading-[1.02] tracking-[-0.035em] text-[var(--text)] sm:text-5xl">
          {t("home.globeTitle")}
        </h2>
        <p className="mt-5 max-w-2xl text-sm leading-7 text-[var(--muted)] sm:text-base">
          {t("home.globeDescription")}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(19rem,0.65fr)] lg:gap-5">
        <div className="relative overflow-hidden rounded-[1.5rem] border border-[var(--line-strong)] bg-[radial-gradient(circle_at_50%_46%,rgba(208,188,255,0.13),transparent_38%),linear-gradient(145deg,#18151c_0%,#151419_58%,#101012_100%)] p-4 shadow-[0_18px_45px_rgba(0,0,0,0.22)] sm:p-6">
          <div
            className="absolute left-4 top-4 z-20 w-[min(18rem,calc(100%-5rem))] sm:left-7 sm:top-7"
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsSearchOpen(false);
            }}
          >
            <label htmlFor="regional-location-search" className="sr-only">{t("home.globeLocationLabel")}</label>
            <div className="flex items-center gap-2 rounded-full border border-white/15 bg-[#111015]/85 px-3.5 py-2.5 shadow-lg backdrop-blur-xl transition focus-within:border-[var(--accent)]/60">
              <Search size={15} className="shrink-0 text-[var(--accent)]" aria-hidden="true" />
              <input
                id="regional-location-search"
                type="text"
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={isSearchOpen && suggestions.length > 0}
                aria-controls="regional-location-suggestions"
                aria-activedescendant={isSearchOpen && suggestions.length > 0 ? `regional-suggestion-${suggestions[activeSuggestionIndex]?.id}` : undefined}
                autoComplete="off"
                value={locationQuery}
                placeholder={t("home.globeSearchPlaceholder")}
                className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-white/45"
                onFocus={() => setIsSearchOpen(true)}
                onChange={(event) => {
                  setLocationQuery(event.target.value);
                  setActiveSuggestionIndex(0);
                  setIsSearchOpen(true);
                }}
                onKeyDown={handleSearchKeyDown}
              />
              {locationQuery && (
                <button
                  type="button"
                  aria-label={t("home.globeClearSearch")}
                  className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-white/50 transition hover:bg-white/10 hover:text-white"
                  onClick={() => {
                    setLocationQuery("");
                    setActiveSuggestionIndex(0);
                    setIsSearchOpen(true);
                  }}
                >
                  <X size={13} />
                </button>
              )}
            </div>
            {isSearchOpen && (
              <div
                id="regional-location-suggestions"
                role="listbox"
                className="mt-2 max-h-72 overflow-y-auto rounded-2xl border border-white/10 bg-[#151319]/95 p-1.5 shadow-2xl backdrop-blur-xl"
              >
                {suggestions.length > 0 ? suggestions.map((location, index) => (
                  <button
                    id={`regional-suggestion-${location.id}`}
                    key={location.id}
                    type="button"
                    role="option"
                    aria-selected={index === activeSuggestionIndex}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition ${index === activeSuggestionIndex ? "bg-[var(--accent)]/15 text-white" : "text-white/75 hover:bg-white/[0.06] hover:text-white"}`}
                    onMouseEnter={() => setActiveSuggestionIndex(index)}
                    onClick={() => focusLocation(location)}
                  >
                    <span className="truncate text-xs font-medium">{location.name}</span>
                    <span className="shrink-0 text-[9px] uppercase tracking-[0.12em] text-white/45">{label(countryCopy[location.country], language)}</span>
                  </button>
                )) : (
                  <p className="px-3 py-3 text-xs text-white/55">{t("home.globeNoMatches")}</p>
                )}
              </div>
            )}
          </div>

          <div className="absolute right-5 top-5 z-10 flex flex-col overflow-hidden rounded-full border border-white/10 bg-[#111015]/75 shadow-lg backdrop-blur sm:right-7 sm:top-7">
            <button type="button" className="grid h-9 w-9 place-items-center text-white/70 transition hover:text-white" aria-label={t("home.globeZoomIn")} onClick={() => setZoomImmediately(Math.min(380, zoomRef.current + 24))}><Plus size={15} /></button>
            <span className="mx-auto w-4 border-t border-white/10" />
            <button type="button" className="grid h-9 w-9 place-items-center text-white/70 transition hover:text-white" aria-label={t("home.globeZoomOut")} onClick={() => setZoomImmediately(Math.max(145, zoomRef.current - 24))}><Minus size={15} /></button>
            <span className="mx-auto w-4 border-t border-white/10" />
            <button type="button" className="grid h-9 w-9 place-items-center text-white/70 transition hover:text-white" aria-label={t("home.globeReset")} onClick={resetGlobe}><RotateCcw size={13} /></button>
          </div>

          <svg
            viewBox="0 0 440 440"
            role="img"
            aria-label={t("home.globeAccessibleLabel")}
            className="mx-auto block aspect-square w-full max-w-[35rem] touch-none select-none"
            onPointerDown={(event) => {
              if ((event.target as SVGElement).closest('[data-interactive="true"]')) return;
              cancelFlight();
              setDragOrigin({ x: event.clientX, y: event.clientY, rotation: rotationRef.current });
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={handlePointerMove}
            onPointerUp={() => setDragOrigin(null)}
            onPointerCancel={() => setDragOrigin(null)}
            onWheel={handleWheel}
          >
            <defs>
              <radialGradient id="lookeate-globe-fill" cx="34%" cy="28%" r="76%">
                <stop offset="0%" stopColor="#464050" />
                <stop offset="58%" stopColor="#24212b" />
                <stop offset="100%" stopColor="#121116" />
              </radialGradient>
              <radialGradient id="lookeate-globe-glow" cx="28%" cy="25%" r="75%">
                <stop offset="0%" stopColor="#d0bcff" stopOpacity=".2" />
                <stop offset="100%" stopColor="#d0bcff" stopOpacity="0" />
              </radialGradient>
              <clipPath id="lookeate-globe-clip"><path d={sphere} /></clipPath>
            </defs>
            <path d={sphere} fill="url(#lookeate-globe-fill)" stroke="rgba(208,188,255,.42)" strokeWidth="1.2" />
            <path d={sphere} fill="url(#lookeate-globe-glow)" pointerEvents="none" />
            <g clipPath="url(#lookeate-globe-clip)">
              <path d={graticule} fill="none" stroke="rgba(255,255,255,.07)" strokeWidth=".65" pointerEvents="none" />
              {allCountries.map((shape) => {
                const isFocusCountry = shape.properties?.name === "Argentina" || shape.properties?.name === "United States of America";
                const isSelectedCountry = country === "ar"
                  ? shape.properties?.name === "Argentina"
                  : shape.properties?.name === "United States of America";
                return (
                  <path
                    key={shape.properties?.name}
                    d={path(shape) ?? ""}
                    fill={isSelectedCountry ? "rgba(208,188,255,.30)" : isFocusCountry ? "rgba(208,188,255,.15)" : "rgba(255,255,255,.055)"}
                    stroke={isFocusCountry ? "rgba(228,215,255,.48)" : "rgba(255,255,255,.15)"}
                    strokeWidth={isSelectedCountry ? ".95" : ".55"}
                    vectorEffect="non-scaling-stroke"
                    pointerEvents="none"
                  />
                );
              })}
              {visibleLocations.map((location) => {
                const point = projection([location.longitude, location.latitude]);
                const isVisible = geoDistance([location.longitude, location.latitude], center) < Math.PI / 2;
                if (!point || !isVisible) return null;
                const isSelected = location.id === selectedId;
                return (
                  <g
                    key={location.id}
                    data-interactive="true"
                    role="button"
                    tabIndex={0}
                    aria-label={`${location.name}, ${label(countryCopy[location.country], language)}`}
                    aria-pressed={isSelected}
                    onClick={() => focusLocation(location)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        focusLocation(location);
                      }
                    }}
                    className="cursor-pointer outline-none"
                  >
                    <circle cx={point[0]} cy={point[1]} r="9" fill="transparent" />
                    {isSelected && <circle cx={point[0]} cy={point[1]} r="12" fill="rgba(208,188,255,.17)" />}
                    <circle cx={point[0]} cy={point[1]} r={isSelected ? 4.5 : 2.8} fill={isSelected ? "#f4edff" : "#d0bcff"} stroke="#211d27" strokeWidth="1.6" />
                    {isSelected && <text x={point[0] + 9} y={point[1] - 9} fill="white" fontSize="9" fontWeight="600" paintOrder="stroke" stroke="#17151b" strokeWidth="3" strokeLinejoin="round">{location.name}</text>}
                  </g>
                );
              })}
            </g>
            <circle cx="220" cy="220" r={zoom} fill="none" stroke="rgba(208,188,255,.2)" strokeWidth="1" pointerEvents="none" />
          </svg>

          <p className="absolute bottom-4 right-5 hidden text-[9px] uppercase tracking-[0.16em] text-white/35 sm:bottom-6 sm:right-7 sm:block">{t("home.globeDragHint")}</p>
        </div>

        <aside className="flex flex-col rounded-[1.5rem] border border-[rgba(208,188,255,0.32)] bg-[linear-gradient(145deg,rgba(208,188,255,0.17),rgba(255,255,255,0.035))] p-6 sm:p-7">
          <p className="mt-7 text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--muted-soft)]">
            {activeLocation.name} · {label(countryCopy[activeLocation.country], language)}
          </p>
          <h3 className="serif mt-3 text-3xl leading-[1.02] tracking-[-0.04em] text-[var(--text)] sm:text-4xl">{label(activeProfile.title, language)}</h3>
          <p className="mt-4 text-sm leading-6 text-[var(--muted)]">{label(activeProfile.summary, language)}</p>

          <div className="mt-6 space-y-4">
            <Signal label={t("home.globePalette")} value={label(activeProfile.palette, language)} />
            <Signal label={t("home.globeMaterials")} value={label(activeProfile.materials, language)} />
            <Signal label={t("home.globeSilhouette")} value={label(activeProfile.silhouette, language)} />
          </div>

          <div className="mt-6 border-t border-white/10 pt-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted-soft)]">{t("home.globeStylePrompt")}</p>
            <p className="mt-2 text-sm leading-6 text-[var(--text)]">{label(activeProfile.suggestion, language)}</p>
          </div>
          {!selectedIsVisible && selectedPoint && <button type="button" onClick={() => focusLocation(activeLocation)} className="mt-4 inline-flex w-fit items-center gap-2 text-xs font-semibold text-[var(--accent)]">{t("home.globeFocusLocation")} <LocateFixed size={14} /></button>}
        </aside>
      </div>
    </section>
  );
}

function Signal({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-[var(--muted-soft)]">{label}</p>
      <p className="mt-1.5 text-sm leading-5 text-[var(--text)]">{value}</p>
    </div>
  );
}

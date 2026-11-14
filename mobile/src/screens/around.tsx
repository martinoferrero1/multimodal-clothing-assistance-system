import { useMemo, useRef, useState } from "react";
import { PanResponder, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { geoDistance, geoGraticule10, geoOrthographic, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import atlas from "world-atlas/countries-110m.json";
import {
  regionalLocations,
  type CountryId,
  type RegionalLocation,
} from "../core/regional-style-data";
import { profiles, countryCopy } from "../core/regional-style-profiles";
import { useApp } from "../core/state";
import {
  Button,
  Chip,
  Field,
  Page,
  ScreenHeading,
  Sheet,
} from "../ui/components";
import { colors, s } from "../ui/theme";

const topology = atlas as unknown as Topology;
const countries = feature(
  topology,
  topology.objects.countries as GeometryCollection<{ name: string }>,
).features;
const initial: Record<CountryId, [number, number, number]> = {
  ar: [64, 22, 0],
  us: [100, -39, 0],
};

export function AroundScreen() {
  const {
    l,
    t,
    preferences: { language },
  } = useApp();
  const [selectedId, setSelectedId] = useState("ar-caba");
  const [rotation, setRotation] = useState(initial.ar);
  const [zoom, setZoom] = useState(140);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const rotationRef = useRef(initial.ar);
  const start = useRef(initial.ar);
  const location = regionalLocations.find((item) => item.id === selectedId)!;
  const profile = profiles[location.profile];
  function rotate(next: [number, number, number]) {
    rotationRef.current = next;
    setRotation(next);
  }
  // Gesture callbacks read current rotation only when the user starts dragging.
  // eslint-disable-next-line react-hooks/refs
  const [pan] = useState(() =>
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderGrant: () => {
        start.current = rotationRef.current;
      },
      onPanResponderMove: (_, g) =>
        rotate([
          start.current[0] + g.dx * 0.35,
          Math.max(-80, Math.min(80, start.current[1] - g.dy * 0.35)),
          0,
        ]),
    }),
  );
  const projection = useMemo(
    () => geoOrthographic().translate([160, 160]).scale(zoom).rotate(rotation),
    [rotation, zoom],
  );
  const path = geoPath(projection);
  function focus(item: RegionalLocation) {
    setSelectedId(item.id);
    rotate([-item.longitude, -item.latitude, 0]);
    setSearching(false);
    setQuery("");
  }
  const normalize = (value: string) =>
    value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  const matches = regionalLocations.filter((item) =>
    query.trim()
      ? normalize(
          `${item.name} ${countryCopy[item.country][language]}`,
        ).includes(normalize(query.trim()))
      : item.country === location.country,
  );
  return (
    <Page>
      <ScreenHeading
        title="Lookeate Around"
        eyebrow={l("ESTILO SIN FRONTERAS", "STYLE WITHOUT BORDERS")}
        description={t("home.globeDescription")}
      />
      <View style={s.wrap}>
        {(["ar", "us"] as const).map((country) => (
          <Chip
            key={country}
            title={countryCopy[country][language]}
            selected={location.country === country}
            onPress={() => {
              focus(
                regionalLocations.find((item) => item.country === country)!,
              );
              rotate(initial[country]);
            }}
          />
        ))}
      </View>
      <View style={[s.card, { padding: 8, overflow: "hidden" }]}>
        <View
          {...pan.panHandlers}
          accessibilityLabel={l(
            "Globo de estilos regionales. Deslizá para girar.",
            "Regional style globe. Swipe to rotate.",
          )}
        >
          <Svg width="100%" viewBox="0 0 320 320" style={{ aspectRatio: 1 }}>
            <Path
              d={path({ type: "Sphere" }) ?? ""}
              fill="#24212b"
              stroke={colors.accent}
              strokeWidth={0.6}
            />
            <Path
              d={path(geoGraticule10()) ?? ""}
              fill="none"
              stroke="#ffffff15"
              strokeWidth={0.5}
            />
            {countries
              .filter((shape) => shape.properties?.name !== "Antarctica")
              .map((shape) => (
                <Path
                  key={String(shape.id)}
                  d={path(shape) ?? ""}
                  fill={
                    String(shape.id) ===
                    (location.country === "ar" ? "032" : "840")
                      ? "#756389"
                      : "#433d4b"
                  }
                  stroke="#b8a8c166"
                  strokeWidth={0.5}
                />
              ))}
            {regionalLocations
              .filter((item) => item.country === location.country)
              .map((item) => {
                const point = projection([item.longitude, item.latitude]);
                if (
                  !point ||
                  geoDistance(
                    [item.longitude, item.latitude],
                    [-rotation[0], -rotation[1]],
                  ) >=
                    Math.PI / 2
                )
                  return null;
                return (
                  <Circle
                    key={item.id}
                    cx={point[0]}
                    cy={point[1]}
                    r={item.id === selectedId ? 6 : 3}
                    fill={item.id === selectedId ? "#fff" : colors.accent}
                    onPress={() => focus(item)}
                  />
                );
              })}
          </Svg>
        </View>
        <View style={[s.wrap, { justifyContent: "center" }]}>
          <Button
            title={l("Alejar", "Zoom out")}
            icon="remove"
            iconOnly
            secondary
            disabled={zoom <= 100}
            onPress={() => setZoom(Math.max(100, zoom - 30))}
          />
          <Button
            title={l("Centrar", "Center")}
            secondary
            onPress={() => {
              focus(location);
              setZoom(140);
            }}
          />
          <Button
            title={l("Acercar", "Zoom in")}
            icon="add"
            iconOnly
            secondary
            disabled={zoom >= 260}
            onPress={() => setZoom(Math.min(260, zoom + 30))}
          />
        </View>
        <Button
          title={l("Buscar provincia o estado", "Search province or state")}
          icon="search-outline"
          secondary
          onPress={() => setSearching(true)}
        />
      </View>
      <View style={s.card}>
        <Text style={s.eyebrow}>
          {location.name} · {countryCopy[location.country][language]}
        </Text>
        <Text style={s.heading}>{profile.title[language]}</Text>
        <Text style={s.muted}>{profile.summary[language]}</Text>
        {(
          [
            ["palette", t("home.globePalette")],
            ["materials", t("home.globeMaterials")],
            ["silhouette", t("home.globeSilhouette")],
          ] as const
        ).map(([key, label]) => (
          <View key={key} style={{ gap: 4 }}>
            <Text style={s.eyebrow}>{label}</Text>
            <Text style={s.text}>{profile[key][language]}</Text>
          </View>
        ))}
        <View style={s.divider} />
        <Text style={s.eyebrow}>{t("home.globeStylePrompt")}</Text>
        <Text style={s.text}>{profile.suggestion[language]}</Text>
      </View>
      <Sheet
        title={l("Elegí una ubicación", "Choose a location")}
        visible={searching}
        onClose={() => setSearching(false)}
      >
        <Field
          label={l("Provincia, estado o país", "Province, state or country")}
          value={query}
          onChangeText={setQuery}
          autoFocus
        />
        {matches.map((item) => (
          <Chip
            key={item.id}
            title={`${item.name} · ${countryCopy[item.country][language]}`}
            selected={item.id === selectedId}
            onPress={() => focus(item)}
          />
        ))}
        {!matches.length && (
          <Text style={s.muted}>
            {l("No encontramos ubicaciones.", "No locations found.")}
          </Text>
        )}
      </Sheet>
    </Page>
  );
}

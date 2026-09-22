import { useRef, useState } from "react";
import { PanResponder, Pressable, ScrollView, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, {
  Defs,
  LinearGradient as SvgGradient,
  Stop,
  Ellipse,
  Path,
  Rect,
  G,
} from "react-native-svg";
import { useApp } from "../core/state";
import { garments, type Garment, type GarmentCategory } from "../core/garments";
import { Button, Chip, Field, Page, Photo } from "../ui/components";
import { s, colors } from "../ui/theme";

export function StyleScreen() {
  const { l } = useApp();
  const [category, setCategory] = useState<GarmentCategory>("top");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<
    Partial<Record<GarmentCategory, Garment>>
  >({});
  const [rotation, setRotation] = useState(0);
  const rotationRef = useRef(0);
  const start = useRef(0);
  const rotate = (value: number) => {
    const next = Math.max(-65, Math.min(65, value));
    rotationRef.current = next;
    setRotation(next);
  };
  // PanResponder registers these callbacks; refs are read only during gestures.
  // eslint-disable-next-line react-hooks/refs
  const [pan] = useState(() =>
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderGrant: () => {
        start.current = rotationRef.current;
      },
      onPanResponderMove: (_, g) => rotate(start.current + g.dx * 0.4),
    }),
  );
  const items = garments.filter(
    (g) =>
      g.category === category &&
      `${g.name} ${g.brand} ${g.colorName}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  function toggle(garment: Garment) {
    setSelected((v) => ({
      ...v,
      [garment.category]:
        v[garment.category]?.id === garment.id ? undefined : garment,
    }));
  }
  return (
    <Page>
      <Text style={s.eyebrow}>
        {l("TU ATELIER PERSONAL", "YOUR PERSONAL ATELIER")}
      </Text>
      <Text style={s.title}>{l("Creá tu estilo.", "Create your style.")}</Text>
      <Text style={s.muted}>
        {l(
          "Elegí prendas, combiná colores y dale forma a tu próximo look.",
          "Choose pieces, combine colors and shape your next look.",
        )}
      </Text>
      <LinearGradient
        colors={["#25212b", "#171717"]}
        style={[s.card, { alignItems: "center", paddingVertical: 20 }]}
      >
        <View
          {...pan.panHandlers}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={l(
            "Maniquí. Deslizá para girar.",
            "Mannequin. Swipe to rotate.",
          )}
          accessibilityValue={{ min: -65, max: 65, now: rotation }}
          aria-valuemin={-65}
          aria-valuemax={65}
          aria-valuenow={rotation}
          accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
          onAccessibilityAction={(event) =>
            rotate(
              rotationRef.current +
                (event.nativeEvent.actionName === "increment" ? 15 : -15),
            )
          }
          style={{
            transform: [{ perspective: 700 }, { rotateY: `${rotation}deg` }],
          }}
        >
          <Svg width={230} height={330} viewBox="0 0 230 360">
            <Defs>
              <SvgGradient id="body" x1="0" x2="1">
                <Stop offset="0" stopColor="#817974" />
                <Stop offset="0.55" stopColor="#e2d9d2" />
                <Stop offset="1" stopColor="#a09791" />
              </SvgGradient>
            </Defs>
            <Ellipse cx="115" cy="345" rx="65" ry="10" fill="#0e0e0e" />
            <G fill="url(#body)">
              <Ellipse cx="115" cy="37" rx="20" ry="26" />
              <Rect x="106" y="56" width="18" height="23" rx="7" />
              <Path d="M83 77 Q115 64 147 77 L136 166 Q115 179 94 166 Z" />
              <Path d="M84 77 Q71 74 66 96 L49 179 Q48 191 56 192 Q65 190 67 179 L88 109 Z" />
              <Path d="M146 77 Q159 74 164 96 L181 179 Q182 191 174 192 Q165 190 163 179 L142 109 Z" />
              <Path d="M95 164 L135 164 Q141 186 134 221 L132 318 Q122 325 116 316 L115 224 L110 317 Q103 326 93 318 L91 220 Q84 185 95 164" />
              <Ellipse cx="99" cy="327" rx="13" ry="10" />
              <Ellipse cx="126" cy="327" rx="13" ry="10" />
            </G>
            {selected.bottom && (
              <G fill={selected.bottom.color} stroke="#ffffff24">
                <Path
                  d={
                    selected.bottom.shape === "shorts"
                      ? "M91 161 L139 161 L138 228 L117 228 L115 190 L112 228 L89 228 Z"
                      : "M91 161 L139 161 L135 316 L116 316 L115 203 L110 316 L91 316 Z"
                  }
                />
                <Path d="M94 167 L137 167" stroke="#ffffff55" />
              </G>
            )}
            {selected.top && (
              <G fill={selected.top.color} stroke="#ffffff24">
                <Path
                  d={
                    ["jacket", "sweatshirt", "shirt"].includes(
                      selected.top.shape,
                    )
                      ? "M82 74 L101 68 Q115 82 129 68 L149 74 L172 169 L157 176 L140 110 L141 170 L89 170 L90 110 L73 176 L58 169 Z"
                      : "M82 74 L101 68 Q115 82 129 68 L149 74 L160 108 L144 118 L138 104 L141 170 L89 170 L92 104 L86 118 L70 108 Z"
                  }
                />
                {selected.top.shape === "shirt" ||
                selected.top.shape === "jacket" ? (
                  <Path d="M115 81 L115 167" stroke="#ffffff66" />
                ) : null}
              </G>
            )}
            {selected.shoes && (
              <G fill={selected.shoes.color} stroke="#ffffff55">
                <Path d="M90 314 L108 314 L111 331 Q107 341 78 338 Q76 327 90 325 Z" />
                <Path d="M117 314 L135 314 L135 325 Q150 327 149 338 Q121 341 116 331 Z" />
              </G>
            )}
          </Svg>
        </View>
        <Text style={s.muted}>
          {l("Deslizá para girar el maniquí", "Swipe to rotate the mannequin")}
        </Text>
        <View style={s.row}>
          <Button title="↶" secondary onPress={() => rotate(rotation - 15)} />
          <Button
            title={l("Centrar", "Center")}
            secondary
            onPress={() => rotate(0)}
          />
          <Button title="↷" secondary onPress={() => rotate(rotation + 15)} />
        </View>
      </LinearGradient>
      <View style={s.row}>
        {(["top", "bottom", "shoes"] as const).map((key, i) => (
          <Chip
            key={key}
            title={
              [
                l("Arriba", "Tops"),
                l("Abajo", "Bottoms"),
                l("Calzado", "Shoes"),
              ][i]
            }
            selected={key === category}
            onPress={() => setCategory(key)}
          />
        ))}
      </View>
      <Field
        label={l("Buscar en el guardarropa", "Search wardrobe")}
        value={query}
        onChangeText={setQuery}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 12 }}
      >
        {items.map((garment) => (
          <Pressable
            key={garment.id}
            accessibilityRole="button"
            accessibilityState={{
              selected: selected[category]?.id === garment.id,
            }}
            onPress={() => toggle(garment)}
            style={[
              s.card,
              {
                width: 155,
                padding: 10,
                borderColor:
                  selected[category]?.id === garment.id
                    ? colors.accent
                    : colors.line,
              },
            ]}
          >
            <Photo uri={garment.image} size={130} />
            <Text numberOfLines={2} style={s.text}>
              {garment.name}
            </Text>
            <Text style={s.muted}>{garment.brand}</Text>
            <View style={[s.row, { gap: 6 }]}>
              <View
                style={{
                  width: 15,
                  height: 15,
                  backgroundColor: garment.color,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: colors.muted,
                }}
              />
              <Text style={s.muted}>{garment.colorName}</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
      {!items.length && (
        <Text style={s.muted}>
          {l(
            "No encontramos prendas para esa búsqueda.",
            "No pieces match this search.",
          )}
        </Text>
      )}
      <View style={s.card}>
        <Text style={s.heading}>
          {l("Tu look actual", "Your current look")}
        </Text>
        {Object.values(selected)
          .filter(Boolean)
          .map((g) => (
            <View key={g!.id} style={s.spread}>
              <Text style={[s.text, { flex: 1 }]}>{g!.name}</Text>
              <Button title="×" secondary onPress={() => toggle(g!)} />
            </View>
          ))}
        {!Object.values(selected).some(Boolean) && (
          <Text style={s.muted}>
            {l("Tocá una prenda para agregarla.", "Tap a piece to add it.")}
          </Text>
        )}
        <Text style={s.muted}>
          {l(
            "Esta combinación es temporal y no se guarda al cerrar la app.",
            "This combination is temporary and is not saved when you close the app.",
          )}
        </Text>
        <Button
          title={l("Empezar de nuevo", "Start over")}
          secondary
          onPress={() => {
            setSelected({});
            rotate(0);
          }}
        />
      </View>
    </Page>
  );
}

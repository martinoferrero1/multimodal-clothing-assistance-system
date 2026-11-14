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

export const profiles: Record<RegionalLocation["profile"], StyleProfile> = {
  warm: {
    title: {
      en: "Light layers, expressive color",
      es: "Capas livianas y color expresivo",
    },
    summary: {
      en: "A warm-weather direction built around breathable pieces and a clear color accent.",
      es: "Una dirección de clima cálido que combina prendas frescas con un acento de color definido.",
    },
    palette: {
      en: "Terracotta · leaf green · warm neutrals",
      es: "Terracota · verde hoja · neutros cálidos",
    },
    materials: {
      en: "Linen · cotton · open-weave knits",
      es: "Lino · algodón · tejidos abiertos",
    },
    silhouette: {
      en: "Easy volume with a defined waist or hem",
      es: "Volumen relajado con cintura o ruedo definidos",
    },
    suggestion: {
      en: "Keep the base light and let one saturated accessory lead.",
      es: "Mantené una base liviana y dejá que un accesorio intenso sea protagonista.",
    },
  },
  central: {
    title: {
      en: "Everyday structure, relaxed fit",
      es: "Estructura cotidiana y calce relajado",
    },
    summary: {
      en: "A versatile city-to-open-air mix: practical layers softened by comfortable proportions.",
      es: "Una mezcla versátil entre ciudad y aire libre: capas prácticas con proporciones cómodas.",
    },
    palette: {
      en: "Indigo · stone · muted blue",
      es: "Índigo · piedra · azul apagado",
    },
    materials: {
      en: "Denim · cotton twill · midweight jersey",
      es: "Denim · sarga de algodón · jersey de peso medio",
    },
    silhouette: {
      en: "Straight leg with a roomier top layer",
      es: "Pierna recta con una capa superior más amplia",
    },
    suggestion: {
      en: "Pair a clean base with one useful overshirt or light jacket.",
      es: "Combiná una base simple con una sobrecamisa práctica o una chaqueta liviana.",
    },
  },
  coastal: {
    title: {
      en: "Coastal ease, tactile basics",
      es: "Frescura costera y básicos con textura",
    },
    summary: {
      en: "An easygoing direction with airy fabrics, sun-faded tones, and a polished finish.",
      es: "Una dirección descontracturada con tejidos frescos, tonos gastados por el sol y un cierre cuidado.",
    },
    palette: {
      en: "Sea blue · chalk · soft sand",
      es: "Azul mar · tiza · arena suave",
    },
    materials: {
      en: "Washed cotton · linen · canvas",
      es: "Algodón lavado · lino · lona",
    },
    silhouette: {
      en: "Fluid top with a neat, shorter proportion",
      es: "Parte superior fluida con una proporción inferior más definida",
    },
    suggestion: {
      en: "Mix a breathable shirt with a structured short or straight trouser.",
      es: "Mezclá una camisa fresca con un short estructurado o un pantalón recto.",
    },
  },
  north: {
    title: {
      en: "Considered layers, soft utility",
      es: "Capas pensadas y utility suave",
    },
    summary: {
      en: "A layer-friendly direction balancing warmth, movement, and durable everyday pieces.",
      es: "Una dirección para superponer que equilibra abrigo, movimiento y prendas cotidianas resistentes.",
    },
    palette: { en: "Moss · charcoal · oatmeal", es: "Musgo · carbón · avena" },
    materials: {
      en: "Wool blend · brushed cotton · sturdy denim",
      es: "Mezcla de lana · algodón cepillado · denim firme",
    },
    silhouette: {
      en: "A compact base under a generous outer layer",
      es: "Una base compacta bajo una capa exterior amplia",
    },
    suggestion: {
      en: "Build warmth with two light layers instead of one bulky piece.",
      es: "Sumá abrigo con dos capas livianas en lugar de una sola prenda voluminosa.",
    },
  },
  south: {
    title: {
      en: "Weather-ready, functional layers",
      es: "Capas funcionales para el clima",
    },
    summary: {
      en: "A practical direction shaped by changing conditions, strong outerwear, and adaptable basics.",
      es: "Una dirección práctica para condiciones cambiantes, con abrigo protagonista y básicos adaptables.",
    },
    palette: {
      en: "Deep navy · rust · glacier grey",
      es: "Azul profundo · óxido · gris glaciar",
    },
    materials: {
      en: "Water-resistant shell · merino · dense knit",
      es: "Tejido exterior repelente al agua · merino · punto compacto",
    },
    silhouette: {
      en: "A protective outer layer over a flexible base",
      es: "Una capa exterior protectora sobre una base flexible",
    },
    suggestion: {
      en: "Choose a weather-ready jacket with room for a fine knit beneath.",
      es: "Elegí una chaqueta preparada para el clima con espacio para un tejido fino debajo.",
    },
  },
  urban: {
    title: {
      en: "Urban tailoring, personal details",
      es: "Sastrería urbana y detalles propios",
    },
    summary: {
      en: "A city-led direction pairing clear lines with individual accessories and flexible layers.",
      es: "Una dirección urbana que une líneas limpias, accesorios personales y capas versátiles.",
    },
    palette: {
      en: "Black · cream · one vivid accent",
      es: "Negro · crema · un acento vibrante",
    },
    materials: {
      en: "Fine wool · crisp poplin · polished leather",
      es: "Lana fina · poplín firme · cuero pulido",
    },
    silhouette: {
      en: "Relaxed tailoring with a defined shoulder",
      es: "Sastrería relajada con hombros definidos",
    },
    suggestion: {
      en: "Anchor a fluid trouser with a precise jacket and one expressive detail.",
      es: "Combiná un pantalón fluido con una chaqueta precisa y un detalle expresivo.",
    },
  },
};

export const countryCopy: Record<CountryId, Localized> = {
  ar: { en: "Argentina", es: "Argentina" },
  us: { en: "United States", es: "Estados Unidos" },
};

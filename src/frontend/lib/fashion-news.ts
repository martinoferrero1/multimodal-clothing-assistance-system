import type { Language } from "@/lib/i18n";

type LocalizedText = Record<Language, string>;

export type FashionNewsTone =
  | "violet"
  | "silver"
  | "rose"
  | "sage"
  | "ink"
  | "sand";

export type FashionNewsArticle = {
  id: string;
  source: string;
  publishedAt: string;
  url: string;
  title: LocalizedText;
  summary: LocalizedText;
  category: LocalizedText;
  tone: FashionNewsTone;
  homeFeature?: boolean;
};

export const fashionNewsArticles: FashionNewsArticle[] = [
  {
    id: "tokyo-fashion-week-ss27",
    source: "Vogue Business",
    publishedAt: "2026-09-07",
    url: "https://www.vogue.com/article/4-key-takeaways-from-tokyo-fashion-week-ss27",
    title: {
      en: "Tokyo Fashion Week looks beyond its borders for SS27",
      es: "La Semana de la Moda de Tokio mira más allá de sus fronteras para SS27",
    },
    summary: {
      en: "Emerging labels, international guests, and immersive shows reshape Tokyo's role as a launchpad for new design talent.",
      es: "Nuevas marcas, invitados internacionales y desfiles inmersivos redefinen el lugar de Tokio como plataforma para talentos emergentes.",
    },
    category: { en: "Runway", es: "Pasarelas" },
    tone: "violet",
    homeFeature: true,
  },
  {
    id: "vintage-fashion-business",
    source: "Vogue Business",
    publishedAt: "2026-09-03",
    url: "https://www.vogue.com/article/how-to-run-a-successful-vintage-fashion-business-today",
    title: {
      en: "Vintage fashion enters a more demanding era",
      es: "La moda vintage entra en una etapa más exigente",
    },
    summary: {
      en: "As resale grows, thoughtful curation, trusted authentication, and distinctive sourcing become the real competitive edge.",
      es: "Mientras crece la reventa, la curaduría, la autenticación confiable y una selección con identidad se vuelven la verdadera ventaja.",
    },
    category: { en: "Industry", es: "Industria" },
    tone: "rose",
  },
  {
    id: "new-grunge-minimalism",
    source: "Vogue",
    publishedAt: "2026-09-02",
    url: "https://www.vogue.com/article/the-new-grunge-minimalism",
    title: {
      en: "Grunge returns lighter, softer, and more minimal",
      es: "El grunge vuelve más liviano, suave y minimalista",
    },
    summary: {
      en: "Gauzy layers, distressed denim, and relaxed silhouettes give the '90s attitude a quieter 2026 interpretation.",
      es: "Capas translúcidas, denim desgastado y siluetas relajadas le dan a la actitud de los noventa una lectura más sutil en 2026.",
    },
    category: { en: "Trends", es: "Tendencias" },
    tone: "ink",
  },
  {
    id: "sustainable-materials",
    source: "Vogue Business",
    publishedAt: "2026-08-27",
    url: "https://www.vogue.com/article/kering-invites-10-designers-to-reimagine-sustainable-materials",
    title: {
      en: "Ten designers rethink what sustainable materials can become",
      es: "Diez diseñadores repiensan qué pueden ser los materiales sustentables",
    },
    summary: {
      en: "Regenerative fibers, recycled inputs, mycelium, and nanocellulose move from material research into experimental garments.",
      es: "Fibras regenerativas, insumos reciclados, micelio y nanocelulosa pasan de la investigación a prendas experimentales.",
    },
    category: { en: "Materials", es: "Materiales" },
    tone: "sage",
  },
  {
    id: "circular-technical-jacket",
    source: "Vogue Business",
    publishedAt: "2026-08-26",
    url: "https://www.vogue.com/article/how-arcteryx-made-its-most-circular-product-yet",
    title: {
      en: "A technical jacket designed around its entire life cycle",
      es: "Una campera técnica diseñada alrededor de todo su ciclo de vida",
    },
    summary: {
      en: "Arc'teryx combines durability, repair routines, recoverable materials, and a digital passport in its System 0 project.",
      es: "Arc'teryx combina durabilidad, procesos de reparación, materiales recuperables y un pasaporte digital en su proyecto System 0.",
    },
    category: { en: "Circularity", es: "Circularidad" },
    tone: "silver",
    homeFeature: true,
  },
  {
    id: "uae-circular-textiles",
    source: "Ellen MacArthur Foundation",
    publishedAt: "2026-08-12",
    url: "https://www.ellenmacarthurfoundation.org/news/creating-a-circular-economy-for-fashion-and-textiles-in-the-uae",
    title: {
      en: "A national circular textile framework takes shape in the UAE",
      es: "Un marco nacional para textiles circulares toma forma en Emiratos Árabes Unidos",
    },
    summary: {
      en: "The Naseej initiative aims to connect policy, industry, and design around a less wasteful fashion and textile system.",
      es: "La iniciativa Naseej busca conectar políticas, industria y diseño alrededor de un sistema de moda y textiles con menos desperdicio.",
    },
    category: { en: "Circularity", es: "Circularidad" },
    tone: "sand",
  },
];

export function localizeFashionNews(
  article: FashionNewsArticle,
  language: Language,
) {
  return {
    ...article,
    title: article.title[language],
    summary: article.summary[language],
    category: article.category[language],
  };
}

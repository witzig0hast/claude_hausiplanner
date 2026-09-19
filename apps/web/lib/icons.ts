const ICON_MAP: Record<string, string> = {
  calculator: "📐",
  book: "📖",
  globe: "🌍",
  leaf: "🌱",
  flask: "🧪",
  atom: "⚛️",
  scroll: "📜",
  map: "🗺️",
  whistle: "⚽",
  palette: "🎨",
};

export function subjectEmoji(icon: string): string {
  return ICON_MAP[icon] ?? "📚";
}

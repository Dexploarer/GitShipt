const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: "var(--chart-4)",
  JavaScript: "var(--warning)",
  Python: "var(--info)",
  Go: "var(--chart-4)",
  Rust: "var(--rank-bronze)",
  Solidity: "var(--fg-muted)",
  Java: "var(--rank-bronze)",
  Ruby: "var(--danger)",
  Swift: "var(--danger)",
  Kotlin: "var(--primary)",
  C: "var(--fg-muted)",
  "C++": "var(--danger)",
  "C#": "var(--success)",
  Shell: "var(--success)",
  HTML: "var(--danger)",
  CSS: "var(--primary)",
  Vue: "var(--success)",
  Svelte: "var(--danger)",
  Dart: "var(--info)",
};

export function languageColor(language: string): string {
  return LANGUAGE_COLORS[language] ?? "var(--fg-muted)";
}

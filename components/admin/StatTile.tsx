// Re-export the dashboard StatTile so admin pages don't fork the primitive.
// Per the brief: "if Agent A creates components/dashboard/StatTile.tsx, you
// may import + reuse it."
export { StatTile, type StatTileProps } from "@/components/dashboard/StatTile";

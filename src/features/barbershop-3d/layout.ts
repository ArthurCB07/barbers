/**
 * Planta da barbearia (unidades em metros, eixo Y para cima).
 *
 *            z = -5  (parede do fundo — espelhos A1..A3)
 *   x=-7 ┌──────────────────────────────────────┐ x=7
 *        │ Espera        A1     A2     A3        │
 *        │ (sofá)                            B1  │  parede direita
 *        │                                   B2  │  (espelhos B1..B3)
 *        │ Recepção                          B3  │
 *        └────────[porta]═══ vitrine ═══════════┘
 *            z = 5  (fachada de vidro) → calçada (z > 5)
 *
 * As estações só podem ocupar os pontos seguros abaixo, definidos para não
 * sobrepor móveis nem bloquear a circulação. Isso evita problemas de colisão
 * no editor de layout e garante um ambiente sempre coerente.
 */

export const ROOM = { minX: -7, maxX: 7, minZ: -5, maxZ: 5, height: 3.4 } as const;

export interface StationSpot {
  key: string;
  label: string;
  x: number;
  z: number;
  /** Rotação base (rad): espelho voltado para a parede */
  baseRotation: number;
  wall: "back" | "right";
}

export const STATION_SPOTS: StationSpot[] = [
  // Face interna das paredes: z = -4.9 (fundo) e x = 6.9 (direita). O painel
  // da estação fica 0,43 m atrás do ponto, então o ponto fica a ~0,46 m da parede.
  { key: "A1", label: "Fundo · 1", x: -1.6, z: -4.44, baseRotation: 0, wall: "back" },
  { key: "A2", label: "Fundo · 2", x: 1.2, z: -4.44, baseRotation: 0, wall: "back" },
  { key: "A3", label: "Fundo · 3", x: 4.0, z: -4.44, baseRotation: 0, wall: "back" },
  { key: "B1", label: "Lateral · 1", x: 6.44, z: -1.7, baseRotation: -Math.PI / 2, wall: "right" },
  { key: "B2", label: "Lateral · 2", x: 6.44, z: 0.9, baseRotation: -Math.PI / 2, wall: "right" },
  { key: "B3", label: "Lateral · 3", x: 6.44, z: 3.4, baseRotation: -Math.PI / 2, wall: "right" },
];

/** Ajustes de giro permitidos (graus) em relação à rotação base do ponto */
export const ROTATION_OFFSETS_DEG = [-20, -10, 0, 10, 20] as const;

export const STATION_MODELS = [
  { key: "classic", label: "Clássica — couro bordô e nogueira" },
  { key: "modern", label: "Moderna — couro preto e grafite" },
] as const;
export type StationModel = (typeof STATION_MODELS)[number]["key"];

export function spotByKey(key: string) {
  return STATION_SPOTS.find((s) => s.key === key);
}

export function rotationFor(spotKey: string, offsetDeg: number) {
  const spot = spotByKey(spotKey);
  return (spot?.baseRotation ?? 0) + (offsetDeg * Math.PI) / 180;
}

export function offsetDegFor(spotKey: string, rotationY: number) {
  const spot = spotByKey(spotKey);
  const deg = Math.round(((rotationY - (spot?.baseRotation ?? 0)) * 180) / Math.PI);
  return ROTATION_OFFSETS_DEG.reduce((best, d) => (Math.abs(d - deg) < Math.abs(best - deg) ? d : best), 0);
}

/** Posição da cadeira (onde o cliente senta) em coordenadas do mundo */
export function chairWorldPosition(x: number, z: number, rotationY: number): [number, number, number] {
  const dist = 1.25;
  return [x + Math.sin(rotationY) * dist, 0, z + Math.cos(rotationY) * dist];
}

/** Pontos do passeio por ambientes */
export const TOUR_POINTS = [
  { key: "facade", label: "Fachada", position: [-0.8, 2.1, 13.5] as const, target: [-1.2, 2.4, 5] as const },
  { key: "reception", label: "Recepção", position: [-1.6, 1.7, 4.4] as const, target: [-5, 1.2, 2.2] as const },
  { key: "waiting", label: "Sala de espera", position: [-1.8, 1.8, 1.6] as const, target: [-5.8, 0.8, -2.4] as const },
  { key: "service", label: "Área de atendimento", position: [2.2, 1.9, 2.8] as const, target: [2.2, 1.1, -3.4] as const },
] as const;

/** Vista inicial: dentro do salão, em 3/4, mostrando espera, recepção e estações */
export const OVERVIEW_VIEW = { position: [5.6, 3.05, 4.4] as const, target: [-0.6, 0.9, -1.6] as const };
export const TOP_VIEW = { position: [0.01, 16, 0.4] as const, target: [0, 0, 0] as const };

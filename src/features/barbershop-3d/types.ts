import type { StationState } from "@/types/domain";

export interface SceneBarber {
  id: string;
  displayName: string;
  photoUrl: string | null;
  bio: string;
  specialties: string[];
  services?: BarberServiceOption[];
}

export interface BarberServiceOption {
  id: string;
  name: string;
  description: string;
  category: string;
  priceCents: number;
  durationMin: number;
  imageUrl: string | null;
}

export interface SceneStation {
  id: string;
  name: string;
  spotKey: string;
  x: number;
  z: number;
  rotationY: number;
  model: string;
  accentColor: string;
  active: boolean;
  barber: SceneBarber | null;
  state: StationState;
  stateDetail?: string | null;
  /** Somente no editor */
  pending?: boolean;
  deleted?: boolean;
  isNew?: boolean;
}

export interface SceneConfigData {
  signText: string;
  accentColor: string;
  plants: boolean;
  sofaColor: string;
  neon: boolean;
}

export interface SceneData {
  shop: { name: string; tagline: string; logoUrl: string | null };
  config: SceneConfigData;
  stations: SceneStation[];
  date: string;
}

export const DEFAULT_SCENE_CONFIG: SceneConfigData = {
  signText: "BARBERVERSE",
  accentColor: "#c8a165",
  plants: true,
  sofaColor: "#5a3b2a",
  neon: true,
};

/** Materiais PBR compartilhados (criados uma vez e reutilizados) */
import * as THREE from "three";
import { darkBrick, darkTiles, fabric, leatherNoise, marble, mirrorTexture, plaster, woodFloor, woodSlats } from "./textures";

let mats: ReturnType<typeof build> | null = null;

function build() {
  const leatherRough = leatherNoise();
  const std = (p: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(p);
  return {
    floorWood: std({ map: woodFloor(), roughness: 0.32, metalness: 0.02, envMapIntensity: 0.8 }),
    floorTile: std({ map: darkTiles(10, 3.4), roughness: 0.16, metalness: 0.05, envMapIntensity: 1 }),
    floorTileSide: std({ map: darkTiles(2.8, 6.4), roughness: 0.16, metalness: 0.05, envMapIntensity: 1 }),
    wallPlaster: std({ map: plaster(), roughness: 0.92 }),
    wallSlats: std({ map: woodSlats(), roughness: 0.55 }),
    wallBrick: std({ map: darkBrick(), roughness: 0.9 }),
    ceiling: std({ color: "#0d0c0b", roughness: 0.95 }),
    walnut: std({ color: "#5c3a22", roughness: 0.38, metalness: 0.02 }),
    walnutDark: std({ color: "#33200f", roughness: 0.42 }),
    graphite: std({ color: "#1d1c1a", roughness: 0.42, metalness: 0.35 }),
    blackMatte: std({ color: "#0d0c0b", roughness: 0.6, metalness: 0.25 }),
    blackGloss: std({ color: "#0a0a0a", roughness: 0.18, metalness: 0.4 }),
    marble: std({ map: marble(), roughness: 0.12, metalness: 0.05, envMapIntensity: 1.2 }),
    gold: std({ color: "#d4ab6a", roughness: 0.22, metalness: 1, envMapIntensity: 1.4 }),
    brass: std({ color: "#b8904f", roughness: 0.32, metalness: 1, envMapIntensity: 1.2 }),
    copper: std({ color: "#b87333", roughness: 0.3, metalness: 1 }),
    chrome: std({ color: "#e6e6e6", roughness: 0.08, metalness: 1, envMapIntensity: 1.6 }),
    leatherOxblood: std({ color: "#5a1515", roughness: 0.48, roughnessMap: leatherRough, metalness: 0.02 }),
    leatherBlack: std({ color: "#141312", roughness: 0.42, roughnessMap: leatherRough, metalness: 0.02 }),
    leatherCognac: std({ color: "#8a5229", roughness: 0.5, roughnessMap: leatherRough }),
    fabric: std({ color: "#3b2a22", roughness: 0.96, roughnessMap: fabric() }),
    mirror: new THREE.MeshBasicMaterial({ map: mirrorTexture() }),
    glass: new THREE.MeshPhysicalMaterial({ color: "#8fa3ad", roughness: 0.04, metalness: 0, transparent: true, opacity: 0.12, envMapIntensity: 1.5, depthWrite: false }),
    screen: std({ color: "#050505", emissive: "#1d3245", emissiveIntensity: 1.2, roughness: 0.2 }),
    plantLeaf: std({ color: "#2b5531", roughness: 0.6, side: THREE.DoubleSide }),
    plantLeafLight: std({ color: "#3e7446", roughness: 0.6, side: THREE.DoubleSide }),
    pot: std({ color: "#1c1a18", roughness: 0.55, metalness: 0.2 }),
    potTerracotta: std({ color: "#7a4a32", roughness: 0.85 }),
    soil: std({ color: "#1d140c", roughness: 1 }),
    paper: std({ color: "#e9dfcd", roughness: 0.9 }),
    rug: std({ color: "#2e211a", roughness: 1 }),
    warmLight: std({ color: "#fff3dc", emissive: "#ffcf8a", emissiveIntensity: 4, toneMapped: false }),
    ledStrip: std({ color: "#fff1d6", emissive: "#ffc47a", emissiveIntensity: 5, toneMapped: false }),
    sidewalk: std({ color: "#34322f", roughness: 0.95 }),
    asphalt: std({ color: "#121212", roughness: 0.85 }),
    facade: std({ color: "#0f0e0d", roughness: 0.7 }),
    whiteCeramic: std({ color: "#efeae1", roughness: 0.22 }),
    towel: std({ color: "#ece6db", roughness: 1 }),
  };
}

export type Materials = ReturnType<typeof build>;

export function getMaterials(): Materials {
  if (!mats) mats = build();
  return mats;
}

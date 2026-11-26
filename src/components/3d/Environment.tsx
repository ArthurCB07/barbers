"use client";

/**
 * Arquitetura e ambientação da barbearia: piso, paredes, forro, fachada,
 * recepção, sala de espera, decoração e iluminação.
 */
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { getMaterials } from "./materials";
import { signTexture, barberPoleTexture, artTexture, labelTexture, emblemTexture, neonTexture } from "./textures";
import { ROOM } from "@/features/barbershop-3d/layout";
import type { SceneConfigData } from "@/features/barbershop-3d/types";

type V3 = [number, number, number];

export function Box({ args, position, rotation, material, cast = true, receive = true }: { args: V3; position: V3; rotation?: V3; material: THREE.Material; cast?: boolean; receive?: boolean }) {
  return (
    <mesh position={position} rotation={rotation} material={material} castShadow={cast} receiveShadow={receive}>
      <boxGeometry args={args} />
    </mesh>
  );
}

/** Caixa com cantos arredondados (estofados, bancadas) */
export function RBox({ args, position, rotation, material, radius = 0.04, cast = true }: { args: V3; position: V3; rotation?: V3; material: THREE.Material; radius?: number; cast?: boolean }) {
  return <RoundedBox args={args} radius={Math.min(radius, Math.min(...args) / 2 - 0.001)} smoothness={4} position={position} rotation={rotation} material={material} castShadow={cast} receiveShadow />;
}

/** Esconde o grupo quando a câmera satisfaz a condição (corte arquitetônico) */
function AutoHide({ hideWhen, children }: { hideWhen: (cam: THREE.Vector3) => boolean; children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ camera }) => {
    if (ref.current) ref.current.visible = !hideWhen(camera.position);
  });
  return <group ref={ref}>{children}</group>;
}

export function Architecture({ config }: { config: SceneConfigData }) {
  const m = getMaterials();
  const W = ROOM.maxX - ROOM.minX;
  const D = ROOM.maxZ - ROOM.minZ;
  const H = ROOM.height;
  const sign = useMemo(() => signTexture(config.signText, config.accentColor), [config.signText, config.accentColor]);
  const downlights = useMemo(() => {
    const out: V3[] = [];
    for (const x of [-5, -2.4, 0.2, 2.8, 5.4]) for (const z of [-2.6, 0.4, 3.2]) out.push([x, H - 0.005, z]);
    return out;
  }, [H]);

  return (
    <group>
      {/* Piso */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow material={m.floorWood}>
        <planeGeometry args={[W, D]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[2, 0.003, -3.3]} receiveShadow material={m.floorTile}>
        <planeGeometry args={[10, 3.4]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[5.6, 0.003, 1.6]} receiveShadow material={m.floorTileSide}>
        <planeGeometry args={[2.8, 6.4]} />
      </mesh>
      {/* Frisos dourados delimitando a área de atendimento */}
      <Box args={[10, 0.006, 0.03]} position={[2, 0.004, -1.6]} material={m.gold} cast={false} />
      <Box args={[0.03, 0.006, 6.4]} position={[4.2, 0.004, 1.6]} material={m.gold} cast={false} />

      {/* Parede do fundo: tijolinho na espera, ripado na área de atendimento */}
      <AutoHide hideWhen={(c) => c.z < ROOM.minZ}>
        <Box args={[4.2, H, 0.2]} position={[-4.9, H / 2, ROOM.minZ]} material={m.wallBrick} />
        <Box args={[9.8, H, 0.2]} position={[2.1, H / 2, ROOM.minZ]} material={m.wallSlats} />
        <Box args={[9.8, 0.03, 0.04]} position={[2.1, H - 0.22, ROOM.minZ + 0.12]} material={m.ledStrip} cast={false} />
        <Box args={[14, 0.08, 0.03]} position={[0, 0.04, ROOM.minZ + 0.11]} material={m.blackMatte} cast={false} />
      </AutoHide>
      {/* Parede esquerda */}
      <AutoHide hideWhen={(c) => c.x < ROOM.minX}>
        <Box args={[0.2, H, D]} position={[ROOM.minX, H / 2, 0]} material={m.wallPlaster} />
        <Box args={[0.04, 0.03, D - 0.4]} position={[ROOM.minX + 0.12, H - 0.22, 0]} material={m.ledStrip} cast={false} />
      </AutoHide>
      {/* Parede direita */}
      <AutoHide hideWhen={(c) => c.x > ROOM.maxX}>
        <Box args={[0.2, H, D]} position={[ROOM.maxX, H / 2, 0]} material={m.wallSlats} />
        <Box args={[0.04, 0.03, D - 0.4]} position={[ROOM.maxX - 0.12, H - 0.22, 0]} material={m.ledStrip} cast={false} />
      </AutoHide>

      {/* Forro escuro com ripas e spots embutidos — oculto em visões superiores */}
      <AutoHide hideWhen={(c) => c.y > H - 0.05}>
        <mesh position={[0, H, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.ceiling}>
          <planeGeometry args={[W, D]} />
        </mesh>
        {Array.from({ length: 20 }, (_, i) => (
          <Box key={i} args={[0.06, 0.08, D - 1.2]} position={[-2.6 + i * 0.48, H - 0.05, 0]} material={m.walnut} cast={false} receive={false} />
        ))}
        {downlights.map((p, i) => (
          <mesh key={i} position={p} rotation={[Math.PI / 2, 0, 0]} material={m.warmLight}>
            <circleGeometry args={[0.06, 16]} />
          </mesh>
        ))}
      </AutoHide>

      <Storefront />

      {/* Exterior */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 7.2]} receiveShadow material={m.sidewalk}>
        <planeGeometry args={[34, 4.4]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 14]} material={m.asphalt}>
        <planeGeometry args={[70, 9.2]} />
      </mesh>
      <Box args={[34, 0.14, 0.25]} position={[0, 0.05, 9.4]} material={m.sidewalk} />
      {/* Faixa superior da fachada com letreiro iluminado */}
      <Box args={[W + 1.2, 1.3, 0.3]} position={[0, H + 0.65, ROOM.maxZ + 0.05]} material={m.facade} />
      <Box args={[W + 1.2, 0.04, 0.34]} position={[0, H + 0.02, ROOM.maxZ + 0.05]} material={m.gold} cast={false} />
      <group position={[-1.2, H + 0.65, ROOM.maxZ + 0.24]}>
        <RBox args={[4.3, 1.1, 0.12]} position={[0, 0, -0.04]} material={m.blackGloss} radius={0.03} />
        <mesh position={[0, 0, 0.025]}>
          <planeGeometry args={[4.2, 1.05]} />
          <meshStandardMaterial map={sign} emissive="#ffffff" emissiveMap={sign} emissiveIntensity={config.neon ? 1.15 : 0.35} toneMapped={false} />
        </mesh>
      </group>
      {/* Pilares */}
      <Box args={[0.6, H + 1.3, 0.5]} position={[ROOM.minX - 0.1, (H + 1.3) / 2, ROOM.maxZ + 0.05]} material={m.facade} />
      <Box args={[0.6, H + 1.3, 0.5]} position={[ROOM.maxX + 0.1, (H + 1.3) / 2, ROOM.maxZ + 0.05]} material={m.facade} />
      {/* Toldo sobre a porta */}
      <group position={[-2.9, 3.05, ROOM.maxZ + 0.6]}>
        <mesh rotation={[0.32, 0, 0]} castShadow material={m.blackMatte}>
          <boxGeometry args={[2.1, 0.05, 1.2]} />
        </mesh>
        <Box args={[2.1, 0.035, 0.035]} position={[0, -0.2, 0.56]} material={m.gold} cast={false} />
      </group>
      <BarberPole position={[-4.4, 1.75, ROOM.maxZ + 0.32]} />
      <WallLantern position={[-4.95, 2.4, ROOM.maxZ + 0.3]} />
      <WallLantern position={[-0.85, 2.4, ROOM.maxZ + 0.3]} />
      <Planter position={[-6.1, 0, ROOM.maxZ + 0.8]} />
      <Planter position={[4.2, 0, ROOM.maxZ + 0.8]} />
      <StreetLamp position={[6.2, 0, 9.0]} />
      <StreetLamp position={[-8.5, 0, 9.0]} />
      <Bench position={[1.2, 0, 8.6]} />
    </group>
  );
}

function Storefront() {
  const m = getMaterials();
  const z = ROOM.maxZ;
  const H = ROOM.height;
  const panes: Array<[number, number]> = [
    [-6.9, -3.5],
    [-2.3, 0.3],
    [0.3, 2.9],
    [2.9, 5.0],
    [5.0, 6.9],
  ];
  return (
    <group>
      {panes.map(([a, b], i) => (
        <group key={i}>
          <mesh position={[(a + b) / 2, 1.45, z]} material={m.glass} renderOrder={2}>
            <planeGeometry args={[b - a, 2.9]} />
          </mesh>
          <Box args={[0.05, 2.9, 0.07]} position={[a, 1.45, z]} material={m.blackMatte} />
        </group>
      ))}
      <Box args={[0.05, 2.9, 0.07]} position={[6.9, 1.45, z]} material={m.blackMatte} />
      <Box args={[13.8, 0.06, 0.08]} position={[0, 2.9, z]} material={m.blackMatte} />
      <Box args={[13.8, 0.1, 0.1]} position={[0, 0.05, z]} material={m.blackMatte} />
      <Box args={[14, H - 2.93, 0.2]} position={[0, 2.93 + (H - 2.93) / 2, z]} material={m.facade} />
      {/* Porta de vidro com puxador dourado */}
      <group position={[-2.9, 0, z]}>
        <mesh position={[0, 1.42, 0]} material={m.glass} renderOrder={2}>
          <planeGeometry args={[1.12, 2.8]} />
        </mesh>
        <Box args={[1.16, 0.05, 0.06]} position={[0, 2.84, 0]} material={m.blackMatte} />
        <mesh position={[0.4, 1.15, 0.06]} material={m.gold}>
          <cylinderGeometry args={[0.018, 0.018, 1, 12]} />
        </mesh>
        <mesh position={[0.4, 1.15, -0.06]} material={m.gold}>
          <cylinderGeometry args={[0.018, 0.018, 1, 12]} />
        </mesh>
      </group>
      {/* "ABERTO" em neon na vitrine */}
      <mesh position={[1.6, 2.15, z + 0.03]}>
        <planeGeometry args={[0.9, 0.253]} />
        <meshBasicMaterial map={neonTexture("ABERTO", "#ffb35c")} toneMapped={false} transparent />
      </mesh>
    </group>
  );
}

function BarberPole({ position }: { position: V3 }) {
  const m = getMaterials();
  const tex = useMemo(() => barberPoleTexture(), []);
  useFrame((_, dt) => {
    tex.offset.y -= dt * 0.35;
  });
  return (
    <group position={position}>
      <mesh>
        <cylinderGeometry args={[0.09, 0.09, 0.8, 32]} />
        <meshStandardMaterial map={tex} emissive="#ffffff" emissiveMap={tex} emissiveIntensity={0.45} roughness={0.15} />
      </mesh>
      <mesh position={[0, 0.43, 0]} material={m.chrome}>
        <sphereGeometry args={[0.11, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      <mesh position={[0, -0.44, 0]} material={m.chrome}>
        <cylinderGeometry args={[0.11, 0.11, 0.08, 24]} />
      </mesh>
      <Box args={[0.04, 0.04, 0.2]} position={[0, 0, -0.14]} material={m.chrome} />
    </group>
  );
}

function WallLantern({ position }: { position: V3 }) {
  const m = getMaterials();
  return (
    <group position={position}>
      <RBox args={[0.16, 0.3, 0.16]} position={[0, 0, 0.06]} material={m.blackMatte} radius={0.02} />
      <mesh position={[0, 0, 0.145]} material={m.warmLight}>
        <planeGeometry args={[0.1, 0.22]} />
      </mesh>
    </group>
  );
}

function StreetLamp({ position }: { position: V3 }) {
  const m = getMaterials();
  return (
    <group position={position}>
      <mesh position={[0, 2.2, 0]} castShadow material={m.blackMatte}>
        <cylinderGeometry args={[0.045, 0.07, 4.4, 12]} />
      </mesh>
      <mesh position={[0, 4.45, 0]} material={m.warmLight}>
        <sphereGeometry args={[0.16, 16, 12]} />
      </mesh>
    </group>
  );
}

function Bench({ position }: { position: V3 }) {
  const m = getMaterials();
  return (
    <group position={position}>
      <RBox args={[1.6, 0.06, 0.42]} position={[0, 0.45, 0]} material={m.walnut} radius={0.02} />
      <Box args={[0.05, 0.45, 0.38]} position={[-0.7, 0.22, 0]} material={m.blackMatte} />
      <Box args={[0.05, 0.45, 0.38]} position={[0.7, 0.22, 0]} material={m.blackMatte} />
    </group>
  );
}

export function Plant({ position, scale = 1, light = false, terracotta = false }: { position: V3; scale?: number; light?: boolean; terracotta?: boolean }) {
  const m = getMaterials();
  const leaves = useMemo(() => {
    const out: Array<{ rot: V3; pos: V3; s: number }> = [];
    const n = 18;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 * 2.4;
      const tilt = 0.35 + (i % 5) * 0.14;
      out.push({ rot: [tilt, a, 0], pos: [Math.sin(a) * 0.05, 0.5 + (i % 6) * 0.1, Math.cos(a) * 0.05], s: 0.75 + (i % 4) * 0.15 });
    }
    return out;
  }, []);
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.22, 0]} castShadow material={terracotta ? m.potTerracotta : m.pot}>
        <cylinderGeometry args={[0.2, 0.15, 0.44, 24]} />
      </mesh>
      <mesh position={[0, 0.43, 0]} material={m.soil}>
        <cylinderGeometry args={[0.18, 0.18, 0.02, 16]} />
      </mesh>
      {leaves.map((l, i) => (
        <mesh key={i} position={l.pos} rotation={l.rot} scale={l.s} castShadow material={light || i % 2 ? m.plantLeafLight : m.plantLeaf}>
          <planeGeometry args={[0.13, 0.62, 1, 3]} />
        </mesh>
      ))}
    </group>
  );
}

function Planter({ position }: { position: V3 }) {
  const m = getMaterials();
  return (
    <group position={position}>
      <RBox args={[1, 0.5, 0.5]} position={[0, 0.25, 0]} material={m.graphite} radius={0.03} />
      <Plant position={[-0.25, 0.3, 0]} scale={0.9} />
      <Plant position={[0.25, 0.3, 0]} scale={0.75} light />
    </group>
  );
}

export function Reception({ shopName, accent }: { shopName: string; accent: string }) {
  const m = getMaterials();
  const emblem = useMemo(() => emblemTexture(shopName, accent), [shopName, accent]);
  return (
    <group position={[-4.8, 0, 2.65]}>
      {/* Balcão com frente canelada em nogueira e tampo de mármore */}
      <RBox args={[2.8, 1.0, 0.62]} position={[0, 0.5, 0]} material={m.walnutDark} radius={0.04} />
      {Array.from({ length: 22 }, (_, i) => (
        <mesh key={i} position={[-1.3 + i * 0.124, 0.5, 0.31]} material={m.walnut} castShadow>
          <cylinderGeometry args={[0.05, 0.05, 0.92, 12, 1, false, 0, Math.PI]} />
        </mesh>
      ))}
      <RBox args={[2.95, 0.06, 0.74]} position={[0, 1.03, 0.02]} material={m.marble} radius={0.025} />
      <Box args={[2.82, 0.02, 0.02]} position={[0, 0.06, 0.36]} material={m.gold} cast={false} />
      {/* Monitor */}
      <group position={[0.6, 1.06, -0.12]}>
        <RBox args={[0.56, 0.36, 0.025]} position={[0, 0.32, 0]} material={m.blackGloss} radius={0.012} />
        <mesh position={[0, 0.33, 0.014]} material={m.screen}>
          <planeGeometry args={[0.52, 0.3]} />
        </mesh>
        <Box args={[0.04, 0.16, 0.04]} position={[0, 0.08, -0.03]} material={m.chrome} />
        <RBox args={[0.2, 0.012, 0.14]} position={[0, 0.006, -0.02]} material={m.chrome} radius={0.005} />
        <RBox args={[0.36, 0.012, 0.12]} position={[0, 0.006, 0.2]} material={m.whiteCeramic} radius={0.005} />
      </group>
      {/* Objetos */}
      <mesh position={[-0.95, 1.14, 0.05]} material={m.gold}>
        <cylinderGeometry args={[0.045, 0.055, 0.16, 20]} />
      </mesh>
      <Plant position={[-1.2, 1.06, -0.05]} scale={0.42} light />
      <RBox args={[0.24, 0.025, 0.17]} position={[-0.4, 1.075, 0.1]} material={m.paper} radius={0.006} />
      {/* Banqueta */}
      <group position={[0.4, 0, -0.78]}>
        <mesh position={[0, 0.66, 0]} material={m.leatherBlack} castShadow>
          <cylinderGeometry args={[0.2, 0.19, 0.08, 28]} />
        </mesh>
        <mesh position={[0, 0.32, 0]} material={m.chrome}>
          <cylinderGeometry args={[0.022, 0.022, 0.62, 12]} />
        </mesh>
        <mesh position={[0, 0.3, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.chrome}>
          <torusGeometry args={[0.15, 0.012, 8, 32]} />
        </mesh>
        <mesh position={[0, 0.01, 0]} material={m.chrome}>
          <cylinderGeometry args={[0.18, 0.2, 0.02, 28]} />
        </mesh>
      </group>
      {/* Emblema na parede lateral */}
      <mesh position={[-2.08, 1.95, -0.7]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[1.5, 1.5]} />
        <meshStandardMaterial map={emblem} transparent emissive="#ffffff" emissiveMap={emblem} emissiveIntensity={0.85} toneMapped={false} />
      </mesh>
      {/* Pendentes */}
      {[-0.8, 0.8].map((x) => (
        <group key={x} position={[x, 2.55, 0]}>
          <mesh position={[0, 0.42, 0]} material={m.blackMatte}>
            <cylinderGeometry args={[0.004, 0.004, 0.84, 4]} />
          </mesh>
          <mesh material={m.gold}>
            <sphereGeometry args={[0.15, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          </mesh>
          <mesh position={[0, -0.01, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.warmLight}>
            <circleGeometry args={[0.12, 20]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Tufted({ w, h, position, rotation }: { w: number; h: number; position: V3; rotation?: V3 }) {
  const m = getMaterials();
  const pts = useMemo(() => {
    const out: V3[] = [];
    const cols = Math.max(2, Math.round(w / 0.22));
    const rows = Math.max(1, Math.round(h / 0.2));
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push([-w / 2 + (c + 0.5 + (r % 2 ? 0.5 : 0)) * (w / (cols + 0.5)), -h / 2 + (r + 0.5) * (h / rows), 0]);
    return out;
  }, [w, h]);
  return (
    <group position={position} rotation={rotation}>
      {pts.map((p, i) => (
        <mesh key={i} position={p} material={m.blackMatte}>
          <sphereGeometry args={[0.012, 8, 6]} />
        </mesh>
      ))}
    </group>
  );
}

export function WaitingArea({ sofaColor, accent, plants }: { sofaColor: string; accent: string; plants: boolean }) {
  const m = getMaterials();
  const sofaMat = useMemo(() => {
    const mat = m.fabric.clone();
    mat.color = new THREE.Color(sofaColor);
    return mat;
  }, [m.fabric, sofaColor]);
  const art1 = useMemo(() => artTexture(3, accent), [accent]);
  const art2 = useMemo(() => artTexture(8, accent), [accent]);
  const magazines = useMemo(() => [labelTexture("#7a1c1c", "GQ"), labelTexture("#1c3f6c", "STYLE"), labelTexture("#8a6a3a", "BARBER")], []);
  return (
    <group>
      {/* Tapete */}
      <RBox args={[3.1, 0.012, 2.6]} position={[-5, 0.006, -1.5]} material={m.rug} radius={0.005} cast={false} />
      {/* Sofá capitonê contra a parede esquerda */}
      <group position={[-6.35, 0, -1.5]} rotation={[0, Math.PI / 2, 0]}>
        <RBox args={[2.6, 0.38, 0.86]} position={[0, 0.27, 0]} material={sofaMat} radius={0.06} />
        <RBox args={[2.6, 0.62, 0.22]} position={[0, 0.68, -0.33]} material={sofaMat} radius={0.08} />
        <Tufted w={2.3} h={0.4} position={[0, 0.72, -0.218]} />
        <RBox args={[0.24, 0.6, 0.86]} position={[-1.28, 0.45, 0]} material={sofaMat} radius={0.1} />
        <RBox args={[0.24, 0.6, 0.86]} position={[1.28, 0.45, 0]} material={sofaMat} radius={0.1} />
        {[-0.78, 0, 0.78].map((x) => (
          <RBox key={x} args={[0.76, 0.14, 0.66]} position={[x, 0.53, 0.07]} material={sofaMat} radius={0.06} />
        ))}
        {[-1.2, 1.2].map((x) => [-0.32, 0.32].map((z) => (
          <mesh key={`${x}${z}`} position={[x, 0.04, z]} material={m.gold}>
            <cylinderGeometry args={[0.022, 0.016, 0.08, 10]} />
          </mesh>
        )))}
      </group>
      {/* Poltronas de couro conhaque */}
      {[-0.3, -2.7].map((z, i) => (
        <group key={z} position={[-3.75, 0, z]} rotation={[0, -Math.PI / 2 + (i ? 0.4 : -0.4), 0]}>
          <RBox args={[0.78, 0.32, 0.76]} position={[0, 0.32, 0]} material={m.leatherCognac} radius={0.07} />
          <RBox args={[0.78, 0.56, 0.16]} position={[0, 0.72, -0.32]} material={m.leatherCognac} radius={0.07} />
          <RBox args={[0.14, 0.3, 0.74]} position={[-0.36, 0.58, 0]} material={m.leatherCognac} radius={0.06} />
          <RBox args={[0.14, 0.3, 0.74]} position={[0.36, 0.58, 0]} material={m.leatherCognac} radius={0.06} />
          {[-0.3, 0.3].map((x) => [-0.28, 0.28].map((zz) => (
            <mesh key={`${x}${zz}`} position={[x, 0.08, zz]} material={m.walnutDark}>
              <cylinderGeometry args={[0.02, 0.015, 0.16, 8]} />
            </mesh>
          )))}
        </group>
      ))}
      {/* Mesa de centro redonda */}
      <group position={[-4.8, 0, -1.5]}>
        <mesh position={[0, 0.42, 0]} material={m.marble} castShadow receiveShadow>
          <cylinderGeometry args={[0.5, 0.5, 0.04, 48]} />
        </mesh>
        <mesh position={[0, 0.21, 0]} material={m.brass}>
          <cylinderGeometry args={[0.04, 0.12, 0.42, 20]} />
        </mesh>
        <mesh position={[0, 0.01, 0]} material={m.brass}>
          <cylinderGeometry args={[0.24, 0.26, 0.02, 32]} />
        </mesh>
        {magazines.map((tex, i) => (
          <mesh key={i} position={[-0.18 + i * 0.16, 0.442 + i * 0.004, 0.06 * (i - 1)]} rotation={[-Math.PI / 2, 0, 0.25 * (i - 1)]}>
            <planeGeometry args={[0.18, 0.24]} />
            <meshStandardMaterial map={tex} roughness={0.55} />
          </mesh>
        ))}
        <mesh position={[0.28, 0.5, -0.1]} material={m.copper}>
          <cylinderGeometry args={[0.045, 0.035, 0.12, 20]} />
        </mesh>
      </group>
      {/* Quadros com moldura dourada */}
      {[[-2.2, art1], [-0.8, art2]].map(([z, tex]) => (
        <group key={String(z)} position={[-6.88, 1.8, z as number]} rotation={[0, Math.PI / 2, 0]}>
          <RBox args={[0.92, 1.14, 0.04]} position={[0, 0, -0.01]} material={m.gold} radius={0.01} />
          <mesh position={[0, 0, 0.012]}>
            <planeGeometry args={[0.82, 1.04]} />
            <meshStandardMaterial map={tex as THREE.Texture} roughness={0.7} />
          </mesh>
        </group>
      ))}
      {/* Estante iluminada com produtos à venda */}
      <group position={[-4.9, 0, -4.76]}>
        <RBox args={[2.5, 0.8, 0.36]} position={[0, 0.4, 0.02]} material={m.walnutDark} radius={0.02} />
        {[1.15, 1.6, 2.05].map((y) => (
          <group key={y}>
            <Box args={[2.4, 0.035, 0.28]} position={[0, y, 0]} material={m.walnut} />
            <Box args={[2.3, 0.012, 0.02]} position={[0, y - 0.025, 0.12]} material={m.ledStrip} cast={false} />
            {Array.from({ length: 9 }, (_, i) => (
              <mesh key={i} position={[-1.05 + i * 0.26, y + 0.1, 0]} material={i % 3 === 0 ? m.gold : i % 3 === 1 ? m.blackGloss : m.copper} castShadow>
                <cylinderGeometry args={[0.04, 0.045, 0.15 + (i % 2) * 0.05, 16]} />
              </mesh>
            ))}
          </group>
        ))}
      </group>
      {plants && (
        <>
          <Plant position={[-6.5, 0, -4.4]} scale={1.5} terracotta />
          <Plant position={[-6.5, 0, 0.65]} scale={1.15} light />
          <Plant position={[-2.65, 0, -4.5]} scale={1.25} />
          <Plant position={[6.5, 0, 4.5]} scale={1.25} light terracotta />
        </>
      )}
      {/* Luminária de piso em arco */}
      <group position={[-6.45, 0, 0.05]}>
        <mesh position={[0, 0.02, 0]} material={m.blackGloss}>
          <cylinderGeometry args={[0.16, 0.18, 0.04, 24]} />
        </mesh>
        <mesh position={[0, 0.85, 0]} material={m.brass}>
          <cylinderGeometry args={[0.012, 0.012, 1.7, 8]} />
        </mesh>
        <mesh position={[0, 1.72, 0]} material={m.brass}>
          <sphereGeometry args={[0.16, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
        <mesh position={[0, 1.71, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.warmLight}>
          <circleGeometry args={[0.12, 20]} />
        </mesh>
      </group>
    </group>
  );
}

/** Iluminação geral (ajustada pelo nível de qualidade) */
export function Lighting({ quality }: { quality: "high" | "medium" | "low" }) {
  const shadows = quality === "high";
  return (
    <>
      <ambientLight intensity={0.55} color="#ffe6c4" />
      <hemisphereLight args={["#ffe2b8", "#22160c", 0.6]} />
      <directionalLight
        position={[3, 10, 5]}
        intensity={1.1}
        color="#ffe7c4"
        castShadow={shadows}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-9}
        shadow-camera-right={9}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
        shadow-camera-near={1}
        shadow-camera-far={30}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
      />
      <pointLight position={[-4.8, 2.6, 2.6]} intensity={9} distance={6} decay={2} color="#ffc98a" />
      <pointLight position={[-5, 2.9, -1.5]} intensity={10} distance={7} decay={2} color="#ffbf7a" />
      {quality !== "low" && (
        <>
          <pointLight position={[1.5, 3.1, 0.8]} intensity={9} distance={9} decay={2} color="#ffdcb0" />
          <pointLight position={[5, 3.1, 2.5]} intensity={6} distance={6} decay={2} color="#ffdcb0" />
          <pointLight position={[-1.2, 5.3, 6.6]} intensity={12} distance={7} decay={2} color="#ffd29a" />
        </>
      )}
    </>
  );
}

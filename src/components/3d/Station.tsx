"use client";

/**
 * Estação de atendimento completa: cadeira hidráulica capitonê, bancada
 * flutuante com tampo de mármore, espelho em arco (clássica) ou retroiluminado
 * (moderna), produtos, carrinho auxiliar, secador, máquina e luz própria.
 * Interativa: hover destaca, clique seleciona. Rótulos ficam na camada HTML
 * (StationLabels) para não depender de raízes React dentro do Canvas.
 */
import { memo, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { getMaterials } from "./materials";
import { Box, RBox } from "./Environment";
import type { SceneStation } from "@/features/barbershop-3d/types";

export const STATE_COLOR: Record<string, string> = {
  AVAILABLE: "#6fbf8b",
  FULL: "#e0b04f",
  UNAVAILABLE: "#c07a45",
  INACTIVE: "#6b665e",
  VACANT: "#8d867a",
};

interface Props {
  station: SceneStation;
  hovered: boolean;
  selected: boolean;
  quality: "high" | "medium" | "low";
  interactive: boolean;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
}

// ─── Geometrias compartilhadas ───────────────────────────────────────────────

let archCache: { mirror: THREE.ShapeGeometry; frame: THREE.ExtrudeGeometry } | null = null;
function archGeometries() {
  if (archCache) return archCache;
  const arch = (w: number, h: number) => {
    const s = new THREE.Shape();
    const r = w / 2;
    s.moveTo(-r, 0);
    s.lineTo(-r, h - r);
    s.absarc(0, h - r, r, Math.PI, 0, true);
    s.lineTo(r, 0);
    s.lineTo(-r, 0);
    return s;
  };
  const outer = arch(0.96, 1.5);
  outer.holes.push(arch(0.86, 1.45) as unknown as THREE.Path);
  const mirror = new THREE.ShapeGeometry(arch(0.86, 1.45), 32);
  // Remapeia os UVs (em metros) para 0..1, para o reflexo preencher o arco
  const pos = mirror.attributes.position;
  const uv = mirror.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / 0.86 + 0.5, pos.getY(i) / 1.45);
  archCache = {
    mirror,
    frame: new THREE.ExtrudeGeometry(outer, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.008, bevelSegments: 2, curveSegments: 32 }),
  };
  return archCache;
}

// ─── Cadeira de barbeiro ─────────────────────────────────────────────────────

function BarberChair({ classic }: { classic: boolean }) {
  const m = getMaterials();
  const leather = classic ? m.leatherOxblood : m.leatherBlack;
  const frame = classic ? m.chrome : m.blackGloss;
  const buttons = useMemo(() => {
    const out: Array<[number, number]> = [];
    for (let r = 0; r < 4; r++) for (let c = 0; c < (r % 2 ? 2 : 3); c++) out.push([(c - (r % 2 ? 0.5 : 1)) * 0.15, 0.14 + r * 0.15]);
    return out;
  }, []);
  return (
    <group rotation={[0, Math.PI, 0]}>
      {/* Base cromada e coluna hidráulica */}
      <mesh position={[0, 0.025, 0]} material={m.chrome} castShadow receiveShadow>
        <cylinderGeometry args={[0.32, 0.34, 0.05, 48]} />
      </mesh>
      <mesh position={[0, 0.05, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.chrome}>
        <torusGeometry args={[0.32, 0.012, 8, 48]} />
      </mesh>
      <mesh position={[0, 0.24, 0]} material={frame} castShadow>
        <cylinderGeometry args={[0.065, 0.085, 0.38, 24]} />
      </mesh>
      <mesh position={[0, 0.43, 0]} material={m.chrome}>
        <cylinderGeometry args={[0.1, 0.07, 0.04, 24]} />
      </mesh>
      <mesh position={[0.17, 0.11, 0.2]} rotation={[0.3, 0, -0.7]} material={m.chrome}>
        <cylinderGeometry args={[0.012, 0.012, 0.24, 8]} />
      </mesh>
      {/* Assento */}
      <RBox args={[0.54, 0.06, 0.52]} position={[0, 0.48, 0.02]} material={frame} radius={0.02} />
      <RBox args={[0.58, 0.16, 0.56]} position={[0, 0.59, 0.03]} material={leather} radius={0.06} />
      {/* Encosto capitonê inclinado */}
      <group position={[0, 0.64, -0.24]} rotation={[-0.18, 0, 0]}>
        <RBox args={[0.56, 0.74, 0.14]} position={[0, 0.38, 0]} material={leather} radius={0.06} />
        {classic &&
          buttons.map(([x, y], i) => (
            <mesh key={i} position={[x, y + 0.04, 0.072]} material={m.blackMatte}>
              <sphereGeometry args={[0.011, 8, 6]} />
            </mesh>
          ))}
        <mesh position={[0, 0.82, 0.0]} material={m.chrome}>
          <cylinderGeometry args={[0.012, 0.012, 0.14, 8]} />
        </mesh>
        <RBox args={[0.3, 0.14, 0.11]} position={[0, 0.92, 0.02]} material={leather} radius={0.05} />
      </group>
      {/* Braços com estrutura tubular */}
      {[-0.34, 0.34].map((x) => (
        <group key={x}>
          <RBox args={[0.09, 0.07, 0.5]} position={[x, 0.85, 0.05]} material={leather} radius={0.03} />
          <mesh position={[x, 0.72, 0.24]} material={m.chrome}>
            <cylinderGeometry args={[0.015, 0.015, 0.22, 10]} />
          </mesh>
          <mesh position={[x, 0.72, -0.14]} material={m.chrome}>
            <cylinderGeometry args={[0.015, 0.015, 0.22, 10]} />
          </mesh>
          <mesh position={[x, 0.61, 0.05]} rotation={[Math.PI / 2, 0, 0]} material={m.chrome}>
            <cylinderGeometry args={[0.013, 0.013, 0.4, 10]} />
          </mesh>
        </group>
      ))}
      {/* Apoio para os pés */}
      <mesh position={[0, 0.45, 0.36]} rotation={[0.9, 0, 0]} material={frame}>
        <boxGeometry args={[0.06, 0.26, 0.03]} />
      </mesh>
      <RBox args={[0.46, 0.025, 0.2]} position={[0, 0.34, 0.47]} rotation={[0.2, 0, 0]} material={m.chrome} radius={0.01} />
    </group>
  );
}

// ─── Bancada, espelho e acessórios ───────────────────────────────────────────

function Workstation({ classic, accent }: { classic: boolean; accent: string }) {
  const m = getMaterials();
  const body = classic ? m.walnut : m.graphite;
  const accentMat = useMemo(() => new THREE.MeshStandardMaterial({ color: accent, metalness: 1, roughness: 0.25, envMapIntensity: 1.3 }), [accent]);
  const arch = archGeometries();
  return (
    <group>
      {/* Painel de fundo da estação */}
      <RBox args={[1.6, 2.5, 0.04]} position={[0, 1.4, -0.41]} material={classic ? m.walnutDark : m.blackMatte} radius={0.015} />
      {/* Bancada flutuante */}
      <RBox args={[1.5, 0.34, 0.46]} position={[0, 0.72, -0.17]} material={body} radius={0.025} />
      <RBox args={[1.56, 0.04, 0.52]} position={[0, 0.91, -0.15]} material={m.marble} radius={0.015} />
      {[-0.5, 0, 0.5].map((x) => (
        <group key={x}>
          <Box args={[0.46, 0.005, 0.005]} position={[x, 0.72, 0.065]} material={m.blackMatte} cast={false} />
          <mesh position={[x, 0.66, 0.075]} rotation={[0, 0, Math.PI / 2]} material={accentMat}>
            <cylinderGeometry args={[0.007, 0.007, 0.12, 8]} />
          </mesh>
        </group>
      ))}
      <Box args={[1.4, 0.012, 0.012]} position={[0, 0.545, -0.05]} material={m.ledStrip} cast={false} />
      {/* Espelho */}
      {classic ? (
        <group position={[0, 1.05, -0.38]}>
          <mesh geometry={arch.mirror} material={m.mirror} position={[0, 0, 0.01]} />
          <mesh geometry={arch.frame} material={accentMat} position={[0, 0, -0.02]} castShadow />
        </group>
      ) : (
        <group position={[0, 1.78, -0.385]}>
          <mesh position={[0, 0, 0.012]} material={m.mirror}>
            <planeGeometry args={[0.9, 1.3]} />
          </mesh>
          <RBox args={[0.96, 1.36, 0.01]} position={[0, 0, -0.005]} material={m.ledStrip} radius={0.006} />
        </group>
      )}
      {/* Arandelas ao lado do espelho */}
      {[-0.66, 0.66].map((x) => (
        <group key={x} position={[x, 1.85, -0.34]}>
          <mesh material={accentMat}>
            <cylinderGeometry args={[0.012, 0.012, 0.12, 8]} />
          </mesh>
          <mesh position={[0, 0.1, 0.02]} material={m.warmLight}>
            <cylinderGeometry args={[0.035, 0.035, 0.14, 16]} />
          </mesh>
        </group>
      ))}
      {/* Produtos e ferramentas */}
      <group position={[0, 0.93, -0.15]}>
        {[-0.64, -0.55, -0.46].map((x, i) => (
          <group key={x}>
            <mesh position={[x, 0.085 + i * 0.01, -0.12]} material={[m.copper, m.blackGloss, m.whiteCeramic][i]} castShadow>
              <cylinderGeometry args={[0.032, 0.038, 0.17 + i * 0.02, 16]} />
            </mesh>
            <mesh position={[x, 0.18 + i * 0.02, -0.12]} material={m.blackMatte}>
              <cylinderGeometry args={[0.014, 0.014, 0.03, 8]} />
            </mesh>
          </group>
        ))}
        <group position={[0.36, 0.028, 0.06]} rotation={[0, 0.5, Math.PI / 2]}>
          <mesh material={m.blackGloss}>
            <cylinderGeometry args={[0.024, 0.03, 0.17, 16]} />
          </mesh>
          <Box args={[0.052, 0.018, 0.018]} position={[0, 0.093, 0]} material={m.chrome} />
        </group>
        <RBox args={[0.18, 0.006, 0.03]} position={[0.1, 0.004, 0.13]} material={m.blackMatte} radius={0.002} cast={false} />
        <group position={[0.6, 0.008, 0.06]} rotation={[0, -0.5, 0]}>
          <Box args={[0.14, 0.005, 0.012]} position={[0, 0, 0.008]} material={m.chrome} cast={false} />
          <Box args={[0.14, 0.005, 0.012]} position={[0, 0.004, -0.008]} rotation={[0, 0.18, 0]} material={m.chrome} cast={false} />
        </group>
        {/* Toalhas dobradas */}
        <RBox args={[0.24, 0.05, 0.16]} position={[-0.2, 0.025, 0.05]} material={m.towel} radius={0.02} />
        <RBox args={[0.24, 0.05, 0.16]} position={[-0.2, 0.075, 0.05]} material={m.towel} radius={0.02} />
      </group>
      {/* Secador pendurado */}
      <group position={[0.81, 0.72, -0.1]}>
        <mesh rotation={[0, 0, Math.PI / 2]} material={m.blackGloss}>
          <cylinderGeometry args={[0.04, 0.05, 0.19, 16]} />
        </mesh>
        <RBox args={[0.04, 0.16, 0.035]} position={[0.02, -0.11, 0]} material={m.blackGloss} radius={0.012} />
      </group>
      {/* Carrinho auxiliar */}
      <group position={[1.05, 0, 0.5]}>
        <RBox args={[0.42, 0.62, 0.38]} position={[0, 0.39, 0]} material={classic ? m.blackGloss : m.graphite} radius={0.03} />
        {[0.24, 0.42, 0.6].map((y) => (
          <Box key={y} args={[0.2, 0.012, 0.01]} position={[0, y, 0.195]} material={accentMat} cast={false} />
        ))}
        <RBox args={[0.44, 0.02, 0.4]} position={[0, 0.71, 0]} material={m.chrome} radius={0.008} />
        {[[-0.17, -0.15], [0.17, -0.15], [-0.17, 0.15], [0.17, 0.15]].map(([x, z]) => (
          <mesh key={`${x}${z}`} position={[x, 0.035, z]} rotation={[0, 0, Math.PI / 2]} material={m.blackMatte}>
            <cylinderGeometry args={[0.032, 0.032, 0.025, 12]} />
          </mesh>
        ))}
        <mesh position={[0.08, 0.77, 0]} material={m.copper}>
          <cylinderGeometry args={[0.03, 0.03, 0.09, 12]} />
        </mesh>
      </group>
    </group>
  );
}

function StationImpl({ station, hovered, selected, quality, interactive, onHover, onSelect }: Props) {
  const m = getMaterials();
  const classic = station.model !== "modern";
  const ringRef = useRef<THREE.Mesh>(null);
  const ringMat = useMemo(() => new THREE.MeshBasicMaterial({ color: station.accentColor, transparent: true, opacity: 0, toneMapped: false, depthWrite: false }), [station.accentColor]);
  const stateMat = useMemo(() => new THREE.MeshBasicMaterial({ color: STATE_COLOR[station.state] ?? "#6b665e", transparent: true, opacity: 0.1, toneMapped: false, depthWrite: false }), [station.state]);
  const dim = !station.active;

  useFrame(({ clock }, dt) => {
    const target = selected ? 0.9 : hovered ? 0.6 : 0.12;
    ringMat.opacity += (target - ringMat.opacity) * Math.min(1, dt * 8);
    if (ringRef.current) ringRef.current.scale.setScalar(selected ? 1 + Math.sin(clock.elapsedTime * 2.4) * 0.025 : 1);
  });

  return (
    <group position={[station.x, 0, station.z]} rotation={[0, station.rotationY, 0]}>
      <Workstation classic={classic} accent={station.accentColor} />
      <group position={[0, 0, 1.25]}>
        <BarberChair classic={classic} />
        <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, 0]} material={ringMat}>
          <ringGeometry args={[0.6, 0.66, 64]} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]} material={stateMat}>
          <circleGeometry args={[0.6, 48]} />
        </mesh>
      </group>
      {/* Pendente próprio da estação */}
      <group position={[0, 2.72, 1.0]}>
        <mesh position={[0, 0.34, 0]} material={m.blackMatte}>
          <cylinderGeometry args={[0.004, 0.004, 0.68, 4]} />
        </mesh>
        <mesh material={classic ? m.gold : m.blackGloss}>
          <cylinderGeometry args={[0.07, 0.2, 0.2, 32, 1, true]} />
        </mesh>
        <mesh position={[0, -0.09, 0]} rotation={[Math.PI / 2, 0, 0]} material={dim ? m.blackMatte : m.warmLight}>
          <circleGeometry args={[0.18, 24]} />
        </mesh>
        {quality !== "low" && !dim && <pointLight position={[0, -0.3, 0]} intensity={selected ? 9 : 5.5} distance={4.2} decay={2} color="#ffd29a" />}
      </group>
      {interactive && (
        <mesh
          position={[0, 1.1, 0.6]}
          visible={false}
          onPointerOver={(e) => {
            e.stopPropagation();
            onHover(station.id);
            document.body.style.cursor = "pointer";
          }}
          onPointerOut={(e) => {
            e.stopPropagation();
            onHover(null);
            document.body.style.cursor = "";
          }}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(station.id);
          }}
        >
          <boxGeometry args={[1.7, 2.2, 2.2]} />
        </mesh>
      )}
    </group>
  );
}

export const Station = memo(StationImpl);

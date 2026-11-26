"use client";

/**
 * Canvas WebGL da barbearia. Recebe os dados do banco (SceneData) e
 * renderiza arquitetura + estações dinâmicas, com pós-processamento
 * (oclusão ambiente, bloom e vinheta) nos níveis de qualidade alto/médio.
 */
import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer, PerformanceMonitor, ContactShadows } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette, N8AO, ToneMapping, SMAA } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import * as THREE from "three";
import { Architecture, Lighting, Reception, WaitingArea } from "./Environment";
import { Station } from "./Station";
import { CameraRig, type CameraView } from "./CameraRig";
import { chairWorldPosition, ROOM } from "@/features/barbershop-3d/layout";
import type { SceneData } from "@/features/barbershop-3d/types";

export type Quality = "high" | "medium" | "low";

export interface BarbershopSceneProps {
  data: SceneData;
  view: CameraView;
  quality: Quality;
  onQualityDrop?: () => void;
  hoveredId: string | null;
  selectedId: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
  interactive?: boolean;
  reducedMotion: boolean;
  autoRotate?: boolean;
  /** Elementos HTML dos rótulos, posicionados a cada quadro sobre as cadeiras */
  labelRefs?: React.MutableRefObject<Map<string, HTMLElement>>;
  onReady?: () => void;
  /** Painel de agendamento aberto sobre a cena */
  panelOpen?: boolean;
}

/**
 * Desloca a projeção para que o assunto fique centralizado na área livre:
 * à esquerda do painel (desktop) ou acima dele (celular).
 */
function ViewShift({ open, instant }: { open: boolean; instant: boolean }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  const current = useRef({ x: 0, y: 0 });
  useFrame((_, dt) => {
    const wide = window.innerWidth >= 1024;
    const goalX = open && wide ? 228 : 0;
    const goalY = open && !wide ? size.height * 0.3 : 0;
    const k = instant ? 1 : 1 - Math.pow(0.004, Math.min(dt, 0.05));
    const c = current.current;
    c.x += (goalX - c.x) * k;
    c.y += (goalY - c.y) * k;
    if (Math.abs(c.x) > 0.5 || Math.abs(c.y) > 0.5) camera.setViewOffset(size.width, size.height, c.x, c.y, size.width, size.height);
    else if (camera.view?.enabled) camera.clearViewOffset();
  });
  return null;
}

/** Projeta a posição de cada cadeira na tela e move o rótulo HTML correspondente */
function LabelProjector({ data, labelRefs }: { data: SceneData; labelRefs: React.MutableRefObject<Map<string, HTMLElement>> }) {
  const { camera, size } = useThree();
  const v = useRef(new THREE.Vector3());
  useFrame(() => {
    for (const s of data.stations) {
      const el = labelRefs.current.get(s.id);
      if (!el) continue;
      const [x, , z] = chairWorldPosition(s.x, s.z, s.rotationY);
      v.current.set(x, 2.05, z).project(camera);
      // Fora da loja (na calçada) os rótulos ficam ocultos
      const outside = camera.position.z > ROOM.maxZ && camera.position.y < ROOM.height + 2;
      const visible = !outside && v.current.z < 1 && Math.abs(v.current.x) < 1.15 && Math.abs(v.current.y) < 1.15;
      el.style.visibility = visible ? "visible" : "hidden";
      el.style.opacity = visible ? "1" : "0";
      el.style.transform = `translate(-50%, -100%) translate(${((v.current.x + 1) / 2) * size.width}px, ${((1 - v.current.y) / 2) * size.height}px)`;
    }
  });
  return null;
}

/** A cena é estática: as sombras são recalculadas só quando algo muda */
function StaticShadows({ version }: { version: string }) {
  const gl = useThree((s) => s.gl);
  const frames = useRef(0);
  useEffect(() => {
    gl.shadowMap.autoUpdate = false;
    frames.current = 0;
  }, [gl, version]);
  useFrame(() => {
    if (frames.current < 20) {
      gl.shadowMap.needsUpdate = true;
      frames.current++;
    }
  });
  return null;
}

/** Sinaliza que o primeiro quadro foi desenhado (remove a tela de carregamento) */
function FirstFrame({ onReady }: { onReady?: () => void }) {
  const done = useRef(false);
  useFrame(() => {
    if (!done.current) {
      done.current = true;
      requestAnimationFrame(() => onReady?.());
    }
  });
  return null;
}

export default function BarbershopScene(props: BarbershopSceneProps) {
  const { data, view, quality, interactive = true } = props;
  const stations = data.stations.filter((s) => !s.deleted);
  const shadowKey = stations.map((s) => `${s.spotKey}${s.rotationY}${s.model}`).join("|");

  // Fallback: nunca deixar a tela de carregamento presa
  useEffect(() => {
    const t = setTimeout(() => props.onReady?.(), 6000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pausa a renderização quando a cena está fora da tela (economiza CPU/GPU)
  const wrapRef = useRef<HTMLDivElement>(null);
  const [onScreen, setOnScreen] = useState(true);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={wrapRef} className="h-full w-full">
    <Canvas
      frameloop={onScreen ? "always" : "never"}
      shadows={quality === "high" ? "percentage" : false}
      dpr={quality === "high" ? [1, 2] : quality === "medium" ? [1, 1.5] : [0.75, 1]}
      gl={{ antialias: quality === "low", powerPreference: "high-performance", toneMapping: quality === "low" ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping, toneMappingExposure: 1.15 }}
      camera={{ position: [...view.position] as [number, number, number], fov: 52, near: 0.05, far: 120 }}
      onPointerMissed={() => props.onHover(null)}
      aria-label="Barbearia virtual em 3D"
      role="img"
    >
      <color attach="background" args={["#090807"]} />
      <fog attach="fog" args={["#090807", 20, 48]} />
      <PerformanceMonitor onDecline={() => props.onQualityDrop?.()} flipflops={2} />
      <Suspense fallback={null}>
        <Environment resolution={256} frames={1}>
          <Lightformer form="rect" intensity={2.4} color="#ffd9a8" position={[0, 4, 0]} rotation-x={Math.PI / 2} scale={[12, 8, 1]} />
          <Lightformer form="rect" intensity={1.4} color="#c8a165" position={[-7, 2, 0]} rotation-y={Math.PI / 2} scale={[10, 2, 1]} />
          <Lightformer form="rect" intensity={1} color="#ffffff" position={[7, 2, 0]} rotation-y={-Math.PI / 2} scale={[10, 2, 1]} />
          <Lightformer form="ring" intensity={2} color="#ffe2b8" position={[0, 3, 6]} scale={3} />
        </Environment>
        <Lighting quality={quality} />
        <Architecture config={data.config} />
        <Reception shopName={data.config.signText || data.shop.name} accent={data.config.accentColor} />
        <WaitingArea sofaColor={data.config.sofaColor} accent={data.config.accentColor} plants={data.config.plants} />
        {stations.map((s) => (
          <Station
            key={s.id}
            station={s}
            hovered={props.hoveredId === s.id}
            selected={props.selectedId === s.id}
            quality={quality}
            interactive={interactive}
            onHover={props.onHover}
            onSelect={props.onSelect}
          />
        ))}
        {quality !== "low" && <ContactShadows key={shadowKey} position={[0, 0.01, 0]} scale={[15, 11]} resolution={1024} blur={2.4} opacity={0.55} far={2.2} frames={1} color="#000000" />}
        {quality !== "low" && (
          <EffectComposer multisampling={0}>
            <N8AO halfRes={quality === "medium"} aoRadius={0.6} intensity={2.2} distanceFalloff={0.6} quality={quality === "high" ? "medium" : "low"} />
            <Bloom mipmapBlur luminanceThreshold={0.9} luminanceSmoothing={0.2} intensity={0.75} />
            <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
            <Vignette offset={0.25} darkness={0.55} />
            <SMAA />
          </EffectComposer>
        )}
        {quality === "high" && <StaticShadows version={`${shadowKey}|${data.config.plants}`} />}
        <FirstFrame onReady={props.onReady} />
      </Suspense>
      <ViewShift open={!!props.panelOpen} instant={props.reducedMotion} />
      {props.labelRefs && <LabelProjector data={{ ...data, stations }} labelRefs={props.labelRefs} />}
      <CameraRig view={view} reducedMotion={props.reducedMotion} autoRotate={props.autoRotate} enabled={interactive} />
    </Canvas>
    </div>
  );
}

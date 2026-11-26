"use client";

/** Fachada 3D animada da página inicial (decorativa, sem interação) */
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { detectWebGL, prefersReducedMotion } from "@/components/3d/webgl";
import { SceneErrorBoundary } from "@/components/3d/SceneErrorBoundary";
import type { CameraView } from "@/components/3d/CameraRig";
import type { SceneData } from "./types";

const BarbershopScene = dynamic(() => import("@/components/3d/BarbershopScene"), { ssr: false });

export function HeroBackdrop({ data }: { data: SceneData }) {
  const [ok, setOk] = useState<null | { lowPower: boolean }>(null);
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<CameraView>({ nonce: 0, position: [3.5, 2.6, 13], target: [0.5, 1.6, 0] });
  useEffect(() => {
    const w = detectWebGL();
    if (w.supported) setOk({ lowPower: w.lowPower });
  }, []);
  useEffect(() => {
    if (!ready || prefersReducedMotion()) return;
    // Aproximação lenta pela vitrine até o interior
    const t = setTimeout(() => setView({ nonce: 1, position: [4.4, 2.3, 7.6], target: [0.4, 1.2, -2] }), 500);
    return () => clearTimeout(t);
  }, [ready]);
  if (!ok) return <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_30%,rgba(200,161,101,0.18),transparent_60%),radial-gradient(ellipse_at_20%_90%,rgba(184,115,51,0.12),transparent_55%)]" />;
  return (
    <div className={`absolute inset-0 transition-opacity duration-[1500ms] ${ready ? "opacity-100" : "opacity-0"}`} aria-hidden>
      <SceneErrorBoundary fallback={null}>
        <BarbershopScene
          data={data}
          view={view}
          quality={ok.lowPower ? "low" : "medium"}
          hoveredId={null}
          selectedId={null}
          onHover={() => {}}
          onSelect={() => {}}
          interactive={false}
          reducedMotion={prefersReducedMotion()}
          onReady={() => setReady(true)}
        />
      </SceneErrorBoundary>
    </div>
  );
}

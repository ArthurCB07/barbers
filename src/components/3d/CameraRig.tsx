"use client";

/**
 * Controle de câmera: órbita com limites, transições suaves entre vistas e
 * proteção para a câmera não atravessar paredes.
 */
import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { ROOM } from "@/features/barbershop-3d/layout";

export interface CameraView {
  nonce: number;
  position: readonly [number, number, number];
  target: readonly [number, number, number];
}

interface Props {
  view: CameraView;
  reducedMotion: boolean;
  autoRotate?: boolean;
  enabled?: boolean;
}

export function CameraRig({ view, reducedMotion, autoRotate, enabled = true }: Props) {
  const { camera } = useThree();
  const controls = useRef<OrbitControlsImpl>(null);
  const goal = useRef({ pos: new THREE.Vector3(...view.position), target: new THREE.Vector3(...view.target), active: true });

  useEffect(() => {
    goal.current.pos.set(...view.position);
    goal.current.target.set(...view.target);
    goal.current.active = true;
    if (reducedMotion) {
      camera.position.copy(goal.current.pos);
      controls.current?.target.copy(goal.current.target);
      controls.current?.update();
      goal.current.active = false;
    }
  }, [view.nonce, view.position, view.target, reducedMotion, camera]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const c = controls.current;
    if (!c) return;
    if (goal.current.active) {
      const t = 1 - Math.pow(0.004, dt);
      camera.position.lerp(goal.current.pos, t);
      c.target.lerp(goal.current.target, t);
      if (camera.position.distanceTo(goal.current.pos) < 0.01 && c.target.distanceTo(goal.current.target) < 0.01) goal.current.active = false;
    }
    // Abaixo do forro a câmera fica dentro do salão (ou na calçada, à frente)
    const p = camera.position;
    if (p.y < ROOM.height - 0.1) {
      if (p.z <= ROOM.maxZ + 0.3) {
        p.x = THREE.MathUtils.clamp(p.x, ROOM.minX + 0.4, ROOM.maxX - 0.4);
        p.z = THREE.MathUtils.clamp(p.z, ROOM.minZ + 0.4, ROOM.maxZ - 0.25);
      } else {
        p.x = THREE.MathUtils.clamp(p.x, -14, 14);
      }
    }
    p.y = THREE.MathUtils.clamp(p.y, 0.5, 18);
    c.target.x = THREE.MathUtils.clamp(c.target.x, ROOM.minX + 0.5, ROOM.maxX - 0.5);
    c.target.z = THREE.MathUtils.clamp(c.target.z, ROOM.minZ + 0.5, ROOM.maxZ + 1);
    c.target.y = THREE.MathUtils.clamp(c.target.y, 0, 2.6);
    c.update();
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enabled={enabled}
      enableDamping
      dampingFactor={0.08}
      minDistance={1.2}
      maxDistance={20}
      maxPolarAngle={Math.PI * 0.48}
      rotateSpeed={0.5}
      zoomSpeed={0.7}
      panSpeed={0.6}
      autoRotate={autoRotate}
      autoRotateSpeed={0.3}
      onStart={() => {
        goal.current.active = false;
      }}
    />
  );
}

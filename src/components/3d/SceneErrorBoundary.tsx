"use client";

import { Component, type ReactNode } from "react";

/** Se o WebGL falhar (contexto perdido, driver), cai para o modo 2D */
export class SceneErrorBoundary extends Component<{ fallback: ReactNode; onError?: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err: unknown) {
    console.error("[3d] falha ao renderizar a cena", err);
    this.props.onError?.();
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

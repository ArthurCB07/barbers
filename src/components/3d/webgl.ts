/** Detecção de suporte a WebGL e da qualidade gráfica inicial recomendada */
export function detectWebGL(): { supported: boolean; lowPower: boolean; quality: "high" | "medium" | "low" } {
  const none = { supported: false, lowPower: true, quality: "low" as const };
  if (typeof window === "undefined") return none;
  try {
    const canvas = document.createElement("canvas");
    const gl = (canvas.getContext("webgl2") || canvas.getContext("webgl")) as WebGLRenderingContext | null;
    if (!gl) return none;
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : "";
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    const nav = navigator as Navigator & { deviceMemory?: number };
    const cores = navigator.hardwareConcurrency ?? 4;
    const mem = nav.deviceMemory ?? 4;
    const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const software = /SwiftShader|llvmpipe|Basic Render/i.test(renderer);
    const lowPower = software || cores <= 2 || mem <= 2 || (mobile && (cores <= 4 || mem <= 3));
    // Placas integradas e celulares começam no nível equilibrado
    const modest = mobile || cores <= 4 || /Intel|Radeon\(TM\) Graphics|Mali|Adreno/i.test(renderer);
    return { supported: true, lowPower, quality: lowPower ? "low" : modest ? "medium" : "high" };
  } catch {
    return none;
  }
}

export function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

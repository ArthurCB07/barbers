/**
 * Texturas procedurais geradas em <canvas> no navegador: zero downloads,
 * tamanho controlado e aparência coerente com o tema luxo escuro.
 */
import * as THREE from "three";

const cache = new Map<string, THREE.Texture>();

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function make(key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, opts: { repeat?: [number, number]; color?: boolean } = {}) {
  const cached = cache.get(key);
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(...(opts.repeat ?? [1, 1]));
  tex.anisotropy = 8;
  if (opts.color !== false) tex.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, tex);
  return tex;
}

function noise(ctx: CanvasRenderingContext2D, w: number, h: number, amount: number, seed: number) {
  const r = rng(seed);
  const img = ctx.getImageData(0, 0, w, h);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (r() - 0.5) * amount;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

/** Tábua de madeira com veios */
function plank(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: () => number, base: [number, number, number]) {
  const t = 0.82 + r() * 0.3;
  ctx.fillStyle = `rgb(${base[0] * t},${base[1] * t},${base[2] * t})`;
  ctx.fillRect(x, y, w, h);
  const horizontal = w > h;
  const len = horizontal ? w : h;
  const thick = horizontal ? h : w;
  for (let i = 0; i < 9; i++) {
    ctx.strokeStyle = `rgba(25,12,5,${0.06 + r() * 0.12})`;
    ctx.lineWidth = 0.6 + r() * 1.4;
    ctx.beginPath();
    const off = r() * thick;
    if (horizontal) {
      ctx.moveTo(x, y + off);
      ctx.bezierCurveTo(x + len * 0.3, y + off + (r() - 0.5) * 4, x + len * 0.7, y + off + (r() - 0.5) * 4, x + len, y + off);
    } else {
      ctx.moveTo(x + off, y);
      ctx.bezierCurveTo(x + off + (r() - 0.5) * 4, y + len * 0.3, x + off + (r() - 0.5) * 4, y + len * 0.7, x + off, y + len);
    }
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(12,6,2,0.75)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

/** Piso de tábuas largas de carvalho escuro (emendas alternadas, tileável) */
export function woodFloor() {
  return make("woodFloor", 1024, 1024, (ctx, s) => {
    const r = rng(9);
    ctx.fillStyle = "#1c1009";
    ctx.fillRect(0, 0, s, s);
    const rows = 10;
    const h = s / rows;
    for (let y = 0; y < rows; y++) {
      let x = -r() * s * 0.6;
      while (x < s) {
        const w = s * (0.45 + r() * 0.35);
        // desenha também deslocado em -s para emendar sem costura
        const seed = r();
        for (const ox of [0, s, -s]) {
          const rr = rng(Math.floor(seed * 1e6) + 1);
          plank(ctx, x + ox, y * h, w, h, rr, [70, 47, 31]);
        }
        x += w;
      }
    }
    noise(ctx, s, s, 8, 3);
  }, { repeat: [4.4, 3.2] });
}

/** Porcelanato marmorizado escuro em placas grandes (área de atendimento) */
export function darkTiles(wTiles: number, dTiles: number) {
  const key = `tiles:${wTiles}:${dTiles}`;
  return make(key, 1024, 1024, (ctx, s) => {
    const r = rng(31);
    const n = 4;
    const t = s / n;
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        const g = ctx.createLinearGradient(x * t, y * t, x * t + t, y * t + t);
        const b = 26 + r() * 8;
        g.addColorStop(0, `rgb(${b},${b - 1},${b - 3})`);
        g.addColorStop(1, `rgb(${b + 8},${b + 6},${b + 3})`);
        ctx.fillStyle = g;
        ctx.fillRect(x * t, y * t, t, t);
        for (let v = 0; v < 5; v++) {
          ctx.strokeStyle = v === 0 ? `rgba(200,161,101,${0.12 + r() * 0.12})` : `rgba(230,225,215,${0.03 + r() * 0.05})`;
          ctx.lineWidth = 0.6 + r() * 1.6;
          ctx.beginPath();
          let px = x * t + r() * t;
          let py = y * t;
          ctx.moveTo(px, py);
          while (py < y * t + t) {
            px += (r() - 0.5) * 36;
            py += 8 + r() * 24;
            ctx.lineTo(px, py);
          }
          ctx.stroke();
        }
        ctx.fillStyle = "rgba(0,0,0,0.85)";
        ctx.fillRect(x * t, y * t, t, 3);
        ctx.fillRect(x * t, y * t, 3, t);
      }
  }, { repeat: [wTiles / 4, dTiles / 4] });
}

/** Painel ripado de madeira escura (paredes de destaque) */
export function woodSlats() {
  return make("woodSlats", 512, 512, (ctx, s) => {
    const r = rng(11);
    const n = 14;
    const w = s / n;
    ctx.fillStyle = "#070504";
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < n; i++) {
      const b = 52 + r() * 14;
      const g = ctx.createLinearGradient(i * w, 0, i * w + w, 0);
      g.addColorStop(0, `rgb(${b + 34},${b + 14},${b - 6})`);
      g.addColorStop(0.5, `rgb(${b + 46},${b + 22},${b})`);
      g.addColorStop(1, `rgb(${b + 18},${b + 4},${b - 12})`);
      ctx.fillStyle = g;
      ctx.fillRect(i * w + 3, 0, w - 6, s);
      for (let k = 0; k < 8; k++) {
        ctx.strokeStyle = `rgba(20,10,4,${0.08 + r() * 0.12})`;
        ctx.beginPath();
        const xx = i * w + 3 + r() * (w - 6);
        ctx.moveTo(xx, 0);
        ctx.lineTo(xx + (r() - 0.5) * 5, s);
        ctx.stroke();
      }
    }
  }, { repeat: [4, 1] });
}

/** Reboco grafite fosco (paredes neutras) */
export function plaster() {
  return make("plaster", 512, 512, (ctx, s) => {
    ctx.fillStyle = "#211f1c";
    ctx.fillRect(0, 0, s, s);
    noise(ctx, s, s, 12, 23);
    const r = rng(5);
    for (let i = 0; i < 50; i++) {
      ctx.fillStyle = `rgba(${r() > 0.5 ? 255 : 0},${r() > 0.5 ? 240 : 0},${r() > 0.5 ? 220 : 0},0.012)`;
      ctx.beginPath();
      ctx.arc(r() * s, r() * s, 20 + r() * 90, 0, Math.PI * 2);
      ctx.fill();
    }
  }, { repeat: [3, 1.5] });
}

/** Tijolinho escuro (parede da sala de espera) */
export function darkBrick() {
  return make("brick", 512, 512, (ctx, s) => {
    const r = rng(17);
    ctx.fillStyle = "#14110f";
    ctx.fillRect(0, 0, s, s);
    const bh = s / 16;
    const bw = s / 4;
    for (let y = 0; y < 16; y++) {
      const off = y % 2 ? bw / 2 : 0;
      for (let x = -1; x < 5; x++) {
        const v = 38 + r() * 18;
        ctx.fillStyle = `rgb(${v + 10},${v},${v - 6})`;
        ctx.fillRect(x * bw + off + 2, y * bh + 2, bw - 4, bh - 4);
      }
    }
    noise(ctx, s, s, 14, 2);
  }, { repeat: [2, 1] });
}

/** Mármore escuro com veios dourados (bancadas) */
export function marble() {
  return make("marble", 512, 512, (ctx, s) => {
    const r = rng(41);
    const g = ctx.createLinearGradient(0, 0, s, s);
    g.addColorStop(0, "#1c1a18");
    g.addColorStop(1, "#2a2622");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 16; i++) {
      ctx.strokeStyle = i % 4 === 0 ? `rgba(214,176,112,${0.3 + r() * 0.25})` : `rgba(235,230,220,${0.05 + r() * 0.08})`;
      ctx.lineWidth = 0.5 + r() * 2;
      ctx.beginPath();
      let x = r() * s;
      let y = 0;
      ctx.moveTo(x, y);
      while (y < s) {
        x += (r() - 0.5) * 40;
        y += 10 + r() * 30;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  });
}

/** Ruído para couro (mapa de rugosidade) */
export function leatherNoise() {
  return make("leather", 256, 256, (ctx, s) => {
    ctx.fillStyle = "#808080";
    ctx.fillRect(0, 0, s, s);
    noise(ctx, s, s, 60, 77);
  }, { repeat: [2, 2], color: false });
}

/** Tecido (veludo) */
export function fabric() {
  return make("fabric", 256, 256, (ctx, s) => {
    ctx.fillStyle = "#7a7a7a";
    ctx.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 2) {
      ctx.fillStyle = y % 4 === 0 ? "#6e6e6e" : "#878787";
      ctx.fillRect(0, y, s, 1);
    }
    noise(ctx, s, s, 20, 8);
  }, { repeat: [3, 3], color: false });
}

/** Letreiro: caixa iluminada com o nome da barbearia (proporção 4:1) */
export function signTexture(text: string, accent: string, sub = "BARBEARIA · DESDE 2014") {
  return make(`sign:${text}:${accent}:${sub}`, 1024, 256, (ctx, w, h) => {
    ctx.fillStyle = "#0b0a09";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 4;
    ctx.strokeRect(10, 10, w - 20, h - 20);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const size = Math.min(118, (w * 1.45) / Math.max(5, text.length));
    ctx.font = `600 ${size}px "Cormorant Garamond", Georgia, serif`;
    ctx.fillStyle = accent;
    ctx.shadowColor = accent;
    ctx.shadowBlur = 18;
    ctx.fillText(text.toUpperCase(), w / 2, h * 0.44);
    ctx.shadowBlur = 0;
    ctx.font = `500 24px Inter, Arial, sans-serif`;
    ctx.fillStyle = "#e9dfcd";
    ctx.fillText(sub.split("").join(" "), w / 2, h * 0.8);
  });
}

/** Logotipo circular para a parede da recepção */
export function emblemTexture(text: string, accent: string) {
  return make(`emblem:${text}:${accent}`, 512, 512, (ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, s * 0.44, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, s * 0.4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = accent;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const size = Math.min(84, (s * 1.25) / Math.max(5, text.length));
    ctx.font = `600 ${size}px "Cormorant Garamond", Georgia, serif`;
    ctx.fillText(text.toUpperCase(), s / 2, s / 2);
    ctx.font = "500 22px Inter, Arial, sans-serif";
    ctx.fillText("✂  B A R B E A R I A  ✂", s / 2, s * 0.68);
    ctx.fillText("E S T.  2 0 1 4", s / 2, s * 0.32);
  });
}

/** Etiqueta de produto / capa de revista */
export function labelTexture(color: string, text: string) {
  return make(`label:${color}:${text}`, 128, 160, (ctx, w, h) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "bold 22px Georgia";
    ctx.textAlign = "center";
    ctx.fillText(text, w / 2, 36);
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.fillRect(16, 60, w - 32, h - 80);
  });
}

/** Faixas do poste de barbeiro */
export function barberPoleTexture() {
  return make("pole", 256, 256, (ctx, s) => {
    ctx.fillStyle = "#f2ece1";
    ctx.fillRect(0, 0, s, s);
    const colors = ["#8c1c1c", "#f2ece1", "#1c3f8c", "#f2ece1"];
    const band = s / 4;
    for (let i = -8; i < 12; i++) {
      ctx.fillStyle = colors[((i % 4) + 4) % 4];
      ctx.beginPath();
      ctx.moveTo(i * band, 0);
      ctx.lineTo(i * band + band, 0);
      ctx.lineTo(i * band + band + s, s);
      ctx.lineTo(i * band + s, s);
      ctx.closePath();
      ctx.fill();
    }
  }, { repeat: [1, 2] });
}

/** Quadro decorativo: retrato estilizado de barbearia */
export function artTexture(seed: number, accent: string) {
  return make(`art:${seed}:${accent}`, 384, 480, (ctx, w, h) => {
    const r = rng(seed);
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#1e1914");
    g.addColorStop(1, "#0e0c0a");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // Silhueta de navalha / tesoura estilizada
    ctx.strokeStyle = accent;
    ctx.lineWidth = 5;
    ctx.globalAlpha = 0.9;
    if (seed % 2) {
      ctx.beginPath();
      ctx.arc(w * 0.38, h * 0.7, 34, 0, Math.PI * 2);
      ctx.arc(w * 0.62, h * 0.7, 34, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(w * 0.4, h * 0.62);
      ctx.lineTo(w * 0.62, h * 0.18);
      ctx.moveTo(w * 0.6, h * 0.62);
      ctx.lineTo(w * 0.38, h * 0.18);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(w * 0.25, h * 0.75);
      ctx.lineTo(w * 0.5, h * 0.45);
      ctx.lineTo(w * 0.78, h * 0.22);
      ctx.stroke();
      ctx.fillStyle = "#6b4429";
      ctx.fillRect(w * 0.18, h * 0.72, w * 0.18, 26);
    }
    ctx.globalAlpha = 1;
    for (let i = 0; i < 60; i++) {
      ctx.fillStyle = `rgba(200,161,101,${r() * 0.08})`;
      ctx.fillRect(r() * w, r() * h, 2, 2);
    }
    ctx.font = "500 18px Georgia";
    ctx.fillStyle = "#e2c48f";
    ctx.textAlign = "center";
    ctx.fillText(seed % 2 ? "THE CUT" : "CLASSIC SHAVE", w / 2, h * 0.92);
  });
}

/** Reflexo estilizado para os espelhos: ambiente quente desfocado + brilho */
export function mirrorTexture() {
  return make("mirror", 256, 384, (ctx, w, h) => {
    const r = rng(53);
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#4a3a2c");
    g.addColorStop(0.45, "#6e5440");
    g.addColorStop(0.7, "#3c2a1e");
    g.addColorStop(1, "#241a13");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) {
      const x = r() * w;
      const y = h * 0.08 + r() * h * 0.62;
      const rad = 5 + r() * 24;
      const b = ctx.createRadialGradient(x, y, 0, x, y, rad);
      b.addColorStop(0, `rgba(255,214,158,${0.18 + r() * 0.4})`);
      b.addColorStop(1, "rgba(255,214,158,0)");
      ctx.fillStyle = b;
      ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    ctx.fillStyle = "rgba(255,226,186,0.35)";
    ctx.fillRect(0, h * 0.17, w, 3);
    // faixas diagonais de brilho
    ctx.save();
    ctx.rotate(-0.5);
    for (const [x, width, a] of [[-60, 46, 0.12], [20, 14, 0.09]] as const) {
      ctx.fillStyle = `rgba(225,238,248,${a})`;
      ctx.fillRect(x, 0, width, h * 1.8);
    }
    ctx.restore();
  });
}

/** Letreiro neon da vitrine */
export function neonTexture(text: string, accent: string) {
  return make(`neon:${text}:${accent}`, 512, 144, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "600 82px Inter, Arial, sans-serif";
    ctx.shadowColor = accent;
    ctx.shadowBlur = 22;
    ctx.strokeStyle = accent;
    ctx.lineWidth = 6;
    ctx.strokeRect(14, 14, w - 28, h - 28);
    ctx.fillStyle = "#fff1d8";
    ctx.fillText(text.split("").join(" "), w / 2, h / 2 + 4);
  });
}

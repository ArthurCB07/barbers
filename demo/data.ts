/** Dados fictícios de exemplo usados apenas na demonstração estática */
import { rotationFor, spotByKey } from "@/features/barbershop-3d/layout";
import type { BarberServiceOption, SceneData, SceneStation } from "@/features/barbershop-3d/types";

const service = (id: string, name: string, description: string, price: number, durationMin: number): BarberServiceOption => ({
  id,
  name,
  description,
  category: "Serviços",
  priceCents: price * 100,
  durationMin,
  imageUrl: null,
});

export const SERVICES = [
  service("s1", "Corte masculino", "Corte clássico com acabamento na máquina e tesoura.", 50, 40),
  service("s2", "Corte degradê", "Degradê navalhado com transição suave.", 60, 45),
  service("s3", "Corte na tesoura", "Corte na tesoura para cabelos médios e longos.", 65, 50),
  service("s4", "Barba tradicional", "Toalha quente, navalha e balm hidratante.", 40, 30),
  service("s5", "Corte + barba", "Combo completo de corte e barba tradicional.", 85, 70),
  service("s6", "Sobrancelha", "Design e limpeza de sobrancelha na navalha.", 20, 15),
];

function station(id: string, name: string, spotKey: string, displayName: string, bio: string, specialties: string[]): SceneStation {
  const spot = spotByKey(spotKey)!;
  return {
    id,
    name,
    spotKey,
    x: spot.x,
    z: spot.z,
    rotationY: rotationFor(spotKey, 0),
    model: "classic",
    accentColor: "#c8a165",
    active: true,
    state: "AVAILABLE",
    barber: { id: `b-${id}`, displayName, photoUrl: null, bio, specialties, services: SERVICES },
  };
}

export const SCENE: SceneData = {
  shop: { name: "Barberverse", tagline: "Barbearia premium", logoUrl: null },
  config: { signText: "Barberverse", accentColor: "#c8a165", plants: true, sofaColor: "#5a3b2a", neon: true },
  date: new Date().toISOString().slice(0, 10),
  stations: [
    station("e1", "Estação 01", "A1", "Rafa Monteiro", "Especialista em cortes clássicos e barba na navalha.", ["Corte clássico", "Degradê", "Barba na navalha"]),
    station("e2", "Estação 02", "A2", "Diego Fade", "Especialista em degradê e desenhos.", ["Degradê", "Freestyle", "Pigmentação"]),
  ],
};

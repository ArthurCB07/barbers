import { requireShop } from "@/server/shop";
import { AuthShell } from "@/components/layout/AuthShell";

export const dynamic = "force-dynamic";
export const metadata = { title: "Privacidade e termos" };

export default async function PrivacyPage() {
  const shop = await requireShop();
  return (
    <AuthShell shopName={shop.name} eyebrow="LGPD · Lei 13.709/2018" title="Política de privacidade e termos de uso" wide>
      <div className="space-y-5 text-sm leading-relaxed text-mist [&_h2]:mb-1.5 [&_h2]:font-display [&_h2]:text-xl [&_h2]:text-cream">
        <p className="text-xs text-smoke">Modelo inicial — revise com assessoria jurídica antes da publicação.</p>
        <section>
          <h2>Controlador</h2>
          <p>{shop.name}{shop.address ? `, ${shop.address}` : ""}{shop.city ? ` — ${shop.city}` : ""}. Contato: {shop.phone || shop.whatsapp || "pelos canais da barbearia"}.</p>
        </section>
        <section>
          <h2>Dados coletados e finalidade</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li><strong>Cadastro</strong> (nome, e-mail, telefone): identificar você e permitir o agendamento — execução de contrato.</li>
            <li><strong>Agendamentos e pagamentos</strong>: prestar o serviço e cumprir obrigações fiscais e contábeis.</li>
            <li><strong>Preferências de atendimento</strong>: compartilhadas apenas com o profissional que atende você, se você autorizar.</li>
            <li><strong>Perfil profissional</strong> (barbeiros): exibido publicamente na barbearia virtual após aprovação.</li>
            <li><strong>Registros de segurança</strong> (sessões, auditoria): prevenção a fraudes — legítimo interesse.</li>
          </ul>
        </section>
        <section>
          <h2>Comunicações</h2>
          <p>Confirmações e lembretes são enviados conforme as preferências escolhidas no seu perfil. WhatsApp somente com consentimento explícito, revogável a qualquer momento.</p>
        </section>
        <section>
          <h2>Seus direitos</h2>
          <p>Você pode acessar, corrigir e exportar seus dados (Perfil → Exportar meus dados) e solicitar a exclusão da conta. Registros de atendimentos e pagamentos são mantidos de forma anonimizada pelo prazo legal.</p>
        </section>
        <section>
          <h2>Segurança</h2>
          <p>Senhas são armazenadas com hash bcrypt; sessões usam cookies httpOnly; o acesso a dados é restrito por perfil e verificado no servidor.</p>
        </section>
        <section>
          <h2>Termos de uso</h2>
          <p>{shop.cancellationPolicyText || "Cancelamentos e remarcações devem respeitar a antecedência definida pela barbearia."} Pagamentos são realizados presencialmente. A barbearia pode cancelar atendimentos por motivo de força maior, com aviso ao cliente.</p>
        </section>
      </div>
    </AuthShell>
  );
}

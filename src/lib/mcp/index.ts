import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listarChamados from "./tools/listar-chamados";
import obterChamado from "./tools/obter-chamado";
import criarChamado from "./tools/criar-chamado";
import comentarChamado from "./tools/comentar-chamado";
import buscarBaseConhecimento from "./tools/buscar-base-conhecimento";

const projectRef = import.meta.env['VITE_SUPABASE_PROJECT_ID'] ?? "project-ref-unset";

export default defineMcp({
  name: "vemplast-support-hub",
  title: "Vemplast Support Hub",
  version: "0.1.0",
  instructions:
    "Ferramentas do Mundo Vem / Vemplast Service Desk. Use `listar_chamados` e `obter_chamado` para consultar chamados do usuário autenticado, `criar_chamado` para abrir um novo chamado, `comentar_chamado` para responder e `buscar_base_conhecimento` para consultar artigos de apoio. Todas as operações respeitam as permissões do usuário logado.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listarChamados, obterChamado, criarChamado, comentarChamado, buscarBaseConhecimento],
});

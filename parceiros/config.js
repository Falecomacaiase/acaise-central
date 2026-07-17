// =========================================================
// CONFIGURAÇÃO — Controle de Consumo de Parceiros
// =========================================================
// Cole aqui a MESMA URL e a MESMA anon key do Supabase que
// vocês já usam no acaise-central (cardápio digital).
// Essas duas informações ficam em qualquer arquivo de config
// do projeto acaise-central existente — é só copiar de lá.
//
// Isso é seguro: a "anon key" do Supabase é feita para rodar
// no navegador. A proteção real fica nas regras (RLS) que o
// schema.sql já configura.
// =========================================================

const SUPABASE_CONFIG = {
  url: "https://gltnusallwwgprjgurls.supabase.co",
  anonKey: "sb_publishable_SKr_q0eOgjLpb3sYsYndOg_XvEzCSep",
};

// Taxa fixa de entrega (delivery), em reais.
const TAXA_ENTREGA_DELIVERY = 7.50;

// Depois de quantos dias um pedido sem postagem passa a ser
// destacado no painel do gestor como "atenção".
const DIAS_ALERTA_SEM_POSTAGEM = 3;

// Senha pra entrar na aba "Painel do Gestor" (só a franqueadora deve saber).
// Troque por uma senha sua antes de subir pro GitHub.
// Atenção: isso é uma trava simples contra acesso casual, não uma
// segurança forte — quem souber olhar o código-fonte consegue ver
// essa senha. Serve pra afastar curiosidade de atendente/franqueado,
// não pra proteger dados sigilosos de verdade.
const SENHA_PAINEL_GESTOR = "acaise2026admin";
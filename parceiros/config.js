// =========================================================
// CONFIGURAÇÃO — Controle de Consumo de Parceiros
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
const SENHA_PAINEL_GESTOR = "acaise2026admin";

const LOJAS_ACAISE = [
  'Boa Viagem', 'Bv2', 'Dona Lindu', 'Jaqueira', 'FPS', 'Caruaru', 'Piedade',
  'Graças', 'Porto de Galinhas', 'Costa Dourada', 'Paulista', 'Campina Grande', 'Setúbal',
];

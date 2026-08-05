// =========================================================
// CONFIGURAÇÃO — Agenda Açaí-se
// =========================================================

const SUPABASE_CONFIG = {
  url: "https://gltnusallwwgprjgurls.supabase.co",
  anonKey: "sb_publishable_SKr_q0eOgjLpb3sYsYndOg_XvEzCSep",
};

// Senha pra poder editar/excluir eventos de QUALQUER loja (uso da
// franqueadora). Sem essa senha, cada um só edita os eventos da
// própria loja selecionada. Troque antes de subir pro GitHub.
const SENHA_FRANQUEADORA_AGENDA = "acaise2026admin";

const LOJAS_ACAISE = [
  'Rede (todas as lojas)',
  'Boa Viagem', 'Bv2', 'Dona Lindu', 'Jaqueira', 'FPS', 'Caruaru', 'Piedade',
  'Graças', 'Porto de Galinhas', 'Costa Dourada', 'Paulista', 'Campina Grande', 'Setúbal',
];
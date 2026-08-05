// =========================================================
// Agenda Açaí-se
// =========================================================

const state = {
  eventos: [],
  eventoEditando: null,
  mesCalendario: mesAtual(),
  diaSelecionado: hojeISO(),
};

let sb = null;

// ---------- utilitários ----------
function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s ?? '';
  return d.innerHTML;
}
function formatarData(d) {
  const [a, m, dia] = d.split('-');
  return `${dia}/${m}/${a}`;
}
function nomeDoMes(mesStr) {
  const [a, m] = mesStr.split('-').map(Number);
  const nomes = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  return `${nomes[m - 1]} ${a}`;
}
function mesAtual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function hojeISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function getInicioFimMes(mesStr) {
  const [ano, mes] = mesStr.split('-').map(Number);
  const inicio = `${mesStr}-01`;
  const ultimoDia = new Date(ano, mes, 0).getDate();
  const fim = `${mesStr}-${String(ultimoDia).padStart(2, '0')}`;
  return { inicio, fim };
}

// ---------- permissão (trava simples, não é segurança forte) ----------
function franqueadoraDesbloqueada() {
  return sessionStorage.getItem('agendaFranqueadoraDesbloqueada') === '1';
}
function podeEditar(evento) {
  if (franqueadoraDesbloqueada()) return true;
  const minhaLoja = document.getElementById('selLoja').value;
  return !!minhaLoja && evento.loja === minhaLoja && evento.loja !== 'Rede (todas as lojas)';
}

document.getElementById('btnFranqueadora').addEventListener('click', () => {
  if (franqueadoraDesbloqueada()) {
    if (confirm('Sair do modo franqueadora?')) {
      sessionStorage.removeItem('agendaFranqueadoraDesbloqueada');
      atualizarBotaoFranqueadora();
      renderAgenda();
    }
    return;
  }
  const senha = prompt('Senha da franqueadora:');
  if (senha === null) return;
  if (senha === SENHA_FRANQUEADORA_AGENDA) {
    sessionStorage.setItem('agendaFranqueadoraDesbloqueada', '1');
    atualizarBotaoFranqueadora();
    renderAgenda();
  } else {
    alert('Senha incorreta.');
  }
});

function atualizarBotaoFranqueadora() {
  const btn = document.getElementById('btnFranqueadora');
  btn.textContent = franqueadoraDesbloqueada() ? '🔓 Franqueadora (ativo)' : '🔒 Franqueadora';
}

// ---------- dados ----------
async function carregarEventos(mes, lojaFiltro) {
  const { inicio, fim } = getInicioFimMes(mes);
  let query = sb.from('agenda_eventos').select('*').gte('data_inicio', inicio).lte('data_inicio', fim);
  if (lojaFiltro) query = query.eq('loja', lojaFiltro);
  const { data, error } = await query.order('data_inicio', { ascending: true });
  if (error) { console.error(error); return []; }
  return data || [];
}

// ---------- popular selects ----------
function popularSelectsLoja() {
  const opts = LOJAS_ACAISE.map(l => `<option value="${escapeHtml(l)}">${escapeHtml(l)}</option>`).join('');

  const selHeader = document.getElementById('selLoja');
  const atualHeader = localStorage.getItem('agenda_loja') || '';
  selHeader.innerHTML = '<option value="">Sua loja...</option>' + opts;
  selHeader.value = atualHeader;

  document.getElementById('filtroLoja').innerHTML = '<option value="">Todas as lojas</option>' + opts;
  document.getElementById('evLoja').innerHTML = opts;
}

// ---------- calendário ----------
function mesAdjacente(mes, delta) {
  const [ano, m] = mes.split('-').map(Number);
  const d = new Date(ano, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function diasNoMes(mes) {
  const [ano, m] = mes.split('-').map(Number);
  return new Date(ano, m, 0).getDate();
}

function diaDaSemanaDoPrimeiro(mes) {
  const [ano, m] = mes.split('-').map(Number);
  return new Date(ano, m - 1, 1).getDay(); // 0 = domingo
}

function contadorDeDias(dataStr) {
  const hoje = hojeISO();
  if (dataStr === hoje) return { texto: 'é hoje', classe: 'hoje-marcador' };
  const diff = Math.round((new Date(dataStr) - new Date(hoje)) / 86400000);
  if (diff > 0) return { texto: `faltam ${diff} dia${diff === 1 ? '' : 's'}`, classe: '' };
  return { texto: `há ${Math.abs(diff)} dia${Math.abs(diff) === 1 ? '' : 's'}`, classe: 'passado' };
}

// ---------- render da agenda ----------
async function renderAgenda() {
  const lojaFiltro = document.getElementById('filtroLoja').value;
  state.eventos = await carregarEventos(state.mesCalendario, lojaFiltro);

  const totalPessoas = state.eventos.reduce((s, e) => s + (Number(e.pessoas_esperadas) || 0), 0);
  document.getElementById('statsAgenda').innerHTML = `
    <div class="stat-card"><div class="valor">${state.eventos.length}</div><div class="label">Eventos no mês</div></div>
    <div class="stat-card"><div class="valor">${totalPessoas}</div><div class="label">Pessoas esperadas</div></div>`;

  renderCalendario();
  renderDetalheDia();
}

function renderCalendario() {
  document.getElementById('tituloMesCalendario').textContent = nomeDoMes(state.mesCalendario);

  const eventosPorDia = {};
  state.eventos.forEach(e => {
    const inicio = e.data_inicio;
    const fim = e.data_fim || e.data_inicio;
    // marca todos os dias entre início e fim (evento de vários dias aparece em cada dia)
    let cursor = new Date(inicio + 'T00:00:00');
    const fimData = new Date(fim + 'T00:00:00');
    while (cursor <= fimData) {
      const chave = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
      (eventosPorDia[chave] = eventosPorDia[chave] || []).push(e);
      cursor.setDate(cursor.getDate() + 1);
    }
  });

  const totalDias = diasNoMes(state.mesCalendario);
  const offset = diaDaSemanaDoPrimeiro(state.mesCalendario);
  const hoje = hojeISO();

  let celulas = '';
  for (let i = 0; i < offset; i++) {
    celulas += '<div class="dia-celula fora-do-mes"></div>';
  }
  for (let dia = 1; dia <= totalDias; dia++) {
    const dataStr = `${state.mesCalendario}-${String(dia).padStart(2, '0')}`;
    const qtd = (eventosPorDia[dataStr] || []).length;
    const classes = ['dia-celula'];
    if (dataStr === hoje) classes.push('hoje');
    if (dataStr === state.diaSelecionado) classes.push('selecionado');
    if (qtd > 0) classes.push('tem-evento');
    celulas += `<div class="${classes.join(' ')}" data-data="${dataStr}">
      ${dia}
      ${qtd > 1 ? `<span class="num-eventos">${qtd}</span>` : ''}
    </div>`;
  }

  document.getElementById('calendarioGrade').innerHTML = celulas;
  document.querySelectorAll('.dia-celula[data-data]').forEach(el => {
    el.addEventListener('click', () => {
      state.diaSelecionado = el.dataset.data;
      renderCalendario();
      renderDetalheDia();
    });
  });
}

function renderDetalheDia() {
  const div = document.getElementById('detalheDia');
  if (!state.diaSelecionado) { div.innerHTML = ''; return; }

  const eventosNoDia = state.eventos.filter(e => {
    const fim = e.data_fim || e.data_inicio;
    return state.diaSelecionado >= e.data_inicio && state.diaSelecionado <= fim;
  });

  const contador = contadorDeDias(state.diaSelecionado);
  const cabecalho = `<div class="contador-dias ${contador.classe}">${contador.texto}</div>
    <h3 style="margin-bottom:10px;">${formatarData(state.diaSelecionado)}</h3>`;

  if (eventosNoDia.length === 0) {
    div.innerHTML = cabecalho + '<div class="vazio">Nenhum evento neste dia.</div>';
    return;
  }

  div.innerHTML = cabecalho + eventosNoDia.map(e => renderEventoCard(e)).join('');
  div.querySelectorAll('.btn-editar-evento').forEach(btn => {
    btn.addEventListener('click', () => abrirEditarEvento(state.eventos.find(e => e.id === btn.dataset.id)));
  });
}

function renderEventoCard(e) {
  const periodo = e.data_fim && e.data_fim !== e.data_inicio
    ? `${formatarData(e.data_inicio)} a ${formatarData(e.data_fim)}`
    : formatarData(e.data_inicio);
  const editavel = podeEditar(e);
  return `<div class="evento-card">
    <div class="titulo-evento">${escapeHtml(e.titulo)}</div>
    <div class="detalhe">📍 ${escapeHtml(e.loja)} · ${periodo}</div>
    ${e.tipo_acao ? `<div class="detalhe">${escapeHtml(e.tipo_acao)}</div>` : ''}
    ${e.pessoas_esperadas ? `<div class="detalhe">👥 ${e.pessoas_esperadas} pessoas esperadas</div>` : ''}
    ${e.material_necessario ? `<div class="detalhe">📦 ${escapeHtml(e.material_necessario)}</div>` : ''}
    ${e.responsavel ? `<div class="detalhe">Responsável: ${escapeHtml(e.responsavel)}</div>` : ''}
    ${e.observacoes ? `<div class="detalhe">${escapeHtml(e.observacoes)}</div>` : ''}
    ${editavel ? `<div class="linha-acoes"><button class="btn btn-secundario btn-pequeno btn-editar-evento" data-id="${e.id}">Editar</button></div>` : ''}
  </div>`;
}

// ---------- novo / editar evento ----------
function abrirNovoEvento() {
  state.eventoEditando = null;
  document.getElementById('tituloFormEvento').textContent = 'Novo evento';
  document.getElementById('evTitulo').value = '';
  document.getElementById('evDataInicio').value = state.diaSelecionado || hojeISO();
  document.getElementById('evDataFim').value = '';
  document.getElementById('evTipoAcao').value = '';
  document.getElementById('evPessoasEsperadas').value = '';
  document.getElementById('evMaterialNecessario').value = '';
  document.getElementById('evResponsavel').value = '';
  document.getElementById('evObservacoes').value = '';
  document.getElementById('btnExcluirEvento').style.display = 'none';

  const selLojaForm = document.getElementById('evLoja');
  const minhaLoja = document.getElementById('selLoja').value;
  if (franqueadoraDesbloqueada()) {
    selLojaForm.disabled = false;
    selLojaForm.value = minhaLoja || LOJAS_ACAISE[0];
  } else {
    if (!minhaLoja) { alert('Selecione "sua loja" no topo antes de criar um evento.'); return; }
    selLojaForm.value = minhaLoja;
    selLojaForm.disabled = true;
  }
  mudarView('novo-evento');
}

function abrirEditarEvento(evento) {
  if (!podeEditar(evento)) { alert('Você só pode editar eventos da sua loja.'); return; }
  state.eventoEditando = evento;
  document.getElementById('tituloFormEvento').textContent = 'Editar evento';
  document.getElementById('evTitulo').value = evento.titulo;
  document.getElementById('evDataInicio').value = evento.data_inicio;
  document.getElementById('evDataFim').value = evento.data_fim || '';
  document.getElementById('evTipoAcao').value = evento.tipo_acao || '';
  document.getElementById('evPessoasEsperadas').value = evento.pessoas_esperadas || '';
  document.getElementById('evMaterialNecessario').value = evento.material_necessario || '';
  document.getElementById('evResponsavel').value = evento.responsavel || '';
  document.getElementById('evObservacoes').value = evento.observacoes || '';
  document.getElementById('btnExcluirEvento').style.display = 'block';

  const selLojaForm = document.getElementById('evLoja');
  selLojaForm.value = evento.loja;
  selLojaForm.disabled = !franqueadoraDesbloqueada();

  mudarView('novo-evento');
}

async function salvarEvento() {
  const titulo = document.getElementById('evTitulo').value.trim();
  const loja = document.getElementById('evLoja').value;
  const dataInicio = document.getElementById('evDataInicio').value;
  const dataFim = document.getElementById('evDataFim').value || null;
  const tipoAcao = document.getElementById('evTipoAcao').value.trim();
  const pessoasEsperadas = document.getElementById('evPessoasEsperadas').value;
  const materialNecessario = document.getElementById('evMaterialNecessario').value.trim();
  const responsavel = document.getElementById('evResponsavel').value.trim();
  const observacoes = document.getElementById('evObservacoes').value.trim();

  if (!titulo) { alert('Dá um título pro evento.'); return; }
  if (!dataInicio) { alert('Escolhe a data do evento.'); return; }
  if (dataFim && dataFim < dataInicio) { alert('A data final não pode ser antes da data inicial.'); return; }

  const payload = {
    titulo,
    loja,
    data_inicio: dataInicio,
    data_fim: dataFim,
    tipo_acao: tipoAcao || null,
    pessoas_esperadas: pessoasEsperadas ? parseInt(pessoasEsperadas, 10) : null,
    material_necessario: materialNecessario || null,
    responsavel: responsavel || null,
    observacoes: observacoes || null,
  };

  const btn = document.getElementById('btnSalvarEvento');
  btn.disabled = true;
  btn.textContent = 'Salvando...';

  let error;
  if (state.eventoEditando) {
    ({ error } = await sb.from('agenda_eventos').update(payload).eq('id', state.eventoEditando.id));
  } else {
    payload.criado_por = responsavel || null;
    ({ error } = await sb.from('agenda_eventos').insert(payload));
  }

  btn.disabled = false;
  btn.textContent = 'Salvar evento';

  if (error) { alert('Erro ao salvar: ' + error.message); return; }

  const minhaLoja = document.getElementById('selLoja').value;
  if (minhaLoja !== localStorage.getItem('agenda_loja')) localStorage.setItem('agenda_loja', minhaLoja);

  state.mesCalendario = dataInicio.substring(0, 7);
  state.diaSelecionado = dataInicio;

  mudarView('agenda');
  await renderAgenda();
}

async function excluirEvento() {
  if (!state.eventoEditando) return;
  if (!confirm('Excluir este evento da agenda?')) return;
  const { error } = await sb.from('agenda_eventos').delete().eq('id', state.eventoEditando.id);
  if (error) { alert('Erro ao excluir: ' + error.message); return; }
  mudarView('agenda');
  await renderAgenda();
}

// ---------- navegação ----------
function mudarView(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('ativa'));
  document.getElementById('view-' + viewId).classList.add('ativa');
}

document.getElementById('btnNovoEvento').addEventListener('click', abrirNovoEvento);
document.getElementById('btnVoltarAgenda').addEventListener('click', () => mudarView('agenda'));
document.getElementById('btnSalvarEvento').addEventListener('click', salvarEvento);
document.getElementById('btnExcluirEvento').addEventListener('click', excluirEvento);
document.getElementById('btnMesAnterior').addEventListener('click', () => {
  state.mesCalendario = mesAdjacente(state.mesCalendario, -1);
  state.diaSelecionado = null;
  renderAgenda();
});
document.getElementById('btnMesSeguinte').addEventListener('click', () => {
  state.mesCalendario = mesAdjacente(state.mesCalendario, 1);
  state.diaSelecionado = null;
  renderAgenda();
});
document.getElementById('filtroLoja').addEventListener('change', renderAgenda);
document.getElementById('selLoja').addEventListener('change', () => {
  localStorage.setItem('agenda_loja', document.getElementById('selLoja').value);
  renderAgenda();
});

// ---------- inicialização ----------
async function init() {
  sb = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
  popularSelectsLoja();
  atualizarBotaoFranqueadora();
  await renderAgenda();
}

init();

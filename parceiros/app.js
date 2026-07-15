// =========================================================
// Controle de Consumo de Parceiros — Açaí-se
// =========================================================

const state = {
  parceiros: [],
  categorias: {},
  parceiroSelecionadoLancar: null,
  tipoEntregaSelecionado: 'presencial',
  viewAtual: 'lancar',
};

let sb = null;

// ---------- utilitários ----------
function formatarMoeda(v) {
  return Number(v || 0).toFixed(2).replace('.', ',');
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
function diasDesde(dataStr) {
  const then = new Date(dataStr + 'T00:00:00');
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return Math.floor((hoje - then) / 86400000);
}
function limiteDoParceiro(parceiro) {
  if (parceiro.limite_mensal_personalizado !== null && parceiro.limite_mensal_personalizado !== undefined) {
    return Number(parceiro.limite_mensal_personalizado);
  }
  return state.categorias[parceiro.categoria]?.limite_mensal || 0;
}

function mesAtual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s ?? '';
  return d.innerHTML;
}
function getInicioFimMes(mesStr) {
  const [ano, mes] = mesStr.split('-').map(Number);
  const inicio = `${mesStr}-01`;
  const ultimoDia = new Date(ano, mes, 0).getDate();
  const fim = `${mesStr}-${String(ultimoDia).padStart(2, '0')}`;
  return { inicio, fim };
}
function bowlSvg(pct, cor) {
  const r = 18, c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return `<div class="bowl"><svg viewBox="0 0 44 44">
    <circle cx="22" cy="22" r="${r}" fill="none" stroke="#EAE1E5" stroke-width="5"/>
    <circle cx="22" cy="22" r="${r}" fill="none" stroke="${cor}" stroke-width="5" stroke-linecap="round"
      stroke-dasharray="${c}" stroke-dashoffset="${offset}" transform="rotate(-90 22 22)"/>
  </svg></div>`;
}

// ---------- dados ----------
async function carregarCategorias() {
  const { data, error } = await sb.from('parceiros_categorias').select('*');
  if (error) { console.error(error); return; }
  state.categorias = {};
  (data || []).forEach(c => { state.categorias[c.categoria] = c; });
}

async function carregarParceiros() {
  const { data, error } = await sb.from('parceiros_marca').select('*').eq('ativo', true).order('nome');
  if (error) { console.error(error); return; }
  state.parceiros = data || [];
  atualizarListasDeLojas();
}

async function getConsumoMensal(parceiroId, mesStr) {
  const { inicio, fim } = getInicioFimMes(mesStr);
  const { data, error } = await sb.from('parceiros_pedidos').select('*')
    .eq('parceiro_id', parceiroId).gte('data', inicio).lte('data', fim)
    .order('data', { ascending: false });
  if (error) { console.error(error); return []; }
  return data || [];
}

function atualizarListasDeLojas() {
  const lojas = [...new Set(state.parceiros.map(p => p.loja).filter(Boolean))].sort();
  const optsDatalist = lojas.map(l => `<option value="${escapeHtml(l)}"></option>`).join('');
  document.getElementById('listaLojasHeader').innerHTML = optsDatalist;
  document.getElementById('listaLojasNovoParceiro').innerHTML = optsDatalist;

  const selectLoja = document.getElementById('painelLoja');
  const atual = selectLoja.value;
  selectLoja.innerHTML = '<option value="">Todas as lojas</option>' +
    lojas.map(l => `<option value="${escapeHtml(l)}">${escapeHtml(l)}</option>`).join('');
  selectLoja.value = atual;
}

// ---------- navegação ----------
function mudarView(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('ativa'));
  document.getElementById('view-' + viewId).classList.add('ativa');
  document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('ativo', b.dataset.view === viewId));
  document.querySelectorAll('#navSuperior button').forEach(b => b.classList.toggle('ativo', b.dataset.view === viewId));
  state.viewAtual = viewId;
  if (viewId === 'parceiros') renderListaParceiros();
  if (viewId === 'painel') renderPainel();
}

document.querySelectorAll('.nav-item, #navSuperior button').forEach(btn => {
  btn.addEventListener('click', () => mudarView(btn.dataset.view));
});

// ---------- tela: lançar pedido ----------
function onBuscaParceiroLancar(e) {
  const termo = e.target.value.toLowerCase();
  const resultado = document.getElementById('resultadoBuscaLancar');
  if (!termo) { resultado.innerHTML = ''; return; }
  const matches = state.parceiros.filter(p =>
    p.nome.toLowerCase().includes(termo) || (p.instagram || '').toLowerCase().includes(termo)
  ).slice(0, 6);
  if (matches.length === 0) {
    resultado.innerHTML = '<div class="vazio">Nenhum parceiro encontrado.</div>';
    return;
  }
  resultado.innerHTML = matches.map(p => `
    <div class="item-parceiro" data-id="${p.id}" style="margin-top:6px;">
      <div class="bowl-info">
        <div class="nome">${escapeHtml(p.nome)}</div>
        <div class="detalhe">${state.categorias[p.categoria]?.label || p.categoria}${p.loja ? ' · ' + escapeHtml(p.loja) : ''}</div>
      </div>
    </div>`).join('');
  resultado.querySelectorAll('.item-parceiro').forEach(el => {
    el.addEventListener('click', () => selecionarParceiroLancar(state.parceiros.find(p => p.id === el.dataset.id)));
  });
}

async function selecionarParceiroLancar(parceiro) {
  state.parceiroSelecionadoLancar = parceiro;
  document.getElementById('parceiroSelecionadoId').value = parceiro.id;
  document.getElementById('buscaParceiroLancar').value = parceiro.nome;
  document.getElementById('resultadoBuscaLancar').innerHTML = '';

  const pedidos = await getConsumoMensal(parceiro.id, mesAtual());
  const consumido = pedidos.reduce((s, p) => s + Number(p.valor_total), 0);
  const limite = limiteDoParceiro(parceiro);

  const div = document.getElementById('resumoParceiroSelecionado');
  const catLabel = state.categorias[parceiro.categoria]?.label || parceiro.categoria;
  const pct = limite > 0 ? Math.min(100, (consumido / limite) * 100) : 0;
  const cor = consumido > limite ? 'var(--vermelho)' : pct > 80 ? 'var(--amarelo)' : 'var(--verde)';
  div.style.display = 'block';
  div.innerHTML = `
    <div class="bowl-wrap" style="margin-top:10px;">
      ${bowlSvg(pct, cor)}
      <div class="bowl-info">
        <div class="nome">${escapeHtml(parceiro.nome)} <span class="tag">${catLabel}</span></div>
        <div class="detalhe">Já consumiu R$ ${formatarMoeda(consumido)} de R$ ${formatarMoeda(limite)} este mês</div>
        <div class="barra"><div class="preenchido" style="width:${pct}%; background:${cor}"></div></div>
      </div>
    </div>`;

  atualizarResumoTotal();
}

function atualizarResumoTotal() {
  const valorPedido = parseFloat(document.getElementById('inpValorPedido').value) || 0;
  const taxa = state.tipoEntregaSelecionado === 'delivery' ? TAXA_ENTREGA_DELIVERY : 0;
  const total = valorPedido + taxa;
  const resumo = document.getElementById('resumoTotal');

  if (valorPedido > 0) {
    resumo.style.display = 'block';
    document.getElementById('resValorPedido').textContent = 'R$ ' + formatarMoeda(valorPedido);
    document.getElementById('linhaTaxa').style.display = taxa > 0 ? 'flex' : 'none';
    document.getElementById('resTaxa').textContent = 'R$ ' + formatarMoeda(taxa);
    document.getElementById('resTotal').textContent = 'R$ ' + formatarMoeda(total);
  } else {
    resumo.style.display = 'none';
  }

  const alertaDiv = document.getElementById('alertaLimite');
  alertaDiv.innerHTML = '';
  const parceiro = state.parceiroSelecionadoLancar;
  if (parceiro && valorPedido > 0) {
    getConsumoMensal(parceiro.id, mesAtual()).then(pedidos => {
      const consumidoAtual = pedidos.reduce((s, p) => s + Number(p.valor_total), 0);
      const limite = limiteDoParceiro(parceiro);
      const novoTotal = consumidoAtual + total;
      if (novoTotal > limite) {
        const excedente = novoTotal - limite;
        alertaDiv.innerHTML = `<div class="alerta perigo">⚠️ Este pedido ultrapassa o limite mensal em R$ ${formatarMoeda(excedente)}.</div>`;
      } else if (limite > 0 && novoTotal > limite * 0.8) {
        alertaDiv.innerHTML = `<div class="alerta aviso">Atenção: com este pedido o parceiro chega a R$ ${formatarMoeda(novoTotal)} de R$ ${formatarMoeda(limite)} no mês.</div>`;
      }
    });
  }
}

function limparFormularioLancar() {
  document.getElementById('buscaParceiroLancar').value = '';
  document.getElementById('parceiroSelecionadoId').value = '';
  document.getElementById('resumoParceiroSelecionado').style.display = 'none';
  document.getElementById('inpValorPedido').value = '';
  document.getElementById('inpItensPedido').value = '';
  document.getElementById('resumoTotal').style.display = 'none';
  document.getElementById('alertaLimite').innerHTML = '';
  state.parceiroSelecionadoLancar = null;
  document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('selecionado'));
  document.querySelector('.toggle-btn[data-tipo="presencial"]').classList.add('selecionado');
  state.tipoEntregaSelecionado = 'presencial';
}

async function salvarPedido() {
  const parceiro = state.parceiroSelecionadoLancar;
  const loja = document.getElementById('selLoja').value.trim();
  const colaborador = document.getElementById('inpColaborador').value.trim();
  const valorPedido = parseFloat(document.getElementById('inpValorPedido').value);

  if (!parceiro) { alert('Selecione um parceiro na lista.'); return; }
  if (!loja) { alert('Informe sua loja.'); return; }
  if (!colaborador) { alert('Informe seu nome.'); return; }
  if (!valorPedido || valorPedido <= 0) { alert('Informe o valor do pedido.'); return; }

  const itensPedido = document.getElementById('inpItensPedido').value.trim();
  if (!itensPedido) { alert('Preenche o que foi pedido (ex: açaí 300, wrap de frango...).'); return; }

  const tipo = state.tipoEntregaSelecionado;
  const taxa = tipo === 'delivery' ? TAXA_ENTREGA_DELIVERY : 0;
  const total = valorPedido + taxa;

  const pedidosDoMes = await getConsumoMensal(parceiro.id, mesAtual());
  const consumidoAtual = pedidosDoMes.reduce((s, p) => s + Number(p.valor_total), 0);
  const limite = limiteDoParceiro(parceiro);
  const novoTotal = consumidoAtual + total;

  if (novoTotal > limite) {
    const excedente = (novoTotal - limite).toFixed(2).replace('.', ',');
    const confirmar = confirm(`Este parceiro vai ultrapassar o limite mensal em R$ ${excedente}. Registrar mesmo assim?`);
    if (!confirmar) return;
  }

  localStorage.setItem('parc_loja', loja);
  localStorage.setItem('parc_colaborador', colaborador);

  const btn = document.getElementById('btnSalvarPedido');
  btn.disabled = true;
  btn.textContent = 'Salvando...';

  const { error } = await sb.from('parceiros_pedidos').insert({
    parceiro_id: parceiro.id,
    valor_pedido: valorPedido,
    tipo_entrega: tipo,
    taxa_entrega: taxa,
    valor_total: total,
    postou: false,
    loja,
    colaborador,
    itens_pedido: itensPedido,
  });

  btn.disabled = false;
  btn.textContent = 'Registrar pedido';

  if (error) { alert('Erro ao salvar: ' + error.message); return; }

  limparFormularioLancar();
  alert('Pedido registrado! ✅');
}

// ---------- tela: parceiros ----------
async function renderListaParceiros() {
  const termo = document.getElementById('buscaParceiroLista').value.toLowerCase();
  const catFiltro = document.getElementById('filtroCategoria').value;
  const lista = document.getElementById('listaParceiros');

  const filtrados = state.parceiros.filter(p => {
    const matchTermo = !termo || p.nome.toLowerCase().includes(termo) || (p.instagram || '').toLowerCase().includes(termo);
    const matchCat = !catFiltro || p.categoria === catFiltro;
    return matchTermo && matchCat;
  });

  if (filtrados.length === 0) {
    lista.innerHTML = '<div class="vazio">Nenhum parceiro encontrado.</div>';
    return;
  }

  lista.innerHTML = '<div class="vazio">Carregando consumo...</div>';
  const mes = mesAtual();
  const linhas = await Promise.all(filtrados.map(async p => {
    const pedidos = await getConsumoMensal(p.id, mes);
    const consumido = pedidos.reduce((s, x) => s + Number(x.valor_total), 0);
    const limite = limiteDoParceiro(p);
    const pct = limite > 0 ? Math.min(100, (consumido / limite) * 100) : 0;
    const cor = consumido > limite ? 'var(--vermelho)' : pct > 80 ? 'var(--amarelo)' : 'var(--verde)';
    const catLabel = state.categorias[p.categoria]?.label || p.categoria;
    return `<div class="item-parceiro" data-id="${p.id}">
      ${bowlSvg(pct, cor)}
      <div class="bowl-info">
        <div class="nome">${escapeHtml(p.nome)}</div>
        <div class="detalhe">${catLabel}${p.loja ? ' · ' + escapeHtml(p.loja) : ''}</div>
        <div class="barra"><div class="preenchido" style="width:${pct}%;background:${cor}"></div></div>
      </div>
    </div>`;
  }));
  lista.innerHTML = linhas.join('');
  lista.querySelectorAll('.item-parceiro').forEach(el => {
    el.addEventListener('click', () => abrirDetalheParceiro(el.dataset.id));
  });
}

async function abrirDetalheParceiro(id) {
  const parceiro = state.parceiros.find(p => p.id === id);
  if (!parceiro) return;
  mudarView('detalhe-parceiro');

  const mes = mesAtual();
  const pedidos = await getConsumoMensal(id, mes);
  const consumido = pedidos.reduce((s, p) => s + Number(p.valor_total), 0);
  const limite = limiteDoParceiro(parceiro);
  const pct = limite > 0 ? Math.min(100, (consumido / limite) * 100) : 0;
  const cor = consumido > limite ? 'var(--vermelho)' : pct > 80 ? 'var(--amarelo)' : 'var(--verde)';
  const catLabel = state.categorias[parceiro.categoria]?.label || parceiro.categoria;

  const conteudo = document.getElementById('detalheParceiroConteudo');
  conteudo.innerHTML = `
    <div class="bowl-wrap">
      ${bowlSvg(pct, cor)}
      <div class="bowl-info">
        <h2 style="margin-bottom:2px;">${escapeHtml(parceiro.nome)}</h2>
        <div class="detalhe">${catLabel}${parceiro.loja ? ' · ' + escapeHtml(parceiro.loja) : ''}${parceiro.instagram ? ' · ' + escapeHtml(parceiro.instagram) : ''}</div>
      </div>
    </div>
    <div class="barra" style="margin-top:10px;"><div class="preenchido" style="width:${pct}%;background:${cor}"></div></div>
    <div class="detalhe" style="margin-top:6px;">R$ ${formatarMoeda(consumido)} de R$ ${formatarMoeda(limite)} consumidos em ${nomeDoMes(mes)}</div>

    <label for="inpLimitePersonalizadoDetalhe" style="margin-top:16px;">Limite mensal personalizado</label>
    <input type="number" id="inpLimitePersonalizadoDetalhe" step="0.01" min="0"
      placeholder="Padrão da categoria: R$ ${formatarMoeda(state.categorias[parceiro.categoria]?.limite_mensal || 0)}"
      value="${parceiro.limite_mensal_personalizado ?? ''}">
    <div class="linha-acoes">
      <button class="btn btn-secundario btn-pequeno" id="btnSalvarLimitePersonalizado">Salvar limite</button>
      <button class="btn-texto" id="btnUsarLimitePadrao">Usar padrão da categoria</button>
    </div>

    <h3 style="margin-top:20px;">Pedidos do mês</h3>
    <div id="listaPedidosParceiro">${renderPedidosParceiro(pedidos)}</div>

    <div class="linha-acoes">
      <button class="btn btn-secundario btn-pequeno" id="btnDesativarParceiro">Desativar parceiro</button>
    </div>`;

  conteudo.querySelectorAll('.chk-postou-pedido').forEach(chk => {
    chk.addEventListener('change', async e => {
      await sb.from('parceiros_pedidos').update({ postou: e.target.checked }).eq('id', e.target.dataset.id);
    });
  });
  conteudo.querySelectorAll('.btn-excluir-pedido').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Excluir este lançamento?')) return;
      await sb.from('parceiros_pedidos').delete().eq('id', btn.dataset.id);
      abrirDetalheParceiro(id);
    });
  });
  document.getElementById('btnDesativarParceiro').addEventListener('click', async () => {
    if (!confirm(`Desativar ${parceiro.nome}? Ele não vai mais aparecer nas buscas.`)) return;
    await sb.from('parceiros_marca').update({ ativo: false }).eq('id', id);
    await carregarParceiros();
    mudarView('parceiros');
  });
  document.getElementById('btnSalvarLimitePersonalizado').addEventListener('click', async () => {
    const valor = document.getElementById('inpLimitePersonalizadoDetalhe').value;
    const novoLimite = valor ? parseFloat(valor) : null;
    await sb.from('parceiros_marca').update({ limite_mensal_personalizado: novoLimite }).eq('id', id);
    await carregarParceiros();
    abrirDetalheParceiro(id);
  });
  document.getElementById('btnUsarLimitePadrao').addEventListener('click', async () => {
    await sb.from('parceiros_marca').update({ limite_mensal_personalizado: null }).eq('id', id);
    await carregarParceiros();
    abrirDetalheParceiro(id);
  });
}

function renderPedidosParceiro(pedidos) {
  if (pedidos.length === 0) return '<div class="vazio">Nenhum pedido lançado neste mês ainda.</div>';
  return pedidos.map(p => `
    <div class="item-parceiro" style="cursor:default;">
      <div class="bowl-info">
        <div class="nome">R$ ${formatarMoeda(p.valor_total)} <span class="tag">${p.tipo_entrega === 'delivery' ? 'Delivery' : 'Presencial'}</span></div>
        <div class="detalhe">${formatarData(p.data)} · ${escapeHtml(p.loja || '')} · lançado por ${escapeHtml(p.colaborador || '—')}</div>
        ${p.itens_pedido ? `<div class="detalhe">🍨 ${escapeHtml(p.itens_pedido)}</div>` : ''}
      </div>
      <div style="display:flex; flex-direction:column; align-items:flex-end; gap:6px;">
        <label style="display:flex;align-items:center;gap:4px;text-transform:none;font-weight:500;font-size:0.78rem;color:var(--texto-suave);margin:0;">
          <input type="checkbox" class="chk-postou-pedido" data-id="${p.id}" ${p.postou ? 'checked' : ''}> Postou
        </label>
        <button class="btn-texto btn-excluir-pedido" data-id="${p.id}" style="color:var(--vermelho);font-size:0.75rem;">Excluir</button>
      </div>
    </div>`).join('');
}

// ---------- tela: novo parceiro ----------
async function salvarNovoParceiro() {
  const nome = document.getElementById('npNome').value.trim();
  const instagram = document.getElementById('npInstagram').value.trim();
  const categoria = document.getElementById('npCategoria').value;
  const loja = document.getElementById('npLoja').value.trim();
  const limiteCustom = document.getElementById('npLimitePersonalizado').value;
  if (!nome) { alert('Informe o nome do parceiro.'); return; }

  const { error } = await sb.from('parceiros_marca').insert({
    nome, instagram: instagram || null, categoria, loja: loja || null,
    limite_mensal_personalizado: limiteCustom ? parseFloat(limiteCustom) : null,
  });
  if (error) { alert('Erro ao salvar: ' + error.message); return; }

  document.getElementById('npNome').value = '';
  document.getElementById('npInstagram').value = '';
  document.getElementById('npLoja').value = '';
  document.getElementById('npLimitePersonalizado').value = '';
  await carregarParceiros();
  mudarView('parceiros');
  alert('Parceiro cadastrado! ✅');
}

// ---------- tela: painel do gestor ----------
function popularMesesPainel() {
  const sel = document.getElementById('painelMes');
  const hoje = new Date();
  let html = '';
  for (let i = 0; i < 6; i++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    html += `<option value="${val}">${nomeDoMes(val)}</option>`;
  }
  sel.innerHTML = html;
}

function renderPendentesPostagem(pendentes) {
  document.getElementById('tituloPendentes').textContent = `Postagens pendentes (${pendentes.length})`;
  const div = document.getElementById('listaPendentesPostagem');
  if (pendentes.length === 0) {
    div.innerHTML = '<div class="vazio">Nenhuma postagem pendente de confirmação 🎉</div>';
    return;
  }
  div.innerHTML = pendentes.map(p => {
    const dias = diasDesde(p.data);
    const atrasado = dias >= DIAS_ALERTA_SEM_POSTAGEM;
    return `<div class="item-parceiro" style="cursor:default;">
      <div class="bowl-info">
        <div class="nome">${escapeHtml(p.parceiroNome)} <span class="tag">${p.tipo_entrega === 'delivery' ? 'Delivery' : 'Presencial'}</span></div>
        <div class="detalhe">R$ ${formatarMoeda(p.valor_total)} · ${formatarData(p.data)} · ${escapeHtml(p.loja || '')}</div>
        ${p.itens_pedido ? `<div class="detalhe">🍨 ${escapeHtml(p.itens_pedido)}</div>` : ''}
        <div class="detalhe" style="${atrasado ? 'color:var(--vermelho);font-weight:600;' : ''}">há ${dias} dia${dias === 1 ? '' : 's'} sem confirmação</div>
      </div>
      <button class="btn btn-secundario btn-pequeno btn-marcar-postado" data-id="${p.id}">Marcar postado</button>
    </div>`;
  }).join('');
  div.querySelectorAll('.btn-marcar-postado').forEach(btn => {
    btn.addEventListener('click', async () => {
      await sb.from('parceiros_pedidos').update({ postou: true }).eq('id', btn.dataset.id);
      renderPainel();
    });
  });
}

async function renderPainel() {
  const mes = document.getElementById('painelMes').value || mesAtual();
  const catFiltro = document.getElementById('painelCategoria').value;
  const lojaFiltro = document.getElementById('painelLoja').value;

  const parceirosFiltrados = state.parceiros.filter(p =>
    (!catFiltro || p.categoria === catFiltro) && (!lojaFiltro || p.loja === lojaFiltro)
  );

  const dadosPorParceiro = await Promise.all(parceirosFiltrados.map(async p => {
    const pedidos = await getConsumoMensal(p.id, mes);
    const consumido = pedidos.reduce((s, x) => s + Number(x.valor_total), 0);
    const limite = limiteDoParceiro(p);
    const semPostagem = pedidos.filter(x => !x.postou && diasDesde(x.data) >= DIAS_ALERTA_SEM_POSTAGEM).length;
    return { parceiro: p, consumido, limite, pedidos, semPostagem };
  }));

  dadosPorParceiro.sort((a, b) => (b.consumido / (b.limite || 1)) - (a.consumido / (a.limite || 1)));

  const pendentes = dadosPorParceiro
    .flatMap(d => d.pedidos.filter(p => !p.postou).map(p => ({ ...p, parceiroNome: d.parceiro.nome })))
    .sort((a, b) => new Date(a.data) - new Date(b.data));
  renderPendentesPostagem(pendentes);

  const totalGeral = dadosPorParceiro.reduce((s, d) => s + d.consumido, 0);
  const totalExcedido = dadosPorParceiro.filter(d => d.consumido > d.limite).length;
  const totalSemPost = dadosPorParceiro.reduce((s, d) => s + d.semPostagem, 0);

  document.getElementById('painelStats').innerHTML = `
    <div class="stat-card"><div class="valor">R$ ${formatarMoeda(totalGeral)}</div><div class="label">Consumo total</div></div>
    <div class="stat-card"><div class="valor">${totalExcedido}</div><div class="label">Excederam limite</div></div>
    <div class="stat-card"><div class="valor">${totalSemPost}</div><div class="label">Pedidos sem post</div></div>`;

  const corpo = document.getElementById('corpoTabelaPainel');
  if (dadosPorParceiro.length === 0) {
    corpo.innerHTML = '<tr><td colspan="5" class="vazio">Nenhum parceiro encontrado.</td></tr>';
    return;
  }

  corpo.innerHTML = dadosPorParceiro.map(d => {
    const pct = d.limite > 0 ? Math.min(100, (d.consumido / d.limite) * 100) : 0;
    const excedeu = d.consumido > d.limite;
    const cor = excedeu ? 'var(--vermelho)' : pct > 80 ? 'var(--amarelo)' : 'var(--verde)';
    return `<tr>
      <td><strong>${escapeHtml(d.parceiro.nome)}</strong><br><span class="detalhe" style="font-size:0.72rem;">${state.categorias[d.parceiro.categoria]?.label || ''}</span></td>
      <td>${escapeHtml(d.parceiro.loja || '—')}</td>
      <td>
        R$ ${formatarMoeda(d.consumido)} / ${formatarMoeda(d.limite)}
        <div class="barra"><div class="preenchido" style="width:${pct}%;background:${cor}"></div></div>
      </td>
      <td>${excedeu ? '<span class="badge-postou nao">Excedeu</span>' : '<span class="badge-postou sim">Dentro</span>'}</td>
      <td>${d.semPostagem > 0 ? `<span class="badge-postou nao">${d.semPostagem} sem post</span>` : '<span class="badge-postou sim">Em dia</span>'}</td>
    </tr>`;
  }).join('');
}

// ---------- inicialização ----------
document.querySelectorAll('.toggle-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('selecionado'));
    btn.classList.add('selecionado');
    state.tipoEntregaSelecionado = btn.dataset.tipo;
    atualizarResumoTotal();
  });
});

document.getElementById('buscaParceiroLista').addEventListener('input', renderListaParceiros);
document.getElementById('filtroCategoria').addEventListener('change', renderListaParceiros);
document.getElementById('btnNovoParceiro').addEventListener('click', () => mudarView('novo-parceiro'));
document.getElementById('btnVoltarLista').addEventListener('click', () => mudarView('parceiros'));
document.getElementById('btnVoltarListaDoNovo').addEventListener('click', () => mudarView('parceiros'));
document.getElementById('btnSalvarNovoParceiro').addEventListener('click', salvarNovoParceiro);
document.getElementById('btnSalvarPedido').addEventListener('click', salvarPedido);
document.getElementById('painelMes').addEventListener('change', renderPainel);
document.getElementById('painelCategoria').addEventListener('change', renderPainel);
document.getElementById('painelLoja').addEventListener('change', renderPainel);
document.getElementById('buscaParceiroLancar').addEventListener('input', onBuscaParceiroLancar);
document.getElementById('inpValorPedido').addEventListener('input', atualizarResumoTotal);

async function init() {
  sb = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);

  document.getElementById('selLoja').value = localStorage.getItem('parc_loja') || '';
  document.getElementById('inpColaborador').value = localStorage.getItem('parc_colaborador') || '';

  await carregarCategorias();
  await carregarParceiros();
  popularMesesPainel();
}

init();

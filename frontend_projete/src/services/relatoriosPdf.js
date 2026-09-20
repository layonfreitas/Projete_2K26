import { jsPDF } from "jspdf";

// Texto e tabelas vetoriais: o PDF não depende da largura da tela nem de
// capturas dos campos do formulário. Usa apenas o jsPDF já instalado.
const COR = {
  verde: [31, 82, 59],
  texto: [34, 47, 40],
  discreto: [94, 108, 99],
  linha: [216, 225, 219],
  fundo: [244, 248, 245],
  branco: [255, 255, 255],
};
const STATUS = { ok: "Ok", atencao: "Atenção", critico: "Crítico" };

function texto(valor, vazio = "Não informado") {
  const conteudo = String(valor ?? "").normalize("NFC").replace(/\r\n?/g, "\n").trim();
  return conteudo || vazio;
}

function quantidade(valor) {
  // Não transforma ausência de informação em uma contagem igual a zero.
  if (valor === null || valor === undefined || String(valor).trim() === "") return "Não informado";
  const numero = Number(valor);
  return Number.isFinite(numero) && numero >= 0
    ? numero.toLocaleString("pt-BR")
    : "Não informado";
}

export function dataParaArquivo(data = new Date()) {
  return [data.getFullYear(), String(data.getMonth() + 1).padStart(2, "0"), String(data.getDate()).padStart(2, "0")].join("-");
}

export function nomeArquivoLaudo(nome, data = new Date()) {
  const parte = String(nome || "lavoura").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "").slice(0, 80) || "lavoura";
  return `laudo_${parte}_${dataParaArquivo(data)}.pdf`;
}

function criarDocumento({ titulo, subtitulo, emissao }) {
  const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true, putOnlyUsedFonts: true });
  pdf.setProperties({ title: titulo, subject: subtitulo, author: "CoffeeVision", creator: "CoffeeVision" });
  pdf.setLanguage("pt-BR");
  pdf.setCreationDate(emissao);

  const margem = 17;
  const largura = pdf.internal.pageSize.getWidth();
  const altura = pdf.internal.pageSize.getHeight();
  const util = largura - margem * 2;
  const fim = altura - 21;
  const dataHora = emissao.toLocaleString("pt-BR");
  let y = 0;

  function fonte(tamanho = 10, negrito = false, cor = COR.texto) {
    pdf.setFont("helvetica", negrito ? "bold" : "normal");
    pdf.setFontSize(tamanho);
    pdf.setTextColor(...cor);
  }

  function cabecalho(primeira = false) {
    pdf.setFillColor(...COR.verde);
    pdf.rect(0, 0, largura, 3, "F");
    fonte(15, true, COR.verde);
    pdf.text("CoffeeVision", margem, 18);
    fonte(8, false, COR.discreto);
    pdf.text("GESTÃO E MONITORAMENTO AGRÍCOLA", largura - margem, 18, { align: "right" });
    pdf.setDrawColor(...COR.linha);
    pdf.setLineWidth(0.3);
    pdf.line(margem, 24, largura - margem, 24);
    if (primeira) {
      fonte(23, true);
      pdf.text(titulo, margem, 39);
      fonte(10, false, COR.discreto);
      pdf.text(subtitulo, margem, 47);
      fonte(8, false, COR.discreto);
      pdf.text(`Emitido em ${dataHora}`, margem, 55);
      y = 64;
    } else {
      fonte(9, true, COR.discreto);
      pdf.text(titulo, margem, 31);
      y = 39;
    }
  }

  function novaPagina() {
    pdf.addPage();
    cabecalho();
  }

  function garantir(espaco) {
    if (y + espaco > fim) novaPagina();
  }

  function secao(tituloSecao, espaco = 22) {
    garantir(espaco);
    fonte(12, true, COR.verde);
    pdf.text(tituloSecao, margem, y + 4);
    y += 10;
  }

  function paragrafo(conteudo, { tamanho = 10, cor = COR.texto, continuacao } = {}) {
    fonte(tamanho, false, cor);
    const linhas = pdf.splitTextToSize(texto(conteudo), util - 1);
    const entrelinha = tamanho * 0.3528 * 1.45;
    for (const linha of linhas) {
      if (y + entrelinha > fim) {
        novaPagina();
        if (continuacao) secao(`${continuacao} (continuação)`);
      }
      fonte(tamanho, false, cor);
      pdf.text(linha, margem, y + tamanho * 0.3528);
      y += entrelinha;
    }
    y += 5;
  }

  function bloco(tituloSecao, conteudo, vazio) {
    secao(tituloSecao);
    paragrafo(texto(conteudo, vazio), { continuacao: tituloSecao });
  }

  function indicadores(itens) {
    garantir(29);
    const gap = 4;
    const w = (util - gap * (itens.length - 1)) / itens.length;
    itens.forEach((item, i) => {
      const x = margem + i * (w + gap);
      pdf.setFillColor(...COR.fundo);
      pdf.roundedRect(x, y, w, 24, 2, 2, "F");
      fonte(8, false, COR.discreto);
      pdf.text(item.rotulo, x + 4, y + 7);
      fonte(16, true, COR.verde);
      // Reduz apenas números muito extensos; não corta valores.
      const valor = String(item.valor);
      const medida = pdf.getTextWidth(valor);
      if (medida > w - 8) pdf.setFontSize(16 * (w - 8) / medida);
      pdf.text(valor, x + 4, y + 17);
    });
    y += 31;
  }

  // Repete o cabeçalho em cada página. Linhas normais ficam inteiras;
  // uma célula maior que uma página é dividida sem descartar conteúdo.
  function tabela(tituloTabela, colunas, registros, vazio = "Nenhum registro disponível.") {
    if (!registros.length) {
      bloco(tituloTabela, vazio);
      return;
    }
    const larguras = colunas.map((c) => c.peso * util);
    const pad = 3;
    const entrelinha = 4.4;
    const tamanho = 9;
    fonte(tamanho, true);
    const titulos = colunas.map((c, i) => pdf.splitTextToSize(c.rotulo, larguras[i] - pad * 2 - 1));
    const alturaCabecalho = Math.max(...titulos.map((c) => c.length)) * entrelinha + pad * 2;
    const linhasPorRegistro = registros.map((registro) => {
      fonte(tamanho);
      return colunas.map((_, i) => pdf.splitTextToSize(texto(registro[i]), larguras[i] - pad * 2 - 1));
    });
    const alturaPrimeira = Math.max(...linhasPorRegistro[0].map((c) => c.length)) * entrelinha + pad * 2;
    secao(tituloTabela, 10 + alturaCabecalho + Math.min(alturaPrimeira, 40));

    function cabecalhoTabela() {
      pdf.setFillColor(...COR.verde);
      pdf.rect(margem, y, util, alturaCabecalho, "F");
      fonte(tamanho, true, COR.branco);
      let x = margem;
      titulos.forEach((celula, i) => {
        celula.forEach((linha, j) => pdf.text(linha, x + pad, y + pad + 3.2 + j * entrelinha));
        x += larguras[i];
      });
      y += alturaCabecalho;
    }

    function continuarTabela() {
      novaPagina();
      secao(`${tituloTabela} (continuação)`);
      cabecalhoTabela();
    }

    cabecalhoTabela();
    linhasPorRegistro.forEach((celulas, indice) => {
      const total = Math.max(...celulas.map((c) => c.length));
      const alturaLinha = total * entrelinha + pad * 2;
      const alturaPagina = fim - 49 - alturaCabecalho;
      if (alturaLinha <= alturaPagina && y + alturaLinha > fim) continuarTabela();
      let inicio = 0;
      while (inicio < total) {
        let cabem = Math.floor((fim - y - pad * 2) / entrelinha);
        if (cabem < 1) {
          continuarTabela();
          cabem = Math.floor((fim - y - pad * 2) / entrelinha);
        }
        const n = Math.min(cabem, total - inicio);
        const h = n * entrelinha + pad * 2;
        pdf.setFillColor(...(indice % 2 === 0 ? COR.fundo : COR.branco));
        pdf.rect(margem, y, util, h, "F");
        fonte(tamanho);
        let x = margem;
        celulas.forEach((linhas, i) => {
          linhas.slice(inicio, inicio + n).forEach((linha, j) => {
            pdf.text(linha, x + pad, y + pad + 3.2 + j * entrelinha);
          });
          x += larguras[i];
        });
        pdf.setDrawColor(...COR.linha);
        pdf.line(margem, y + h, largura - margem, y + h);
        y += h;
        inicio += n;
        if (inicio < total) continuarTabela();
      }
    });
    y += 8;
  }

  function finalizar() {
    const paginas = pdf.getNumberOfPages();
    for (let pagina = 1; pagina <= paginas; pagina += 1) {
      pdf.setPage(pagina);
      pdf.setDrawColor(...COR.linha);
      pdf.line(margem, altura - 15, largura - margem, altura - 15);
      fonte(8, false, COR.discreto);
      pdf.text(`CoffeeVision | ${dataHora}`, margem, altura - 9);
      pdf.text(`Página ${pagina} de ${paginas}`, largura - margem, altura - 9, { align: "right" });
    }
    return pdf;
  }

  cabecalho(true);
  return { secao, paragrafo, bloco, indicadores, tabela, finalizar };
}

export function criarLaudoPdf({ produtorNome, lavouraNome, dataSelecionada, indices = {}, observacoes, recomendacoes, emissao = new Date() }) {
  const relatorio = criarDocumento({ titulo: "Laudo técnico", subtitulo: "Análise e acompanhamento da lavoura", emissao });
  relatorio.bloco("Identificação", `Produtor: ${texto(produtorNome)}\nLavoura: ${texto(lavouraNome)}\nData da análise: ${dataSelecionada ? dataSelecionada.split("-").reverse().join("/") : "Sem análise disponível"}`);
  relatorio.secao("Indicadores da lavoura", 41);
  relatorio.indicadores(["NDVI", "NDRE", "NDWI"].map((tipo) => ({
    rotulo: tipo,
    valor: Number.isFinite(indices[tipo]) ? indices[tipo].toFixed(6).replace(".", ",") : "Não disponível",
  })));
  relatorio.paragrafo("Os valores correspondem à data de análise selecionada. A interpretação e as orientações estão registradas nos campos abaixo.", { tamanho: 9, cor: COR.discreto });
  relatorio.bloco("Observações técnicas", observacoes, "Nenhuma observação registrada.");
  relatorio.bloco("Recomendações técnicas", recomendacoes, "Nenhuma recomendação registrada.");
  return relatorio.finalizar();
}

export function criarRelatorioCooperativaPdf({ dashboard, ranking, usuarios, emissao = new Date() }) {
  // Uma resposta inválida é erro, não uma cooperativa vazia.
  if (!dashboard || typeof dashboard !== "object" || Array.isArray(dashboard)
    || !dashboard.statusLavouras || !Array.isArray(dashboard.lavourasEmAlerta)
    || !Array.isArray(ranking) || !Array.isArray(usuarios)
    || ranking.some((r) => !r || typeof r !== "object")
    || usuarios.some((u) => !u || typeof u !== "object")
    || dashboard.lavourasEmAlerta.some((l) => !l || typeof l !== "object")) {
    throw new Error("Os dados do relatório estão incompletos. Tente novamente.");
  }
  const relatorio = criarDocumento({ titulo: "Relatório da cooperativa", subtitulo: "Visão geral, acompanhamento e pessoas cadastradas", emissao });
  relatorio.indicadores([
    { rotulo: "PRODUTORES", valor: quantidade(dashboard.totalProdutores) },
    { rotulo: "AGRÔNOMOS", valor: quantidade(dashboard.totalAgronomos) },
    { rotulo: "LAVOURAS", valor: quantidade(dashboard.totalLavouras) },
  ]);
  relatorio.paragrafo(`Produtores sem agrônomo: ${quantidade(dashboard.produtoresSemAgronomo)}.\nPosição atual da cooperativa, consultada no momento da exportação.`, { tamanho: 9, cor: COR.discreto });
  relatorio.tabela("Situação das lavouras", [
    { rotulo: "Situação", peso: 0.7 }, { rotulo: "Quantidade", peso: 0.3 },
  ], Object.entries(STATUS).map(([chave, rotulo]) => [rotulo, quantidade(dashboard.statusLavouras[chave])]));
  relatorio.tabela("Lavouras que pedem atenção", [
    { rotulo: "Lavoura", peso: 0.4 }, { rotulo: "Produtor", peso: 0.38 }, { rotulo: "Situação", peso: 0.22 },
  ], dashboard.lavourasEmAlerta.map((l) => [l.nomeLavoura, l.produtor, STATUS[l.status] || l.status]), "Nenhuma lavoura em alerta informada no painel.");
  relatorio.tabela("Ranking por agrônomo", [
    { rotulo: "Agrônomo", peso: 0.46 }, { rotulo: "Produtores", peso: 0.18 },
    { rotulo: "Lavouras", peso: 0.18 }, { rotulo: "Críticas", peso: 0.18 },
  ], [...ranking].sort((a, b) => (Number(b.totalProdutores) || 0) - (Number(a.totalProdutores) || 0))
    .map((r) => [r.nome, quantidade(r.totalProdutores), quantidade(r.totalLavouras), quantidade(r.lavourasCriticas)]), "Nenhum agrônomo no ranking.");

  const agronomos = usuarios.filter((u) => u.tipo === "agronomo").sort((a, b) => texto(a.nome).localeCompare(texto(b.nome), "pt-BR"));
  const produtores = usuarios.filter((u) => u.tipo === "produtor").sort((a, b) => texto(a.nome).localeCompare(texto(b.nome), "pt-BR"));
  const nomes = new Map(agronomos.map((a) => [String(a.id), a.nome]));
  const carga = new Map();
  produtores.forEach((p) => {
    if (p.agronomoId) carga.set(String(p.agronomoId), (carga.get(String(p.agronomoId)) || 0) + 1);
  });
  relatorio.tabela("Produtores cadastrados", [
    { rotulo: "Produtor", peso: 0.32 }, { rotulo: "E-mail", peso: 0.38 }, { rotulo: "Agrônomo", peso: 0.3 },
  ], produtores.map((p) => [p.nome, p.email, p.agronomoId ? nomes.get(String(p.agronomoId)) || "Vínculo não identificado" : "Sem agrônomo"]), "Nenhum produtor cadastrado.");
  relatorio.tabela("Agrônomos cadastrados", [
    { rotulo: "Agrônomo", peso: 0.34 }, { rotulo: "E-mail", peso: 0.46 }, { rotulo: "Produtores", peso: 0.2 },
  ], agronomos.map((a) => [a.nome, a.email, quantidade(carga.get(String(a.id)) || 0)]), "Nenhum agrônomo cadastrado.");
  return relatorio.finalizar();
}

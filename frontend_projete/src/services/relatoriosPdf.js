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

function criarDocumento({ titulo, subtitulo, emissao, logo }) {
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
    if (logo) {
      const img = pdf.getImageProperties(logo);
      const escala = Math.min(12 / img.width, 12 / img.height);
      pdf.addImage(logo, img.fileType, margem, 8,
        img.width * escala, img.height * escala);
    }
    pdf.text("CoffeeVision", margem + (logo ? 16 : 0), 18);
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

export function criarLaudoPdf({
  produtorNome,
  lavouraNome,
  dataSelecionada,
  dataImagem,
  resumo,
  observacoes,
  recomendacoes,
  responsavel,
  logo,
  mapa,
  legendaMapa,
  emissao = new Date(),
}) {
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
  });

  const cores = {
    verde: [31, 82, 59],
    verdeEscuro: [20, 57, 40],
    verdeClaro: [237, 245, 239],
    texto: [37, 49, 42],
    secundario: [94, 108, 99],
    borda: [217, 228, 220],
    fundo: [246, 248, 245],
    branco: [255, 255, 255],
    amareloClaro: [251, 246, 232],
  };

  const largura = pdf.internal.pageSize.getWidth();
  const altura = pdf.internal.pageSize.getHeight();

  const margem = 18;
  const larguraUtil = largura - margem * 2;
  const limiteInferior = altura - 24;

  let y = 0;

  function texto(valor, padrao = "Não informado") {
    const resultado = String(valor ?? "")
      .normalize("NFC")
      .replace(/\r\n?/g, "\n")
      .trim();

    return resultado || padrao;
  }

  function formatarData(valor) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(valor || "")) {
      return "Não informada";
    }

    return valor.split("-").reverse().join("/");
  }

  const dataEmissao = emissao.toLocaleDateString("pt-BR");
  const horaEmissao = emissao.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  pdf.setProperties({
    title: `Laudo da lavoura - ${texto(lavouraNome)}`,
    subject: "Análise, observações e orientações ao produtor",
    author: "CoffeeVision",
    creator: "CoffeeVision",
  });

  pdf.setLanguage("pt-BR");
  pdf.setCreationDate(emissao);

  function fonte(
    tamanho = 10,
    negrito = false,
    cor = cores.texto
  ) {
    pdf.setFont("helvetica", negrito ? "bold" : "normal");
    pdf.setFontSize(tamanho);
    pdf.setTextColor(...cor);
  }

  function cabecalho(primeiraPagina = false) {
    pdf.setFillColor(...cores.verde);
    pdf.rect(0, 0, largura, 4, "F");

    if (logo) {
      const propriedades = pdf.getImageProperties(logo);

      const proporcao = Math.min(
        15 / propriedades.width,
        15 / propriedades.height
      );

      pdf.addImage(
        logo,
        propriedades.fileType,
        margem,
        11,
        propriedades.width * proporcao,
        propriedades.height * proporcao
      );
    }

    fonte(16, true, cores.verde);
    pdf.text(
      "CoffeeVision",
      margem + (logo ? 20 : 0),
      21
    );

    fonte(8, false, cores.secundario);
    pdf.text(
      "ACOMPANHAMENTO DA LAVOURA",
      largura - margem,
      20,
      { align: "right" }
    );

    pdf.setDrawColor(...cores.borda);
    pdf.setLineWidth(0.3);
    pdf.line(margem, 31, largura - margem, 31);

    if (primeiraPagina) {
      fonte(26, true, cores.verdeEscuro);
      pdf.text("Laudo da lavoura", margem, 47);

      fonte(10, false, cores.secundario);
      pdf.text(
        "Análise, observações e orientações ao produtor",
        margem,
        55
      );

      fonte(8, false, cores.secundario);
      pdf.text(
        `Emitido em ${dataEmissao}, às ${horaEmissao}`,
        margem,
        63
      );

      y = 73;
    } else {
      fonte(10, true, cores.verde);
      pdf.text("Laudo da lavoura", margem, 41);
      y = 50;
    }
  }

  function novaPagina() {
    pdf.addPage();
    cabecalho(false);
  }

  function garantirEspaco(espaco) {
    if (y + espaco > limiteInferior) {
      novaPagina();
    }
  }

  function tituloSecao(titulo) {
    garantirEspaco(24);

    pdf.setFillColor(...cores.verde);
    pdf.roundedRect(margem, y, 2, 7, 1, 1, "F");

    fonte(13, true, cores.verde);
    pdf.text(titulo, margem + 6, y + 5);

    y += 13;
  }

  // Escreve o texto linha por linha, sem cortar palavras
  // entre páginas nem transformar o documento em uma foto.
  function paragrafo(
    conteudo,
    {
      tamanho = 10,
      cor = cores.texto,
      continuacao = "",
    } = {}
  ) {
    fonte(tamanho, false, cor);

    const linhas = pdf.splitTextToSize(
      texto(conteudo),
      larguraUtil
    );

    const entrelinha = tamanho * 0.3528 * 1.5;

    for (const linha of linhas) {
      if (y + entrelinha > limiteInferior) {
        novaPagina();

        if (continuacao) {
          tituloSecao(`${continuacao} - continuação`);
        }
      }

      fonte(tamanho, false, cor);
      pdf.text(linha, margem, y + tamanho * 0.3528);

      y += entrelinha;
    }

    y += 5;
  }

  function campoIdentificacao(rotulo, valor) {
    fonte(11, true);

    const linhas = pdf.splitTextToSize(
      texto(valor),
      larguraUtil - 12
    );

    const alturaBloco = 13 + linhas.length * 5;

    // Nomes muito longos usam a paginação normal.
    if (alturaBloco > 65) {
      garantirEspaco(20);

      fonte(8, true, cores.secundario);
      pdf.text(rotulo.toUpperCase(), margem, y + 3);

      y += 8;

      paragrafo(valor, {
        continuacao: rotulo,
      });

      return;
    }

    garantirEspaco(alturaBloco + 4);

    pdf.setFillColor(...cores.fundo);
    pdf.roundedRect(
      margem,
      y,
      larguraUtil,
      alturaBloco,
      2,
      2,
      "F"
    );

    fonte(8, true, cores.secundario);
    pdf.text(
      rotulo.toUpperCase(),
      margem + 6,
      y + 6
    );

    fonte(11, true);

    linhas.forEach((linha, indice) => {
      pdf.text(
        linha,
        margem + 6,
        y + 13 + indice * 5
      );
    });

    y += alturaBloco + 4;
  }

  function blocoDatas() {
    garantirEspaco(28);

    const intervalo = 4;
    const larguraCartao = (larguraUtil - intervalo * 2) / 3;

    const itens = [
      ["DATA DA ANÁLISE", formatarData(dataSelecionada)],
      ["DATA DA IMAGEM", formatarData(dataImagem)],
      ["EMISSÃO DO LAUDO", dataEmissao],
    ];

    itens.forEach(([rotulo, valor], indice) => {
      const x = margem + indice * (larguraCartao + intervalo);

      pdf.setFillColor(...cores.verdeClaro);
      pdf.roundedRect(
        x,
        y,
        larguraCartao,
        22,
        2,
        2,
        "F"
      );

      fonte(7, true, cores.secundario);
      pdf.text(rotulo, x + 4, y + 7);

      fonte(11, true, cores.verde);
      pdf.text(valor, x + 4, y + 15);
    });

    y += 29;
  }

  function secaoTexto(titulo, explicacao, valor, vazio) {
    tituloSecao(titulo);

    paragrafo(explicacao, {
      tamanho: 9,
      cor: cores.secundario,
    });

    paragrafo(texto(valor, vazio), {
      continuacao: titulo,
    });

    y += 3;
  }

  function adicionarMapa() {
    tituloSecao("03  Mapa da lavoura");

    if (!mapa) {
      paragrafo(
        "Nenhum mapa foi anexado a este laudo. " +
          "A localização visual das áreas analisadas não está " +
          "representada neste documento.",
        { tamanho: 10, cor: cores.secundario }
      );

      return;
    }

    paragrafo(
      `Imagem de referência: ${formatarData(dataImagem)}. ` +
        "O mapa abaixo foi anexado pelo responsável pela análise.",
      { tamanho: 9, cor: cores.secundario }
    );

    const propriedades = pdf.getImageProperties(mapa);

    const larguraMaxima = larguraUtil - 10;
    const alturaMaxima = 105;

    const escala = Math.min(
      larguraMaxima / propriedades.width,
      alturaMaxima / propriedades.height
    );

    const larguraImagem = propriedades.width * escala;
    const alturaImagem = propriedades.height * escala;
    const alturaQuadro = alturaImagem + 10;

    if (y + alturaQuadro + 15 > limiteInferior) {
      novaPagina();
      tituloSecao("Mapa da lavoura - continuação");
    }

    pdf.setFillColor(...cores.fundo);
    pdf.setDrawColor(...cores.borda);

    pdf.roundedRect(
      margem,
      y,
      larguraUtil,
      alturaQuadro,
      2,
      2,
      "FD"
    );

    pdf.addImage(
      mapa,
      propriedades.fileType,
      margem + (larguraUtil - larguraImagem) / 2,
      y + 5,
      larguraImagem,
      alturaImagem
    );

    y += alturaQuadro + 7;

    paragrafo(
      `Legenda: ${texto(
        legendaMapa,
        "Não informada pelo responsável."
      )}`,
      {
        tamanho: 9,
        continuacao: "Legenda do mapa",
      }
    );

    y += 3;
  }

  function rodapes() {
    const total = pdf.getNumberOfPages();

    for (let pagina = 1; pagina <= total; pagina += 1) {
      pdf.setPage(pagina);

      pdf.setDrawColor(...cores.borda);
      pdf.setLineWidth(0.3);

      pdf.line(
        margem,
        altura - 17,
        largura - margem,
        altura - 17
      );

      fonte(8, false, cores.secundario);

      pdf.text(
        `CoffeeVision | Emitido em ${dataEmissao}`,
        margem,
        altura - 10
      );

      pdf.text(
        `${pagina} / ${total}`,
        largura - margem,
        altura - 10,
        { align: "right" }
      );
    }
  }

  // =========================
  // CONTEÚDO DO DOCUMENTO
  // =========================

  cabecalho(true);

  tituloSecao("01  Identificação e datas");

  campoIdentificacao("Produtor", produtorNome);
  campoIdentificacao("Lavoura", lavouraNome);

  blocoDatas();

  paragrafo(
    "A data da análise indica quando a avaliação foi realizada. " +
      "A data da imagem corresponde à captura utilizada como referência. " +
      "A emissão indica quando este documento foi gerado.",
    {
      tamanho: 9,
      cor: cores.secundario,
    }
  );

  secaoTexto(
    "02  Resumo da análise",
    "Visão geral da situação observada e dos principais pontos de atenção.",
    resumo,
    "O resumo da análise não foi preenchido. " +
      "Não é possível concluir a situação da lavoura a partir deste campo."
  );

  adicionarMapa();

  secaoTexto(
    "04  Observações em campo",
    "Registros realizados durante o acompanhamento da lavoura, " +
      "incluindo as condições observadas e a localização dos pontos avaliados.",
    observacoes,
    "Nenhuma observação em campo foi registrada neste laudo."
  );

  secaoTexto(
    "05  Orientações ao produtor",
    "Próximos passos definidos pelo responsável pela análise.",
    recomendacoes,
    "Nenhuma orientação foi registrada. " +
      "Solicite ao responsável os próximos passos do acompanhamento."
  );

  tituloSecao("06  Responsável pela análise");

  paragrafo(
    texto(
      responsavel,
      "Responsável não informado."
    )
  );

  tituloSecao("Como interpretar este laudo");

  paragrafo(
    "Este documento reúne as informações preenchidas pelo responsável " +
      "no momento da emissão. Campos não informados não significam " +
      "ausência de problemas na lavoura.\n\n" +
      "Quando utilizadas, imagens de satélite apoiam a identificação " +
      "de diferenças na área, mas não confirmam isoladamente a causa " +
      "dessas diferenças. A interpretação deve considerar as " +
      "observações em campo.\n\n" +
      "As condições apresentadas se referem às datas indicadas neste " +
      "documento e podem mudar ao longo do tempo.",
    {
      tamanho: 9,
      cor: cores.secundario,
      continuacao: "Como interpretar este laudo",
    }
  );

  rodapes();

  return pdf;
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

export function criarRelatorioLavourasPdf({
  lavouras,
  logo,
  emissao = new Date(),
}) {
  if (
    !Array.isArray(lavouras) ||
    lavouras.some(
      lavoura =>
        !lavoura ||
        typeof lavoura !== "object"
    )
  ) {
    throw new Error(
      "Os dados do relatório são inválidos."
    );
  }

  const estadosPdf = {
    ok: "Ok",
    critico: "Crítico",
  };

  // Compatibilidade com os registros antigos do banco.
  const registros = lavouras.map(lavoura => ({
    ...lavoura,
    status:
      lavoura.status === "atencao"
        ? "ok"
        : lavoura.status,
  }));

  const relatorio = criarDocumento({
    titulo: "Relatório da cooperativa",
    subtitulo:
      "Produtores, agrônomos e situação das lavouras",
    emissao,
    logo,
  });

  relatorio.indicadores(
    Object.entries(estadosPdf).map(
      ([chave, rotulo]) => ({
        rotulo: rotulo.toUpperCase(),
        valor: registros.filter(
          lavoura => lavoura.status === chave
        ).length,
      })
    )
  );

  relatorio.paragrafo(
    "Crítico: alerta crítico detectado. " +
      "Ok: sem alerta crítico, o que não significa " +
      "ausência de anomalias. Sem data: estado anterior " +
      "ainda não confirmado por esta rotina.",
    {
      tamanho: 9,
    }
  );

  relatorio.tabela(
    "Lavouras cadastradas",
    [
      {
        rotulo: "Produtor",
        peso: 0.25,
      },
      {
        rotulo: "Agrônomo",
        peso: 0.25,
      },
      {
        rotulo: "Lavoura",
        peso: 0.22,
      },
      {
        rotulo: "Estado",
        peso: 0.12,
      },
      {
        rotulo: "Data da imagem",
        peso: 0.16,
      },
    ],
    registros.map(lavoura => [
      lavoura.produtor,
      lavoura.agronomo || "Sem agrônomo",
      lavoura.nomeLavoura,
      estadosPdf[lavoura.status] || "Não informado",
      /^\d{4}-\d{2}-\d{2}$/.test(
        lavoura.dataImagem || ""
      )
        ? lavoura.dataImagem
            .split("-")
            .reverse()
            .join("/")
        : "Sem data",
    ]),
    "Nenhuma lavoura cadastrada."
  );

  return relatorio.finalizar();
}

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AUTH_API_URL } from "../config/api";
import { fetchAutenticado } from "../services/apiAutenticado";
import BottomNav from "../components/BottomNav";
import "./cooperativa.css";

/* =========================================================
   Constantes e utilitários
   ========================================================= */

const ROTULO_STATUS = {
  ok: "Ok",
  atencao: "Atenção",
  critico: "Crítico",
};

const ABAS = [
  { id: "visao", rotulo: "Visão geral" },
  { id: "pessoas", rotulo: "Pessoas" },
  { id: "avisos", rotulo: "Avisos" },
];

const CHAVE_ABA = "cooperativaAba";
const ITENS_POR_PAGINA = 12;
const ERRO_REDE =
  "Não foi possível conectar ao servidor. Verifique a conexão e tente de novo.";

function lerAbaSalva() {
  try {
    const salva = sessionStorage.getItem(CHAVE_ABA);
    return ABAS.some((a) => a.id === salva) ? salva : "visao";
  } catch {
    return "visao";
  }
}

// Uma chamada à API que nunca lança: sempre devolve { ok, dados }.
async function chamar(caminho, { metodo = "GET", corpo } = {}) {
  const opcoes = { method: metodo };
  if (corpo !== undefined) {
    opcoes.headers = { "Content-Type": "application/json" };
    opcoes.body = JSON.stringify(corpo);
  }
  try {
    const resposta = await fetchAutenticado(`${AUTH_API_URL}${caminho}`, opcoes);
    let dados = null;
    try {
      dados = await resposta.json();
    } catch {
      dados = null;
    }
    return { ok: resposta.ok, dados };
  } catch {
    return { ok: false, dados: { mensagem: ERRO_REDE } };
  }
}

function normalizar(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function iniciais(nome) {
  const partes = String(nome || "").trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  const primeira = partes[0][0];
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : "";
  return (primeira + ultima).toUpperCase();
}

function contar(n, singular, plural) {
  return `${n} ${n === 1 ? singular : plural}`;
}

/* Carrega um recurso da API. `buscar` atualiza em silêncio (sem piscar
   o esqueleto); `tentar` é para o botão "Tentar de novo". */
function useRecurso(caminho) {
  const [estado, setEstado] = useState({ dados: null, erro: "", carregando: true });

  const aplicar = useCallback((ok, dados) => {
    setEstado((atual) =>
      ok
        ? { dados, erro: "", carregando: false }
        : {
            dados: atual.dados,
            erro: dados?.mensagem || "Não foi possível carregar estas informações.",
            carregando: false,
          }
    );
  }, []);

  const buscar = useCallback(async () => {
    const { ok, dados } = await chamar(caminho);
    aplicar(ok, dados);
  }, [caminho, aplicar]);

  const tentar = useCallback(() => {
    setEstado((atual) => ({ ...atual, carregando: true, erro: "" }));
    return buscar();
  }, [buscar]);

  useEffect(() => {
    let ativo = true;
    chamar(caminho).then(({ ok, dados }) => {
      if (ativo) aplicar(ok, dados);
    });
    return () => {
      ativo = false;
    };
  }, [caminho, aplicar]);

  return { ...estado, buscar, tentar };
}

/* =========================================================
   Peças de interface
   ========================================================= */

const ICONES = {
  busca: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>
  ),
  mais: <path d="M12 5v14M5 12h14" />,
  usuarioMais: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M19 8v6M22 11h-6" />
    </>
  ),
  editar: (
    <>
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </>
  ),
  lixeira: (
    <>
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M10 11v6M14 11v6" />
    </>
  ),
  elo: (
    <>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </>
  ),
  baixar: (
    <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="m7 10 5 5 5-5M12 15V3" />
    </>
  ),
  check: <path d="M20 6 9 17l-5-5" />,
  fechar: <path d="M18 6 6 18M6 6l12 12" />,
  olho: (
    <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  olhoRiscado: (
    <>
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.53 13.53 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <path d="m2 2 20 20" />
    </>
  ),
  enviar: (
    <>
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </>
  ),
  alerta: (
    <>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
      <path d="M12 9v4M12 17h.01" />
    </>
  ),
  seta: <path d="m9 18 6-6-6-6" />,
  chave: (
    <>
      <circle cx="7.5" cy="15.5" r="4.5" />
      <path d="m21 2-9.6 9.6M15.5 7.5l3 3L22 7l-3-3" />
    </>
  ),
};

function Icone({ nome, tamanho = 20 }) {
  return (
    <svg
      className="cooperativa-icone"
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {ICONES[nome]}
    </svg>
  );
}

function Campo({ rotulo, ajuda, children }) {
  return (
    <label className="cooperativa-campo">
      <span>{rotulo}</span>
      {children}
      {ajuda && <small>{ajuda}</small>}
    </label>
  );
}

function Segmentos({ legenda, nome, valor, aoMudar, opcoes }) {
  return (
    <fieldset className="cooperativa-segmentos">
      <legend>{legenda}</legend>
      <div>
        {opcoes.map((o) => (
          <label key={o.valor}>
            <input
              type="radio"
              className="cooperativa-oculto"
              name={nome}
              value={o.valor}
              checked={valor === o.valor}
              onChange={() => aoMudar(o.valor)}
            />
            <span>
              {o.rotulo}
              {o.detalhe !== undefined && <small>{o.detalhe}</small>}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function Esqueleto({ linhas = 3, altura = 64 }) {
  return (
    <div className="cooperativa-esqueleto" aria-hidden="true">
      {Array.from({ length: linhas }, (_, i) => (
        <span key={i} style={{ height: altura }} />
      ))}
    </div>
  );
}

function Falha({ mensagem, aoTentar }) {
  return (
    <div className="cooperativa-falha" role="alert">
      <Icone nome="alerta" />
      <div>
        <strong>Não foi possível carregar</strong>
        <p>{mensagem}</p>
      </div>
      <button
        type="button"
        className="cooperativa-btn cooperativa-btn--secondary"
        onClick={aoTentar}
      >
        Tentar de novo
      </button>
    </div>
  );
}

function Vazio({ titulo, texto, children }) {
  return (
    <div className="cooperativa-vazio">
      <strong>{titulo}</strong>
      {texto && <p>{texto}</p>}
      {children}
    </div>
  );
}

/* Painel deslizante (bottom sheet no celular, janela no desktop).
   Usa <dialog>: ganha foco preso, ESC e leitor de tela de graça. */
function Painel({ aberto, chave, aoFechar, titulo, descricao, children }) {
  const ref = useRef(null);
  const pressionouFora = useRef(false);

  useEffect(() => {
    const dialogo = ref.current;
    if (!dialogo) return;
    if (aberto) {
      if (!dialogo.open) dialogo.showModal();
      // também refoca quando o conteúdo troca (ex.: Editar → Excluir),
      // senão o foco cairia no <body> quando o botão clicado sumisse
      const alvo = dialogo.querySelector("[data-foco]") || dialogo.querySelector("input, button");
      alvo?.focus();
    } else if (dialogo.open) {
      dialogo.close();
    }
  }, [aberto, chave]);

  return (
    <dialog
      ref={ref}
      className="cooperativa-painel"
      aria-labelledby="cooperativa-painel-titulo"
      onClose={aoFechar}
      onMouseDown={(e) => {
        pressionouFora.current = e.target === ref.current;
      }}
      onClick={(e) => {
        if (e.target === ref.current && pressionouFora.current) aoFechar();
      }}
    >
      {aberto && (
        <div className="cooperativa-painel-corpo">
          <div className="cooperativa-painel-topo">
            <div>
              <h2 id="cooperativa-painel-titulo">{titulo}</h2>
              {descricao && <p>{descricao}</p>}
            </div>
            <button
              type="button"
              className="cooperativa-btn cooperativa-btn--icone"
              onClick={aoFechar}
              aria-label="Fechar"
            >
              <Icone nome="fechar" />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

function Notificacao({ aviso, aoFechar }) {
  useEffect(() => {
    if (!aviso) return undefined;
    const tempo = setTimeout(aoFechar, aviso.tipo === "erro" ? 8000 : 4500);
    return () => clearTimeout(tempo);
  }, [aviso, aoFechar]);

  return (
    <div className="cooperativa-notificacoes" aria-live="polite">
      {aviso && (
        <div
          className={`cooperativa-notificacao cooperativa-notificacao--${aviso.tipo}`}
          role={aviso.tipo === "erro" ? "alert" : "status"}
        >
          <Icone nome={aviso.tipo === "erro" ? "alerta" : "check"} />
          <p>{aviso.texto}</p>
          <button
            type="button"
            className="cooperativa-btn cooperativa-btn--icone-escuro"
            onClick={aoFechar}
            aria-label="Dispensar aviso"
          >
            <Icone nome="fechar" tamanho={18} />
          </button>
        </div>
      )}
    </div>
  );
}

/* =========================================================
   Conteúdo dos painéis (formulários)
   ========================================================= */

function FormNovoUsuario({ perfilInicial, ocupado, erro, aoEnviar }) {
  const [perfil, setPerfil] = useState(perfilInicial);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);

  function enviar(evento) {
    evento.preventDefault();
    aoEnviar({ nome: nome.trim(), email: email.trim(), senha, tipo: perfil });
  }

  return (
    <form className="cooperativa-form" onSubmit={enviar}>
      <Segmentos
        legenda="Perfil"
        nome="perfil"
        valor={perfil}
        aoMudar={setPerfil}
        opcoes={[
          { valor: "produtor", rotulo: "Produtor" },
          { valor: "agronomo", rotulo: "Agrônomo" },
        ]}
      />

      <Campo rotulo="Nome completo">
        <input
          data-foco
          type="text"
          autoComplete="off"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          required
        />
      </Campo>

      <Campo rotulo="E-mail">
        <input
          type="email"
          inputMode="email"
          autoComplete="off"
          autoCapitalize="none"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </Campo>

      <Campo rotulo="Senha provisória" ajuda="Use pelo menos 6 caracteres.">
        <div className="cooperativa-senha">
          <input
            type={mostrarSenha ? "text" : "password"}
            autoComplete="new-password"
            minLength={6}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
          />
          <button
            type="button"
            className="cooperativa-btn cooperativa-btn--icone"
            onClick={() => setMostrarSenha((v) => !v)}
            aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
            aria-pressed={mostrarSenha}
          >
            <Icone nome={mostrarSenha ? "olhoRiscado" : "olho"} />
          </button>
        </div>
      </Campo>

      {erro && (
        <p className="cooperativa-erro-form" role="alert">
          {erro}
        </p>
      )}

      <button
        type="submit"
        className="cooperativa-btn cooperativa-btn--largo"
        disabled={ocupado}
      >
        {ocupado
          ? "Cadastrando…"
          : perfil === "agronomo"
            ? "Cadastrar agrônomo"
            : "Cadastrar produtor"}
      </button>
    </form>
  );
}

function FormEditar({ pessoa, ocupado, erro, aoSalvar, aoCancelar, aoAlterarSenha, aoExcluir }) {
  const [nome, setNome] = useState(pessoa.nome || "");
  const [email, setEmail] = useState(pessoa.email || "");

  function enviar(evento) {
    evento.preventDefault();
    aoSalvar({ nome: nome.trim(), email: email.trim() });
  }

  return (
    <form className="cooperativa-form" onSubmit={enviar}>
      <Campo rotulo="Nome completo">
        <input
          data-foco
          type="text"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          required
        />
      </Campo>

      <Campo rotulo="E-mail">
        <input
          type="email"
          inputMode="email"
          autoCapitalize="none"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </Campo>

      <div className="cooperativa-linha-senha">
        <div>
          <strong>Senha</strong>
          <p>Abre a tela de troca de senha desta pessoa.</p>
        </div>
        <button
          type="button"
          className="cooperativa-btn cooperativa-btn--secondary cooperativa-btn--pequeno"
          onClick={aoAlterarSenha}
          disabled={ocupado}
        >
          <Icone nome="chave" tamanho={16} />
          Alterar senha
        </button>
      </div>

      {erro && (
        <p className="cooperativa-erro-form" role="alert">
          {erro}
        </p>
      )}

      <div className="cooperativa-botoes">
        <button
          type="button"
          className="cooperativa-btn cooperativa-btn--secondary"
          onClick={aoCancelar}
          disabled={ocupado}
        >
          Cancelar
        </button>
        <button type="submit" className="cooperativa-btn" disabled={ocupado}>
          {ocupado ? "Salvando…" : "Salvar alterações"}
        </button>
      </div>

      <div className="cooperativa-zona-perigo">
        <button
          type="button"
          className="cooperativa-btn cooperativa-btn--perigo-suave"
          onClick={aoExcluir}
          disabled={ocupado}
        >
          <Icone nome="lixeira" tamanho={18} />
          {`Excluir ${pessoa.tipo === "produtor" ? "produtor" : "agrônomo"}`}
        </button>
      </div>
    </form>
  );
}

function FormVinculo({
  produtor,
  agronomos,
  carga,
  ocupado,
  erro,
  aoSalvar,
  aoRemover,
  aoCadastrarAgronomo,
}) {
  const atual = produtor.agronomoId ? String(produtor.agronomoId) : "";
  const [selecionado, setSelecionado] = useState(atual);

  if (agronomos.length === 0) {
    return (
      <Vazio
        titulo="Ainda não há agrônomos"
        texto="Cadastre um agrônomo para poder direcionar produtores a ele."
      >
        <button type="button" className="cooperativa-btn" onClick={aoCadastrarAgronomo}>
          <Icone nome="usuarioMais" />
          Cadastrar agrônomo
        </button>
      </Vazio>
    );
  }

  return (
    <form
      className="cooperativa-form"
      onSubmit={(e) => {
        e.preventDefault();
        aoSalvar(selecionado);
      }}
    >
      <fieldset className="cooperativa-opcoes-grupo">
        <legend>Agrônomo responsável</legend>
        <div className="cooperativa-opcoes">
          {agronomos.map((a, indice) => {
            const id = String(a.id);
            const total = carga.get(id) || 0;
            return (
              <label className="cooperativa-opcao" key={a.id}>
                <input
                  type="radio"
                  className="cooperativa-oculto"
                  name="agronomo"
                  value={id}
                  checked={selecionado === id}
                  onChange={() => setSelecionado(id)}
                  data-foco={indice === 0 ? "" : undefined}
                />
                <span className="cooperativa-opcao-corpo">
                  <span className="cooperativa-radio" aria-hidden="true" />
                  <span className="cooperativa-opcao-texto">
                    <strong>{a.nome}</strong>
                    <small>
                      {contar(total, "produtor atendido", "produtores atendidos")}
                    </small>
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {erro && (
        <p className="cooperativa-erro-form" role="alert">
          {erro}
        </p>
      )}

      <div className="cooperativa-botoes">
        {atual && (
          <button
            type="button"
            className="cooperativa-btn cooperativa-btn--perigo-suave"
            onClick={aoRemover}
            disabled={ocupado}
          >
            Remover vínculo
          </button>
        )}
        <button
          type="submit"
          className="cooperativa-btn"
          disabled={ocupado || !selecionado || selecionado === atual}
        >
          {ocupado ? "Salvando…" : "Salvar vínculo"}
        </button>
      </div>
    </form>
  );
}

function ConfirmarExclusao({ pessoa, vinculados, ocupado, erro, aoConfirmar, aoCancelar }) {
  const ehProdutor = pessoa.tipo === "produtor";

  return (
    <div className="cooperativa-form">
      <div className="cooperativa-consequencias">
        <p>Esta ação é permanente.</p>
        {ehProdutor ? (
          <p>As lavouras, imagens e observações deste produtor também serão apagadas.</p>
        ) : (
          <p>
            {vinculados > 0
              ? `${contar(vinculados, "produtor vinculado ficará", "produtores vinculados ficarão")} sem agrônomo. `
              : ""}
            As observações que este agrônomo escreveu continuam salvas.
          </p>
        )}
      </div>

      {erro && (
        <p className="cooperativa-erro-form" role="alert">
          {erro}
        </p>
      )}

      <div className="cooperativa-botoes">
        <button
          type="button"
          data-foco
          className="cooperativa-btn cooperativa-btn--secondary"
          onClick={aoCancelar}
          disabled={ocupado}
        >
          Cancelar
        </button>
        <button
          type="button"
          className="cooperativa-btn cooperativa-btn--perigo"
          onClick={aoConfirmar}
          disabled={ocupado}
        >
          {ocupado ? "Excluindo…" : `Excluir ${ehProdutor ? "produtor" : "agrônomo"}`}
        </button>
      </div>
    </div>
  );
}

/* =========================================================
   Aba: Visão geral
   ========================================================= */

function SaudeLavouras({ dashboard }) {
  const { ok, atencao, critico } = dashboard.statusLavouras;
  const soma = ok + atencao + critico;

  let manchete;
  if (dashboard.totalLavouras === 0) {
    manchete = "Ainda não há lavouras cadastradas";
  } else if (critico > 0) {
    manchete = `${contar(critico, "lavoura em estado crítico", "lavouras em estado crítico")}`;
  } else if (atencao > 0) {
    manchete = `${contar(atencao, "lavoura pede atenção", "lavouras pedem atenção")}`;
  } else {
    manchete = "Todas as lavouras estão bem";
  }

  const partes = [
    { chave: "ok", rotulo: "Ok", n: ok },
    { chave: "atencao", rotulo: "Atenção", n: atencao },
    { chave: "critico", rotulo: "Crítico", n: critico },
  ];

  return (
    <section className="cooperativa-saude" aria-labelledby="cooperativa-saude-titulo">
      <h2 id="cooperativa-saude-titulo">Saúde das lavouras</h2>
      <p className="cooperativa-saude-manchete">{manchete}</p>

      <div
        className="cooperativa-maturacao"
        role="img"
        aria-label={`${contar(dashboard.totalLavouras, "lavoura", "lavouras")}: ${ok} ok, ${atencao} em atenção, ${critico} em estado crítico`}
      >
        {soma > 0 &&
          partes.map(
            (p) =>
              p.n > 0 && (
                <span
                  key={p.chave}
                  className={`cooperativa-maturacao-parte cooperativa-maturacao-parte--${p.chave}`}
                  style={{ flexGrow: p.n }}
                />
              )
          )}
      </div>

      <ul className="cooperativa-legenda">
        {partes.map((p) => (
          <li key={p.chave} className={`cooperativa-legenda-item cooperativa-legenda-item--${p.chave}`}>
            <span className="cooperativa-legenda-ponto" aria-hidden="true" />
            <span className="cooperativa-legenda-rotulo">{p.rotulo}</span>
            <strong>{p.n}</strong>
          </li>
        ))}
      </ul>
    </section>
  );
}

function VisaoGeral({ dashboard, ranking, aoDirecionar, aoBaixar, baixando }) {
  const dados = dashboard.dados;
  const posicoes = ranking.dados || [];
  const maiorCarteira = posicoes.reduce((m, r) => Math.max(m, r.totalProdutores), 0);

  if (!dados && dashboard.carregando) {
    return (
      <div aria-busy="true">
        <Esqueleto linhas={1} altura={210} />
        <Esqueleto linhas={2} altura={72} />
      </div>
    );
  }

  return (
    <>
      {dashboard.erro && !dados ? (
        <Falha mensagem={dashboard.erro} aoTentar={dashboard.tentar} />
      ) : (
        dados && (
          <>
            <SaudeLavouras dashboard={dados} />

            <dl className="cooperativa-numeros">
              <div>
                <dt>Produtores</dt>
                <dd>{dados.totalProdutores}</dd>
              </div>
              <div>
                <dt>Agrônomos</dt>
                <dd>{dados.totalAgronomos}</dd>
              </div>
              <div>
                <dt>Lavouras</dt>
                <dd>{dados.totalLavouras}</dd>
              </div>
            </dl>

            {dados.produtoresSemAgronomo > 0 ? (
              <div className="cooperativa-pendencia">
                <span className="cooperativa-pendencia-icone" aria-hidden="true">
                  <Icone nome="elo" />
                </span>
                <div>
                  <strong>
                    {contar(
                      dados.produtoresSemAgronomo,
                      "produtor sem agrônomo",
                      "produtores sem agrônomo"
                    )}
                  </strong>
                  <p>Vincule cada um a um agrônomo para acompanhar as lavouras.</p>
                </div>
                <button
                  type="button"
                  className="cooperativa-btn cooperativa-btn--secondary cooperativa-btn--pequeno"
                  onClick={aoDirecionar}
                >
                  Direcionar
                </button>
              </div>
            ) : (
              dados.totalProdutores > 0 && (
                <p className="cooperativa-tudo-certo">
                  <Icone nome="check" tamanho={18} />
                  Todos os produtores têm agrônomo.
                </p>
              )
            )}

            {dados.lavourasEmAlerta.length > 0 && (
              <section aria-labelledby="cooperativa-alertas-titulo">
                <div className="cooperativa-secao-topo">
                  <h3 id="cooperativa-alertas-titulo">Lavouras que pedem atenção</h3>
                  <span className="cooperativa-contagem">{dados.lavourasEmAlerta.length}</span>
                </div>
                <ul className="cooperativa-lista">
                  {dados.lavourasEmAlerta.map((l) => (
                    <li
                      key={l.id}
                      className={`cooperativa-alerta cooperativa-alerta--${l.status}`}
                    >
                      <div>
                        <strong>{l.nomeLavoura}</strong>
                        <span>Produtor: {l.produtor}</span>
                      </div>
                      <span className={`cooperativa-selo cooperativa-selo--${l.status}`}>
                        {ROTULO_STATUS[l.status] || l.status}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )
      )}

      <section aria-labelledby="cooperativa-ranking-titulo">
        <div className="cooperativa-secao-topo">
          <div>
            <h3 id="cooperativa-ranking-titulo">Ranking por agrônomo</h3>
            <p>Ordenado por quantidade de produtores atendidos.</p>
          </div>
        </div>

        {!ranking.dados && ranking.carregando && <Esqueleto linhas={3} altura={68} />}
        {ranking.erro && !ranking.dados && (
          <Falha mensagem={ranking.erro} aoTentar={ranking.tentar} />
        )}
        {ranking.dados && posicoes.length === 0 && (
          <Vazio
            titulo="Nenhum agrônomo cadastrado"
            texto="Cadastre agrônomos na aba Pessoas para acompanhar a carteira de cada um."
          />
        )}
        {posicoes.length > 0 && (
          <ol className="cooperativa-ranking">
            {posicoes.map((r, indice) => {
              const largura =
                r.totalProdutores > 0 && maiorCarteira > 0
                  ? Math.max(4, (r.totalProdutores / maiorCarteira) * 100)
                  : 0;
              return (
                <li key={r.id} className="cooperativa-ranking-item">
                  <span className="cooperativa-ranking-posicao" aria-hidden="true">
                    {indice + 1}
                  </span>
                  <div className="cooperativa-ranking-corpo">
                    <div className="cooperativa-ranking-topo">
                      <strong>{r.nome}</strong>
                      <span
                        className={`cooperativa-selo ${
                          r.lavourasCriticas > 0 ? "cooperativa-selo--critico" : "cooperativa-selo--ok"
                        }`}
                      >
                        {r.lavourasCriticas > 0
                          ? contar(r.lavourasCriticas, "crítica", "críticas")
                          : "Sem críticas"}
                      </span>
                    </div>
                    <span className="cooperativa-barra" aria-hidden="true">
                      <i style={{ width: `${largura}%` }} />
                    </span>
                    <span className="cooperativa-ranking-meta">
                      <span>{contar(r.totalProdutores, "produtor", "produtores")}</span>
                      <span>{contar(r.totalLavouras, "lavoura", "lavouras")}</span>
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <button
        type="button"
        className="cooperativa-btn cooperativa-btn--secondary cooperativa-btn--largo"
        onClick={aoBaixar}
        disabled={baixando}
      >
        <Icone nome="baixar" />
        {baixando ? "Gerando relatório…" : "Baixar relatório (CSV)"}
      </button>
    </>
  );
}

/* =========================================================
   Aba: Pessoas
   ========================================================= */

function CartaoPessoa({ pessoa, nomeAgronomo, carga, aoAbrir, aoVincular }) {
  const ehProdutor = pessoa.tipo === "produtor";
  const vinculado = Boolean(pessoa.agronomoId);

  return (
    <li className="cooperativa-pessoa">
      <span
        className={`cooperativa-avatar cooperativa-avatar--${pessoa.tipo}`}
        aria-hidden="true"
      >
        {iniciais(pessoa.nome)}
      </span>

      <div className="cooperativa-pessoa-info">
        {/* o botão do nome cobre o cartão inteiro (ver ::after no CSS) */}
        <button
          type="button"
          className="cooperativa-pessoa-abrir"
          onClick={() => aoAbrir(pessoa)}
          aria-label={`Editar ${pessoa.nome}`}
        >
          <span className="cooperativa-pessoa-nome">{pessoa.nome}</span>
        </button>
        <span className="cooperativa-pessoa-email" title={pessoa.email}>
          {pessoa.email}
        </span>

        <div className="cooperativa-etiquetas">
          {ehProdutor ? (
            <button
              type="button"
              className={`cooperativa-btn cooperativa-btn--vinculo ${
                vinculado ? "is-vinculado" : "is-pendente"
              }`}
              onClick={() => aoVincular(pessoa)}
              aria-label={
                vinculado
                  ? `Agrônomo de ${pessoa.nome}: ${nomeAgronomo}. Alterar vínculo`
                  : `Vincular ${pessoa.nome} a um agrônomo`
              }
            >
              <Icone nome={vinculado ? "elo" : "mais"} tamanho={14} />
              <span>{vinculado ? nomeAgronomo : "Vincular agrônomo"}</span>
            </button>
          ) : (
            <span className="cooperativa-etiqueta">
              {contar(carga, "produtor atendido", "produtores atendidos")}
            </span>
          )}
        </div>
      </div>

      <Icone nome="seta" tamanho={20} />
    </li>
  );
}

function PainelPessoas({
  recurso,
  contagens,
  filtradas,
  filtro,
  aoFiltrar,
  busca,
  aoBuscar,
  limite,
  aoMostrarMais,
  aoLimpar,
  nomes,
  carga,
  aoNovo,
  aoAbrir,
  aoVincular,
}) {
  const filtros = [
    { id: "todos", rotulo: "Todos", n: contagens.todos },
    { id: "produtor", rotulo: "Produtores", n: contagens.produtores },
    { id: "agronomo", rotulo: "Agrônomos", n: contagens.agronomos },
    { id: "sem-agronomo", rotulo: "Sem agrônomo", n: contagens.semAgronomo },
  ];

  if (!recurso.dados && recurso.carregando) {
    return (
      <div aria-busy="true">
        <Esqueleto linhas={4} altura={104} />
      </div>
    );
  }

  if (!recurso.dados && recurso.erro) {
    return <Falha mensagem={recurso.erro} aoTentar={recurso.tentar} />;
  }

  if (contagens.todos === 0) {
    return (
      <Vazio
        titulo="Nenhum usuário cadastrado"
        texto="Cadastre produtores e agrônomos para começar a organizar a cooperativa."
      >
        <button type="button" className="cooperativa-btn" onClick={() => aoNovo("produtor")}>
          <Icone nome="usuarioMais" />
          Cadastrar primeiro usuário
        </button>
      </Vazio>
    );
  }

  const visiveis = filtradas.slice(0, limite);
  const restantes = filtradas.length - visiveis.length;
  const agrupar = filtro === "todos";
  const totaisPorTipo = {
    produtor: filtradas.filter((p) => p.tipo === "produtor").length,
    agronomo: filtradas.filter((p) => p.tipo === "agronomo").length,
  };

  return (
    <>
      <div className="cooperativa-busca">
        <Icone nome="busca" tamanho={18} />
        <input
          type="search"
          value={busca}
          onChange={(e) => aoBuscar(e.target.value)}
          placeholder="Buscar por nome ou e-mail"
          aria-label="Buscar por nome ou e-mail"
          autoComplete="off"
        />
      </div>

      <div className="cooperativa-filtros" role="group" aria-label="Filtrar pessoas">
        {filtros.map((f) => (
          <button
            key={f.id}
            type="button"
            className="cooperativa-btn cooperativa-btn--filtro"
            aria-pressed={filtro === f.id}
            onClick={() => aoFiltrar(f.id)}
          >
            {f.rotulo}
            <span className="cooperativa-filtro-n">{f.n}</span>
          </button>
        ))}
      </div>

      <p className="cooperativa-resultado" aria-live="polite">
        {contar(filtradas.length, "pessoa encontrada", "pessoas encontradas")}
      </p>

      {filtradas.length === 0 ? (
        <Vazio
          titulo="Ninguém encontrado"
          texto="Tente outro nome ou limpe os filtros."
        >
          <button
            type="button"
            className="cooperativa-btn cooperativa-btn--secondary"
            onClick={aoLimpar}
          >
            Limpar filtros
          </button>
        </Vazio>
      ) : (
        <ul className="cooperativa-pessoas">
          {visiveis.map((p, indice) => {
            const novoGrupo = agrupar && (indice === 0 || visiveis[indice - 1].tipo !== p.tipo);
            return (
              <Fragment key={p.id}>
                {novoGrupo && (
                  <li className="cooperativa-grupo">
                    <h3>{p.tipo === "produtor" ? "Produtores" : "Agrônomos"}</h3>
                    <span>{totaisPorTipo[p.tipo]}</span>
                  </li>
                )}
                <CartaoPessoa
                  pessoa={p}
                  nomeAgronomo={nomes.get(String(p.agronomoId)) || "Agrônomo vinculado"}
                  carga={carga.get(String(p.id)) || 0}
                  aoAbrir={aoAbrir}
                  aoVincular={aoVincular}
                />
              </Fragment>
            );
          })}
        </ul>
      )}

      {restantes > 0 && (
        <button
          type="button"
          className="cooperativa-btn cooperativa-btn--secondary cooperativa-btn--largo"
          onClick={aoMostrarMais}
        >
          Mostrar mais ({restantes})
        </button>
      )}
    </>
  );
}

/* =========================================================
   Aba: Avisos
   ========================================================= */

function PainelAvisos({ contagens, notificar }) {
  const [titulo, setTitulo] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [destino, setDestino] = useState("todos");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  const alvo = contagens ? contagens[destino] : null;
  const semDestinatarios = alvo === 0;

  async function enviar(evento) {
    evento.preventDefault();
    if (!titulo.trim() || !mensagem.trim()) {
      setErro("Preencha o título e a mensagem do aviso.");
      return;
    }
    setEnviando(true);
    setErro("");
    const { ok, dados } = await chamar("/cooperativa/avisos", {
      metodo: "POST",
      corpo: {
        titulo: titulo.trim(),
        mensagem: mensagem.trim(),
        destinatarioTipo: destino,
      },
    });
    setEnviando(false);

    if (!ok) {
      setErro(dados?.mensagem || "Não foi possível enviar o aviso.");
      return;
    }
    notificar(
      alvo !== null ? `Aviso enviado para ${contar(alvo, "pessoa", "pessoas")}.` : "Aviso enviado."
    );
    setTitulo("");
    setMensagem("");
    setDestino("todos");
  }

  return (
    <form className="cooperativa-form cooperativa-cartao" onSubmit={enviar}>
      <div>
        <h3>Novo aviso</h3>
        <p className="cooperativa-cartao-texto">
          O aviso aparece para os destinatários dentro do app.
        </p>
      </div>

      <Segmentos
        legenda="Quem vai receber"
        nome="destino"
        valor={destino}
        aoMudar={setDestino}
        opcoes={[
          { valor: "todos", rotulo: "Todos", detalhe: contagens ? contagens.todos : undefined },
          {
            valor: "produtores",
            rotulo: "Produtores",
            detalhe: contagens ? contagens.produtores : undefined,
          },
          {
            valor: "agronomos",
            rotulo: "Agrônomos",
            detalhe: contagens ? contagens.agronomos : undefined,
          },
        ]}
      />

      <Campo rotulo="Título">
        <input
          type="text"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          required
        />
      </Campo>

      <Campo rotulo="Mensagem">
        <textarea
          rows={5}
          value={mensagem}
          onChange={(e) => setMensagem(e.target.value)}
          required
        />
      </Campo>

      {erro && (
        <p className="cooperativa-erro-form" role="alert">
          {erro}
        </p>
      )}

      <button
        type="submit"
        className="cooperativa-btn cooperativa-btn--largo"
        disabled={enviando || semDestinatarios}
      >
        <Icone nome="enviar" />
        {enviando
          ? "Enviando…"
          : semDestinatarios
            ? "Sem destinatários"
            : alvo !== null
              ? `Enviar para ${contar(alvo, "pessoa", "pessoas")}`
              : "Enviar aviso"}
      </button>
    </form>
  );
}

/* =========================================================
   Página
   ========================================================= */

function Cooperativa() {
  const navigate = useNavigate();

  const usuarios = useRecurso("/cooperativa/usuarios");
  const dashboard = useRecurso("/cooperativa/dashboard");
  const ranking = useRecurso("/cooperativa/ranking-agronomos");

  const [aba, setAba] = useState(lerAbaSalva);
  const [aviso, setAviso] = useState(null);
  const [painel, setPainel] = useState(null); // { tipo, pessoa?, perfil? }
  const [erroPainel, setErroPainel] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [baixando, setBaixando] = useState(false);

  const [filtro, setFiltro] = useState("todos");
  const [busca, setBusca] = useState("");
  const [limite, setLimite] = useState(ITENS_POR_PAGINA);

  const listaUsuarios = usuarios.dados;

  const { produtores, agronomos, semAgronomo, carga, nomes } = useMemo(() => {
    const lista = listaUsuarios || [];
    const produtores = lista.filter((u) => u.tipo === "produtor");
    const agronomos = lista.filter((u) => u.tipo === "agronomo");
    const carga = new Map();
    produtores.forEach((p) => {
      if (!p.agronomoId) return;
      const chave = String(p.agronomoId);
      carga.set(chave, (carga.get(chave) || 0) + 1);
    });
    return {
      produtores,
      agronomos,
      semAgronomo: produtores.filter((p) => !p.agronomoId),
      carga,
      nomes: new Map(agronomos.map((a) => [String(a.id), a.nome])),
    };
  }, [listaUsuarios]);

  const contagens = {
    todos: produtores.length + agronomos.length,
    produtores: produtores.length,
    agronomos: agronomos.length,
    semAgronomo: semAgronomo.length,
  };

  const filtradas = useMemo(() => {
    const base =
      filtro === "produtor"
        ? produtores
        : filtro === "agronomo"
          ? agronomos
          : filtro === "sem-agronomo"
            ? semAgronomo
            : [...produtores, ...agronomos];
    const termo = normalizar(busca.trim());
    if (!termo) return base;
    return base.filter((p) => normalizar(`${p.nome} ${p.email}`).includes(termo));
  }, [filtro, busca, produtores, agronomos, semAgronomo]);

  /* ---------- navegação / feedback ---------- */

  function trocarAba(id) {
    setAba(id);
    try {
      sessionStorage.setItem(CHAVE_ABA, id);
    } catch {
      /* sessionStorage indisponível: segue sem memorizar a aba */
    }
    window.scrollTo({ top: 0 });
  }

  function aoTeclarAba(evento, indice) {
    let novo = null;
    if (evento.key === "ArrowRight") novo = (indice + 1) % ABAS.length;
    if (evento.key === "ArrowLeft") novo = (indice - 1 + ABAS.length) % ABAS.length;
    if (evento.key === "Home") novo = 0;
    if (evento.key === "End") novo = ABAS.length - 1;
    if (novo === null) return;
    evento.preventDefault();
    trocarAba(ABAS[novo].id);
    document.getElementById(`aba-${ABAS[novo].id}`)?.focus();
  }

  const notificar = useCallback((texto, tipo = "sucesso") => {
    setAviso({ texto, tipo, id: Date.now() });
  }, []);
  const fecharAviso = useCallback(() => setAviso(null), []);

  function abrirPainel(dados) {
    setErroPainel("");
    setPainel(dados);
  }
  const fecharPainel = useCallback(() => {
    setPainel(null);
    setErroPainel("");
  }, []);

  function atualizarTudo() {
    usuarios.buscar();
    dashboard.buscar();
    ranking.buscar();
  }

  function mudarFiltro(novo) {
    setFiltro(novo);
    setLimite(ITENS_POR_PAGINA);
  }
  function mudarBusca(texto) {
    setBusca(texto);
    setLimite(ITENS_POR_PAGINA);
  }
  function limparFiltros() {
    setFiltro("todos");
    setBusca("");
    setLimite(ITENS_POR_PAGINA);
  }
  function direcionarSemAgronomo() {
    limparFiltros();
    setFiltro("sem-agronomo");
    trocarAba("pessoas");
  }

  /* ---------- ações que mudam dados ---------- */

  async function executar(caminho, opcoes, sucesso) {
    setOcupado(true);
    setErroPainel("");
    const { ok, dados } = await chamar(caminho, opcoes);
    setOcupado(false);

    if (!ok) {
      setErroPainel(dados?.mensagem || "Não foi possível concluir a ação. Tente de novo.");
      return;
    }
    notificar(sucesso);
    fecharPainel();
    atualizarTudo();
  }

  function cadastrar(dados) {
    executar(
      "/cooperativa/cadastrar-usuario",
      { metodo: "POST", corpo: dados },
      `${dados.tipo === "agronomo" ? "Agrônomo" : "Produtor"} cadastrado.`
    );
  }

  function salvarEdicao(pessoa, dados) {
    executar(
      `/cooperativa/usuario/${pessoa.id}`,
      { metodo: "PUT", corpo: dados },
      "Dados atualizados."
    );
  }

  function excluir(pessoa) {
    executar(
      `/cooperativa/usuario/${pessoa.id}`,
      { metodo: "DELETE" },
      `${pessoa.nome} foi excluído.`
    );
  }

  function vincular(produtor, agronomoId) {
    executar(
      "/vincular",
      { metodo: "POST", corpo: { produtorId: produtor.id, agronomoId } },
      `${produtor.nome} vinculado a ${nomes.get(String(agronomoId)) || "agrônomo"}.`
    );
  }

  function removerVinculo(produtor) {
    executar(
      "/desvincular",
      { metodo: "POST", corpo: { produtorId: produtor.id } },
      "Vínculo removido."
    );
  }

  function alterarSenha(pessoa) {
    localStorage.setItem("editarSenhaUsuarioId", pessoa.id);
    localStorage.setItem("editarSenhaUsuarioNome", pessoa.nome || "");
    navigate("/editar_senha");
  }

  async function baixarRelatorio() {
    setBaixando(true);
    try {
      const resposta = await fetchAutenticado(`${AUTH_API_URL}/cooperativa/relatorio.csv`);
      if (!resposta.ok) {
        notificar("Não foi possível gerar o relatório. Tente de novo.", "erro");
        return;
      }
      const blob = await resposta.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "relatorio_coffeevision.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      notificar("Relatório baixado.");
    } catch {
      notificar(ERRO_REDE, "erro");
    } finally {
      setBaixando(false);
    }
  }

  /* ---------- conteúdo do painel aberto ---------- */

  let tituloPainel = "";
  let descricaoPainel = "";
  let conteudoPainel = null;

  if (painel?.tipo === "novo") {
    tituloPainel = "Novo usuário";
    descricaoPainel = "Cadastre um produtor ou um agrônomo da cooperativa.";
    conteudoPainel = (
      <FormNovoUsuario
        perfilInicial={painel.perfil || "produtor"}
        ocupado={ocupado}
        erro={erroPainel}
        aoEnviar={cadastrar}
      />
    );
  } else if (painel?.tipo === "editar") {
    tituloPainel = "Editar pessoa";
    descricaoPainel = painel.pessoa.tipo === "produtor" ? "Produtor" : "Agrônomo";
    conteudoPainel = (
      <FormEditar
        pessoa={painel.pessoa}
        ocupado={ocupado}
        erro={erroPainel}
        aoSalvar={(dados) => salvarEdicao(painel.pessoa, dados)}
        aoCancelar={fecharPainel}
        aoAlterarSenha={() => alterarSenha(painel.pessoa)}
        aoExcluir={() => abrirPainel({ tipo: "excluir", pessoa: painel.pessoa })}
      />
    );
  } else if (painel?.tipo === "vincular") {
    tituloPainel = "Direcionar produtor";
    descricaoPainel = `Escolha quem acompanha as lavouras de ${painel.pessoa.nome}.`;
    conteudoPainel = (
      <FormVinculo
        produtor={painel.pessoa}
        agronomos={agronomos}
        carga={carga}
        ocupado={ocupado}
        erro={erroPainel}
        aoSalvar={(agronomoId) => vincular(painel.pessoa, agronomoId)}
        aoRemover={() => removerVinculo(painel.pessoa)}
        aoCadastrarAgronomo={() => abrirPainel({ tipo: "novo", perfil: "agronomo" })}
      />
    );
  } else if (painel?.tipo === "excluir") {
    tituloPainel = `Excluir ${painel.pessoa.nome}?`;
    conteudoPainel = (
      <ConfirmarExclusao
        pessoa={painel.pessoa}
        vinculados={carga.get(String(painel.pessoa.id)) || 0}
        ocupado={ocupado}
        erro={erroPainel}
        aoConfirmar={() => excluir(painel.pessoa)}
        aoCancelar={fecharPainel}
      />
    );
  }

  return (
    <div className="cooperativa-page">
      <header className="cooperativa-topo">
        <div className="cooperativa-topo-linha">
          <h1>Cooperativa</h1>
          <button
            type="button"
            className="cooperativa-btn cooperativa-btn--pequeno"
            onClick={() => abrirPainel({ tipo: "novo", perfil: "produtor" })}
          >
            <Icone nome="mais" tamanho={18} />
            Novo usuário
          </button>
        </div>
        <p>Acompanhe as lavouras e organize produtores e agrônomos.</p>
      </header>

      <div className="cooperativa-abas">
        <div className="cooperativa-abas-lista" role="tablist" aria-label="Seções da cooperativa">
          {ABAS.map((a, indice) => (
            <button
              key={a.id}
              type="button"
              role="tab"
              id={`aba-${a.id}`}
              aria-selected={aba === a.id}
              aria-controls={`painel-${a.id}`}
              tabIndex={aba === a.id ? 0 : -1}
              className="cooperativa-aba"
              onClick={() => trocarAba(a.id)}
              onKeyDown={(e) => aoTeclarAba(e, indice)}
            >
              {a.rotulo}
              {a.id === "pessoas" && semAgronomo.length > 0 && (
                <span className="cooperativa-aba-marca">
                  {semAgronomo.length}
                  <span className="cooperativa-oculto"> sem agrônomo</span>
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <main className="cooperativa-conteudo">
        <div
          role="tabpanel"
          id="painel-visao"
          aria-labelledby="aba-visao"
          className="cooperativa-aba-painel"
          hidden={aba !== "visao"}
        >
          <VisaoGeral
            dashboard={dashboard}
            ranking={ranking}
            aoDirecionar={direcionarSemAgronomo}
            aoBaixar={baixarRelatorio}
            baixando={baixando}
          />
        </div>

        <div
          role="tabpanel"
          id="painel-pessoas"
          aria-labelledby="aba-pessoas"
          className="cooperativa-aba-painel"
          hidden={aba !== "pessoas"}
        >
          <PainelPessoas
            recurso={usuarios}
            contagens={contagens}
            filtradas={filtradas}
            filtro={filtro}
            aoFiltrar={mudarFiltro}
            busca={busca}
            aoBuscar={mudarBusca}
            limite={limite}
            aoMostrarMais={() => setLimite((l) => l + ITENS_POR_PAGINA)}
            aoLimpar={limparFiltros}
            nomes={nomes}
            carga={carga}
            aoNovo={(perfil) => abrirPainel({ tipo: "novo", perfil })}
            aoAbrir={(pessoa) => abrirPainel({ tipo: "editar", pessoa })}
            aoVincular={(pessoa) => abrirPainel({ tipo: "vincular", pessoa })}
          />
        </div>

        <div
          role="tabpanel"
          id="painel-avisos"
          aria-labelledby="aba-avisos"
          className="cooperativa-aba-painel"
          hidden={aba !== "avisos"}
        >
          <PainelAvisos
            contagens={usuarios.dados ? contagens : null}
            notificar={notificar}
          />
        </div>
      </main>

      <Painel
        aberto={Boolean(painel)}
        chave={painel ? `${painel.tipo}-${painel.pessoa?.id ?? ""}` : ""}
        aoFechar={fecharPainel}
        titulo={tituloPainel}
        descricao={descricaoPainel}
      >
        {conteudoPainel}
      </Painel>

      <Notificacao aviso={aviso} aoFechar={fecharAviso} />
      <BottomNav />
    </div>
  );
}

export default Cooperativa;
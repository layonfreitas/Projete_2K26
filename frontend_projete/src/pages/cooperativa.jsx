import { useEffect, useState } from "react";
import { AUTH_API_URL } from "../config/api";
import { useNavigate } from "react-router-dom";
import { fetchAutenticado } from "../services/apiAutenticado";
import BottomNav from "../components/BottomNav";
import Editar_senha from "./editar_senha.jsx";
import "./cooperativa.css";
import "./Editar_senha.css";

const ROTULO_STATUS = {
  ok: "Ok",
  atencao: "Atenção",
  critico: "Crítico",
};

function Cooperativa() {
  const navigate = useNavigate();
  const [usuarios, setUsuarios] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");

  // Form de cadastro
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [tipo, setTipo] = useState("produtor");
  const [enviando, setEnviando] = useState(false);

  // Form de direcionamento
  const [produtorId, setProdutorId] = useState("");
  const [agronomoId, setAgronomoId] = useState("");

  // Edição inline (id do usuário sendo editado no momento, ou null)
  const [editandoId, setEditandoId] = useState(null);
  const [editNome, setEditNome] = useState("");
  const [editEmail, setEditEmail] = useState("");

  // Dashboard / ranking / avisos
  const [dashboard, setDashboard] = useState(null);
  const [ranking, setRanking] = useState([]);
  const [avisoTitulo, setAvisoTitulo] = useState("");
  const [avisoMensagem, setAvisoMensagem] = useState("");
  const [avisoDestino, setAvisoDestino] = useState("todos");
  const [enviandoAviso, setEnviandoAviso] = useState(false);

  async function buscarUsuarios() {
    try {
      const resposta = await fetchAutenticado(`${AUTH_API_URL}/cooperativa/usuarios`);
      const dados = await resposta.json();
      if (resposta.ok) {
        setUsuarios(dados);
      } else {
        setErro(dados.mensagem || "Erro ao buscar usuários.");
      }
    } catch (erroRequisicao) {
      setErro("Erro ao conectar com o servidor.");
    } finally {
      setCarregando(false);
    }
  }

  async function buscarDashboard() {
    try {
      const resposta = await fetchAutenticado(`${AUTH_API_URL}/cooperativa/dashboard`);
      const dados = await resposta.json();
      if (resposta.ok) setDashboard(dados);
    } catch (erroRequisicao) {
      console.error(erroRequisicao);
    }
  }

  function editar_senha(usuario_id)
{
  localStorage.setItem("editarSenhaUsuarioId", usuario_id);
  navigate("/Editar_senha");
}
  async function buscarRanking() {
    try {
      const resposta = await fetchAutenticado(`${AUTH_API_URL}/cooperativa/ranking-agronomos`);
      const dados = await resposta.json();
      if (resposta.ok) setRanking(dados);
    } catch (erroRequisicao) {
      console.error(erroRequisicao);
    }
  }

  useEffect(() => {
    buscarUsuarios();
    buscarDashboard();
    buscarRanking();
  }, []);

  const produtores = usuarios.filter((u) => u.tipo === "produtor");
  const agronomos = usuarios.filter((u) => u.tipo === "agronomo");

  async function handleCadastrar(event) {
    event.preventDefault();
    setMensagem("");
    setEnviando(true);
    try {
      const resposta = await fetchAutenticado(`${AUTH_API_URL}/cooperativa/cadastrar-usuario`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, email, senha, tipo }),
      });
      const dados = await resposta.json();

      if (resposta.ok) {
        setMensagem(`${tipo === "agronomo" ? "Agrônomo" : "Produtor"} cadastrado com sucesso!`);
        setNome("");
        setEmail("");
        setSenha("");
        buscarUsuarios();
        buscarDashboard();
      } else {
        setMensagem(dados.mensagem || "Erro ao cadastrar.");
      }
    } catch (erroRequisicao) {
      setMensagem("Erro ao conectar com o servidor.");
      console.error(erroRequisicao);
    } finally {
      setEnviando(false);
    }
  }

  async function handleVincular(event) {
    event.preventDefault();
    setMensagem("");
    if (!produtorId || !agronomoId) {
      setMensagem("Selecione um produtor e um agrônomo.");
      return;
    }
    try {
      const resposta = await fetchAutenticado(`${AUTH_API_URL}/vincular`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ produtorId, agronomoId }),
      });
      const dados = await resposta.json();

      if (resposta.ok) {
        setMensagem("Produtor vinculado ao agrônomo com sucesso!");
        setProdutorId("");
        setAgronomoId("");
        buscarUsuarios();
        buscarRanking();
      } else {
        setMensagem(dados.mensagem || "Erro ao vincular.");
      }
    } catch (erroRequisicao) {
      setMensagem("Erro ao conectar com o servidor.");
      console.error(erroRequisicao);
    }
  }

  // ---------- Editar ----------

  function iniciarEdicao(usuario) {
    setEditandoId(usuario.id);
    setEditNome(usuario.nome);
    setEditEmail(usuario.email);
  }

  function cancelarEdicao() {
    setEditandoId(null);
    setEditNome("");
    setEditEmail("");
  }

  async function salvarEdicao(usuarioId) {
    setMensagem("");
    try {
      const resposta = await fetchAutenticado(`${AUTH_API_URL}/cooperativa/usuario/${usuarioId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: editNome, email: editEmail }),
      });
      const dados = await resposta.json();

      if (resposta.ok) {
        setMensagem("Usuário atualizado com sucesso!");
        cancelarEdicao();
        buscarUsuarios();
      } else {
        setMensagem(dados.mensagem || "Erro ao editar usuário.");
      }
    } catch (erroRequisicao) {
      setMensagem("Erro ao conectar com o servidor.");
      console.error(erroRequisicao);
    }
  }

  // ---------- Deletar ----------

  async function deletarUsuario(usuario) {
    const confirmado = window.confirm(
      `Tem certeza que deseja excluir ${usuario.nome}? ` +
      `Essa ação é permanente${usuario.tipo === "produtor" ? " e também apaga as lavouras e observações dele" : ""}.`
    );
    if (!confirmado) return;

    setMensagem("");
    try {
      const resposta = await fetchAutenticado(`${AUTH_API_URL}/cooperativa/usuario/${usuario.id}`, {
        method: "DELETE",
      });
      const dados = await resposta.json();

      if (resposta.ok) {
        setMensagem("Usuário excluído com sucesso.");
        buscarUsuarios();
        buscarDashboard();
        buscarRanking();
      } else {
        setMensagem(dados.mensagem || "Erro ao excluir usuário.");
      }
    } catch (erroRequisicao) {
      setMensagem("Erro ao conectar com o servidor.");
      console.error(erroRequisicao);
    }
  }

  // ---------- Relatório CSV ----------

  async function baixarRelatorio() {
    try {
      const resposta = await fetchAutenticado(`${AUTH_API_URL}/cooperativa/relatorio.csv`);
      if (!resposta.ok) {
        setMensagem("Erro ao gerar relatório.");
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
    } catch (erroRequisicao) {
      setMensagem("Erro ao conectar com o servidor.");
      console.error(erroRequisicao);
    }
  }

  // ---------- Avisos ----------

  async function enviarAviso(event) {
    event.preventDefault();
    if (!avisoTitulo.trim() || !avisoMensagem.trim()) {
      setMensagem("Preencha título e mensagem do aviso.");
      return;
    }
    setEnviandoAviso(true);
    setMensagem("");
    try {
      const resposta = await fetchAutenticado(`${AUTH_API_URL}/cooperativa/avisos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo: avisoTitulo,
          mensagem: avisoMensagem,
          destinatarioTipo: avisoDestino,
        }),
      });
      const dados = await resposta.json();

      if (resposta.ok) {
        setMensagem("Aviso enviado com sucesso!");
        setAvisoTitulo("");
        setAvisoMensagem("");
        setAvisoDestino("todos");
      } else {
        setMensagem(dados.mensagem || "Erro ao enviar aviso.");
      }
    } catch (erroRequisicao) {
      setMensagem("Erro ao conectar com o servidor.");
      console.error(erroRequisicao);
    } finally {
      setEnviandoAviso(false);
    }
  }

  function nomeDoAgronomo(agronomoId) {
    const agronomo = agronomos.find((a) => a.id === agronomoId);
    return agronomo ? agronomo.nome : null;
  }

  return (
    <div className="cooperativa-page">
      <div className="cooperativa-cabecalho">
        <h1>Cooperativa</h1>
        <p>Cadastre, direcione e acompanhe agrônomos e produtores.</p>
      </div>

      {mensagem && <p className="cooperativa-mensagem">{mensagem}</p>}

      {/* ---------------- DASHBOARD ---------------- */}
      <section className="cooperativa-card">
        <h2>Visão geral</h2>
        {!dashboard && <p className="cooperativa-status">Carregando dashboard...</p>}
        {dashboard && (
          <>
            <div className="cooperativa-stats">
              <div className="cooperativa-stat">
                <span className="cooperativa-stat-numero">{dashboard.totalProdutores}</span>
                <span className="cooperativa-stat-label">Produtores</span>
              </div>
              <div className="cooperativa-stat">
                <span className="cooperativa-stat-numero">{dashboard.totalAgronomos}</span>
                <span className="cooperativa-stat-label">Agrônomos</span>
              </div>
              <div className="cooperativa-stat">
                <span className="cooperativa-stat-numero">{dashboard.produtoresSemAgronomo}</span>
                <span className="cooperativa-stat-label">Sem agrônomo</span>
              </div>
              <div className="cooperativa-stat">
                <span className="cooperativa-stat-numero">{dashboard.totalLavouras}</span>
                <span className="cooperativa-stat-label">Lavouras</span>
              </div>
            </div>

            <div className="cooperativa-status-lavouras">
              <span className="cooperativa-tag cooperativa-tag-ok">
                Ok: {dashboard.statusLavouras.ok}
              </span>
              <span className="cooperativa-tag cooperativa-tag-atencao">
                Atenção: {dashboard.statusLavouras.atencao}
              </span>
              <span className="cooperativa-tag cooperativa-tag-critico">
                Crítico: {dashboard.statusLavouras.critico}
              </span>
            </div>

            {dashboard.lavourasEmAlerta.length > 0 && (
              <div className="cooperativa-alertas">
                <h3>Lavouras que precisam de atenção</h3>
                <div className="cooperativa-lista">
                  {dashboard.lavourasEmAlerta.map((l) => (
                    <div key={l.id} className="cooperativa-item">
                      <div>
                        <span className="cooperativa-nome">{l.nomeLavoura}</span>
                        <span className="cooperativa-email">Produtor: {l.produtor}</span>
                      </div>
                      <span className={`cooperativa-tag cooperativa-tag-${l.status}`}>
                        {ROTULO_STATUS[l.status]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button type="button" className="cooperativa-btn-relatorio" onClick={baixarRelatorio}>
              📄 Baixar relatório (CSV)
            </button>
          </>
        )}
      </section>

      {/* ---------------- RANKING ---------------- */}
      <section className="cooperativa-card">
        <h2>Ranking por agrônomo</h2>
        {ranking.length === 0 && <p className="cooperativa-status">Nenhum agrônomo cadastrado ainda.</p>}
        {ranking.length > 0 && (
          <table className="cooperativa-tabela">
            <thead>
              <tr>
                <th>Agrônomo</th>
                <th>Produtores</th>
                <th>Lavouras</th>
                <th>Críticas</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((r) => (
                <tr key={r.id}>
                  <td>{r.nome}</td>
                  <td>{r.totalProdutores}</td>
                  <td>{r.totalLavouras}</td>
                  <td>{r.lavourasCriticas}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* ---------------- CADASTRO ---------------- */}
      <section className="cooperativa-card">
        <h2>Cadastrar novo usuário</h2>
        <form onSubmit={handleCadastrar} className="cooperativa-form">
          <input
            type="text"
            placeholder="Nome completo"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
          />
          <input
            type="email"
            placeholder="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Senha provisória"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
          />
          <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="produtor">Produtor</option>
            <option value="agronomo">Agrônomo</option>
          </select>
          <button type="submit" disabled={enviando}>
            {enviando ? "Cadastrando..." : "Cadastrar"}
          </button>
        </form>
      </section>

      {/* ---------------- VÍNCULO ---------------- */}
      <section className="cooperativa-card">
        <h2>Direcionar produtor para agrônomo</h2>
        <form onSubmit={handleVincular} className="cooperativa-form">
          <select value={produtorId} onChange={(e) => setProdutorId(e.target.value)}>
            <option value="">Selecione o produtor</option>
            {produtores.map((p) => (
              <option key={p.id} value={p.id}>{p.nome}</option>
            ))}
          </select>
          <select value={agronomoId} onChange={(e) => setAgronomoId(e.target.value)}>
            <option value="">Selecione o agrônomo</option>
            {agronomos.map((a) => (
              <option key={a.id} value={a.id}>{a.nome}</option>
            ))}
          </select>
          <button type="submit">Vincular</button>
        </form>
      </section>

      {/* ---------------- PRODUTORES ---------------- */}
      <section className="cooperativa-card">
        <h2>Produtores ({produtores.length})</h2>

        {carregando && <p className="cooperativa-status">Carregando...</p>}

        {!carregando && erro && (
          <p className="cooperativa-status cooperativa-erro">{erro}</p>
        )}

        <div className="cooperativa-lista">
          {produtores.map((p) => (
            <div key={p.id} className="cooperativa-item">
              {editandoId === p.id ? (
                <form
                className="cooperativa-form-edicao"
  onSubmit={(e) => { e.preventDefault(); salvarEdicao(p.id); }}
>
  <input value={editNome} onChange={(e) => setEditNome(e.target.value)} required />
  <input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} required />

  <div className="cooperativa-acoes">
    <button type="submit">Salvar</button>
    <button type="button" onClick={cancelarEdicao}>Cancelar</button>
  </div>

  <div className="cooperativa-editar-senha">
    <button type="button" onClick={()=> editar_senha(p.id)}>Editar senha</button>
  </div>
</form>
              ) : (
                <>
                  <div>
                    <span className="cooperativa-nome">{p.nome}</span>
                    <span className="cooperativa-email">{p.email}</span>
                  </div>

                  <span
                    className={`cooperativa-tag ${
                      p.agronomoId ? "cooperativa-tag-ok" : "cooperativa-tag-pendente"
                    }`}
                  >
                    {p.agronomoId
                      ? `Agrônomo: ${nomeDoAgronomo(p.agronomoId) || "—"}`
                      : "Sem agrônomo"}
                  </span>

                  <div className="cooperativa-acoes">
                    <button onClick={() => iniciarEdicao(p)}>Editar</button>
                    <button className="cooperativa-btn-perigo" onClick={() => deletarUsuario(p)}>
                      Excluir
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ---------------- AGRÔNOMOS ---------------- */}
      <section className="cooperativa-card">
        <h2>Agrônomos ({agronomos.length})</h2>

        <div className="cooperativa-lista">
          {agronomos.map((a) => (
            <div key={a.id} className="cooperativa-item">
              {editandoId === a.id ? (
                <form
                  className="cooperativa-form-edicao"
                  onSubmit={(e) => { e.preventDefault(); salvarEdicao(a.id); }}
                >
                  <input value={editNome} onChange={(e) => setEditNome(e.target.value)} required />
                  <input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} required />
                  <div className="cooperativa-acoes">
                    <button type="submit">Salvar</button>
                    <button type="button" onClick={cancelarEdicao}>Cancelar</button>
                  </div>
                </form>
              ) : (
                <>
                  <div>
                    <span className="cooperativa-nome">{a.nome}</span>
                    <span className="cooperativa-email">{a.email}</span>
                  </div>

                  <div className="cooperativa-acoes">
                    <button onClick={() => iniciarEdicao(a)}>Editar</button>
                    <button className="cooperativa-btn-perigo" onClick={() => deletarUsuario(a)}>
                      Excluir
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ---------------- AVISOS ---------------- */}
      <section className="cooperativa-card">
        <h2>Enviar aviso</h2>
        <form onSubmit={enviarAviso} className="cooperativa-form">
          <input
            type="text"
            placeholder="Título do aviso"
            value={avisoTitulo}
            onChange={(e) => setAvisoTitulo(e.target.value)}
            required
          />
          <textarea
            placeholder="Mensagem"
            value={avisoMensagem}
            onChange={(e) => setAvisoMensagem(e.target.value)}
            required
          />
          <select value={avisoDestino} onChange={(e) => setAvisoDestino(e.target.value)}>
            <option value="todos">Todos</option>
            <option value="produtores">Somente produtores</option>
            <option value="agronomos">Somente agrônomos</option>
          </select>
          <button type="submit" disabled={enviandoAviso}>
            {enviandoAviso ? "Enviando..." : "Enviar aviso"}
          </button>
        </form>
      </section>

      <BottomNav />
    </div>
  );
}

export default Cooperativa;

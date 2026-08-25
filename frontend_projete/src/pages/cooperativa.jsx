import { useEffect, useState } from "react";
import { AUTH_API_URL } from "../config/api";
import BottomNav from "../components/BottomNav";
import "./cooperativa.css";

function Cooperativa() {
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

  async function buscarUsuarios() {
    try {
      const resposta = await fetch(`${AUTH_API_URL}/cooperativa/usuarios`);
      const dados = await resposta.json();
      if (resposta.ok) {
        setUsuarios(dados);
      } else {
        setErro(dados.mensagem || "Erro ao buscar usuários.");
      }
    } catch (erroRequisicao) {
      setErro("Erro ao conectar com o servidor.");
      console.error(erroRequisicao);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    buscarUsuarios();
  }, []);

  const produtores = usuarios.filter((u) => u.tipo === "produtor");
  const agronomos = usuarios.filter((u) => u.tipo === "agronomo");

  async function handleCadastrar(event) {
    event.preventDefault();
    setMensagem("");
    setEnviando(true);
    try {
      const resposta = await fetch(`${AUTH_API_URL}/cooperativa/cadastrar-usuario`, {
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
      const resposta = await fetch(`${AUTH_API_URL}/vincular`, {
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
      } else {
        setMensagem(dados.mensagem || "Erro ao vincular.");
      }
    } catch (erroRequisicao) {
      setMensagem("Erro ao conectar com o servidor.");
      console.error(erroRequisicao);
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
        <p>Cadastre e direcione agrônomos e produtores.</p>
      </div>

      {mensagem && <p className="cooperativa-mensagem">{mensagem}</p>}

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

      <section className="cooperativa-card">
        <h2>Produtores ({produtores.length})</h2>
        {carregando && <p className="cooperativa-status">Carregando...</p>}
        {!carregando && erro && <p className="cooperativa-status cooperativa-erro">{erro}</p>}
        <div className="cooperativa-lista">
          {produtores.map((p) => (
            <div key={p.id} className="cooperativa-item">
              <div>
                <span className="cooperativa-nome">{p.nome}</span>
                <span className="cooperativa-email">{p.email}</span>
              </div>
              <span className={`cooperativa-tag ${p.agronomoId ? "cooperativa-tag-ok" : "cooperativa-tag-pendente"}`}>
                {p.agronomoId ? `Agrônomo: ${nomeDoAgronomo(p.agronomoId) || "—"}` : "Sem agrônomo"}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="cooperativa-card">
        <h2>Agrônomos ({agronomos.length})</h2>
        <div className="cooperativa-lista">
          {agronomos.map((a) => (
            <div key={a.id} className="cooperativa-item">
              <div>
                <span className="cooperativa-nome">{a.nome}</span>
                <span className="cooperativa-email">{a.email}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <BottomNav />
    </div>
  );
}

export default Cooperativa;
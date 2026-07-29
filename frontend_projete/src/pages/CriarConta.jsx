import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AUTH_API_URL } from "../config/api";
import "./CriarConta.css";

export default function CriarConta() {
  const navigate = useNavigate();

  const [nome, setNome] = useState("");
  const [confirmaNome, setConfirmaNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmaSenha, setConfirmaSenha] = useState("");

  const [cidade, setCidade] = useState("");
  const [cidadeCoords, setCidadeCoords] = useState(null);
  const [buscandoCidade, setBuscandoCidade] = useState(false);

  const [mensagem, setMensagem] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function buscarCidade() {
    if (!cidade.trim()) return;

    setBuscandoCidade(true);
    setCidadeCoords(null);

    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cidade)}`;
      const resposta = await fetch(url);
      const dados = await resposta.json();

      if (dados.length === 0) {
        setMensagem("Cidade não encontrada. Tente escrever de outra forma (ex.: Cidade, Estado).");
        return;
      }

      setCidadeCoords({
        lat: parseFloat(dados[0].lat),
        lon: parseFloat(dados[0].lon),
        nomeCompleto: dados[0].display_name,
      });
      setMensagem("");
    } catch (erro) {
      setMensagem("Erro ao buscar a cidade.");
      console.error(erro);
    } finally {
      setBuscandoCidade(false);
    }
  }

  async function handleCadastro(event) {
    event.preventDefault();

    if (!nome || !confirmaNome || !email || !senha || !confirmaSenha || !cidade) {
      setMensagem("Preencha todos os campos.");
      return;
    }

    if (!cidadeCoords) {
      setMensagem('Clique em "Buscar" para confirmar sua cidade antes de continuar.');
      return;
    }

    setCarregando(true);
    setMensagem("");

    try {
      const resposta = await fetch(`${AUTH_API_URL}/cadastro`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome,
          confirmaNome,
          email,
          senha,
          confirmaSenha,
          cidade,
          cidadeLat: cidadeCoords.lat,
          cidadeLon: cidadeCoords.lon,
        }),
      });

      const dados = await resposta.json();

      if (resposta.ok) {
        setMensagem("Conta criada com sucesso! Redirecionando para o login...");
        setTimeout(() => navigate("/login"), 1500);
      } else {
        setMensagem(dados.mensagem || "Erro ao criar conta.");
      }
    } catch (erro) {
      setMensagem("Erro ao conectar com o servidor.");
      console.error(erro);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="criar-conta-container">
      <div className="criar-conta-card">
        <h1>🌱 Criar conta</h1>

        <form className="criar-conta-form" onSubmit={handleCadastro}>
          <label>Nome</label>
          <input value={nome} onChange={(e) => setNome(e.target.value)} />

          <label>Confirmar nome</label>
          <input value={confirmaNome} onChange={(e) => setConfirmaNome(e.target.value)} />

          <label>E-mail</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />

          <label>Senha</label>
          <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} />

          <label>Confirmar senha</label>
          <input type="password" value={confirmaSenha} onChange={(e) => setConfirmaSenha(e.target.value)} />

          <label>Cidade onde mora</label>
          <div className="campo-cidade">
            <input
              value={cidade}
              onChange={(e) => { setCidade(e.target.value); setCidadeCoords(null); }}
              placeholder="Ex.: Santa Rita do Sapucaí, MG"
            />
            <button type="button" onClick={buscarCidade} disabled={buscandoCidade}>
              {buscandoCidade ? "Buscando..." : "Buscar"}
            </button>
          </div>
          {cidadeCoords && <p className="cidade-confirmada">📍 {cidadeCoords.nomeCompleto}</p>}

          {mensagem && <p className="mensagem-cadastro">{mensagem}</p>}

          <button type="submit" className="botao-salvar" disabled={carregando}>
            {carregando ? "Criando conta..." : "Criar conta"}
          </button>
        </form>
      </div>
    </div>
  );
}
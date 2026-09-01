import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AUTH_API_URL } from "../config/api";
import BottomNav from "../components/BottomNav";
import "./agronomo.css";

function Agronomo() {
  const navigate = useNavigate();

  const [produtores, setProdutores] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    async function buscarProdutores() {
      const agronomoId = localStorage.getItem("usuarioId");

      if (!agronomoId) {
        setErro("Usuário não identificado.");
        setCarregando(false);
        return;
      }

      try {
        const resposta = await fetch(
          `${AUTH_API_URL}/agronomo/${agronomoId}/produtores`
        );
        const dados = await resposta.json();

        if (resposta.ok) {
          setProdutores(dados);
        } else {
          setErro(dados.mensagem || "Erro ao buscar produtores.");
        }
      } catch (erroRequisicao) {
        setErro("Erro ao conectar com o servidor.");
        //console.error(erroRequisicao);
      } finally {
        setCarregando(false);
      }
    }

    buscarProdutores();
  }, []);

  function selecionarProdutor(produtor) {
    localStorage.setItem("produtorSelecionadoId", produtor.id);
    localStorage.setItem("produtorSelecionadoNome", produtor.nome);
    
    navigate("/home");
  }

  function pegarIniciais(nome) {
    if (!nome) return "?";
    const partes = nome.trim().split(" ");
    if (partes.length === 1) return partes[0].substring(0, 2).toUpperCase();
    return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
  }

  return (
    <div className="agronomo-page">
      <div className="agronomo-cabecalho">
        <h1>Meus produtores</h1>
        <p>Selecione um produtor para acompanhar a lavoura dele.</p>
      </div>

      {carregando && <p className="agronomo-status">Carregando produtores...</p>}

      {!carregando && erro && <p className="agronomo-status agronomo-erro">{erro}</p>}

      {!carregando && !erro && produtores.length === 0 && (
        <p className="agronomo-status">Nenhum produtor cadastrado ainda.</p>
      )}

      <div className="agronomo-lista">
        {produtores.map((produtor) => (
          <button
            key={produtor.id}
            className="agronomo-card"
            onClick={() => selecionarProdutor(produtor)}
          >
            <div className="agronomo-avatar">{pegarIniciais(produtor.nome)}</div>
            <div className="agronomo-info">
              <span className="agronomo-nome">{produtor.nome}</span>
              <span className="agronomo-email">{produtor.email}</span>
            </div>
          </button>
        ))}
      </div>

      <BottomNav />
    </div>
  );
}

export default Agronomo;
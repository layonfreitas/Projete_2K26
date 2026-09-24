import { useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { AUTH_API_URL } from "../config/api";
import AppBar from "../components/ui/AppBar";
import Button from "../components/ui/Button";
import { TextField } from "../components/ui/Field";
import { EmptyState, Notice } from "../components/ui/States";
import { useToast } from "../components/ui/toastContext";
import { calcularAreaHectares, formatarHectares, pontosParaSvg } from "../utils/geo";
import { mensagemDeErro } from "../services/erros";
import "./Cadastro.css";

export default function Cadastro() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  const coordenadas = location.state?.coordenadas;

  const [nome, setNome] = useState("");
  const [erroNome, setErroNome] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [carregando, setCarregando] = useState(false);

  const temPoligono = Array.isArray(coordenadas) && coordenadas.length >= 3;
  const area_hectares = calcularAreaHectares(coordenadas);

  async function salvarCadastro(evento) {
    evento.preventDefault();

    const usuarioId = localStorage.getItem("usuarioId");

    if (!nome.trim()) {
      setErroNome("Dê um nome para identificar a lavoura.");
      return;
    }

    if (!coordenadas) {
      setMensagem("Desenhe o polígono no mapa antes de cadastrar.");
      return;
    }

    setCarregando(true);
    setMensagem("");
    setErroNome("");

    try {
      const projection = await fetch(`${os.environ.get("IA_URL")}/crs`,
        {
          method: "POST",
          headers:{
            "Content-Type":"application/json"
          },
          body:JSON.stringify({
            coordenadas: coordenadas
          })
        })
      
      const projecoes = await projection.json();
      const crs = projecoes.crs;
      const crs_transformation = projecoes.crs_transformation;

      
      const resposta = await fetch(`${AUTH_API_URL}/lavoura`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          usuarioId: usuarioId,
          nomeLavoura: nome,
          coordenadas,
          crs: crs,
          crs_transformation: crs_transformation
          
        }),
      });
      const dados = await resposta.json();

      if (resposta.ok) {
        toast.sucesso("Lavoura cadastrada com sucesso!");
                if (dados.mapas) {
          if (dados.mapas.status === "aceito") {
            toast.sucesso(dados.mapas.mensagem);
          } else {
            toast.erro(`Lavoura salva. ${dados.mapas.mensagem}`);
          }
        }
        navigate("/home");
      } else {
        setMensagem(dados.mensagem || "Erro ao cadastrar lavoura.");
      }
    } catch (erro) {
      setMensagem(mensagemDeErro(erro, "Erro ao conectar com o servidor."));
    } finally {
      setCarregando(false);
    }
  }

        async function Crs_obtido(coordenadas){
        try{
          const response = await fetch("http://127.0.0.1:8000/crs",
            {
              method:POST,
              headers:{"Content-type": "application/json"},
              body: JSONstringify({coordenadas}),
            });

            if(response.ok){
              const erro = await response.json();
              throw new Error(erro.detail || "Erro desconhecido ao consultar o CRS");
            }
            const dados = await response.json();
            return dados;
          } catch(erro){
            console.error("falha o obter CRS:", Error.message);
            throw erro;
          }
        }


  if (!temPoligono) {
    return (
      <div className="ui-coluna ui-coluna--sem-nav">
        <AppBar titulo="Cadastro da lavoura" para="/mapa" />
        <div className="ui-conteudo">
          <EmptyState
            icone="mapa"
            titulo="Nenhum contorno recebido"
            texto="Para cadastrar uma lavoura, marque os pontos dela no mapa e confirme o contorno."
          >
            <Button icon="mapa" onClick={() => navigate("/mapa")}>
              Ir para o mapa
            </Button>
          </EmptyState>
        </div>
      </div>
    );
  }

  return (
    <div className="ui-coluna ui-coluna--sem-nav">
      <AppBar
        titulo="Cadastro da lavoura"
        subtitulo="Dê um nome para a área que você marcou."
        para="/mapa"
      />

      <form className="ui-conteudo" onSubmit={salvarCadastro} noValidate>
        <div className="ui-cartao ui-formulario">
          <div className="cad-resumo">
            <svg
              className="cad-contorno"
              viewBox="0 0 240 160"
              role="img"
              aria-label="Desenho do contorno da lavoura"
            >
              <polygon points={pontosParaSvg(coordenadas)} />
            </svg>

            <dl className="cad-numeros">
              <div>
                <dt>Área</dt>
                <dd>{formatarHectares(area_hectares)}</dd>
              </div>
              <div>
                <dt>Pontos marcados</dt>
                <dd>{coordenadas.length}</dd>
              </div>
            </dl>
          </div>

          <TextField
            label="Nome da lavoura"
            placeholder="Ex.: Lavoura Boa Vista"
            autoComplete="off"
            error={erroNome}
            value={nome}
            onChange={(e) => {
              setNome(e.target.value);
              if (erroNome) setErroNome("");
            }}
          />

          {mensagem && <Notice tipo="erro">{mensagem}</Notice>}
        </div>

        <div className="ui-acoes-pagina">
          <Button type="submit" size="lg" block loading={carregando}>
            {carregando ? "Salvando…" : "Salvar cadastro"}
          </Button>
          <Button variant="secondary" block onClick={() => navigate("/mapa")}>
            Voltar ao mapa
          </Button>
        </div>
      </form>
    </div>
  );
}
import { useState } from "react";
import "./historico.css";

import historicoMapas from "../components/historicoMapas";
import BottomNav from "../components/BottomNav";
import Header from "../components/Header";


const ABAS = [
  {
    id: "mapas",
    nome: "Mapas",
    componente: historicoMapas,
  },

  // Para adicionar uma nova aba futuramente:
  //
  // {
  //   id: "graficos",
  //   nome: "Gráficos",
  //   componente: Graficos,
  // },
];


export default function Historico() {

  const [abaAtiva, setAbaAtiva] = useState(ABAS[0].id);

  const abaSelecionada = ABAS.find(
    (aba) => aba.id === abaAtiva
  );

  const ComponenteAba = abaSelecionada.componente;


  return (
    <div className="historico">

      <Header />

      <main className="historico-conteudo">

        {/* ================================
            TÍTULO
        ================================= */}

        <div className="historico-cabecalho">

          <div>
            <h1>Histórico</h1>

            <p>
              Consulte os dados e mapas históricos
              das suas lavouras.
            </p>
          </div>

        </div>


        {/* ================================
            ABAS
        ================================= */}

        <nav className="historico-abas">

          {ABAS.map((aba) => (

            <button
              key={aba.id}
              className={
                abaAtiva === aba.id
                  ? "historico-aba ativa"
                  : "historico-aba"
              }
              onClick={() => setAbaAtiva(aba.id)}
            >
              {aba.nome}
            </button>

          ))}

        </nav>


        {/* ================================
            CONTEÚDO DA ABA
        ================================= */}

        <section className="historico-painel">

          <ComponenteAba />

        </section>

      </main>

      <BottomNav />

    </div>
  );
}
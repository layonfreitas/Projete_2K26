import { useState } from "react";
import "./historico.css";

import HistoricoMapas from "../components/historicoMapas.jsx";
import BottomNav from "../components/BottomNav";
import Header from "../components/Header";

const ABAS = [
  {
    id: "mapas",
    nome: "Mapas",
    componente: HistoricoMapas,
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

  const abaSelecionada = ABAS.find((aba) => aba.id === abaAtiva);
  const ComponenteAba = abaSelecionada.componente;

  return (
    <div className="hist">
      <Header />

      <main className="hist-conteudo">
        <div className="hist-cabecalho">
          <h1>Histórico</h1>
          <p>Consulte os dados e mapas históricos das suas lavouras.</p>
        </div>

        {/* com uma única aba, a barra de abas seria só ruído */}
        {ABAS.length > 1 && (
          <nav className="hist-abas" role="tablist" aria-label="Seções do histórico">
            {ABAS.map((aba) => (
              <button
                key={aba.id}
                type="button"
                role="tab"
                aria-selected={abaAtiva === aba.id}
                className="hist-aba"
                onClick={() => setAbaAtiva(aba.id)}
              >
                {aba.nome}
              </button>
            ))}
          </nav>
        )}

        <section className="hist-painel">
          <ComponenteAba />
        </section>
      </main>

      <BottomNav />
    </div>
  );
}

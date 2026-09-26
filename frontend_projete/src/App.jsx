import { lazy, Suspense, useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";

import RotaProtegida from "./components/RotaProtegida";
import { Spinner } from "./components/ui/States";

// Cada tela é carregada só quando o usuário chega nela. Antes tudo (mapa,
// gerador de PDF, etc.) vinha num único arquivo de ~1 MB.
const Login = lazy(() => import("./pages/login"));
const Home = lazy(() => import("./pages/home"));
const Mapa = lazy(() => import("./pages/mapa"));
const Historico = lazy(() => import("./pages/historico"));
const Cadastro = lazy(() => import("./pages/Cadastro"));
const Perfil = lazy(() => import("./pages/perfil"));
const RecuperarSenha = lazy(() => import("./pages/RecuperarSenha"));
const TrocarSenha = lazy(() => import("./pages/TrocarSenha"));
const Agronomo = lazy(() => import("./pages/agronomo"));
const Cooperativa = lazy(() => import("./pages/cooperativa"));
const Observacao = lazy(() => import("./pages/observacao"));
const Observacao_Produtor = lazy(() => import("./pages/observacao_produtor"));
const NaoEncontrado = lazy(() => import("./pages/NaoEncontrado"));
const Laudo = lazy(() => import("./pages/laudo"));
const Edicao = lazy(() => import("./pages/edicao"));
const EditarSenha = lazy(() => import("./pages/Editar_senha"));




// Ao trocar de tela, volta ao topo (o React Router não faz isso sozinho).
function VoltarAoTopo() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

function Carregando() {
  return (
    <div className="carregando-tela">
      <Spinner rotulo="Carregando…" />
    </div>
  );
}

function App() {
  return (
    <>
      <VoltarAoTopo />

      <Suspense fallback={<Carregando />}>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route
            path="/home"
            element={
              <RotaProtegida>
                <Home />
              </RotaProtegida>
            }
          />
          <Route
            path="/mapa"
            element={
              <RotaProtegida>
                <Mapa />
              </RotaProtegida>
            }
          />
          <Route
            path="/historico"
            element={
              <RotaProtegida>
                <Historico />
              </RotaProtegida>
            }
          />
          <Route
            path="/cadastro"
            element={
              <RotaProtegida>
                <Cadastro />
              </RotaProtegida>
            }
          />
          <Route
            path="/perfil"
            element={
              <RotaProtegida>
                <Perfil />
              </RotaProtegida>
            }
          />

          <Route
            path="/agronomo"
            element={
              <RotaProtegida tiposPermitidos={["agronomo"]}>
                <Agronomo />
              </RotaProtegida>
            }
          />

          <Route
            path="/cooperativa"
            element={
              <RotaProtegida tiposPermitidos={["cooperativa"]}>
                <Cooperativa />
              </RotaProtegida>
            }
          />
          <Route
            path="/observacao/:id"
            element={
              <RotaProtegida>
                <Observacao />
              </RotaProtegida>
            }
          />
          <Route
            path="/laudo/:id"
            element={
              <RotaProtegida>
                <Laudo />
              </RotaProtegida>
            }
          />
          <Route
            path="/observacao_produtor/:id"
            element={
              <RotaProtegida>
                <Observacao_Produtor />
              </RotaProtegida>
            }
          />
          <Route
            path="/edicao/:id"
            element={
              <RotaProtegida>
                <Edicao />
              </RotaProtegida>
            }
          />

          <Route path="/NaoEncontrado" element={<NaoEncontrado />} />

          <Route path="/recuperar-senha" element={<RecuperarSenha />} />

          <Route
            path="/Editar_senha"
            element={
              <RotaProtegida tiposPermitidos={["cooperativa"]}>
                <EditarSenha />
              </RotaProtegida>
            }
          />
          <Route
            path="/cadastroUsuario"
            element={
                <CadastroUsuario />
            }
          />

          <Route
            path="/trocar-senha"
            element={
              <RotaProtegida>
                <TrocarSenha />
              </RotaProtegida>
            }
          />
          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route path="*" element={<NaoEncontrado />} />
        </Routes>
      </Suspense>
    </>
  );
}

export default App;

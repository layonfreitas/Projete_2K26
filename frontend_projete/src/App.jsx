import { Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/login";
import Home from "./pages/home";
import Mapa from "./pages/mapa";
import Historico from "./pages/historico";
import Cadastro from "./pages/Cadastro";
import Perfil from "./pages/perfil";
import RecuperarSenha from "./pages/RecuperarSenha";
import TrocarSenha from "./pages/TrocarSenha";
import Agronomo from "./pages/agronomo";
import Cooperativa from "./pages/cooperativa";
import Observacao from "./pages/observacao";
import Observacao_Produtor from "./pages/observacao_produtor";
import NaoEncontrado from "./pages/NaoEncontrado";
import Laudo from "./pages/laudo";
import Edicao from "./pages/edicao";
import EditarSenha from "./pages/Editar_senha";
import RotaProtegida from "./components/RotaProtegida";

function App() {
  return (
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
        path="/trocar-senha"
        element={
          <RotaProtegida>
            <TrocarSenha />
          </RotaProtegida>
        }
      />
      <Route
        path="/Historico"
        element={
          <RotaProtegida>
            <Historico />
          </RotaProtegida>
        }
      />
      <Route path="/" element={<Navigate to="/home" replace />} />
      <Route path="*" element={<NaoEncontrado />} />

    </Routes>
  );
}

export default App;
import { Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/login";
import Home from "./pages/home";
import Mapa from "./pages/mapa";
import Cadastro from "./pages/Cadastro";
import Perfil from "./pages/perfil";
import RecuperarSenha from "./pages/RecuperarSenha";
import TrocarSenha from "./pages/TrocarSenha";
import Agronomo from "./pages/agronomo";
import Cooperativa from "./pages/cooperativa";
import Observacao from "./pages/observacao";
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
          <RotaProtegida>
            <Agronomo />
          </RotaProtegida>
        }
      />

      <Route
        path="/cooperativa"
        element={
          <RotaProtegida>
            <Cooperativa />
          </RotaProtegida>
        }
      />
      <Route
        path="/observacao"
        element={
          <RotaProtegida>
            <Observacao />
          </RotaProtegida>
        }
      />



        <Route path="/recuperar-senha" element={<RecuperarSenha />} />

        <Route
          path="/trocar-senha"
          element={
            <RotaProtegida>
              <TrocarSenha />
            </RotaProtegida>
          }
        />

      <Route path="/" element={<Navigate to="/home" replace />} />
      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
  );
}

export default App;
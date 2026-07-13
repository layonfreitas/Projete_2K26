import { Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login";
import Home from "./pages/Home";
import Mapa from "./pages/mapa";
import Cadastro from "./pages/Cadastro";
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

      <Route path="/" element={<Navigate to="/home" replace />} />
      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
  );
}

export default App;
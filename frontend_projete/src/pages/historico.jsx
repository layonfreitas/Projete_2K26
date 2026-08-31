import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AUTH_API_URL } from "../config/api";
import "./historico.css";

import L from "leaflet";
import "leaflet/dist/leaflet.css";

import BottomNav from "../components/BottomNav";

import iconeMarcador from "leaflet/dist/images/marker-icon.png";
import iconeMarcador2x from "leaflet/dist/images/marker-icon-2x.png";
import iconeSombra from "leaflet/dist/images/marker-shadow.png";


// Pequenos utilitários de texto compartilhados pelas telas.

export function iniciais(nome, padrao = "CV") {
  const partes = String(nome || "").trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return padrao;
  if (partes.length === 1) return partes[0].substring(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

export function primeiroNome(nome) {
  return String(nome || "").trim().split(/\s+/)[0] || "";
}

export function normalizar(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function contar(n, singular, plural) {
  return `${n} ${n === 1 ? singular : plural}`;
}

export function formatarData(iso, opcoes = { day: "2-digit", month: "short" }) {
  if (!iso) return "";
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return "";
  return data.toLocaleDateString("pt-BR", opcoes);
}

export function formatarNumero(valor, casas = 1) {
  const n = Number(valor);
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: casas,
  });
}

export const ROTULO_TIPO = {
  produtor: "Produtor",
  agronomo: "Agrônomo",
  cooperativa: "Cooperativa",
};

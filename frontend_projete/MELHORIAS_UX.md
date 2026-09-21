# Refação de UX/UI do frontend

Regra seguida: **nenhum tom de cor foi alterado**. Todos os tokens de `src/index.css`
(`--canopy`, `--cherry`, `--gold`, `--parchment`, `--ink`…) continuam iguais, e só foram
usados os hovers que já existiam no código (`#b6842f`, `#a91f1f`, `#7a5b1c`, `#7a2c1e`).
As cores dos polígonos do mapa (`#2f4a33`, `#ffd54f`, paleta das lavouras) também não mudaram.

## Base compartilhada (novo)
- `src/components/ui/` — `Icon` (ícones SVG no lugar dos emojis), `Button`, `Field`
  (`TextField`, `PasswordField` com botão de mostrar senha, `TextAreaField`), `Sheet`
  (painel/`<dialog>`), `Toast` + `useToast` (no lugar de `alert()`), `AppBar`, `Avatar`
  e `States` (`Skeleton`, `EmptyState`, `ErrorState`, `Notice`, `Badge`, `Spinner`).
- `src/components/ui/ui.css` — estilos dessa base (prefixo `ui-`).
- `src/utils/` — `texto.js`, `geo.js` (cálculo de área que estava copiado em 3 telas),
  `leafletIcons.js`. `src/services/` — `sessao.js` (sair limpa TODA a sessão), `erros.js`.

## Por tela
- **Login / Recuperar senha**: logo, `AuthShell`, campos com rótulo visível e `autocomplete`,
  mostrar/ocultar senha, erro em vermelho (antes tudo aparecia em verde), passo 1 de 2,
  reenviar código com contagem regressiva.
- **Home**: cabeçalho com "Acompanhando {produtor}" (agrônomo) e atalho de observações
  (produtor); avisos da cooperativa (`AvisosBanner`, que existia mas não era usado);
  estados de carregando/erro/vazio (agrônomo sem produtor selecionado antes via tela em branco);
  clima com ícone, métricas e "tentar de novo"; upload com arrastar-e-soltar, dicas e
  "analisar outra folha"; falha da IA agora avisa.
- **Mapa**: barra de busca compacta + painel de cadastro com passo a passo, contagem de pontos
  e área ao vivo (antes 4 botões empilhados ocupavam metade da tela no celular).
- **Histórico**: datas viram faixa rolável no celular, índice e modo como controles
  segmentados, e o slider de opacidade (o estado existia, mas nunca foi desenhado).
- **Perfil / Trocar senha / Editar senha**: cartões organizados, confirmação ao sair.
- **Agrônomo, Cadastro, Edição, Observações, Laudo, 404**: estados vazios/erro, toasts,
  confirmações em painel (no lugar de `window.confirm`), área ao vivo e "salvar" só habilitado
  quando algo mudou (Edição), textarea que cresce para o PDF não cortar o texto (Laudo).

## Técnico
- Telas carregadas sob demanda (`React.lazy`): bundle inicial de ~1.028 kB → ~194 kB.
- `viewport-fit=cover` no `index.html` (sem ele as `env(safe-area-inset-*)` não funcionam).
- CSS por tela com prefixo próprio: acabaram as colisões (`.perfil-page`/`.perfil-card`
  estavam definidos em dois arquivos e o Perfil só funcionava porque `Editar_senha.css`
  também estava carregado).
- ESLint: de 15 para 3 problemas (os 3 restantes estão em `AvisosContext.jsx`, lógica de
  dados que não foi alterada).
- Não usados no app (mantidos): `src/components/cooperativa/*` e `src/hooks/useCooperativa.js`.

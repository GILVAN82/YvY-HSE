# YVY HSE

> **Sprint 3 verified baseline (authoritative):** the application now includes the
> production-shaped YVY HSE agent with LangGraph routing, five read-only operational
> tools, approved-source RAG with citations, PostgreSQL thread state, explicit
> long-term memory, human approval for critical LOTO execution, domain-scope controls
> and an external evaluation harness. The final evidence package is indexed in
> [`artifacts/presentation/evidence-index.md`](artifacts/presentation/evidence-index.md).

YVY HSE is a domain-specific HSE/QHSE AI application built with LangGraph that
combines operational PostgreSQL tools, Agentic RAG, persistent conversation state,
controlled long-term memory, human-in-the-loop workflows and security guardrails.

Current validated baseline:

- PostgreSQL 16.14 and pgvector 0.8.6
- 42 original HSE tables and 784 operational rows preserved
- 4 approved RAG documents, 4 chunks and 1536-dimensional embeddings
- 154 backend tests, 7 frontend tests and 5 harness tests passing
- offline evaluation: 36/36; live-safe evaluation: 9/9
- the agent ends an inactive UI conversation after 15 minutes and starts a new thread

Current agent documentation:

- [Final validation](docs/turing-sprint3-final-validation.md)
- [LangGraph architecture](docs/langgraph-architecture.md)
- [RAG ingestion](docs/turing-sprint3-rag-ingestion.md)
- [Thread state](docs/turing-sprint3-thread-state.md)
- [Long-term memory](docs/turing-sprint3-long-term-memory.md)
- [Human approval](docs/turing-sprint3-hitl.md)
- [Agent harness](docs/turing-sprint3-agent-harness.md)
- [Final presentation](docs/turing-sprint3-final-presentation.md)

Final validation commands from `backend/`:

```bash
npm run typecheck
npm run build
npm test
npm run eval:harness
npm run agent:evaluate
npm run rag:ingest -- --dry-run
```

From `frontend/`:

```bash
npm run build
npm run test:ci
```

Never commit `backend/.env` or print its values. Use `.env.example` only as the
configuration template.

## Demo environment

An isolated synthetic presentation database is available as `hse_app_demo`. From
`backend/`, run `npm run demo:reset`, validate with `npm run demo:validate`, and start
the backend with `npm run demo:start`. The reset fails closed unless the connected
database is exactly `hse_app_demo`; it never overwrites `backend/.env`. Full instructions
and expected counts are in [docs/yvy-hse-demo-environment.md](docs/yvy-hse-demo-environment.md).

Sistema full-stack de gestão de HSE. Sem login (uso local, um único usuário). Os dados
iniciais (12 projetos, incidentes, ações, treinamentos etc.) já vêm pré-carregados no
banco via script de seed.

## Arquitetura

```
hse-app/
├── database/
│   ├── schema.sql      # DDL PostgreSQL — ~30 tabelas de dados + projects/lookup_lists/settings
│   ├── data.json        # dataset inicial (usado só pelo seed)
│   └── seed.js           # carrega data.json no Postgres
├── backend/               # Node + TypeScript + Express
│   └── src/
│       ├── config/tableMeta.json   # metadados de cada tabela (colunas, tipos)
│       ├── routes/generic.ts        # CRUD genérico: GET/POST/PUT/DELETE /api/data/:sheet/:tableIndex
│       ├── routes/projects.ts        # /api/projects, /api/lists, /api/settings
│       ├── routes/kpi.ts              # /api/kpi — TRIR, LTIFR, homens-hora, ações, treinamento, auditoria
│       └── index.ts
└── frontend/               # Angular 18 (standalone components)
    └── src/app/
        ├── core/            # ApiService, I18nService (EN/PT/ES/FR/DE), nav.config.ts
        ├── shared/charts/    # bar-chart, line-chart, donut-chart (SVG puro, sem lib externa)
        └── pages/            # home, portfolio, project, projects, lists, instructions, sheet (genérico p/ as ~34 abas restantes)
```

**KPIs nas páginas de dados.** Além dos dashboards, cada uma das 35 abas mostra uma faixa
de KPIs acima da tabela (`routes/sheetStats.ts`). As abas principais (Incidentes, Ações,
Treinamento, Permissões, Auditoria, Observações, HIRA, Mão de Obra, Químicos,
Derramamentos, DDS) têm indicadores escritos à mão; as demais caem num motor genérico que
deriva os cards das próprias colunas (status, datas de vencimento, colunas de nota). Os
cards usam os mesmos filtros da tabela — filtrar por projeto recalcula os KPIs.

**Por que "CRUD genérico"?** Em vez de escrever 34 controllers e 34 telas quase idênticas
(uma por seção de dados), o backend lê `tableMeta.json` (colunas/tipos de cada tabela) e
serve um único endpoint parametrizado por `sheet`. O frontend espelha isso com um único
componente (`pages/sheet`) que monta a tabela, os filtros e o formulário de "Adicionar
registro" dinamicamente. Isso significa que adicionar uma coluna nova = atualizar
`schema.sql` e `tableMeta.json`, sem tocar em código de tela.

## Pré-requisitos

- Node.js 20+
- PostgreSQL 14+ rodando localmente

## Como rodar (primeira vez)

### 1. Banco de dados

```bash
createdb hse_app
psql -d hse_app -f database/schema.sql

cd database
npm install pg
DATABASE_URL="postgres://SEU_USUARIO:SUA_SENHA@localhost:5432/hse_app" node seed.js
```

O seed carrega: 12 projetos, ~40 tabelas de dados, listas de apoio (dropdowns) e
configurações (RateBase, metas de TRIR/LTIFR etc.).

### 2. Backend (API)

```bash
cd backend
cp .env.example .env      # ajuste DATABASE_URL se necessário
npm install
npm run dev                # http://localhost:3000
```

Teste rápido: `curl http://localhost:3000/api/health` deve retornar `{"ok":true}`.

### 3. Frontend (Angular)

```bash
cd frontend
npm install
npm start                  # http://localhost:4200
```

Abra `http://localhost:4200` no navegador. O seletor de idiomas fica no topo (mesmas 5
línguas do app anterior: EN/PT/ES/FR/DE).

## Agente de IA

O sistema inclui um agente consultivo que responde a perguntas sobre os dados de HSE
consultando-os em tempo real através de ferramentas.

- **Propósito e limites** — [docs/agent-purpose.md](docs/agent-purpose.md)
- **Arquitectura do agente** — [docs/langgraph-architecture.md](docs/langgraph-architecture.md)
- **Arquitectura do sistema** — [docs/architecture.md](docs/architecture.md)
- **Limitações conhecidas** — [docs/limitations.md](docs/limitations.md)

**Para o agente funcionar é preciso pelo menos uma chave de LLM** em `backend/.env`
(Anthropic, OpenAI ou Google), ou um Ollama a correr localmente. Sem nenhum provedor
configurado, `POST /api/ai/chat` responde `503 AI_PROVIDER_UNAVAILABLE` — não uma resposta
vazia.

```bash
cd backend
cp .env.example .env     # preencha UMA das chaves
npm run dev
```

Quatro ferramentas, todas de leitura: `get_kpi`, `list_incidents`, `list_actions`,
`get_projects`. Exemplos de perguntas: *"Qual o TRIR do portfólio?"*, *"Que ações estão
atrasadas?"*, *"Quais incidentes teve o PRJ-009?"*

### Comandos do backend

| Comando | Faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento com recarga |
| `npm run build` | Compila para `dist/` (exclui testes) |
| `npm test` | 37 testes com modelo simulado — não precisa de chave nem de rede |
| `npm run typecheck` | `tsc --noEmit`, incluindo os testes |

## Endpoints principais da API

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/sheets` | metadados de todas as abas (colunas, tipos) |
| GET | `/api/projects` | lista de projetos |
| GET | `/api/lists` | listas de apoio (dropdowns) agrupadas |
| GET | `/api/settings` | configurações do sistema (RateBase, metas) |
| GET | `/api/kpi?project=PRJ-001&month=3` | KPIs calculados (TRIR, LTIFR, ações, treinamento...); `project=*` = portfólio inteiro, `month` omitido/`*` = ano todo |
| GET | `/api/stats/:sheet/:tableIndex?` | KPIs da aba (mesmos filtros `q`/`project`/`status` do `/api/data`, sem paginação) |
| GET | `/api/data/:sheet/:tableIndex?` | lista registros (filtros: `q`, `project`, `status`, `page`, `pageSize`) |
| POST | `/api/data/:sheet/:tableIndex` | adiciona registro |
| PUT | `/api/data/:sheet/:tableIndex/:id` | edita registro |
| DELETE | `/api/data/:sheet/:tableIndex/:id` | remove registro |

`:sheet` é o nome da seção de dados, ex. `Incident Register`
(precisa URL-encode: `Incident%20Register`).

## O que já foi validado

- Schema aplicado sem erros (30 tabelas).
- Seed completo: todos os dados iniciais carregados corretamente.
- **Auditoria completa dos dados**: contagem de linhas e cabeçalhos conferidos tabela a
  tabela — 100% consistentes. Fórmulas de KPI (`SUMIFS`/`COUNTIFS`/`IFERROR` equivalentes)
  comparadas com a lógica do backend — batem.
- **Os 8 gráficos dos dashboards foram revisados e ajustados** (título, tipo, fonte de
  dados) — ex.: "Severity Breakdown" é rosca (não barra); "Incident Trend - All Projects"
  existe no Portfólio; o Painel do Projeto tem 4 gráficos próprios (Tendência de
  Incidentes, Status das Ações, Treinamento por Função, Tendência da Nota de Inspeção).
- KPIs conferidos: TRIR 51,95 · LTIFR 8,66 · 115.500 homens-hora ·
  5 ações abertas / 3 atrasadas no portfólio.
- CRUD testado (criação e leitura via API).
- Build do Angular sem erros de tipo.
- Frontend e backend testados de ponta a ponta localmente.

## Próximos passos sugeridos (não incluídos ainda)

- **Autenticação/perfis** — hoje não há login. Se depois você quiser múltiplos usuários,
  dá para adicionar JWT + tabela `users` sem reestruturar o resto.
- **Edição de registros na tela** (hoje o frontend genérico cria e exclui; falta o botão
  "editar" abrindo o mesmo modal pré-preenchido — é pequena extensão do componente `sheet`).
- **Deploy** — tudo pensado para rodar local por enquanto; quando quiser hospedar, dá pra
  containerizar com Docker Compose (Postgres + backend + build estático do Angular atrás
  de um Nginx).
# AI Agent Attachments

The AI Agent accepts temporary PDF, DOCX, XLSX, PNG, JPG/JPEG, and WEBP attachments for HSE/QHSE analysis. Files expire after 120 minutes by default, are limited to 10 MB each (three per conversation and 25 MB combined), and are never added automatically to PostgreSQL, pgvector, RAG, or Long-Term Memory. Configure limits with the `AI_ATTACHMENT_*` environment variables. Image analysis requires the configured provider/model to support visual input. See `docs/yvy-hse-ai-attachments.md` for privacy and security limitations.

# 01 — Mapa do projecto e inventário da stack

## Estrutura

Monorepo simples, sem workspaces declarados. Três pastas de código mais uma de configuração
do agente de desenvolvimento.

```
hse-system-app/
├── backend/          Node + TypeScript + Express
│   └── src/
│       ├── ai/providers.ts          registry de LLM + allowlist
│       ├── config/tableMeta.json    metadados das 35 abas de dados
│       ├── db/pool.ts               pool Postgres
│       ├── routes/aiChat.ts         AGENTE: tools + streaming
│       ├── routes/generic.ts        CRUD genérico
│       ├── routes/kpi.ts            cálculo de KPI (reusado como tool)
│       ├── routes/projects.ts       projectos, listas, settings
│       ├── routes/sheetStats.ts     KPIs por aba
│       └── index.ts
├── database/         schema.sql + data.json + seed.js
├── frontend/         Angular 18 standalone
│   ├── public/branding/yvy-hse/     17 ficheiros de marca
│   ├── public/assets/i18n/          5 dicionários
│   └── src/app/{core,pages,shared}
└── docs/turing-sprint3-audit/       (criado por esta auditoria)
```

**Ausentes:** `.git`, `docs/` (antes desta auditoria), `.github/`, `Dockerfile`,
`docker-compose.yml`, `LICENSE`, ficheiros de ESLint, qualquer `*.spec.ts`.

---

## Ferramentas realmente utilizadas pelo YVY HSE

| Nome | Categoria | Versão | Finalidade | Onde | Evidência | Status |
|---|---|---|---|---|---|---|
| TypeScript | linguagem | 5.5 (fe) / 5.9 (be) | toda a base de código | ambos | `tsconfig.json` | EM PRODUÇÃO |
| Angular | frontend | 18.2 | SPA standalone | `frontend/` | `frontend/package.json` | EM PRODUÇÃO |
| SCSS | UI | — | design system próprio | `src/styles.scss` | 260+ linhas de tokens | EM PRODUÇÃO |
| lucide-angular | UI/ícones | 1.0.0 | ícones da navegação | sidebar, topbar | `navigation.config.ts` | EM PRODUÇÃO |
| Angular signals | estado | 18.2 | estado local e derivado | `sidebar-state.service.ts` | `signal()`, `computed()` | EM PRODUÇÃO |
| Angular Router | routing | 18.2 | 8 rotas + genérica | `app.routes.ts` | — | EM PRODUÇÃO |
| Node + Express | backend | Express 4.19 | API REST | `backend/src/index.ts` | — | EM PRODUÇÃO |
| PostgreSQL | base de dados | 16-alpine | 30+ tabelas HSE | container `hse-postgres` | `database/schema.sql` | EM PRODUÇÃO |
| `pg` | driver | 8.12 | acesso à BD | `db/pool.ts` | SQL parametrizado | EM PRODUÇÃO |
| **Vercel AI SDK (`ai`)** | IA/orquestração | **7.0.17** | streaming + tool calling | `routes/aiChat.ts:172` | `streamText`, `tool` | **PARCIAL** ¹ |
| `@ai-sdk/anthropic` | IA/provedor | 4.0.9 | Claude | `ai/providers.ts:28` | 3 modelos | CONFIGURADO MAS NÃO USADO ² |
| `@ai-sdk/openai` | IA/provedor | 4.0.8 | GPT | `ai/providers.ts:39` | 3 modelos | CONFIGURADO MAS NÃO USADO ² |
| `@ai-sdk/google` | IA/provedor | 4.0.9 | Gemini | `ai/providers.ts:50` | 2 modelos | CONFIGURADO MAS NÃO USADO ² |
| `ollama-ai-provider-v2` | IA/provedor | 4.0.1 | modelos locais | `ai/providers.ts:60` | custom model id | CONFIGURADO MAS NÃO USADO ³ |
| Zod | schemas/tools | 4.4.3 | `inputSchema` das tools | `aiChat.ts:25,39,65,96` | validação de argumentos | EM PRODUÇÃO |
| `express-rate-limit` | segurança | 8.5.2 | 20 req/min no chat | `aiChat.ts:117` | guard real | EM PRODUÇÃO |
| `cors` | segurança | 2.8.5 | CORS aberto | `index.ts:10` | `app.use(cors())` | EM PRODUÇÃO |
| `dotenv` | config | 16.4 | carrega `.env` | `index.ts:1` | — | EM PRODUÇÃO |
| `ts-node-dev` | tooling | 2.0 | dev server | `package.json` | — | EM PRODUÇÃO |
| Karma + Jasmine | testes | 6.4 / 5.2 | runner configurado | `angular.json` | **0 ficheiros spec** | CONFIGURADO MAS NÃO USADO |
| localStorage | persistência cliente | — | tema, idioma, sidebar, provedor | vários | `hse-theme`, `hse-sidebar-*` | EM PRODUÇÃO |

¹ Ver nota crítica abaixo. ² Sem chave em `.env`. ³ Servidor Ollama inacessível (`HTTP 000`).

### Categorias sem nenhuma tecnologia presente

autenticação · autorização/RBAC · ORM · memória longa · RAG · embeddings · vector database ·
filas/jobs · cache · observabilidade · logging estruturado · analytics · avaliação de IA ·
containers da aplicação · CI/CD · deployment · linting.

---

## Nota crítica sobre o AI SDK

```text
Evidência:
- Ficheiro: backend/src/routes/aiChat.ts
- Linhas: 172–178
- Símbolo: streamText({ model, system, tools, messages, maxOutputTokens })
- O que comprova: streamText é invocado com ferramentas mas SEM `stopWhen`.
```

```text
Evidência:
- Ficheiro: backend/node_modules/ai/dist/index.js
- Linha: 8412
- Símbolo: function streamText({ ... stopWhen = isStepCount(1) ... })
- O que comprova: o padrão do SDK é parar após UM passo, logo o resultado da
  ferramenta nunca é devolvido ao modelo.
```

Confirmado em execução com modelo simulado — ver [`09_COMMAND_RESULTS.md`](09_COMMAND_RESULTS.md).

---

## Base de dados

- 30+ tabelas de dados HSE geradas por `database/schema.sql`, semeadas por `database/seed.js`
  a partir de `database/data.json`.
- Dados presentes e coerentes: 12 projectos, 11 incidentes, 42 registos de formação,
  115 500 homens-hora.
- **Sem ORM** — SQL escrito à mão com parâmetros posicionais.
- **Sem migrations versionadas** — apenas um `schema.sql` aplicado uma vez.
- **Sem tabelas de IA**: consulta a `information_schema` devolveu `0` tabelas cujo nome
  contenha `chat`, `message`, `feedback`, `embedding` ou `memor`.
- **Sem `pgvector`**: `SELECT count(*) FROM pg_extension WHERE extname='vector'` → `0`.

---

## Configuração e segredos

`backend/.env.example` documenta seis variáveis. No `.env` real:

| Variável | Estado |
|---|---|
| `PORT` | preenchida |
| `DATABASE_URL` | preenchida |
| `ANTHROPIC_API_KEY` | **vazia** |
| `OPENAI_API_KEY` | **vazia** |
| `GOOGLE_GENERATIVE_AI_API_KEY` | **vazia** |
| `OLLAMA_BASE_URL` | preenchida, mas o serviço não responde |

Nenhum valor de segredo é reproduzido nesta auditoria. `.env` está listado no `.gitignore`.

**Consequência:** `GET /api/ai/providers` devolve `available:false` para os três provedores
cloud. O Ollama reporta `available:true` porque `envKey` é `null`
([`providers.ts:76-78`](../../backend/src/ai/providers.ts)), mas o serviço local está
inacessível — ou seja, a disponibilidade anunciada ao cliente é optimista e não é verificada.

# 03 — Matriz de conformidade com a Turing College

Status usados: `CUMPRE` · `CUMPRE PARCIALMENTE` · `NÃO CUMPRE` · `NÃO SE APLICA` ·
`NÃO VERIFICADO` · `MOCK` · `UI APENAS` · `PLANEJADO`.

---

## Parte 1 — Os cinco requisitos principais

### 1. Agent Purpose — CUMPRE PARCIALMENTE · P1

**Interpretação:** o agente deve ter um propósito claro, resolver um problema real e servir
utilizadores identificáveis.

**Evidências:** o `SYSTEM_PROMPT` ([`aiChat.ts:11-19`](../../backend/src/routes/aiChat.ts))
define com precisão o papel — assistente consultivo de dados HSE, proibido de inventar números
e de alterar registos. O README descreve o domínio e o dataset (12 projectos, ~40 tabelas).

**O que está bom:** o propósito é real e não decorativo. Um gestor de HSE que hoje tem de abrir
o Painel do Portfólio, escolher projecto e mês e ler quatro gráficos pode, em vez disso,
perguntar "quais acções estão atrasadas". O problema — dados HSE dispersos por 35 abas — é
genuíno e está demonstrado no próprio sistema.

**O que falta:** nada disto está **documentado**. Não há secção sobre o agente no README, nem
utilizadores-alvo, nem limites de uso, nem situações em que não deve ser usado. O propósito
tem de ser inferido do código.

**Risco:** médio. O revisor pergunta "que problema resolve?" e não encontra resposta escrita.

**Recomendação:** secção no README com problema, utilizadores, três casos de uso e limitações.

---

### 2. Core Functionality — CUMPRE PARCIALMENTE · P0

**Interpretação:** o agente deve funcionar — receber pedidos, decidir, usar ferramentas e
responder de forma útil.

**Evidências:** function calling implementado (`aiChat.ts:21-104`), quatro tools com schemas
Zod, streaming SSE (`aiChat.ts:180-188`), histórico conversacional (`aiChat.ts:166`).

**O que está bom:** a mecânica de tool calling está correctamente montada e o modelo tem
liberdade real de escolha entre quatro ferramentas.

**O que falta — e é grave:**
- O ciclo não fecha (`stopWhen` ausente): a ferramenta corre, o resultado não volta ao modelo,
  o utilizador **não recebe resposta**. Provado em [`09`](09_COMMAND_RESULTS.md).
- `list_actions` produz erro SQL (colunas inexistentes).
- Nenhum provedor configurado — o agente não corre.

**Risco:** **alto**. Este é o requisito central da sprint e, na prática, o agente não responde.

**Recomendação:** as três correcções P0 do roadmap. Esforço somado: pequeno.

---

### 3. User Interface — CUMPRE · P2

**Interpretação:** interface utilizável, intuitiva, com as interacções necessárias.

**Evidências:** widget de chat com sugestões iniciais, estados de carregamento
(`status: 'consulting' | 'streaming' | 'done'`), streaming incremental, gaveta de definições
separada, aviso permanente de que "as respostas podem conter imprecisões".

**O que está bom:** é a área mais forte do projecto. Sidebar de dois níveis, 5 idiomas, tema
claro/escuro, tooltips, foco visível, alvos de 44px, drawer mobile com armadilha de foco.
A separação entre definições de programador (provedor/modelo) e a experiência do utilizador
está feita e é exactamente o que a Turing pede num optional medium.

**O que falta:** sem histórico entre sessões, sem referências às fontes nas respostas, sem
botão de feedback, sem forma de cancelar uma resposta em curso.

**Risco:** baixo.

---

### 4. Technical Implementation — CUMPRE PARCIALMENTE · P0

**Evidências:** backend Express modular (`routes/` separado de `ai/` e `db/`), tipagem completa,
allowlist de modelos, rate limit, SQL parametrizado. `tsc --noEmit` e `ng build` passam.

**O que está bom:** organização de código sólida, separação de responsabilidades clara,
configuração central de navegação tipada, tokens de design centralizados.

**O que falta:** zero testes (`ng test` falha `TS18003`), zero lint, zero CI, sem Docker da
aplicação, sem autenticação, sem observabilidade, sem tratamento de erro dentro das tools,
sem timeout no `streamText`.

**Risco:** alto — "understanding core concepts" inclui explicitamente *erros e edge cases*.

---

### 5. Documentation — NÃO CUMPRE · P0

**Evidências:** existe `README.md` na raiz, bom para instalação, arquitectura de dados e
endpoints REST. **Não menciona o agente de IA uma única vez** — nem tools, nem prompts, nem
provedores, nem `GET /api/ai/providers`, nem `POST /api/ai/chat`.

**O que falta:** how to use, casos de uso comuns, decisões técnicas, arquitectura de IA,
limitações, riscos, melhorias futuras, troubleshooting.

**Risco:** alto — é um dos cinco critérios avaliados e está praticamente vazio no que toca a IA.

---

## Parte 2 — Optional easy

| # | Tarefa | Status | Evidência | Recomendação |
|---|---|---|---|---|
| 1 | Crítica de usabilidade, segurança e prompt engineering | **NÃO CUMPRE** | nenhum documento | Esta auditoria pode servir de base |
| 2 | Personalidade do agente | **CUMPRE PARCIALMENTE** | `aiChat.ts:11-19` define papel, tom e idioma, mas não uma persona | Nomear o agente e dar-lhe voz consistente |
| 3 | Escolha de LLM | **CUMPRE** | `providers.ts:27-72`, selector na gaveta de definições | — |
| 4 | Temperatura e max tokens configuráveis | **CUMPRE PARCIALMENTE** | `maxOutputTokens: 4096` fixo (`aiChat.ts:177`); temperatura nunca definida | Expor ambos na gaveta |
| 5 | Ajuda interativa / guia | **CUMPRE PARCIALMENTE** | `SUGGESTED_PROMPTS` com 3 exemplos (`ai-chat-widget.component.ts:28-32`) | Aumentar e contextualizar por página |

**Resultado: 1 cumprida, 3 parciais, 1 ausente.**

---

## Parte 3 — Optional medium

| # | Tarefa | Status | Evidência | Esforço | Valor |
|---|---|---|---|---|---|
| 1 | Token usage e custos | **NÃO CUMPRE** | `usage` do SDK nunca lido | médio | alto |
| 2 | Memória curta ou longa | **CUMPRE PARCIALMENTE** | curta no cliente (`component.ts:120`), perde-se no refresh; longa ausente | médio | alto |
| 3 | Uma ferramenta de API externa | **NÃO CUMPRE** | as 4 tools leem Postgres local | médio | alto |
| 4 | Autenticação e personalização | **NÃO CUMPRE** | 0 guards; prefs por browser, não por utilizador | grande | médio |
| 5 | Feedback loop | **NÃO CUMPRE** | sem UI e sem tabela | pequeno | alto |
| 6 | Duas tools extra / cinco no total | **CUMPRE PARCIALMENTE** | 4 declaradas, 3 funcionais | pequeno | médio |
| 7 | Activar/desactivar tools na UI | **NÃO CUMPRE** | objecto estático | médio | médio |
| 8 | Plugin system | **NÃO CUMPRE** | — | grande | baixo |
| 9 | Multi-model | **CUMPRE** | 4 provedores, 11 modelos, allowlist servidor | — | alto |
| 10 | Security guard | **CUMPRE** | 5 guards reais (ver 04) | — | alto |
| 11 | Developer settings separados da UX | **CUMPRE** | gaveta de definições isolada, só visível se houver >1 provedor (`ai-chat-widget.component.html:33`) | — | alto |

**Resultado: 3 cumpridas, 2 parciais, 6 ausentes.** O mínimo de 2 medium para bónus **já está
satisfeito**.

---

## Parte 4 — Optional hard

| # | Tarefa | Status | Lacuna | Esforço | Risco |
|---|---|---|---|---|---|
| 1 | Agentic RAG | **NÃO CUMPRE** | sem ingestão, chunking, embeddings, vector store ou recuperação; `pgvector` não instalado | grande | médio |
| 2 | Observabilidade de LLM | **NÃO CUMPRE** | sem traces, spans, latência, tokens ou custos | **médio** | baixo |
| 3 | Relatório de avaliação de IA | **NÃO CUMPRE** | sem casos, métricas ou dataset | **médio** | baixo |
| 4 | Agente aprende com feedback | **NÃO CUMPRE** | depende de (5) medium, que também falta | grande | alto |
| 5 | Fontes de dados externas | **NÃO CUMPRE** | nenhuma chamada a API de terceiros | médio | médio |

**Resultado: 0 cumpridas.** É aqui que o bónus se perde.

---

## Parte 5 — Critérios de avaliação

### Problem Definition

| Critério | Status | Evidência | Pergunta provável | Lacuna |
|---|---|---|---|---|
| Problema bem definido | CUMPRE PARCIALMENTE | prompt e domínio claros; nada escrito | "Que problema resolve?" | não documentado |
| App resolve o problema | **NÃO CUMPRE** hoje | ciclo não fecha | "Mostre-me a funcionar" | agente não responde |
| Utilidade | CUMPRE PARCIALMENTE | KPIs reais e correctos por trás | "É útil a quem?" | por documentar |
| Utilizadores-alvo | **NÃO CUMPRE** | não declarados | "Quem usa isto?" | inferível: gestor HSE |

### Understanding Core Concepts

| Critério | Status | Evidência | Lacuna |
|---|---|---|---|
| Princípios de agentes | CUMPRE PARCIALMENTE | tools + escolha do modelo | ciclo multi-passo desactivado |
| Diferenças entre tipos de agentes | **NÃO VERIFICADO** | sem documento de decisões | por escrever |
| Function calling | CUMPRE | `tool()` + Zod | 1 tool partida |
| Organização de código | CUMPRE | `routes/`, `ai/`, `db/`, `core/`, `shared/` | — |
| Erros e edge cases | CUMPRE PARCIALMENTE | try/catch no handler | nenhum nas tools; sem timeout |

### Technical Implementation

| Critério | Status | Evidência | Lacuna |
|---|---|---|---|
| Frontend | CUMPRE | Angular 18, build limpo | — |
| Knowledge base | NÃO SE APLICA | dados estruturados dispensam RAG (justificado em 02) | — |
| Segurança | CUMPRE PARCIALMENTE | 5 guards | sem auth, CORS aberto, sem anti-injecção |

### Reflection and Improvement

| Critério | Status | Lacuna |
|---|---|---|
| Problemas potenciais | **NÃO CUMPRE** | nenhum documento |
| Melhorias | **NÃO CUMPRE** | nenhum documento |
| Quando usar prompt engineering / RAG / agente | **NÃO CUMPRE** | análise existe agora em [`02`](02_TURING_TOOLS_AND_EQUIVALENCES.md) mas não é do projecto |

---

## Score indicativo (não oficial)

| Critério | Nota | Justificação |
|---|---|---|
| Problem Definition | **3 / 5** | O problema é real e o domínio é sólido, mas nada está documentado e o agente não demonstra a solução hoje |
| Understanding Core Concepts | **2 / 5** | Function calling correcto e código bem organizado, mas o conceito central — ciclo agentic — está desactivado e sem edge cases tratados nas tools |
| Technical Implementation | **2 / 5** | Frontend e segurança básica bons; zero testes, zero lint, zero CI, agente não operacional |
| Reflection and Improvement | **1 / 5** | Nenhuma reflexão escrita no repositório |
| Documentation | **2 / 5** | README bom para o sistema HSE, silencioso sobre IA |
| Optional Easy | **1** cumprida (de 5) | escolha de LLM |
| Optional Medium | **3** cumpridas (de 11) | multi-model, security guard, separação dev/UX |
| Optional Hard | **0** cumpridas (de 5) | — |
| **Bónus (2 medium + 1 hard)** | **não atingido** | medium ✅ · hard ❌ |

Estas notas são uma estimativa desta auditoria, não uma avaliação oficial, e **não constituem
previsão de aprovação**.

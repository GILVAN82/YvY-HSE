# 02 — Ferramentas sugeridas pela Turing e equivalências

> Premissa aplicada: **capacidades e resultados contam, nomes de bibliotecas não.** Streamlit,
> Next.js, LangChain e LangGraph não são tratados como obrigatórios quando a mesma capacidade
> existe noutra tecnologia.

## Ferramentas e conceitos sugeridos pela Turing

| Item | Como a Turing apresenta | YVY HSE usa? | Equivalente usado | Lacuna funcional | Evidência |
|---|---|---|---|---|---|
| Python | pré-requisito | não | TypeScript em toda a stack | nenhuma | `tsconfig.json` |
| TypeScript | pré-requisito | **sim** | — | nenhuma | fe 5.5 / be 5.9 |
| Streamlit | ferramenta sugerida (UI) | não | Angular 18 SPA | nenhuma — UI muito superior | `frontend/` |
| Next.js | ferramenta sugerida (UI) | não | Angular 18 SPA | nenhuma | `frontend/` |
| OpenAI API | ferramenta sugerida | configurado | `@ai-sdk/openai` + 3 outros | sem chave activa | `providers.ts:39` |
| LangChain | ferramenta sugerida | não | Vercel AI SDK 7 | nenhuma para o âmbito | `aiChat.ts:3` |
| LangGraph | ferramenta sugerida (orquestração) | não | `streamText` + `stopWhen` | **sim — `stopWhen` ausente** | `aiChat.ts:172` |
| Prompt engineering | tópico | **sim** | system prompt com regras | sem versionamento/testes | `aiChat.ts:11-19` |
| Function calling | tópico + requisito | **sim** | `tool()` + Zod | 1 de 4 tools partida | `aiChat.ts:21-104` |
| Short-term memory | tópico | parcial | `history` no cliente + corte a 30 | não persiste, sem resumo | `aiChat.ts:112,166` |
| Long-term memory | tópico | **não** | nenhum | total | 0 tabelas de IA |
| Human-in-the-loop | tópico | parcial | prompt read-only; tools sem escrita | sem aprovação explícita | `aiChat.ts:13` |
| State management | tópico | parcial | signals no cliente | sem estado do agente no servidor | `sidebar-state.service.ts` |
| Git | submissão | **NÃO** | nenhum | **bloqueante** | sem `.git` |
| GitHub | submissão | **NÃO** | nenhum | **bloqueante** | — |
| VS Code | tooling | sim | `.vscode/` presente | nenhuma | `frontend/.vscode` |
| Gemini | multi-model | configurado | `@ai-sdk/google` | sem chave | `providers.ts:50` |
| Anthropic | multi-model | configurado | `@ai-sdk/anthropic` | sem chave | `providers.ts:28` |
| Multi-model support | optional medium | **sim** | 4 provedores + allowlist | nenhuma | `providers.ts:27-72` |
| External APIs | optional medium/hard | **não** | as 4 tools só leem Postgres local | total | `aiChat.ts:33,51,83,98` |
| LangSmith | observabilidade | não | nenhum | total | — |
| Langfuse | observabilidade | não | nenhum | total | — |
| Ragas | avaliação | não | nenhum | total | — |
| DeepEval | avaliação | não | nenhum | total | — |
| RAG | tópico | **não** | consultas SQL determinísticas | ver nota | — |
| Agentic RAG | optional hard | **não** | nenhum | total | — |
| Autenticação | optional medium | **não** | nenhum | total | 0 `canActivate` |
| Personalização | optional medium | parcial | tema/idioma/sidebar por browser | não por utilizador | `localStorage` |
| Feedback loop | optional medium | **não** | nenhum | total | sem UI e sem tabela |
| Token usage | optional medium | **não** | `usage` do SDK não é lido | total | `aiChat.ts:180-188` |
| Cost tracking | optional medium | **não** | nenhum | total | — |
| Security guardrails | optional medium | **sim** | 5 guards distintos | ver 04 | `aiChat.ts:117,141,152` |
| Plugin/tool system | optional medium | **não** | tools fixas em objecto literal | total | `aiChat.ts:21` |

---

## Tabela de equivalências técnicas

| Capacidade exigida/sugerida | Ferramenta Turing | Tecnologia real YVY HSE | É equivalente? | Evidência | Lacuna |
|---|---|---|---|---|---|
| Interface de utilizador | Streamlit / Next.js | Angular 18 standalone, i18n 5 idiomas, tema duplo, sidebar de 2 níveis | **Sim — superior.** Streamlit não faz roteamento, i18n nem acessibilidade a este nível | `frontend/src/app` | nenhuma |
| Orquestração do agente | LangGraph / LangChain | Vercel AI SDK 7 `streamText` + `tool()` | **Parcialmente.** O SDK suporta o mesmo ciclo multi-passo via `stopWhen`; o projecto **não o activa**, logo hoje não há ciclo | `aiChat.ts:172`; `ai/dist/index.js:8412` | **ciclo de 1 passo** |
| Function calling | LangChain tools | `tool()` + `inputSchema` Zod | **Sim.** Schemas tipados, descrições orientadas ao modelo, validação automática de argumentos | `aiChat.ts:22-33` | 1 tool com SQL inválido |
| Memória curta | LangGraph checkpoints / LangChain memory | array `history` enviado pelo cliente, cortado a 30 turnos no servidor | **Parcialmente.** Cumpre o efeito de contexto conversacional, mas vive no cliente e evapora no refresh | `aiChat.ts:112,166-170` | sem persistência |
| Memória longa | vector store / LangChain memory | nenhuma | **Não** | 0 tabelas, sem `pgvector` | total |
| Gestão de estado | graph state | Angular signals (cliente) | **Não para o agente.** Os signals gerem a UI, não o estado da execução do agente | `sidebar-state.service.ts` | sem estado servidor |
| Observabilidade | LangSmith / Langfuse | nenhuma | **Não.** Nem sequer logging estruturado das chamadas | — | total |
| Avaliação | Ragas / DeepEval | nenhuma | **Não.** Zero testes de qualquer tipo | `ng test` falha TS18003 | total |
| Multi-model | OpenAI API | 4 provedores + allowlist servidor | **Sim — superior à sugestão**, que assume um único fornecedor | `providers.ts:86-111` | chaves por preencher |
| Guardrails | — | rate limit, limite de tamanho, allowlist de modelo, prompt read-only, SQL parametrizado | **Sim** | `aiChat.ts:117,141`; `providers.ts:106` | sem validação de output |

---

## Nota sobre RAG

O YVY HSE **não faz RAG e, para o problema actual, não precisa**. As perguntas que o agente
serve ("qual o TRIR do portfólio", "que acções estão atrasadas") são respondidas por agregação
determinística sobre dados estruturados — `computeKpi()` executa `SUM`/`COUNT` em SQL. Recuperar
os mesmos números por similaridade vectorial seria menos exacto e mais caro.

RAG passaria a fazer sentido se o agente tivesse de responder sobre o **conteúdo não estruturado**
que o sistema já regista: procedimentos, lições aprendidas, actas de reunião, registos de
Document Control. Essa é a extensão natural e é o caminho recomendado caso se pretenda a tarefa
hard de *agentic RAG*.

Distinção aplicada nesta auditoria:

- **Busca SQL** — o que existe hoje: consulta determinística com filtros.
- **RAG** — recuperação por semelhança sobre texto indexado, injectada no prompt. Ausente.
- **Agentic RAG** — o modelo decide *se*, *o quê* e *quantas vezes* recuperar. Ausente.

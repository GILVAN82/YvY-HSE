# 06 — Lacunas e roadmap priorizado

## P0 — Obrigatório antes da avaliação

| # | Acção | Requisito Turing | Ficheiro | Depende de | Critério de pronto | Esforço | Risco | Valor |
|---|---|---|---|---|---|---|---|---|
| P0-1 | Passar `stopWhen: stepCountIs(5)` ao `streamText` | Core Functionality | [`aiChat.ts:172`](../../backend/src/routes/aiChat.ts) | — | Pergunta sobre TRIR devolve texto com o número | **pequeno** (1 linha + import) | baixo | **crítico** |
| P0-2 | Corrigir SQL da tool `list_actions`: `description`→`action_description`, `responsible`→`responsible_person` | Core Functionality | `aiChat.ts:84` | — | "quais acções estão atrasadas" devolve linhas | **pequeno** | baixo | **crítico** |
| P0-3 | `git init`, primeiro commit, publicar no GitHub | Submissão | raiz | `.gitignore` já correcto | repositório público com histórico e sem `.env` | **pequeno** | baixo | **crítico** |
| P0-4 | Documentar o agente no README | Documentation | `README.md` | — | problema, utilizadores, arquitectura, tools, limitações, como pôr uma chave | **médio** | baixo | **crítico** |
| P0-5 | Configurar pelo menos uma chave de LLM e validar fim-a-fim | Core Functionality | `backend/.env` | P0-1, P0-2 | conversa real gravada em screenshot/GIF | **pequeno** | baixo | **crítico** |

**Sem os cinco, o agente não pode ser demonstrado.** P0-1 e P0-2 somados são menos de dez linhas.

---

## P1 — Importante para cumprir bem

| # | Acção | Requisito | Ficheiro | Critério de pronto | Esforço | Valor |
|---|---|---|---|---|---|---|
| P1-1 | `try/catch` dentro de cada `execute` de tool, devolvendo erro estruturado ao modelo | Erros e edge cases | `aiChat.ts:21-104` | BD em baixo → agente explica, não rebenta | pequeno | alto |
| P1-2 | `timeout` no `streamText` e mensagem de expiração | Erros e edge cases | `aiChat.ts:172` | pedido pendurado termina em ≤30s | pequeno | alto |
| P1-3 | Testes do agente: schemas das tools, guards, SQL das tools contra a BD | Technical Implementation | novo `backend/src/**/*.test.ts` | suite corre em CI e apanha o bug do P0-2 | médio | alto |
| P1-4 | Instrução anti-prompt-injection no system prompt | Segurança | `aiChat.ts:11-19` | dados com instruções embutidas são ignorados | pequeno | alto |
| P1-5 | Restringir CORS à origem do frontend | Segurança | `index.ts:10` | origem estranha recebe 403 | pequeno | médio |
| P1-6 | Documento de reflexão: limitações, riscos, quando usar prompt/RAG/agente | Reflection and Improvement | `docs/` | responde aos 3 pontos do critério | médio | alto |
| P1-7 | Verificar disponibilidade real do Ollama em vez de assumir | Correcção | `providers.ts:76-78` | `available:false` quando o serviço não responde | pequeno | médio |

---

## P2 — Bónus e qualidade

| # | Acção | Tarefa Turing | Esforço | Valor |
|---|---|---|---|---|
| P2-1 | **Observabilidade própria**: persistir por pedido — modelo, tokens (`usage`), latência, tools chamadas, erro | **hard #2** | médio | **muito alto** |
| P2-2 | **Relatório de avaliação**: 15-20 perguntas com resposta esperada, medir exactidão numérica e uso correcto de tool | **hard #3** | médio | **muito alto** |
| P2-3 | Feedback 👍/👎 com tabela e associação à resposta | medium #5 | pequeno | alto |
| P2-4 | Expor temperatura e max tokens na gaveta | easy #4 | pequeno | médio |
| P2-5 | Persistir conversas por sessão no Postgres | medium #2 | médio | alto |
| P2-6 | Uma tool de API externa (ex.: meteorologia para planeamento de trabalhos em altura) | medium #3 | médio | alto |
| P2-7 | Activar/desactivar tools na UI | medium #7 | médio | médio |
| P2-8 | Persona nomeada e consistente | easy #2 | pequeno | baixo |

---

## P3 — Evolução futura

| # | Acção | Esforço | Nota |
|---|---|---|---|
| P3-1 | Autenticação + isolamento por utilizador | grande | Desbloqueia memória longa e personalização reais |
| P3-2 | **Agentic RAG** sobre Document Control, lições aprendidas e actas | grande | Exige `pgvector` ou store externo; ver justificação em [`02`](02_TURING_TOOLS_AND_EQUIVALENCES.md) |
| P3-3 | Agente aprende com feedback | grande | Depende de P2-3 |
| P3-4 | Plugin system para tools | grande | Baixo retorno no âmbito da sprint |
| P3-5 | CI/CD e Docker Compose | médio | Facilita a revisão externa |

---

## Caminho mínimo para submissão

```
P0-1  fechar o ciclo agentic        (1 linha)
P0-2  corrigir list_actions          (2 nomes de coluna)
P0-3  git init + GitHub
P0-4  documentar o agente no README
P0-5  configurar uma chave e gravar a demonstração
```

Estimativa: **meio dia**, dominado pela escrita da documentação.

## Caminho recomendado para bónus

As **três medium já estão cumpridas** — multi-model, security guard e separação entre definições
de programador e experiência do utilizador. Não é preciso construir nada para o mínimo de duas;
**é preciso documentá-las**, porque nada no repositório as declara.

Falta **uma hard**. Recomendação por ordem de custo/benefício:

1. **P2-1 Observabilidade própria** — o AI SDK já entrega `usage` e `onFinish`; existe Postgres
   para persistir; uma tabela e um painel simples cumprem o requisito. A Turing aceita solução
   própria em vez de LangSmith/Langfuse.
2. **P2-2 Relatório de avaliação** — não exige código de produção. Um conjunto de perguntas com
   resposta conhecida (os KPIs são determinísticos, portanto o *ground truth* é calculável a
   partir da própria BD) e a medição de exactidão numérica e escolha de tool.

Fazer **as duas** custa pouco mais do que uma e cobre dois requisitos hard, além de alimentar
directamente o critério "Reflection and Improvement".

---

## Resumo das lacunas por severidade

| Severidade | Lacuna | Impacto |
|---|---|---|
| **Bloqueante** | Sem repositório Git | Impossível submeter |
| **Bloqueante** | Ciclo agentic não fecha | Agente não responde |
| **Alta** | `list_actions` partida | 1 de 4 tools falha |
| **Alta** | Sem provedor configurado | Não demonstrável |
| **Alta** | Documentação de IA inexistente | Critério vazio |
| **Alta** | Zero testes | Critério técnico penalizado |
| **Média** | Sem observabilidade / avaliação | Bónus hard perdido |
| **Média** | Sem tratamento de erro nas tools | Edge cases |
| **Média** | Sem anti-prompt-injection | Dados editáveis chegam ao modelo |
| **Baixa** | CORS aberto, sem lint, sem CI | Qualidade |

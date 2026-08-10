# 00 — Resumo executivo

**Projeto:** YVY HSE
**Data da auditoria:** 2026-08-04
**Tipo:** auditoria de leitura. Nenhum ficheiro da aplicação foi alterado.
**Escopo:** comparação do estado real do repositório com a Turing College — Sprint 3: AI Agents.

---

## Classificação do agente

**B — Agente funcional básico, actualmente NÃO OPERACIONAL.**

O projeto tem um agente real, não um mock: `streamText` do Vercel AI SDK v7 com quatro
ferramentas declaradas via `tool()` e schemas Zod, streaming SSE, quatro provedores de LLM
e allowlist de modelos no servidor. O modelo decide autonomamente que ferramenta chamar.

Não é classificado como A porque **três defeitos impedem-no de funcionar de ponta a ponta**:

1. **O ciclo agentic não fecha.** `streamText` é chamado sem `stopWhen`, e o padrão do SDK é
   `stepCountIs(1)`. O modelo executa a ferramenta e para — o resultado nunca lhe volta, logo
   nunca há resposta em texto. Provado empiricamente (ver 09).
2. **Uma das quatro ferramentas está partida.** `list_actions` consulta colunas que não existem
   na tabela; produz erro SQL em execução. Confirmado contra a base real.
3. **Nenhum provedor está utilizável.** As três chaves cloud estão vazias e o Ollama local não
   responde, portanto o agente não pode sequer ser executado neste momento.

---

## Pontos fortes

1. **Function calling genuíno e bem desenhado** — quatro ferramentas com `description` orientada
   ao modelo, `inputSchema` Zod com limites (`min`/`max`/`default`), e SQL parametrizado.
2. **Multi-model real com allowlist no servidor** — Anthropic, OpenAI, Google e Ollama; o cliente
   nunca recebe chaves e não pode injectar um model id arbitrário em provedores cloud.
3. **Frontend maduro** — Angular 18 standalone, sidebar de dois níveis, i18n em 5 idiomas,
   tema claro/escuro, acessibilidade trabalhada, build de produção limpo.

---

## Lacunas principais

1. **O repositório não está sob controlo de versão** — não existe `.git`. A submissão da Turing
   exige GitHub. É o bloqueio número um.
2. **Ciclo agentic não fecha** — o agente não responde quando usa ferramentas.
3. **Zero testes** — `ng test` falha com `TS18003` por não existir nenhum ficheiro `.spec.ts`.
4. **Zero documentação do agente** — o README descreve o sistema HSE mas não menciona
   arquitectura de IA, prompts, ferramentas, memória ou limitações.
5. **Nenhuma tarefa hard cumprida** — sem RAG, observabilidade de LLM, relatório de avaliação,
   aprendizagem por feedback ou fontes externas.

---

## Prontidão para avaliação

**NÃO PRONTO.** Com o estado actual, um revisor que abrisse o chat e fizesse uma pergunta sobre
KPIs não receberia resposta nenhuma.

| Bloco | Situação |
|---|---|
| Requisitos principais (5) | 0 CUMPRE · 4 CUMPRE PARCIALMENTE · 1 NÃO CUMPRE |
| Optional easy | 1 implementada · 3 parciais · 1 ausente |
| Optional medium | **3 implementadas** · 2 parciais · 6 ausentes |
| Optional hard | **0 implementadas** |
| Bónus (2 medium + 1 hard) | medium ✅ · hard ❌ |

---

## Caminho mínimo para submeter

Quatro acções, todas de esforço pequeno a médio:

1. **P0 — Fechar o ciclo agentic**: passar `stopWhen: stepCountIs(5)` a `streamText`.
   Uma linha em [`aiChat.ts:172`](../../backend/src/routes/aiChat.ts).
2. **P0 — Corrigir a tool `list_actions`**: `description` → `action_description`,
   `responsible` → `responsible_person`.
3. **P0 — Inicializar o repositório Git** e publicar no GitHub com `.env` fora do controlo.
4. **P0 — Documentar o agente** no README: problema, utilizadores, arquitectura, ferramentas,
   limitações e como configurar uma chave de LLM.

Sem uma chave de provedor configurada, nenhum revisor consegue ver o agente a funcionar.

## Caminho recomendado para bónus

As **3 medium já estão cumpridas** (multi-model, security guard, separação developer settings/UX).
Falta **1 hard**. A de menor esforço é **observabilidade de LLM com solução própria**: o SDK já
expõe `usage` e `onFinish`, e existe uma base Postgres onde persistir. Custo estimado: médio.
A alternativa é o **relatório de avaliação de IA**, que não exige código de produção — apenas um
conjunto de casos e a medição das respostas.

---

Índice dos restantes relatórios em [`06_GAP_AND_ROADMAP.md`](06_GAP_AND_ROADMAP.md) e detalhe
técnico do agente em [`04_AI_AGENT_TECHNICAL_AUDIT.md`](04_AI_AGENT_TECHNICAL_AUDIT.md).

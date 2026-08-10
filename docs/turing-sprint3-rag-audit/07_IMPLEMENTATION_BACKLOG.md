# 07 — Backlog de implementação

> **Nada aqui foi executado.** Propostas para sprints futuras, sujeitas a autorização.

---

## Decisão que precede o backlog

O inventário conclui que **RAG não é viável com o conteúdo actual** — 4 616 caracteres, ~7
chunks, nove fontes com um único registo. Antes de planear sprints, é preciso escolher entre:

| Caminho | Descrição | Honestidade | Valor para a Sprint 3 |
|---|---|---|---|
| **A** | Não fazer RAG. Documentar a decisão técnica e cumprir outra tarefa hard | ✅ | **Alto** — a justificação é ela própria avaliada |
| **B** | Construir a capacidade documental primeiro (upload), depois RAG sobre documentos reais | ✅ | Alto, mas fora do prazo |
| **C** | Gerar conteúdo HSE para encher o índice | ❌ Proibido | Negativo — indefensável numa review |

**Recomendação: A agora, B como evolução.** O backlog abaixo reflecte essa ordem.

---

## Sprint 2 — Fechar o agente e provar que funciona *(recomendada a seguir)*

Não tem RAG. Corrige o que impede o agente de responder e cumpre uma tarefa hard sem depender
de conteúdo documental.

| # | Item | Porquê | Ficheiro | Esforço | Critério de pronto |
|---|---|---|---|---|---|
| 2.1 | `stopWhen: stepCountIs(5)` no `streamText` | Sem isto o agente executa a tool e **não responde** | `backend/src/routes/aiChat.ts:172` | pequeno | Pergunta sobre TRIR devolve 51,95 em texto |
| 2.2 | Corrigir SQL da tool `list_actions` | 1 de 4 tools falha em execução | `aiChat.ts:84` | pequeno | "Que acções estão atrasadas" devolve as 8 |
| 2.3 | Estender o `SYSTEM_PROMPT` à recusa documental | Hoje só proíbe inventar **números**; falta proibir inventar **procedimentos** | `aiChat.ts:11-19` | pequeno | As 5 perguntas de recusa de [`05`](05_RAG_TEST_QUESTIONS.md) são recusadas |
| 2.4 | **Relatório de avaliação de IA** (tarefa hard) | As 10 perguntas SQL têm *ground truth* calculável da própria base — medição objectiva, sem julgamento humano | novo `docs/` + script | médio | Relatório com exactidão numérica e escolha correcta de tool por pergunta |
| 2.5 | **Observabilidade própria** (tarefa hard alternativa) | O SDK já expõe `usage` e `onFinish`; há Postgres para persistir | `aiChat.ts` + 1 tabela | médio | Tokens, latência, modelo e tools registados por pedido |

**Resultado:** agente funcional + 1 ou 2 tarefas hard. Somado às 3 medium já cumpridas
(multi-model, security guard, separação developer/UX), o bónus fica atingido **sem RAG**.

---

## Sprint 3 — Capacidade documental *(pré-requisito real do RAG)*

O bloqueio do RAG não é o vector store — é não haver documentos. Esta sprint cria a capacidade.

| # | Item | Esforço | Dependências |
|---|---|---|---|
| 3.1 | Endpoint de upload com validação de tipo, tamanho e antivírus | médio | — |
| 3.2 | Armazenamento de ficheiros + tabela `documents` (metadados, versão, projecto, sensibilidade) | médio | 3.1 |
| 3.3 | Ligar `document_control` aos ficheiros reais | pequeno | 3.2 |
| 3.4 | Extracção de texto (PDF, DOCX) | médio | 3.2 |
| 3.5 | **Autenticação** — sem utilizadores não há a quem restringir o índice | grande | — |

**Sem 3.1–3.4 não há corpus. Sem 3.5 não há controlo de acesso ao corpus.** Ambos são
pré-requisitos, não melhorias.

---

## Sprint 4 — RAG, quando houver conteúdo

Executar **apenas** se o corpus ultrapassar um limiar defensável. Proposta: **≥ 50 000
caracteres** de texto documental real, ou ≥ 30 documentos. Abaixo disso, incluir tudo no prompt
continua a ser melhor e mais barato.

| # | Item | Esforço | Nota |
|---|---|---|---|
| 4.1 | `pgvector` no Postgres existente | pequeno | Evita nova infraestrutura |
| 4.2 | Pipeline de ingestão: parsing → chunking → embeddings | médio | Formato já definido em [`04`](04_DOCUMENT_FORMAT_AND_METADATA.md) |
| 4.3 | Recuperação com filtro obrigatório por `project_code` e `sensitivity` | médio | Filtro antes da semelhança, não depois |
| 4.4 | Citações com `source_module` + `record_id`, ligadas a `/sheet/<aba>` | pequeno | A rota já existe |
| 4.5 | **Agentic RAG** — o modelo decide se e quantas vezes recupera | médio | Tarefa hard |
| 4.6 | Avaliação de recuperação: groundedness e atribuição de fonte | médio | Estende 2.4 |

**Regra de exclusão a implementar antes de qualquer indexação:** os 16 campos EXCLUDE de
[`06`](06_GAPS_PRIVACY_AND_LIMITATIONS.md) nunca entram no `pageContent`. A filtragem acontece
na construção do documento — um embedding não se apaga selectivamente.

---

## O que NÃO fazer

| Item | Porquê |
|---|---|
| Indexar as 30 linhas actuais | 4 616 caracteres. Recuperar 4 de 7 chunks é ruído; o prompt inteiro é mais barato e mais completo |
| Gerar procedimentos, SDS ou planos de emergência | Proibido pelo prompt e perigoso — um LOTO inventado é risco de vida |
| Indexar `document_control` | Guarda nomes de documentos, não o seu conteúdo |
| RAG para KPIs | `computeKpi()` é exacto; o embedding seria aproximado |
| Vector store externo | O Postgres com `pgvector` chega para esta escala |

---

## Critério de reavaliação

Refazer este inventário quando **qualquer** condição se verificar:

1. Corpus documental ≥ 50 000 caracteres de texto real;
2. `investigation_rca` deixar de estar vazia (é a melhor fonte potencial — causas-raiz são
   conhecimento reutilizável, ao contrário de entradas de registo);
3. Upload de ficheiros em produção com ≥ 30 documentos carregados;
4. Autenticação activa, permitindo controlo de acesso por sensibilidade.

Enquanto nenhuma se verificar, a resposta correcta à pergunta *"porque não há RAG?"* é a que
está em [`03_RAG_COLLECTIONS.md`](03_RAG_COLLECTIONS.md) — com os números.

---

## Estimativa

| Sprint | Esforço | Desbloqueia |
|---|---|---|
| 2 — fechar o agente + 1 hard | **1–2 dias** | Submissão viável com bónus |
| 3 — capacidade documental | 1–2 semanas | Pré-requisito do RAG |
| 4 — RAG e agentic RAG | 1 semana | Tarefa hard adicional |

**A Sprint 2 sozinha resolve a avaliação da Turing.** As Sprints 3 e 4 são produto, não requisito.

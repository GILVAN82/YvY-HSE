# 00 — Resumo executivo do inventário de RAG

**Sprint 1 — inventário e plano.** Modo somente leitura. Nenhum ficheiro da aplicação foi
alterado, nenhuma dependência instalada, nenhuma tabela criada ou modificada, nenhum conteúdo
externo introduzido.

---

## Conclusão

# RAG NÃO VIÁVEL com o conteúdo actual.

Não por falha de arquitectura, mas por **falta de matéria-prima**. O sistema tem dados de
excelente qualidade — só que são quase todos estruturados, e o pouco texto livre que existe é
curto demais para justificar recuperação semântica.

### O número que decide

| Fonte | Caracteres de texto livre |
|---|---|
| Todas as 18 fontes aprovadas, na base de dados | **2 679** |
| Módulo Instructions (35 descrições de uma linha) | **1 937** |
| **Total do corpus candidato** | **≈ 4 616** |

Cerca de **página e meia de texto**. Com o tamanho de chunk habitual (500–1000 caracteres), o
corpus inteiro dá **5 a 9 chunks**. Recuperar 4 de 9 chunks por semelhança vectorial é
mensuravelmente pior do que colocar os 9 no prompt — que é o que um agente sem RAG já faria.

O campo de texto mais longo de todo o sistema tem **63 caracteres**:

> "Complete pre-start review for temporary generator change."

Comando de verificação e detalhe por coluna em [`01_SOURCE_MAPPING.md`](01_SOURCE_MAPPING.md).

---

## Estado das 18 fontes aprovadas

| Estado | Nº | Fontes |
|---|---|---|
| **Não utilizável — sem dados** | 1 | Investigation & RCA (**0 registos**) |
| **Não utilizável — sem texto** | 3 | Chemical Inventory & MSDS, Document Control, Emergency Preparedness (contactos) |
| **Utilizável com restrições severas** — 1 registo apenas | 9 | HIRA, JSA Log, JSA Steps, Toolbox Talks, Meeting Minutes, MOC, Spill, Legal Compliance, Change Log |
| **Utilizável com restrições** — vários registos, texto curto | 5 | Incident Register (11), Action Tracker (9), Audit Tracker (12), Audit Findings (2), Safety Observations (2) |
| **Utilizável** | 1 | Instructions (35 descrições) — mas é conteúdo de UI, não conhecimento HSE |

Nove das dezoito fontes têm **exactamente um registo**. Um índice vectorial sobre um único
registo de HIRA não é recuperação — é uma consulta com passos extra.

---

## As quatro coleções propostas

| Coleção | Veredicto | Porquê |
|---|---|---|
| `system_instructions` | **Viável como prompt, não como RAG** | 1 937 caracteres cabem inteiros no system prompt. Indexar seria overhead puro. |
| `emergency_guidance` | **Não viável** | 6 linhas de acção imediata, média de 53 caracteres. O plano de emergência real (ERP-FIRE, etc.) não existe como documento. |
| `operational_knowledge` | **Não viável hoje** | ~2 000 caracteres dispersos por 13 tabelas, nove delas com um registo. |
| `document_metadata` | **Viável — mas é SQL, não RAG** | São filtros exactos sobre campos estruturados. `WHERE status='Expired'` responde melhor do que qualquer embedding. |

---

## O que isto significa para a Sprint 3 da Turing

O requisito hard *agentic RAG* **não pode ser cumprido honestamente** com os dados actuais.
Fabricar procedimentos, SDS ou planos de emergência para encher um índice seria inventar
conteúdo HSE — expressamente proibido neste prompt e indefensável numa review.

**A boa notícia:** o agente já responde às perguntas que este domínio realmente faz, e responde
melhor sem RAG. "Qual o TRIR do PRJ-003" é `SUM`/`COUNT` sobre sete tabelas — determinístico e
exacto. Recuperação semântica daria um número aproximado ou o pedaço de texto errado.

Esta é uma decisão técnica defensável e vale mais numa review do que um RAG decorativo. Está
articulada em [`06_GAPS_PRIVACY_AND_LIMITATIONS.md`](06_GAPS_PRIVACY_AND_LIMITATIONS.md).

---

## Caminhos possíveis (nenhum executado nesta sprint)

| Opção | O que exige | Honestidade | Esforço |
|---|---|---|---|
| **A. Não fazer RAG.** Documentar a decisão e cumprir outra tarefa hard (observabilidade ou relatório de avaliação) | Nada de novo | ✅ Total | pequeno |
| **B. RAG sobre documentos reais** que a empresa venha a carregar | Upload de ficheiros, parsing, chunking, embeddings, vector store | ✅ Total, quando houver documentos | grande |
| **C. Encher o índice com conteúdo gerado** | — | ❌ Proibido e indefensável | — |

Recomendação: **A**, com **B** declarada como evolução. Detalhe em
[`07_IMPLEMENTATION_BACKLOG.md`](07_IMPLEMENTATION_BACKLOG.md).

---

## Nota sobre a planilha

O prompt pede `HSE_Management_System(2).xlsx`. Esse ficheiro **não existe**. Foi analisado o
único correspondente encontrado: `C:\Users\Gil\Downloads\HSE_Management_System.xlsx`,
com 41 abas.

A planilha tem 1 277 strings partilhadas e apenas **4 com mais de 120 caracteres** — todas
sobre operação do próprio Excel (protecção de folha, funções dinâmicas, como adicionar um
projecto), não sobre HSE. Confirma o mesmo diagnóstico: o sistema é uma máquina de cálculo,
não um repositório documental.

---

## Documentos desta auditoria

| Ficheiro | Conteúdo |
|---|---|
| [`01_SOURCE_MAPPING.md`](01_SOURCE_MAPPING.md) | Aba → tabela → rota → página, contagens e campos |
| [`02_SQL_VS_RAG_CLASSIFICATION.md`](02_SQL_VS_RAG_CLASSIFICATION.md) | Cada campo como SQL ONLY / RAG CANDIDATE / METADATA ONLY / EXCLUDE |
| [`03_RAG_COLLECTIONS.md`](03_RAG_COLLECTIONS.md) | Validação das 4 coleções |
| [`04_DOCUMENT_FORMAT_AND_METADATA.md`](04_DOCUMENT_FORMAT_AND_METADATA.md) | Formato documental proposto (não implementado) |
| [`05_RAG_TEST_QUESTIONS.md`](05_RAG_TEST_QUESTIONS.md) | 30 perguntas de teste |
| [`06_GAPS_PRIVACY_AND_LIMITATIONS.md`](06_GAPS_PRIVACY_AND_LIMITATIONS.md) | Lacunas, privacidade, LOTO |
| [`07_IMPLEMENTATION_BACKLOG.md`](07_IMPLEMENTATION_BACKLOG.md) | Backlog das próximas sprints |

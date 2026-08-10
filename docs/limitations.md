# Limitações conhecidas

Estado após a Parte 1 (inserção do LangGraph). Nada aqui é aspiracional — descreve o que
**não** existe hoje.

## Não implementado

| Área | Estado | Consequência |
|---|---|---|
| **Autenticação** | Ausente | Sem utilizadores, papéis ou sessões |
| **RBAC / multi-tenant** | Ausente | Sem isolamento de dados por utilizador ou organização |
| **Memória persistente** | Ausente | A conversa vive no cliente e evapora ao recarregar |
| **Human-in-the-loop** | Ausente | Sem aprovação para ações; hoje irrelevante, porque nenhuma tool escreve |
| **RAG** | Ausente | Ver [`turing-sprint3-rag-audit/`](turing-sprint3-rag-audit/00_RAG_EXECUTIVE_SUMMARY.md) |
| **Observabilidade** | Ausente | Tokens, latência e custos não são registados |
| **Avaliação de IA** | Ausente | Sem dataset nem métricas de qualidade de resposta |
| **Feedback** | Ausente | Sem 👍/👎 e sem persistência |
| **Ferramenta externa** | Ausente | As quatro tools leem apenas o Postgres local |

## Implementado com ressalvas

### `MemorySaver` é volátil

O checkpointer do LangGraph existe para desenvolvimento e testes. Vive na heap do processo:
**não sobrevive a um restart, não é partilhado entre instâncias e não permite retomar uma
execução.** Não é memória persistente. Por omissão o runner corre **sem** checkpointer.
O checkpointer Postgres é fase posterior.

### Endpoints de escrita bloqueados, não protegidos

Como não há autenticação, `POST`/`PUT`/`DELETE` respondem **403** salvo se
`ALLOW_UNAUTHENTICATED_WRITES=true`. Isto é um **travão, não um modelo de permissões**:
quando activado, fica aberto a qualquer chamador. É uma medida temporária até existir
autenticação real.

### CORS não é autenticação

A allowlist impede que uma página noutra origem use a API a partir de um browser. Não impede
`curl`, nem substitui autenticação.

### O `verify` é estrutural

Verifica que há resposta, que o limite de passos foi respeitado e que nenhuma ferramenta
falhou. **Não verifica se a resposta está correcta ou fundamentada** — isso exige uma segunda
chamada ao modelo ou verificação contra fontes, e pertence à fase de RAG.

### Guard de injecção é baseado em padrões

Bloqueia formulações conhecidas que pedem o prompt de sistema, chaves ou mudança de persona.
É deliberadamente estreito para não bloquear perguntas HSE legítimas — "quais os procedimentos
de trabalho em altura registados?" tem de passar. Um atacante determinado com uma formulação
nova pode contorná-lo; a defesa de fundo é o prompt de sistema e o facto de **nenhuma tool
escrever**.

### Prompt injection indirecta

Os dados HSE são editáveis pelos utilizadores. Um campo de texto — a descrição de um incidente,
por exemplo — pode conter instruções e será devolvido ao modelo por uma tool. O prompt instrui
o modelo a tratar resultados como dados, nunca como instruções, mas isto **não está testado**
com um modelo real.

## Dependências e segurança

- `npm audit` no backend reporta **3 vulnerabilidades** (1 baixa, 2 altas) em
  `body-parser`, `brace-expansion` e `ip-address`. **Todas pré-existentes**, provenientes de
  `express` e `express-rate-limit` — nenhuma vem do LangGraph. Não foram corrigidas nesta fase
  porque `npm audit fix` alteraria dependências fora do âmbito.
- `langsmith@0.8.9` entrou como dependência **transitiva** de `@langchain/core`. Não é
  utilizada e fica inerte sem `LANGCHAIN_TRACING_V2`.

## Estado do agente sem provedor

As três chaves cloud estão vazias e o Ollama local não responde. Nesse estado o endpoint
devolve **503 `AI_PROVIDER_UNAVAILABLE`** — não uma resposta vazia nem sucesso simulado.
Para ver o agente a funcionar é preciso configurar uma chave em `backend/.env`.

## Testes

37 testes cobrem o grafo, o guard, os dois orquestradores, a configuração e o SQL das tools,
todos com **modelo simulado** — não precisam de chave nem de rede. Não há testes E2E de
browser, nem testes contra um LLM real, nem testes de carga.

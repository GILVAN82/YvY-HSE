# 07 — Preparação para a review

Cada resposta é sustentada **apenas** pelo estado real do repositório. Onde o projecto não
sustenta uma afirmação, isso está dito.

---

### "Que problema o agente resolve?"

**Resposta sustentável:** os dados de HSE estão dispersos por 35 abas e mais de 30 tabelas.
Responder a "qual o TRIR do PRJ-003" exige cruzar sete tabelas — `manpower_log`,
`incident_register`, `settings` e outras — e é isso que `computeKpi()` faz
([`kpi.ts:19-134`](../../backend/src/routes/kpi.ts)). O agente expõe essa agregação em linguagem
natural.

**Não afirmar:** que o agente já poupa tempo a alguém. Não há utilizadores, nem métricas, nem
sequer uma chave de LLM configurada.

---

### "Porquê um agente e não apenas prompt engineering?"

**Resposta sustentável:** os números vivem numa base de dados que muda. Um prompt fixo teria de
levar os dados embutidos e ficaria desactualizado à primeira inserção. As quatro tools
([`aiChat.ts:21-104`](../../backend/src/routes/aiChat.ts)) consultam a base no momento do pedido,
e o modelo escolhe qual usar consoante a pergunta.

**Não afirmar:** que o agente executa planos de vários passos. Hoje não executa — ver a pergunta
sobre arquitectura.

---

### "Porquê não apenas RAG?"

**Resposta sustentável:** as perguntas são agregações determinísticas sobre dados estruturados.
`SUM(total_manhours)` dá o número certo; recuperação por semelhança daria um número aproximado
ou o pedaço de texto errado. RAG passaria a fazer sentido para o conteúdo não estruturado que o
sistema também guarda — procedimentos, lições aprendidas, actas — e essa é a extensão planeada.

---

### "Descreva a arquitectura."

**Resposta sustentável:** widget Angular → `POST /api/ai/chat` → rate limit → validação de
tamanho → `resolveModel()` com allowlist no servidor → `streamText` com system prompt e quatro
tools → Postgres → SSE de volta ao cliente. Diagrama em
[`04`](04_AI_AGENT_TECHNICAL_AUDIT.md).

**Dizer também, sem esperar que perguntem:** o ciclo de múltiplos passos não está activo — falta
`stopWhen`. É um defeito conhecido e corrigido numa linha. É melhor apresentá-lo como defeito
identificado do que ser apanhado a demonstrar.

---

### "Como funciona o function calling?"

**Resposta sustentável:** `tool()` do Vercel AI SDK com `inputSchema` em Zod. Cada tool tem uma
`description` escrita para orientar a escolha do modelo e limites nos argumentos
(`limit` entre 1 e 50, `month` entre 0 e 11 ou `'*'`). A validação dos argumentos é feita pelo
SDK a partir do schema, e todo o SQL é parametrizado.

**Não afirmar:** que as quatro tools funcionam. `list_actions` referencia colunas inexistentes e
falha em execução.

---

### "Como gere memória e estado?"

**Resposta sustentável:** memória curta existe — o cliente envia o histórico e o servidor corta
aos últimos 30 turnos ([`aiChat.ts:112,166`](../../backend/src/routes/aiChat.ts)).

**Não afirmar:** memória longa, persistência entre sessões ou estado do agente no servidor.
Nenhum existe; a conversa desaparece ao recarregar a página.

---

### "Que segurança implementou?"

**Resposta sustentável, com cinco itens concretos:** rate limit de 20/min; limite de 4000
caracteres por mensagem; allowlist de modelos no servidor para o cliente não poder pedir um
modelo arbitrário; chaves nunca enviadas ao cliente (`listProvidersForClient()` devolve só
`available`); SQL parametrizado em todo o lado. Além disso, o system prompt declara o agente
consultivo e **nenhuma tool escreve** — não há caminho para o modelo alterar dados.

**Não afirmar:** autenticação, autorização, isolamento por utilizador, defesa contra prompt
injection ou validação do output. CORS está aberto a qualquer origem.

---

### "Como trata erros e edge cases?"

**Resposta sustentável:** validação de entrada antes de chamar o modelo; `try/catch` em torno do
streaming com evento `error` para o cliente; o cliente distingue falha de rede, erro do servidor
e erro no stream; o SDK repete até 2 vezes por omissão.

**Não afirmar:** robustez. Não há `try/catch` dentro das tools, não há timeout, não há fallback
entre modelos, e não existe um único teste.

---

### "Que testes tem?"

**Resposta honesta:** nenhum. `ng test` falha com `TS18003` porque não existe qualquer ficheiro
`.spec.ts`. A validação até hoje foi manual e por scripts de browser fora do repositório.
É a lacuna técnica mais visível.

---

### "Porquê Angular e não Streamlit ou Next.js?"

**Resposta sustentável:** o agente é uma funcionalidade dentro de um sistema HSE que já existe,
com 41 rotas, 5 idiomas, dois temas e navegação de dois níveis. Streamlit não suporta esse
âmbito. A escolha não foi entre frameworks de chat — foi integrar o agente no produto onde os
dados vivem.

---

### "Porquê não LangGraph ou LangChain?"

**Resposta sustentável:** o backend já é TypeScript, e o Vercel AI SDK dá tool calling tipado
com Zod, streaming e troca de provedor sem camada adicional. Para quatro tools de leitura, um
grafo de estados seria peso sem retorno.

**Reconhecer:** o SDK oferece o mesmo ciclo multi-passo via `stopWhen`, e o projecto ainda não o
activou. A equivalência existe; o uso é que está incompleto.

---

### "Que tarefas opcionais cumpriu?"

**Resposta sustentável:** três medium — multi-model com quatro provedores e allowlist no
servidor; pelo menos um security guard (há cinco); e separação entre definições de programador e
experiência do utilizador, com a gaveta de provedor/modelo isolada e só visível quando há mais
do que uma opção.

**Não afirmar:** qualquer tarefa hard. Nenhuma está feita.

---

### "Quais são as limitações?"

**Resposta honesta e completa:** o ciclo agentic não fecha; uma das quatro tools falha; não há
autenticação, memória longa, RAG, observabilidade, avaliação nem feedback; nenhum teste; e o
agente não corre sem uma chave de LLM configurada.

Apresentar isto de forma estruturada é mais forte do que ser descoberto — e alimenta
directamente o critério *Reflection and Improvement*, que hoje é a nota mais baixa do projecto.

---

## Riscos da review

| Momento | Risco | Mitigação |
|---|---|---|
| Demonstração ao vivo | O agente não responde | Corrigir P0-1 e P0-2 **antes** |
| "Mostre o repositório" | Não existe Git | P0-3 |
| "Onde está a documentação do agente?" | README não o menciona | P0-4 |
| "Corra os testes" | `ng test` falha | Ou criar testes (P1-3), ou declarar a ausência de imediato |
| "Pergunte sobre acções atrasadas" | Tool partida | P0-2 |

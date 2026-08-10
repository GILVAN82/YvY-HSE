# 09 — Comandos executados e resultados

Todos os comandos são de diagnóstico ou leitura. Nenhum `--fix`, nenhuma instalação, nenhuma
alteração à base de dados ou ao `.env`.

---

## Typecheck do backend

```text
Comando:
cd backend && npx tsc -p . --noEmit

Resultado:
PASS

Duração:
~3,4 s

Resumo:
Sem erros de tipo. Exit code 0.
```

## Build de produção do frontend

```text
Comando:
cd frontend && npx ng build

Resultado:
PASS

Duração:
~4,9 s

Resumo:
Bundle inicial 488,57 kB (123,94 kB transferidos). Sem erros nem avisos de budget.
Saída em frontend/dist/frontend.
```

## Testes

```text
Comando:
cd frontend && npx ng test --watch=false --browsers=ChromeHeadless

Resultado:
FAIL

Resumo:
error TS18003: No inputs were found in config file 'tsconfig.spec.json'.
Specified 'include' paths were ["src/**/*.spec.ts","src/**/*.d.ts"].

Contagem de ficheiros de teste no repositório: 0.
Não é "0 testes a passar" — é falha de configuração por ausência total de specs.
```

## Lint

```text
Comando:
(nenhum)

Resultado:
NOT AVAILABLE

Resumo:
Não existe ESLint nem qualquer configuração de lint. Procurado em .eslintrc*, eslint.config*
na raiz, em frontend/ e em backend/: 0 ficheiros. Nenhum script "lint" em qualquer package.json.
```

## Backend do agente — disponibilidade de provedores

```text
Comando:
curl -s http://localhost:3000/api/ai/providers

Resultado:
PASS (endpoint responde)

Resumo:
anthropic  available=false  3 modelos
openai     available=false  3 modelos
google     available=false  2 modelos
ollama     available=true   3 modelos

Nenhum provedor cloud tem chave. O Ollama reporta-se disponível porque envKey é null,
mas o serviço local não responde (ver abaixo) — a disponibilidade anunciada não é verificada.
```

```text
Comando:
curl --max-time 3 http://localhost:11434/api/tags

Resultado:
FAIL

Resumo:
HTTP 000 — servidor Ollama inacessível. Conclusão: nenhum modelo é executável neste momento,
logo o comportamento fim-a-fim do agente com um LLM real fica NÃO VERIFICADO.
```

---

## Prova empírica do ciclo agentic

Reproduz a chamada exacta de `aiChat.ts:172-178` contra um modelo simulado, importando o SDK a
partir de `backend/node_modules`. **Nenhum ficheiro da aplicação foi tocado** — a sonda vive no
directório temporário da sessão.

```text
Comando:
node loop-probe.mjs

Resultado:
PASS (sonda executou)

Saída:
COMO ESTA HOJE (sem stopWhen)     chamadas_ao_modelo=1  tool_executada=1  texto_para_o_utilizador=""
COM stopWhen: stepCountIs(5)      chamadas_ao_modelo=2  tool_executada=1  texto_para_o_utilizador="TRIR e 51,95."
```

**Interpretação:** com a configuração actual o modelo é chamado uma única vez, a ferramenta
executa, e **nenhum texto chega ao utilizador**. Basta `stopWhen` para o resultado voltar ao
modelo e produzir a resposta.

Confirmação por leitura do SDK:

```text
Evidência:
- Ficheiro: backend/node_modules/ai/dist/index.js
- Linha: 8412
- Símbolo: function streamText({ ... stopWhen = isStepCount(1) ... })
- O que comprova: o padrão do SDK encerra após um passo.
```

---

## Validação do SQL das tools contra a base real

```text
Comando:
docker exec hse-postgres psql -U postgres -d hse_app \
  -c "SELECT project, description, status, target_date, responsible FROM action_tracker_capa LIMIT 1;"

Resultado:
FAIL

Saída:
ERROR:  column "description" does not exist

Resumo:
A tool list_actions (aiChat.ts:84) referencia colunas inexistentes.
Colunas reais: action_id, source_module, source_reference, project, action_description,
responsible_person, priority, target_date, status, computed_status, days_remainingoverdue,
closure_date, verified_by, evidence_of_closure, comments.
```

```text
Comando:
SELECT project_code, date_of_incident, incident_type, severity, description
FROM incident_register LIMIT 1;

Resultado:
PASS — tool list_incidents válida.
```

```text
Comando:
SELECT code, name, status, project_manager, hse_manager FROM projects LIMIT 1;

Resultado:
PASS — tool get_projects válida.
```

`get_kpi` delega em `computeKpi()`, cujas consultas já estavam validadas pelo funcionamento do
Painel do Portfólio (TRIR 51,95 e LTIFR 8,66 conferem com o README).

---

## Estruturas de IA na base de dados

```text
Comando:
SELECT count(*) FROM information_schema.tables WHERE table_schema='public'
AND (table_name LIKE '%chat%' OR '%message%' OR '%feedback%' OR '%embedding%' OR '%memor%');

Resultado:
0

Comando:
SELECT count(*) FROM pg_extension WHERE extname='vector';

Resultado:
0
```

**Conclusão:** sem memória longa, sem histórico persistido, sem feedback armazenado, sem
embeddings. Confirma as classificações de [`03`](03_TURING_COMPLIANCE_MATRIX.md).

---

## Controlo de versão

```text
Comando:
test -d .git

Resultado:
FAIL

Resumo:
O projecto NÃO está sob controlo de versão. Sem commits, sem histórico, sem remoto.
git status e git log não são aplicáveis.
```

---

## Resumo

| Verificação | Resultado |
|---|---|
| Typecheck backend | **PASS** |
| Build frontend | **PASS** |
| Testes | **FAIL** (TS18003 — nenhum spec existe) |
| Lint | **NOT AVAILABLE** (não configurado) |
| Endpoint de provedores | **PASS** |
| Provedor executável | **FAIL** (nenhum) |
| Ciclo agentic | **FAIL** (provado: 1 passo, texto vazio) |
| SQL das tools | **3 de 4 PASS** |
| Estruturas de IA na BD | **0** |
| Repositório Git | **FAIL** (inexistente) |

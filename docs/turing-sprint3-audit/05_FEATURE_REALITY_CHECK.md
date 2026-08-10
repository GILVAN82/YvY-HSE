# 05 — Verificação de realidade, funcionalidade a funcionalidade

Nenhuma funcionalidade foi dada como existente por haver botão, menu ou nome de ficheiro.
Cada linha foi confirmada por leitura de código, consulta à base ou execução no browser.

## Funcionalidades gerais HSE

| Funcionalidade | Classificação | Evidência |
|---|---|---|
| CRUD genérico sobre 35 abas | **funcional** | `routes/generic.ts`; POST/PUT/DELETE implementados |
| Página `sheet` genérica (tabela, filtros, modal) | **funcional** | `pages/sheet/`; 41 rotas navegadas sem erro |
| Edição de registo na própria tabela | **ausente** | só criação e exclusão; o README já o admite |
| KPIs por aba (`/api/stats`) | **funcional** | `routes/sheetStats.ts`; 39 combinações aba/tabela testadas |
| Painel do Portfólio (5 gráficos + RAG grid) | **funcional** | `pages/portfolio/`; TRIR 51,95 confere com o README |
| Painel do Projecto | **funcional** | `pages/project/` |
| Registo de Projectos | **funcional** | `pages/projects/` |
| Listas de apoio | **funcional** | `pages/lists/` |
| Instruções | **funcional** | `pages/instructions/`, alimentada por `nav.config.ts` |
| Cálculo de KPI (TRIR, LTIFR, homens-hora) | **funcional** | `routes/kpi.ts:19-134`; valores conferidos contra a BD |
| Exportação CSV | **funcional** | `sheet.component.ts:exportCSV()` |
| i18n em 5 idiomas | **funcional** | 5 dicionários, ~710 chaves cada |
| Tema claro/escuro | **funcional** | `data-theme` no `<html>`, persistido |
| Sidebar de dois níveis | **funcional** | 43 verificações de comportamento passam |

## Funcionalidades de IA

| Funcionalidade | Classificação | Evidência |
|---|---|---|
| Widget de chat | **funcional** | `shared/ai-chat-widget/` |
| Endpoint `POST /api/ai/chat` | **parcial** | responde e faz streaming, mas não devolve texto quando usa tool |
| Endpoint `GET /api/ai/providers` | **funcional** | testado: devolve 4 provedores com `available` |
| Selector de provedor e modelo | **funcional** | gaveta de definições; persiste em `localStorage` |
| Streaming da resposta | **funcional** | SSE, com estados `consulting`/`streaming`/`done` |
| Function calling | **parcial** | 4 tools declaradas, 3 funcionais, ciclo não fecha |
| Histórico de conversa | **parcial** | vive no cliente; perde-se ao recarregar |
| Sugestões de pergunta | **funcional** | 3 prompts em `SUGGESTED_PROMPTS` |
| Aviso de imprecisão | **funcional** | rodapé fixo do painel |
| Feedback (👍/👎) | **ausente** | sem UI e sem tabela |
| Contagem de tokens / custo | **ausente** | `usage` do SDK nunca lido |
| Memória longa | **ausente** | 0 tabelas de IA na BD |
| RAG | **ausente** | sem `pgvector`, sem embeddings |
| Observabilidade | **ausente** | sem logs de LLM |

## Ferramentas disponíveis ao agente

| Tool | Classificação | Evidência |
|---|---|---|
| `get_kpi` | **funcional** | reusa `computeKpi()`, já validado contra a BD |
| `list_incidents` | **funcional** | consulta verificada contra `incident_register` |
| `list_actions` | **partida** | `ERROR: column "description" does not exist` |
| `get_projects` | **funcional** | consulta verificada contra `projects` |

## Itens de navegação sem destino

| Item | Classificação | Evidência |
|---|---|---|
| Equipa (rail) | **UI APENAS** — inerte e assinalado "Breve" | `navigation.config.ts` `UTILITY_ITEMS` sem `route` |
| Notificações (rail) | **UI APENAS** — inerte e assinalado "Breve" | idem |
| Configurações (rail) | **UI APENAS** — inerte e assinalado "Breve" | idem |
| Central de Ajuda (rail) | **funcional** | aponta para `/instructions` |

Nota: estes três estão explicitamente marcados como indisponíveis na interface
(`aria-disabled="true"`, opacidade reduzida, tooltip "· Breve"). Não são falsos positivos —
são placeholders honestos.

## Autenticação, permissões, integrações

| Área | Classificação | Evidência |
|---|---|---|
| Autenticação | **ausente** | 0 `canActivate`, sem middleware, sem tabela de utilizadores |
| Permissões / RBAC | **parcial (mecanismo sem fonte)** | `SidebarStateService.allowed()` filtra por `permissions`, mas `grantedPermissions` é sempre `null` |
| Multi-tenant | **ausente** | — |
| Integrações externas | **ausentes** | nenhuma chamada a API de terceiros |
| Upload de ficheiros | **ausente** | — |
| Relatórios / PDF | **ausente** | — |

---

## Que funcionalidades demonstram o "problema real" exigido pela Sprint 3

O problema é concreto e verificável neste repositório: **os dados de HSE estão dispersos por 35
abas e 30+ tabelas**, e responder a uma pergunta simples exige navegação e leitura manual.

Três funcionalidades sustentam essa narrativa:

1. **`computeKpi()`** ([`kpi.ts:19-134`](../../backend/src/routes/kpi.ts)) — para dar o TRIR de um
   projecto, o sistema cruza `manpower_log`, `incident_register`, `action_tracker_capa`,
   `permit_to_work_register`, `training_competency`, `audit_tracker` e `settings`. Sete tabelas
   para um número. É exactamente o tipo de agregação que um utilizador não faz de cabeça.
2. **As 35 abas genéricas** — a página `sheet` existe porque escrever 35 ecrãs iguais seria
   absurdo; o mesmo argumento justifica que um agente responda em vez de o utilizador percorrer
   as abas.
3. **Dados semeados realistas** — 12 projectos, 11 incidentes, 42 formações, 8 acções atrasadas.
   Há substância para perguntar.

O que **não** sustenta a narrativa hoje: o agente não consegue responder, porque o ciclo não
fecha. A matéria-prima está toda lá; a última ligação falta.

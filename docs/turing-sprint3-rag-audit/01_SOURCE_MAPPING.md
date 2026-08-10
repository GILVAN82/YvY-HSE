# 01 — Mapeamento planilha → banco → backend → frontend

Nenhuma correspondência foi assumida. Cada linha foi confirmada em três sítios: o nome da aba
em `xl/workbook.xml` da planilha, a chave e `db_table` em
[`backend/src/config/tableMeta.json`](../../backend/src/config/tableMeta.json), e a existência
da tabela na base via `information_schema`.

**Planilha analisada:** `C:\Users\Gil\Downloads\HSE_Management_System.xlsx` — 41 abas.
O ficheiro `HSE_Management_System(2).xlsx` referido no prompt não existe no sistema.

**Comandos usados:**

```bash
# nomes das abas
Expand-Archive HSE_Management_System.xlsx; [xml](Get-Content xl\workbook.xml).workbook.sheets.sheet

# contagens e volume de texto por coluna (script completo no scratchpad da sessão)
docker exec -i hse-postgres psql -U postgres -d hse_app < rag-measure.sql
```

Rotas: todas as fontes abaixo são servidas pelo CRUD genérico
[`generic.ts:43`](../../backend/src/routes/generic.ts) (`GET /api/data/:sheet/:tableIndex`) e
rendidas pelo componente genérico [`pages/sheet`](../../frontend/src/app/pages/sheet),
excepto onde indicado.

---

## As 18 fontes aprovadas

| # | Aba na planilha | Tabela PostgreSQL | Registos | Campos textuais úteis (≥25 chars) | Estado no RAG |
|---|---|---|---|---|---|
| 1 | Instructions | *(nenhuma)* — `desc` de `tableMeta.json` | 35 descrições | 35 × ~55 chars | **utilizável, mas é conteúdo de UI** |
| 2 | Emergency Preparedness | `emergency_preparedness` | 3 | **nenhum** | **não utilizável** |
| 2b | ↳ Emergency Response Plan Summary | `emergency_preparedness__emergency_response_plan_summary` | 6 | `immediate_actions` (6/6, méd. 53) | utilizável com restrições |
| 2c | ↳ Emergency Drill Register | `emergency_preparedness__emergency_drill_register` | 1 | `observations` (1/1, 50) | restrições severas |
| 3 | HIRA Register | `hira_register` | **1** | `activitytask` 29 · `hazard_description` 34 · `existing_controls` 32 · `additional_controls_required` 46 | restrições severas |
| 4 | JSA Log | `jsa_log` | **1** | `taskactivity` 25 | restrições severas |
| 5 | JSA Steps Detail | `jsa_steps_detail` | **1** | `control_measures` 47 · `ppe_required_this_step` 32 | restrições severas |
| 6 | Incident Register | `incident_register` | **11** | `description` (11/11, méd. 38, máx. 48) | utilizável com restrições |
| 7 | Investigation & RCA | `investigation_rca` | **0** | — | **não utilizável — tabela vazia** |
| 8 | Action Tracker (CAPA) | `action_tracker_capa` | **9** | `action_description` (9/9, méd. 52, máx. 63) · `comments` (9/9, 44) | utilizável com restrições |
| 9 | Safety Observations (BBS) | `safety_observations_bbs` | **2** | `description` (2/2, méd. 30) | restrições severas |
| 10 | Toolbox Talks | `toolbox_talks` | **1** | `key_points_discussed` 32 | restrições severas |
| 11 | Meeting Minutes | `meeting_minutes` | **1** | `agenda_items` 31 · `key_discussion_points` 42 | restrições severas |
| 12 | Management of Change | `management_of_change` | **1** | `change_description` 31 | restrições severas |
| 13 | Spill Environmental Incident | `spill_environmental_incident` | **1** | `immediate_response_taken` 36 | restrições severas |
| 14 | Chemical Inventory & MSDS | `chemical_inventory_msds` | **1** | **nenhum ≥25 chars** | **não utilizável** |
| 15 | Legal Compliance Register | `legal_compliance_register` | **1** | `regulationstandard_name` 31 · `requirement_description` 54 | restrições severas |
| 16 | Document Control | `document_control` | **1** | **nenhum ≥25 chars** | **não utilizável** |
| 17 | Audit Tracker | `audit_tracker` | **12** | `scope` (12/12, méd. 26) | metadados, não conhecimento |
| 17b | ↳ Audit Findings Detail | `audit_tracker__audit_findings_detail_register` | **2** | `finding_description` (2/2, méd. 46) | restrições severas |
| 18 | Change Log | `change_log` | **1** | `description_of_change` 62 | restrições severas |

**Total de texto livre nas 18 fontes: 2 679 caracteres** (soma verificada por SQL).

---

## Detalhe das fontes com mais substância

### Incident Register — a melhor fonte textual do sistema

- **Aba:** Incident Register · **Tabela:** `incident_register` · **11 registos**
- **Backend:** `/api/data/Incident%20Register/0` · KPIs em [`kpi.ts:43`](../../backend/src/routes/kpi.ts)
- **Frontend:** `/sheet/Incident Register`
- **Campo textual:** `description` — 11 de 11 preenchidos, média 38, máximo 48 caracteres
- **Exemplo real:** "Excavator operated close to live service marker."
- **Numéricos/datas/status:** `date_of_incident`, `time`, `severity`, `incident_type`,
  `lost_days`, `days_open`, `closed_date`, `investigation_status`
- **Dados pessoais: SIM** — `injured_person_name`, `body_part_affected`,
  `medical_treatment_required`, `departmenttrade`
- **Texto suficiente para recuperação semântica: NÃO.** 11 frases de ~40 caracteres cabem
  inteiras num prompt; um índice não acrescenta nada.
- **Divergências planilha/banco/UI:** nenhuma detectada — 21 colunas em `tableMeta.json`
  correspondem à tabela e à aba.

### Action Tracker (CAPA)

- **9 registos**, dois campos de texto preenchidos em todos: `action_description` (máx. 63 —
  o valor mais longo de todo o sistema) e `comments` (44).
- **Divergência crítica encontrada:** a tool `list_actions` do agente
  ([`aiChat.ts:84`](../../backend/src/routes/aiChat.ts)) consulta `description` e `responsible`;
  as colunas reais são `action_description` e `responsible_person`. Já registada na auditoria
  anterior — relevante aqui porque é a fonte que qualquer RAG de CAPA usaria.

### Instructions — fonte da coleção `system_instructions`

- **Não tem tabela.** O conteúdo vive em `tableMeta.json`, campo `desc` de cada uma das 35 abas,
  consumido por [`instructions.component.ts:49`](../../frontend/src/app/pages/instructions/instructions.component.ts)
  via `GET /api/sheets`.
- **35 descrições de uma linha, 1 937 caracteres no total, média 55.**
- Exemplo: *"Single source of truth for man-hours and rate denominators."*
- É **documentação de interface** — explica para que serve cada aba. Não é conhecimento HSE
  (não diz como fazer uma HIRA nem o que fazer num incêndio).

### Emergency Preparedness — fonte da coleção `emergency_guidance`

Três tabelas:

| Tabela | Registos | Texto |
|---|---|---|
| `emergency_preparedness` (contactos) | 3 | nenhum — nome, papel, telefone |
| `..._emergency_response_plan_summary` | 6 | `immediate_actions`, 6/6, média 53 |
| `..._emergency_drill_register` | 1 | `observations`, 50 |

Exemplo real de `immediate_actions`: *"Raise alarm, isolate source if safe, evacuate to muster point."*

A coluna `reference_document` aponta para `ERP-FIRE`, `ERP-CS`, `ERP-SPILL` — **identificadores,
não documentos**. Nenhum plano de resposta a emergência existe no sistema.

---

## Divergências entre planilha, banco e interface

| Divergência | Evidência | Impacto no RAG |
|---|---|---|
| `investigation_rca` vazia apesar de a aba existir e ter 21 colunas | `SELECT count(*)` → 0 | Fonte aprovada #7 inutilizável |
| Nome do ficheiro da planilha diverge do prompt | `(2).xlsx` não existe | Analisado o único encontrado |
| Tool `list_actions` usa colunas inexistentes | `aiChat.ts:84` vs. `information_schema` | Qualquer consulta de CAPA pelo agente falha |
| `chemical_inventory_msds.msds_on_file` = flag, sem SDS | 1 registo, sem campo de texto | Não há conteúdo químico para indexar |
| `permit_to_work_register.isolationloto_reference` vazia nos 3 registos | ver [`06`](06_GAPS_PRIVACY_AND_LIMITATIONS.md) | LOTO não responde nada |

Fora estas, **não foram encontradas divergências estruturais** entre as 41 abas, as 35 chaves de
`tableMeta.json` e as tabelas da base. O mapeamento aba → tabela é consistente e o `slug()` que
gera os nomes de tabela é partilhado entre `schema.sql` e `generic.ts`.

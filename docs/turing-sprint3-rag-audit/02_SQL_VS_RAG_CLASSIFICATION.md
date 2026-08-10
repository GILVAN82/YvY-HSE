# 02 — Classificação campo a campo: SQL, RAG, metadados ou exclusão

Regras aplicadas:

- **SQL ONLY** — números, datas, status, filtros, contagens, KPIs. Exigem exactidão.
- **RAG CANDIDATE** — descrições, orientações, causas, perigos, controlos, discussões.
- **METADATA ONLY** — IDs, nomes de documento, versão, categoria, projecto, data, referência.
- **EXCLUDE** — dados pessoais, médicos, telefones, nomes de feridos, vazios, sem valor semântico.

---

## Instructions (fonte: `tableMeta.json`, campo `desc`)

| Campo | Classificação | Nota |
|---|---|---|
| `sheet` (nome da aba) | METADATA ONLY | chave de filtro |
| `desc` | **RAG CANDIDATE** | 35 × ~55 chars. Único conteúdo redigido para ser lido |
| `tables[].columns[]` | METADATA ONLY | estrutura, não conhecimento |

## Emergency Preparedness

### `emergency_preparedness` (contactos, 3 registos)

| Campo | Classificação | Nota |
|---|---|---|
| `name` | **EXCLUDE** | nome de pessoa ("Site Emergency Coordinator" é papel, mas o campo aceita nomes) |
| `role` | METADATA ONLY | |
| `project` | METADATA ONLY | |
| `phone_primary`, `phone_alternate` | **EXCLUDE** | telefone — dado pessoal |
| `available_247` | SQL ONLY | |

### `..._emergency_response_plan_summary` (6 registos)

| Campo | Classificação | Nota |
|---|---|---|
| `scenario` | METADATA ONLY | "Fire", "Chemical Spill" — categoria |
| `immediate_actions` | **RAG CANDIDATE** | 6/6, méd. 53 chars. O melhor conteúdo de orientação do sistema |
| `assemblymuster_point`, `responsible_team` | METADATA ONLY | |
| `reference_document` | METADATA ONLY | identificador `ERP-FIRE` sem documento real |

### `..._emergency_drill_register` (1 registo)

| Campo | Classificação |
|---|---|
| `drill_id`, `project`, `drill_type`, `date` | METADATA ONLY |
| `participants_count`, `evacuationresponse_time_minutes` | SQL ONLY |
| `observations` | **RAG CANDIDATE** (50 chars, 1 registo) |

## HIRA Register (1 registo)

| Campo | Classificação | Nota |
|---|---|---|
| `hira_id`, `project`, `location`, `date_assessed` | METADATA ONLY | |
| `assessed_by`, `action_owner` | **EXCLUDE** | nome de pessoa |
| `activitytask` | **RAG CANDIDATE** | 29 chars |
| `hazard_description` | **RAG CANDIDATE** | 34 chars |
| `existing_controls` | **RAG CANDIDATE** | 32 chars |
| `additional_controls_required` | **RAG CANDIDATE** | 46 chars |
| `hazard_category` | METADATA ONLY | |
| `likelihood`, `consequence`, `risk_rating`, `risk_level` | SQL ONLY | matriz 5×5 |
| `residual_*` | SQL ONLY | |
| `review_date`, `status` | SQL ONLY | |

## JSA Log + JSA Steps Detail (1 registo cada)

| Campo | Classificação |
|---|---|
| `jsa_id`, `project`, `date`, `linked_permit_no`, `revision_number` | METADATA ONLY |
| `prepared_by`, `approved_by` | **EXCLUDE** |
| `taskactivity` | **RAG CANDIDATE** (25) |
| `number_of_steps`, `permit_required`, `crew_briefed` | SQL ONLY |
| `job_step_description`, `potential_hazards` | RAG CANDIDATE — **vazios ou <25 chars** |
| `control_measures` | **RAG CANDIDATE** (47) |
| `ppe_required_this_step` | **RAG CANDIDATE** (32) |

## Incident Register (11 registos)

| Campo | Classificação | Nota |
|---|---|---|
| `incident_id`, `project_code`, `locationarea` | METADATA ONLY | |
| `date_of_incident`, `time`, `closed_date` | SQL ONLY | |
| `incident_type`, `severity` | SQL ONLY | dirigem TRIR/LTIFR |
| `description` | **RAG CANDIDATE** | 11/11, méd. 38 — melhor cobertura do sistema |
| `injured_person_name` | **EXCLUDE** | nome de ferido |
| `body_part_affected`, `medical_treatment_required` | **EXCLUDE** | dado médico |
| `departmenttrade`, `employeecontractor` | **EXCLUDE** | identifica indirectamente |
| `immediate_cause` | RAG CANDIDATE — **<25 chars**, na prática categoria |
| `lost_days`, `days_open` | SQL ONLY | |
| `reportable_to_authority` | SQL ONLY | |
| `investigation_status`, `linked_investigation_id`, `linked_action_ids` | METADATA ONLY | |

## Investigation & RCA — **0 registos**

Todas as colunas ficam por classificar na prática. Se houvesse dados, `immediate_cause` e
`root_cause_man/machine/method/material/environment` seriam os melhores RAG CANDIDATE do
sistema, e `investigation_team` seria EXCLUDE.

## Action Tracker (CAPA) (9 registos)

| Campo | Classificação | Nota |
|---|---|---|
| `action_id`, `source_module`, `source_reference`, `project` | METADATA ONLY | |
| `action_description` | **RAG CANDIDATE** | 9/9, máx. 63 — valor mais longo do sistema |
| `comments` | **RAG CANDIDATE** | 9/9, 44 |
| `responsible_person`, `verified_by` | **EXCLUDE** | |
| `priority`, `status`, `computed_status` | SQL ONLY | |
| `target_date`, `closure_date`, `days_remainingoverdue` | SQL ONLY | |
| `evidence_of_closure` | METADATA ONLY | referência, não conteúdo |

## Safety Observations (BBS) (2 registos)

| Campo | Classificação |
|---|---|
| `observation_id`, `project`, `area`, `date` | METADATA ONLY |
| `observer_name`, `observed_personcrew` | **EXCLUDE** |
| `description` | **RAG CANDIDATE** (2/2, méd. 30) |
| `immediate_action_taken` | RAG CANDIDATE — **<25 chars** |
| `observation_type`, `category`, `risk_level`, `action_required`, `status` | SQL ONLY |

## Toolbox Talks · Meeting Minutes · MOC · Spill (1 registo cada)

| Tabela | RAG CANDIDATE | EXCLUDE | SQL ONLY |
|---|---|---|---|
| `toolbox_talks` | `key_points_discussed` (32) | `conducted_by` | `number_of_attendees`, `duration_minutes` |
| `meeting_minutes` | `agenda_items` (31), `key_discussion_points` (42) | `attendees` | `date`, `next_meeting_date` |
| `management_of_change` | `change_description` (31) | `initiated_by`, `approved_by` | `change_type`, `approval_level_required` |
| `spill_environmental_incident` | `immediate_response_taken` (36) | — | `quantity_spilled`, `reported_to_authority`, `status` |

## Chemical Inventory & MSDS (1 registo) — **nenhum RAG CANDIDATE**

| Campo | Classificação | Nota |
|---|---|---|
| `chemical_name`, `ghs_hazard_class`, `location_stored` | METADATA ONLY | |
| `storage_conditions`, `handling_precautions` | RAG CANDIDATE — **<25 chars, sem substância** | |
| `msds_on_file` | SQL ONLY | flag booleana, **não é a SDS** |
| `quantity_on_site`, `unit` | SQL ONLY | |

Nota: a SDS/MSDS real **não existe no sistema**. `msds_on_file = 'Yes'` diz que existe algures,
não guarda o conteúdo.

## Legal Compliance · Document Control · Audit Tracker · Change Log

| Tabela | RAG CANDIDATE | METADATA ONLY | SQL ONLY |
|---|---|---|---|
| `legal_compliance_register` | `requirement_description` (54), `regulationstandard_name` (31) | `applicable_clause`, `authorityjurisdiction`, `evidence_of_compliance` | `compliance_status`, `next_review_date` |
| `document_control` | **nenhum** | `document_name`, `category`, `version_no`, `applicability` | `issue_date`, `next_review_due`, `status` |
| `audit_tracker` | `scope` (26) — fronteiriço, é mais categoria | `audit_id`, `audit_type`, `standardreference` | `number_of_findings`, `overall_audit_score` |
| `audit_tracker__findings` | `finding_description` (2/2, méd. 46) | `clause_reference`, `linked_action_id` | `classification`, `status`, `target_close_date` |
| `change_log` | `description_of_change` (62) | `version_no`, `sheets_affected` | `date` |

---

## Totais

| Classificação | Campos | Volume real |
|---|---|---|
| **RAG CANDIDATE com texto útil (≥25 chars)** | **20 campos em 13 tabelas** | **2 679 caracteres** |
| RAG CANDIDATE nominal mas vazio ou <25 chars | 6 campos | desprezável |
| SQL ONLY | ~90 campos | é aqui que vive o valor do sistema |
| METADATA ONLY | ~60 campos | filtros e citações |
| **EXCLUDE (pessoais/médicos)** | **16 campos em 9 tabelas** | ver [`06`](06_GAPS_PRIVACY_AND_LIMITATIONS.md) |

**Leitura:** a proporção fala por si. Noventa campos SQL contra vinte campos de texto que somam
menos de três mil caracteres. Este é um sistema de medição, não de documentação — e é por isso
que o agente actual, que usa `computeKpi()` e consultas SQL, está arquitectonicamente certo.

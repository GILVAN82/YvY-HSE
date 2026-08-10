# 04 — Formato documental e metadados propostos

> **Proposta, não implementação.** Nada disto foi executado. Serve para que, quando existir
> conteúdo que justifique RAG (ver [`07`](07_IMPLEMENTATION_BACKLOG.md)), o formato já esteja
> decidido e as regras de privacidade já estejam fixadas.

---

## Princípio

Separação estrita entre o que é **recuperado por semelhança** e o que serve para **filtrar e
citar**:

- `pageContent` — apenas texto redigido para ser lido. É o que gera o embedding.
- `metadata` — identificadores, códigos, datas e status. Nunca entram no `pageContent`.

Um ID de projecto num embedding é ruído: "PRJ-003" não tem semântica e aproxima documentos que
nada têm a ver. Como filtro em metadados, é exacto e barato.

---

## Formato

```
Type: <tipo de documento>
Source module: <módulo de origem>
Activity: <o que estava a ser feito>
Hazard: <perigo identificado>
Existing controls: <controlos em vigor>
Additional controls: <controlos adicionais requeridos>
```

Regras de construção:

1. Só entram campos classificados **RAG CANDIDATE** em [`02`](02_SQL_VS_RAG_CLASSIFICATION.md).
2. Campos vazios são **omitidos**, não incluídos como rótulo sem valor — um `Hazard:` seguido de
   nada polui o embedding.
3. Campos **EXCLUDE** nunca entram, em circunstância alguma.
4. O rótulo em inglês acompanha o idioma dos dados; a resposta ao utilizador é traduzida pelo
   modelo, como já acontece hoje.

---

## Exemplos com dados reais do sistema

### HIRA (o único registo existente)

```
Type: HIRA
Source module: HIRA Register
Activity: Excavation near live services
Hazard: Contact with buried utilities
Existing controls: Permit, cable locator survey
Additional controls: Hand digging within 500mm, spotter present
```

```json
{
  "source_module": "HIRA Register",
  "source_table": "hira_register",
  "source_sheet": "HIRA Register",
  "record_id": "HIRA-0001",
  "project_code": "PRJ-001",
  "document_type": "hira",
  "category": "Excavation",
  "status": "Open",
  "source_date": "2026-01-15",
  "sensitivity": "internal",
  "source_fields": ["activitytask", "hazard_description", "existing_controls", "additional_controls_required"]
}
```

Note-se o que **não** está no `pageContent`: `assessed_by` e `action_owner` (nomes de pessoas,
EXCLUDE), `risk_rating` e `likelihood` (SQL ONLY — números que exigem exactidão), `hira_id` e
`project` (metadados de filtro).

### Incidente

```
Type: Incident
Source module: Incident Register
Description: Excavator operated close to live service marker.
```

```json
{
  "source_module": "Incident Register",
  "source_table": "incident_register",
  "record_id": "INC-0009",
  "project_code": "PRJ-009",
  "document_type": "incident",
  "category": "Near Miss",
  "status": "3 - Moderate",
  "source_date": "2026-05-19",
  "sensitivity": "restricted",
  "source_fields": ["description"]
}
```

`sensitivity: restricted` porque a tabela de origem contém campos médicos e nominais, mesmo que
nenhum entre no `pageContent`. A marca acompanha a origem, não só o extracto — se amanhã alguém
alargar os campos indexados, o aviso já lá está.

### Orientação de emergência

```
Type: Emergency guidance
Source module: Emergency Preparedness
Scenario: Fire
Immediate actions: Raise alarm, isolate source if safe, evacuate to muster point.
```

```json
{
  "source_module": "Emergency Preparedness",
  "source_table": "emergency_preparedness__emergency_response_plan_summary",
  "record_id": "ERP-FIRE",
  "project_code": null,
  "document_type": "emergency_guidance",
  "category": "Fire",
  "status": null,
  "source_date": null,
  "sensitivity": "public",
  "source_fields": ["scenario", "immediate_actions"]
}
```

`record_id: ERP-FIRE` é o valor de `reference_document`. **É um identificador, não um plano** —
o documento ERP-FIRE não existe no sistema. Um agente que cite esta fonte deve dizer que
apresenta o resumo, não o plano completo.

---

## Metadados mínimos

| Campo | Tipo | Origem | Uso |
|---|---|---|---|
| `source_module` | string | nome da aba | citação ao utilizador |
| `source_table` | string | `tableMeta.json` → `db_table` | rastreio técnico |
| `source_sheet` | string | nome da aba na planilha | rastreio até à fonte de verdade |
| `record_id` | string | coluna de ID da tabela | permite abrir o registo na UI |
| `project_code` | string \| null | `project` ou `project_code` | **filtro principal** |
| `document_type` | enum | fixo por tabela | filtro por tipo |
| `category` | string \| null | tipo/categoria da tabela | filtro secundário |
| `status` | string \| null | coluna de status | excluir registos fechados |
| `source_date` | date \| null | data do registo | recência |
| `sensitivity` | `public` \| `internal` \| `restricted` | atribuído por tabela | controlo de acesso futuro |
| `source_fields` | string[] | campos concatenados | auditoria do que foi indexado |

### Sensibilidade por tabela

| Nível | Tabelas |
|---|---|
| `public` | Instructions, Emergency Response Plan Summary |
| `internal` | HIRA, JSA, Toolbox Talks, MOC, Legal Compliance, Document Control, Audit, Change Log |
| `restricted` | Incident Register, Investigation & RCA, Safety Observations, Spill, Meeting Minutes |

`restricted` marca tabelas que contêm campos pessoais ou médicos na origem — mesmo que esses
campos fiquem de fora do `pageContent`.

---

## Regra de citação

Toda a resposta apoiada em recuperação deve citar `source_module` + `record_id`, para o
utilizador poder abrir o registo. O sistema já tem a rota:
`/sheet/<source_sheet>` — o mesmo padrão que a sidebar usa hoje.

---

## Regra que não pode ser quebrada

**Nenhum campo classificado EXCLUDE entra no `pageContent`.** São dezasseis campos em nove
tabelas: nomes de feridos, partes do corpo afectadas, tratamento médico, telefones de
emergência, nomes de observadores, avaliadores, aprovadores e participantes.

Um embedding não se apaga selectivamente. Uma vez indexado o nome de um trabalhador ferido com a
descrição da lesão, esse par fica recuperável por qualquer pergunta semanticamente próxima — e
o pedido de eliminação obriga a reconstruir o índice. Por isso a exclusão acontece **na
construção do documento**, não na filtragem da resposta.

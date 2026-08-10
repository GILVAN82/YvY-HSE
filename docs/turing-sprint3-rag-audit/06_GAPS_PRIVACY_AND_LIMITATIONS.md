# 06 — Lacunas, privacidade e limitações

## A. Conteúdos citados mas ausentes

O sistema referencia documentos que **não contém**. Cada um destes é uma armadilha de
alucinação: o nome existe na base, o conteúdo não.

| Referência | Onde aparece | O que é de facto | Pode entrar no RAG? |
|---|---|---|---|
| `ERP-FIRE`, `ERP-CS`, `ERP-SPILL`, `ERP-MED`, `ERP-NAT`, `ERP-SEC` | `..._response_plan_summary.reference_document` | Identificadores. Os planos não existem | **Só como metadado** |
| SDS / MSDS | `chemical_inventory_msds.msds_on_file = 'Yes'` | Flag booleana. Nenhuma ficha de segurança está no sistema | **Não** |
| ISO 45001 / ISO 14001 | `legal_compliance_register`, `audit_tracker.standardreference` | Nome e cláusula. O texto normativo é externo e sujeito a direitos de autor | **Só como metadado** |
| Procedimento LOTO | `permit_to_work_register.isolationloto_reference` | Coluna **vazia nos 3 registos** | **Não** |
| Procedimento PTW | `permit_to_work_register` | Registo de permissões emitidas, não o procedimento | **Não** |
| Project HSE Plan | Instructions / Document Control | Nome de documento em `document_control` | **Só como metadado** |
| HSE-MS Audit Protocol | `audit_tracker.standardreference` | Referência | **Só como metadado** |

---

## B. LOTO — verificação específica pedida

**Onde existe referência:**

```
Evidência:
- Ficheiro: backend/src/config/tableMeta.json
- Linhas: 738-739
- Símbolo: coluna "isolationloto_reference", header "Isolation/LOTO Reference"
- Tabela: permit_to_work_register
```

**Estado dos dados** (`SELECT permit_no, permit_type, isolationloto_reference FROM permit_to_work_register`):

| permit_no | permit_type | isolationloto_reference |
|---|---|---|
| PTW-0001 | Working at Height | *(vazio)* |
| PTW-0002 | Hot Work | *(vazio)* |
| PTW-0003 | Excavation | *(vazio)* |

**É apenas um identificador?** É menos do que isso — é um campo de identificador **que está
vazio**. Uma única coluna em todo o schema contém "loto" ou "isolation" no nome
(`information_schema` → 1 resultado).

**Perguntas SQL que podem ser respondidas:**

- Quantas permissões exigem isolamento? → hoje, zero têm referência preenchida
- Que permissões existem e de que tipo? → 3 (altura, trabalho a quente, escavação)
- Que permissões exigiram teste de gás? → 1 (PTW-0002)

**Perguntas documentais que NÃO podem ser respondidas:**

- Qual o procedimento de LOTO?
- Que passos seguir para isolar energia?
- Quem pode aplicar e remover bloqueios?
- Que dispositivos de bloqueio usar?

**Nenhuma tem resposta no sistema e nenhuma deve ser respondida por inferência.** É a pergunta
de recusa nº 1 em [`05`](05_RAG_TEST_QUESTIONS.md), e a de consequência mais grave: um
procedimento de bloqueio de energia inventado é um risco de vida.

---

## C. Módulos com pouco texto para RAG

Ordenados pelo volume real:

| Módulo | Registos | Caracteres | Veredicto |
|---|---|---|---|
| Investigation & RCA | **0** | 0 | Tabela vazia |
| Chemical Inventory & MSDS | 1 | 0 úteis | Sem campo textual ≥25 |
| Document Control | 1 | 0 úteis | Só metadados |
| Emergency Preparedness (contactos) | 3 | 0 úteis | Só contactos |
| JSA Log | 1 | 25 | Insuficiente |
| Toolbox Talks | 1 | 32 | Insuficiente |
| Management of Change | 1 | 31 | Insuficiente |
| Spill / Environmental | 1 | 36 | Insuficiente |
| Change Log | 1 | 62 | Insuficiente |
| Meeting Minutes | 1 | 73 | Insuficiente |
| JSA Steps Detail | 1 | 79 | Insuficiente |
| Legal Compliance | 1 | 85 | Insuficiente |
| HIRA Register | 1 | 141 | Insuficiente |
| Safety Observations | 2 | ~60 | Insuficiente |
| Audit Findings | 2 | ~97 | Insuficiente |
| Audit Tracker | 12 | ~312 | Metadados repetitivos |
| Incident Register | 11 | ~418 | Melhor cobertura, texto curto |
| Action Tracker (CAPA) | 9 | ~864 | Melhor volume |

**Dezasseis das dezoito abaixo de 500 caracteres.** Nove com exactamente um registo.

---

## D. Campos vazios

| Campo | Tabela | Estado |
|---|---|---|
| `isolationloto_reference` | `permit_to_work_register` | vazio em 3/3 |
| `job_step_description`, `potential_hazards` | `jsa_steps_detail` | abaixo do limiar de 25 chars |
| `immediate_action_taken` | `safety_observations_bbs` | abaixo do limiar |
| `immediate_cause` | `incident_register` | abaixo do limiar — funciona como categoria |
| `storage_conditions`, `handling_precautions` | `chemical_inventory_msds` | abaixo do limiar |
| toda a tabela | `investigation_rca` | **0 registos** |

---

## E. Dados pessoais e sensíveis

**Dezasseis campos em nove tabelas** classificados EXCLUDE:

| Categoria | Campos | Tabelas |
|---|---|---|
| **Médico** | `injured_person_name`, `body_part_affected`, `medical_treatment_required` | `incident_register` |
| **Contacto** | `phone_primary`, `phone_alternate`, `name` | `emergency_preparedness` |
| **Nominal** | `observer_name`, `observed_personcrew` | `safety_observations_bbs` |
| **Nominal** | `assessed_by`, `action_owner` | `hira_register` |
| **Nominal** | `prepared_by`, `approved_by` | `jsa_log` |
| **Nominal** | `responsible_person`, `verified_by` | `action_tracker_capa` |
| **Nominal** | `conducted_by` | `toolbox_talks` |
| **Nominal** | `attendees` | `meeting_minutes` |
| **Nominal** | `initiated_by`, `approved_by` | `management_of_change` |
| **Nominal** | `employee_name`, `employee_id` | `training_competency` (fora do âmbito, mas relevante) |

**Risco específico do RAG:** o par nome-de-ferido + descrição-da-lesão em `incident_register` é
dado de saúde. Uma vez embutido num vector store, torna-se recuperável por qualquer pergunta
semanticamente próxima, e um pedido de eliminação obriga a reconstruir o índice — não basta
apagar a linha da base.

Por isso a regra em [`04`](04_DOCUMENT_FORMAT_AND_METADATA.md) é exclusão **na construção do
documento**, não filtragem da resposta. E por isso as tabelas com campos pessoais são marcadas
`sensitivity: restricted` mesmo quando o extracto indexado não os contém.

Agravante: **o sistema não tem autenticação** (0 guards de rota, sem tabela de utilizadores).
Não há a quem restringir acesso. Qualquer índice construído hoje seria acessível a qualquer
pessoa que abrisse a aplicação.

---

## F. Divergências entre app e planilha

| Divergência | Evidência |
|---|---|
| A planilha do prompt (`HSE_Management_System(2).xlsx`) não existe | Procurado em `C:\Users\Gil`; encontrado apenas `HSE_Management_System.xlsx` |
| Planilha tem 41 abas, `tableMeta.json` tem 35 | As 6 em falta são de UI: Home, Portfolio Dashboard, Project Dashboard, Lists, Project Register, KPI Statistics Engine — implementadas como páginas próprias, não como abas genéricas |
| Tool `list_actions` usa colunas inexistentes | `aiChat.ts:84` → `description`/`responsible`; reais: `action_description`/`responsible_person` |
| Aba Investigation & RCA existe, tabela vazia | 21 colunas definidas, 0 registos |

Fora estas, o mapeamento aba → tabela → rota → página é **consistente**. O `slug()` partilhado
entre `schema.sql` e `generic.ts` garante a correspondência dos nomes.

---

## G. Conteúdo que só poderá ser adicionado numa fase futura

Nada disto pode ser criado nesta sprint, nem inventado depois:

1. **Procedimentos operacionais** — LOTO, PTW, trabalho em altura, espaço confinado.
2. **SDS/MSDS reais** — vêm do fabricante.
3. **Planos de emergência completos** — os ERP-* referenciados.
4. **Normas** — ISO 45001/14001, sujeitas a direitos de autor.
5. **Lições aprendidas redigidas** — exigiriam `investigation_rca` preenchida.
6. **Project HSE Plans** — referenciados em Document Control, sem ficheiro.

**Todos exigem uma capacidade que o sistema não tem: upload e armazenamento de ficheiros.** Não
há endpoint de upload, nem coluna de blob, nem storage. Essa é a dependência real que bloqueia
o RAG — não o vector store.

---

## Limitação central

O YVY HSE é um **sistema de medição**, não um repositório documental. Noventa campos SQL contra
vinte campos de texto que somam menos de três mil caracteres. Foi desenhado a partir de uma
planilha de fórmulas — e as fórmulas, não a prosa, são o seu valor.

RAG não é a ferramenta certa para este conteúdo. Passará a ser quando existirem documentos —
e a decisão de o dizer, em vez de encher um índice para cumprir um requisito, é ela própria
defensável numa review técnica.

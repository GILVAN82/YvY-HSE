# 03 — Validação das quatro coleções iniciais

Critério aplicado: uma coleção só se justifica se a recuperação semântica **superar** a
alternativa mais simples — pôr o conteúdo inteiro no prompt, ou consultá-lo por SQL.

---

## 1. `system_instructions`

**Veredicto: VIÁVEL COMO PROMPT, NÃO COMO RAG.**

| Aspecto | Realidade |
|---|---|
| Fontes confirmadas | `tableMeta.json`, campo `desc` de 35 abas; servido por `GET /api/sheets` |
| Campos indexáveis | `desc` (35 valores) |
| Apenas metadados | nome da aba, `db_table`, colunas |
| Excluir | nada |
| Volume | **35 registos · 1 937 caracteres · média 55** |
| Qualidade | Boa — frases redigidas para serem lidas, não dados brutos |
| Duplicação | Nenhuma |
| Privacidade | Nenhum risco |

**Limitação decisiva:** 1 937 caracteres cabem inteiros num system prompt e custam ~500 tokens.
Indexar, embutir e recuperar 4 de 35 fragmentos introduz latência, custo e risco de recuperar o
fragmento errado — para servir menos contexto do que simplesmente incluir tudo.

**Responde a:** "para que serve a aba Manpower Log?", "onde registo um quase-acidente?",
"que aba alimenta os dashboards?"

**Não responde a:** qualquer pergunta sobre HSE em si. As descrições explicam a *interface*,
não a disciplina. Não dizem como conduzir uma HIRA nem o que fazer num derrame.

---

## 2. `emergency_guidance`

**Veredicto: NÃO VIÁVEL.**

| Aspecto | Realidade |
|---|---|
| Fontes confirmadas | `..._emergency_response_plan_summary` (6), `..._emergency_drill_register` (1) |
| Campos indexáveis | `immediate_actions` (6 × ~53), `observations` (1 × 50) |
| Apenas metadados | `scenario`, `assemblymuster_point`, `responsible_team`, `reference_document` |
| Excluir | `emergency_preparedness`: `name`, `phone_primary`, `phone_alternate` |
| Volume | **7 registos · ≈ 368 caracteres** |
| Qualidade | As 6 linhas são úteis mas telegráficas |

Conteúdo integral indexável desta coleção — é isto, na totalidade:

```
Fire              → Raise alarm, isolate source if safe, evacuate to muster point.
Medical Emergency → Call first aider, preserve scene, arrange ambulance.
Chemical Spill    → Stop work, isolate area, use spill kit if trained.
Confined Space    → Do not enter, raise alarm, activate rescue plan.
Natural Disaster  → Follow site alarm, secure equipment, account for personnel.
Security Incident → Withdraw, notify security, account for personnel.
```

**Limitação decisiva:** seis linhas. Um `SELECT` por `scenario` devolve a linha exacta; um
embedding devolve a "mais parecida", que pode ser a errada — num contexto de emergência, o pior
modo de falha possível.

**Responde a:** "o que fazer em caso de incêndio?" (mas SQL responde melhor)

**Não responde a:** "qual o procedimento completo de evacuação?", "quem lidera a brigada?",
"qual o plano ERP-FIRE?". Os planos referenciados (`ERP-FIRE`, `ERP-CS`, `ERP-SPILL`) são
**identificadores sem documento**.

---

## 3. `operational_knowledge`

**Veredicto: NÃO VIÁVEL COM O CONTEÚDO ACTUAL.**

| Fonte | Registos | Texto indexável |
|---|---|---|
| HIRA Register | **1** | 141 chars em 4 campos |
| JSA Log | **1** | 25 |
| JSA Steps Detail | **1** | 79 |
| Incident Register | **11** | ~418 |
| Investigation & RCA | **0** | — |
| Action Tracker (CAPA) | **9** | ~864 |
| Safety Observations (BBS) | **2** | ~60 |
| Toolbox Talks | **1** | 32 |
| Meeting Minutes | **1** | 73 |
| Management of Change | **1** | 31 |
| Spill / Environmental | **1** | 36 |
| Chemical handling | **1** | **0 úteis** |
| **Total** | **30 registos** | **≈ 1 759 caracteres** |

**Limitação decisiva — três razões independentes, qualquer uma bastaria:**

1. **Volume.** 1 759 caracteres = 2 a 4 chunks. Não há o que recuperar.
2. **Cardinalidade.** Sete das doze fontes têm **um registo**. Um índice sobre um registo é uma
   consulta com passos extra e uma camada de imprecisão.
3. **Natureza do conteúdo.** As frases descrevem *ocorrências* ("Dust in eye during drilling"),
   não *conhecimento* ("como prevenir lesões oculares"). RAG serve para recuperar conhecimento
   reutilizável; estas são entradas de registo, e entradas de registo consultam-se por SQL com
   filtros exactos de projecto, data e severidade.

**Responde a:** "que incidentes houve com escavadoras?" — mas o `LIKE` em SQL responde igual e
com garantia de completude, que o embedding não dá.

**Não responde a:** "como fazer uma avaliação de risco?", "quais os controlos típicos para
trabalho em altura?", "que lições foram aprendidas com incidentes de escavação?". Este é
conhecimento que o sistema **não contém**.

---

## 4. `document_metadata`

**Veredicto: VIÁVEL — MAS É SQL, NÃO RAG.**

| Fonte | Registos | Campos |
|---|---|---|
| Document Control | 1 | `document_name`, `category`, `version_no`, `next_review_due`, `status` |
| Legal Compliance Register | 1 | `regulationstandard_name`, `requirement_description`, `compliance_status` |
| Audit Tracker | 12 | `audit_type`, `scope`, `overall_audit_score`, `number_of_findings` |
| Change Log | 1 | `version_no`, `description_of_change`, `sheets_affected` |

**Limitação decisiva:** as perguntas que esta coleção serviria são todas filtros exactos —
"que documentos estão por rever", "qual a norma aplicável", "qual a pontuação da última
auditoria". `WHERE next_review_due < now()` responde com exactidão e completude. Um índice
vectorial sobre 15 registos de metadados é a ferramenta errada.

E o essencial: **os documentos em si não existem**. `document_control` tem um registo com nome,
versão e data de revisão — mas nenhum conteúdo. Indexar o nome de um documento não permite
responder sobre o que ele diz.

**Responde a:** "que documentos expiram este mês?" · "qual a versão do procedimento X?"

**Não responde a:** "o que diz o procedimento X?" — não há ficheiro.

---

## Quadro final

| Coleção | Registos | Caracteres | Chunks a ~700 | Veredicto |
|---|---|---|---|---|
| `system_instructions` | 35 | 1 937 | ~3 | Prompt, não RAG |
| `emergency_guidance` | 7 | ~368 | <1 | Não viável |
| `operational_knowledge` | 30 | ~1 759 | ~3 | Não viável |
| `document_metadata` | 15 | ~500 | <1 | SQL, não RAG |
| **Total** | **87** | **≈ 4 616** | **≈ 7** | — |

Sete chunks no corpus inteiro. Recuperar os "4 melhores" de sete é ruído estatístico: em metade
dos casos o chunk certo fica de fora por acaso, e em nenhum caso se poupa contexto face a
incluir tudo.

**Conclusão:** nenhuma das quatro coleções justifica um vector store hoje. A viabilidade não
depende de mais engenharia — depende de **conteúdo documental que o sistema ainda não tem**.

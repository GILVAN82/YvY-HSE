# Propósito do agente

## O que é

**YVY HSE AI Agent** — assistente consultivo que responde a perguntas sobre os dados de
Health, Safety & Environment do sistema, consultando-os em tempo real através de ferramentas.

## O problema

Os dados de HSE estão dispersos por **35 abas e mais de 30 tabelas**. Responder a "qual o TRIR
do PRJ-003 em maio?" obriga a cruzar sete tabelas — `manpower_log`, `incident_register`,
`action_tracker_capa`, `permit_to_work_register`, `training_competency`, `audit_tracker` e
`settings`. É exactamente o que a função `computeKpi()` faz, e não é algo que se faça de cabeça
nem em poucos cliques.

O agente expõe essa agregação em linguagem natural, sem que o utilizador tenha de saber em que
aba está o número.

## Utilizadores

Profissionais de HSE que já usam o sistema: gestores de HSE, técnicos de segurança, gestores
de projeto e auditores. Não há autenticação, portanto hoje não há distinção de papéis —
ver [limitations.md](limitations.md).

## O que resolve

- Calcular KPIs (TRIR, LTIFR, homens-hora, conformidade de formação, nota de auditoria)
- Localizar incidentes por projeto, tipo ou severidade
- Listar ações CAPA abertas ou atrasadas
- Consultar o portfólio de projetos
- Dizer **o que o sistema não tem**, em vez de o inventar

## Limites — deliberados e verificáveis

O agente é **estritamente consultivo**. Nenhuma das suas quatro ferramentas escreve na base:
todas executam `SELECT`. Isto não é só uma instrução no prompt, é uma propriedade do código.

Não faz:

| Não faz | Porquê |
|---|---|
| Criar, editar, aprovar ou apagar registos | Nenhuma tool escreve; toda a decisão é humana |
| Fornecer procedimentos de LOTO ou PTW | **O sistema não os contém.** Guarda referências, não documentos |
| Fornecer fichas de segurança (SDS/MSDS) | `msds_on_file` é uma flag; a ficha não está no sistema |
| Citar o texto de normas ISO | Guarda o nome e a cláusula, não o texto |
| Identificar pessoas feridas ou dar dados médicos | Privacidade; campos excluídos por regra |
| Substituir julgamento profissional de HSE | Apresenta dados, não decisões |
| Emitir diagnóstico médico | Fora de âmbito |

O prompt de sistema instrui explicitamente a recusar cada um destes casos, e o guard bloqueia
tentativas de o contornar antes de qualquer chamada ao modelo.

## Como sabe que não sabe

A regra mais importante do prompt: **nunca inventar**. Se uma ferramenta não devolver o dado,
o agente diz isso em vez de estimar. Num domínio onde um procedimento de bloqueio de energia
inventado pode matar alguém, recusar é a resposta correcta.

# 08 — Prontidão para GitHub e submissão

## Checklist

| Item | Estado | Nota |
|---|---|---|
| Repositório Git | ❌ **NÃO EXISTE** | Não há `.git` na raiz. Bloqueante absoluto. |
| Status limpo | n/a | Sem repositório |
| Commits | ❌ | Nenhum histórico |
| Branch / tags / releases | ❌ | — |
| `README.md` | ⚠️ parcial | Bom para o sistema HSE; **não menciona o agente de IA** |
| `.gitignore` | ✅ | Cobre `node_modules/`, `dist/`, `.angular/`, `.env`, `*.log` |
| Segredos fora do controlo | ✅ | `.env` está no `.gitignore`; as chaves cloud estão vazias |
| `.env.example` | ✅ | Documenta as 6 variáveis com comentários úteis |
| Instruções de setup | ✅ | README tem createdb, seed, backend e frontend |
| Scripts | ⚠️ | `dev`/`build`/`start` no backend; `start`/`build`/`test` no frontend. `test` está partido |
| Screenshots | ❌ | Nenhum no repositório |
| Demonstração | ❌ | Nenhum GIF ou vídeo |
| Dados de exemplo | ✅ | `database/data.json` + `seed.js`, dataset realista |
| Licença | ❌ | Sem `LICENSE` |
| Documento de arquitectura | ⚠️ | README tem a árvore de pastas; nada sobre IA (esta auditoria passa a cobrir) |
| Documentação | ⚠️ | Ver acima |
| Testes | ❌ | Zero ficheiros `.spec.ts`; `ng test` falha |
| Build | ✅ | `ng build` e `tsc --noEmit` passam |
| Instruções de review | ❌ | Sem indicação de por onde começar |
| CI | ❌ | Sem `.github/` |
| Docker da aplicação | ❌ | Sem `Dockerfile` nem `docker-compose.yml` (o Postgres corre num container criado à mão) |

---

## Ficheiros que não devem entrar no repositório

Verificado — o `.gitignore` já cobre os principais:

| Padrão | Coberto |
|---|---|
| `node_modules/` | ✅ |
| `dist/` | ✅ |
| `.angular/` (cache) | ✅ |
| `.env` | ✅ |
| `*.log` | ✅ |

**Não cobertos e a rever antes do primeiro commit:**

| Caminho | Recomendação |
|---|---|
| `frontend/hse-shot.js` | Script de screenshot com um caminho absoluto de máquina local embutido. Remover ou mover para `scripts/` com caminho relativo. |
| `frontend/.vscode/` | Decidir se as definições de editor devem ser partilhadas. |
| `.claude/` | Configuração do agente de desenvolvimento; provavelmente não pertence ao repositório público. |
| `docs/turing-sprint3-audit/` | Estes relatórios: manter é uma vantagem — demonstram reflexão, que é um critério avaliado. |

Não foram encontradas bases de dados locais, uploads nem builds fora de `dist/`.

---

## Problemas que podem prejudicar a avaliação

Por ordem de gravidade:

1. **Não há repositório.** Sem isto não há submissão. Custo: minutos.
2. **O agente não responde** quando usa ferramentas. Um revisor que teste o chat conclui que o
   agente não funciona. Ver [`06`](06_GAP_AND_ROADMAP.md) P0-1.
3. **Nenhuma chave de LLM configurada.** Mesmo com o ciclo corrigido, o revisor não consegue
   executar nada. É preciso deixar instruções claras — e idealmente um GIF da conversa real.
4. **O README não menciona o agente.** É o artefacto que o revisor lê primeiro e não há lá nada
   sobre IA: nem endpoints, nem tools, nem prompts, nem provedores.
5. **`npm test` falha com erro de configuração**, não com "0 testes". Dá a impressão de projecto
   partido. Ou criar testes, ou remover/ajustar o script.
6. **Sem screenshots nem demonstração.** Um sistema com esta qualidade de interface perde muito
   por não a mostrar.
7. **`frontend/hse-shot.js`** depende de `playwright-core`, que não está declarado no
   `package.json`. Quem clonar o repositório não o consegue correr.

---

## Sequência recomendada antes de publicar

```
1. Corrigir P0-1 e P0-2 (agente passa a responder)
2. Configurar uma chave de LLM e gravar a demonstração
3. Escrever a secção de IA no README
4. Rever ficheiros a excluir (hse-shot.js, .claude/)
5. git init && git add . && git commit
6. Confirmar que .env NÃO entrou:  git ls-files | grep .env
7. Publicar no GitHub
8. Adicionar screenshots/GIF ao README
```

O passo 6 é o que evita o erro irreversível: uma chave de API publicada num repositório fica no
histórico mesmo depois de removida.

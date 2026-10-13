# Auditoria da experiência do Colaborador — diagnóstico (somente leitura)

Nenhum arquivo foi alterado. Esta é uma auditoria; aprovar o plano NÃO implementa nada — as correções só serão feitas se você pedir depois.

## Limitação
- Tela aberta: não autenticada nesta sessão. Não há conta de colaborador autorizada para teste; não usei login real. Achados vêm da leitura do código atual.

## Achados confirmados no código

### P0 — bloqueia o uso
1. **Celular sem menu.** O menu lateral só aparece em telas médias/grandes (`hidden md:flex`) e não há botão de menu no celular. No celular o colaborador só vê logo, sino e "Sair": não consegue ir para Novo chamado, Meus chamados, Catálogo nem trocar de área. — `src/routes/_authenticated/route.tsx`
2. **Detalhe do chamado carrega para sempre** quando o chamado não existe, foi negado pelas permissões ou deu erro: a tela mostra "Carregando…" sem mensagem nem volta. — `src/routes/_authenticated/chamados.$id.tsx` (linha ~249)

### P1 — confuso ou incorreto
3. **"Meus chamados" diz "Chamados da área X" mas não filtra pela área**: mostra chamados de todas as áreas. — `chamados.index.tsx` (consulta sem `segmento_id`)
4. **Painel trava em "Carregando dashboard…" sem área escolhida** (ex.: acesso direto pelo link, localStorage limpo), em vez de mandar para "Áreas". — `dashboard.tsx` (linha ~77)
5. **Erros silenciosos**: Meus chamados, Conversas e o detalhe não mostram estado de erro; uma falha aparece como "Nenhum chamado encontrado" ou lista vazia. — `chamados.index.tsx`, `chamados.$id.tsx`
6. **Catálogo ignora a área atual**: lista itens de todas as áreas, enquanto o resto do portal é por área. — `catalogo.tsx`
7. **Rótulos duplicados/inconsistentes**: cartão "Total de chamados" com o mesmo texto nos dois casos; o mesmo botão de abrir chamado aparece duas vezes na mesma tela; marca "Vemplast SD" no celular vs "Mundo Vem" nos títulos. — `chamados.index.tsx`, `route.tsx`
8. **Saber para onde ir é difícil**: o login cai em "Áreas" (tela cheia, sem menu) e depois no painel; não há uma página inicial do colaborador com "Abrir chamado / Chamados aguardando você". — `index.tsx`, `areas.tsx`
9. **Abrir chamado — validação só por aviso (toast)**: os campos com erro não ficam destacados nem anunciados; se um anexo falhar, o chamado é criado mesmo assim e o aviso some. — `chamados.novo.tsx` (linhas ~84–88)

### P2 — melhorias
10. Acessibilidade: notas de avaliação (estrelas) e badges de status dependem só da cor/ícone; o carregamento não é anunciado para leitores de tela; as cores dos selos são fixas (não seguem a paleta).
11. Data/hora completa em cada linha da lista; não há paginação além de 100 chamados.
12. Pasta duplicada `routes/` na raiz do projeto (fora de `src/`), com cópias antigas de telas — risco de editar o arquivo errado.

## Hipóteses (precisam de login real como colaborador)
- Se as permissões deixam o colaborador comentar/anexar após o fechamento.
- Se o fluxo de avaliação + reabertura em 48h funciona do começo ao fim.
- Se comentários internos ficam realmente escondidos do colaborador (o código filtra; as permissões do banco não foram testadas).
- Layout real do formulário e do detalhe no celular (além do menu ausente).
- Lentidão no detalhe do chamado (tela grande, muitas consultas).

## Próximo passo sugerido (só se você pedir)
Corrigir na ordem P0 → P1. Para validar as hipóteses, autorize um login de colaborador de teste.

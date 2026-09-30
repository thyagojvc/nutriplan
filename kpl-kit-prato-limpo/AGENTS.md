# Regras do projeto Kit Prato Limpo

Estas regras se aplicam a todo trabalho neste projeto e devem ser seguidas sempre.

## Deploy

1. O deploy de produção sai **sempre desta pasta** (`kpl-kit-prato-limpo`), com `npx vercel --prod --yes --scope thyago-vieira-s-projects`. Nunca monte cópia, ZIP ou pasta de staging a partir do Git para publicar.
2. A pasta `entrega/` contém os PDFs que os clientes compram. Eles ficam fora do Git de propósito. Qualquer deploy feito a partir de uma cópia do Git sai sem eles e quebra a entrega de todo mundo.
3. Se o deploy falhar, pare, descubra a causa e explique ao usuário antes de tentar outro caminho. Não contorne a falha.
4. Nunca use `vercel promote`, `vercel alias` nem rollback sem pedir autorização ao usuário. Isso trava as atualizações seguintes do domínio.
5. Depois de todo deploy, teste em produção com `curl` pelo menos a página inicial, `/profissional` e um PDF de `entrega/`. Teste simulado não conta como teste de produção.

## Arquivos

6. Não crie arquivos ou pastas temporárias dentro do projeto. Use uma pasta temporária do sistema. Se criar algo temporário, apague ao final e diga ao usuário o que era.
7. Nunca rode `git add -A` nem `git add .`. Adicione somente os arquivos que você mudou, explicitamente pelo nome.
8. Antes de dizer que algo está pronto, rode `git status` e mostre ao usuário o que ficou sobrando.

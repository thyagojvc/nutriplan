# KPL — Kit Prato Limpo

Mini página de vendas (arquivo único) + checkout **Pix via PushInPay**, para deploy na Vercel.

- Front-end: `index.html` (HTML + CSS + JS puro, mobile first, sem framework)
- Back-end (serverless na Vercel): `api/create-charge.js`, `api/payment-status.js`, `api/webhook.js`
- Catálogo/preços no servidor: `api/_catalog.js` (fonte de verdade — o front nunca define o valor)

Cartão está **desligado** por decisão de negócio (só Pix por enquanto). A arquitetura já está pronta para religar: veja `api/create-charge.js` (branch `method === 'card'`).

---

## Fluxo de pagamento

1. Cliente preenche nome, e-mail, telefone, CPF e marca os order bumps.
2. Front valida + dispara `InitiateCheckout` (Pixel) → `POST /api/create-charge`.
3. Servidor **recalcula o total** pelos ids de bump e cria a cobrança na PushInPay.
4. Página mostra **QR Code + copia e cola** (botão copiar) e faz **polling a cada 5s** em `/api/payment-status`.
5. Ao aprovar, troca para a **tela de sucesso**, dispara `Purchase` (Pixel) e chama `/api/deliver-kit`, que reconsulta a PushInPay e manda um **e-mail de confirmação/recibo** pro cliente (via Resend) + um **aviso pra `ADMIN_ALERT_EMAIL`** com nome e WhatsApp do cliente.
6. **Entrega real hoje é manual pelo WhatsApp**: ainda não há PDF hospedado, então quem recebe o aviso do passo 5 precisa mandar o material manualmente pro WhatsApp cadastrado no checkout. Quando o PDF existir, trocar `api/deliver-kit.js` pra mandar o link direto e virar automático.
7. Em paralelo, `/api/webhook` recebe a confirmação da PushInPay. Ele é a **rede de segurança**: como não guarda o e-mail/WhatsApp do cliente, se a pessoa fechar a aba antes do polling confirmar, ele manda um aviso mais genérico (só o ID da transação) para `ADMIN_ALERT_EMAIL`.

---

## ✅ O que VOCÊ precisa preencher

### 1. Chaves e variáveis de ambiente (Vercel → Settings → Environment Variables)
Baseie-se no `.env.example`:

| Variável | Onde conseguir |
|---|---|
| `PUSHINPAY_TOKEN` | Painel da PushInPay → API/Integrações |
| `PUBLIC_BASE_URL` | URL do seu site na Vercel, ex.: `https://kit-prato-limpo.vercel.app` (sem barra final) |
| `PUSHINPAY_API_URL` | Só se a PushInPay indicar outra base (senão deixe o default) |
| `DELIVERY_*` | Credenciais do seu envio de e-mail (ver item 4) |

> ⚠️ Confirme no painel da PushInPay: **o valor da API é em centavos** (o código já envia assim) e **qual é o endpoint** de criar cobrança e de consultar status. Deixei os padrões conhecidos (`/api/pix/cashIn` e `/api/transactions/{id}`); se a sua conta usar outro path, ajuste em `api/create-charge.js` e `api/payment-status.js`.

### 2. Textos e identidade
Tudo no topo do `<script>` em `index.html`:
- **`CONFIG.META_PIXEL_ID`** → ID do seu Pixel do Meta.
- **`BUMPS`** → nome, descrição, tag, `priceCents` (com desconto) e `oldCents` (riscado) dos 2 bumps ativos. **Mantenha em sincronia com `api/_catalog.js`** (os preços de verdade estão lá).
- **`DEPOIMENTOS`** → já preenchido com 4 depoimentos reais (nome, idade do filho, texto e foto). Adicione novos no mesmo formato, sem usar uma estrutura fixa pra cada mãe escrever (isso deixa os textos com cara de padronizado/falso).
- E-mail de suporte: `kitpratolimpo@gmail.com` (aparece na garantia, no checkout, na tela de sucesso e no rodapé).
- Rodapé: só "Kit Prato Limpo · © 2026" (sem CNPJ, pendente formalização).
- `og:url` e `og:image` nas meta tags do `<head>` já apontam pro domínio e imagem atuais.

### 3. Imagens (pasta `assets/`)
Já preenchidas: mockup do hero, 4 imagens de prévia real, 4 fotos de depoimento, favicon e og-image. Falta apenas o PDF final do kit (ver item 4).

### 4. Entrega do kit (hoje manual por WhatsApp)
`api/deliver-kit.js` manda e-mail de confirmação pro cliente + aviso com WhatsApp pra `ADMIN_ALERT_EMAIL`. **Você precisa enviar o material manualmente pelo WhatsApp** de cada pedido aprovado, até o PDF existir. Quando tiver o PDF:
- Hospede (nome de arquivo longo/não-adivinhável, ex. em `assets/`).
- Coloque o link em `DELIVERY_KIT_URL`.
- Troque `confirmationEmailHtml()` em `api/deliver-kit.js` pra incluir o link de download e virar automático.

### 5. Webhook na PushInPay
O `webhook_url` já é enviado automaticamente pelo código em cada cobrança criada (não precisa cadastrar URL manualmente no painel). O que existe no painel PushInPay > Webhooks é um campo de **token de segurança** (header `x-pushinpay-token`): gere um valor aleatório, salve em `PUSHINPAY_WEBHOOK_TOKEN` (Vercel) e cole o mesmo valor lá no painel.

### 6. Idempotência (rede de segurança)
Em `api/webhook.js`, o controle de "já avisei" usa um `Set` em memória, que **não sobrevive entre invocações serverless**. Como esse caminho agora só dispara um e-mail de aviso pro suporte (não a entrega principal ao cliente), o impacto de um aviso duplicado é baixo — mas se quiser eliminar de vez, troque por uma marca persistente (Vercel KV, Upstash ou um banco).

---

## Rodar / publicar

```bash
# desenvolvimento local (roda as functions):
npx vercel dev

# deploy:
npx vercel --prod
```

Como o front chama `/api/...` no mesmo domínio, não há CORS a configurar. As chaves ficam só no servidor.

---

## Checklist rápido antes de vender
- [x] `PUSHINPAY_TOKEN` e `PUBLIC_BASE_URL` configurados na Vercel
- [x] Endpoints da PushInPay confirmados (criar cobrança / status)
- [x] Token de segurança do webhook colado no painel da PushInPay
- [x] `deliver-kit` implementado e testado (e-mail de confirmação + aviso ao admin)
- [ ] PDF do kit hospedado + `DELIVERY_KIT_URL` preenchida (entrega ainda é manual por WhatsApp)
- [x] Pixel ID preenchido; eventos disparando
- [x] Bumps de `index.html` e `api/_catalog.js` com os mesmos preços
- [x] Imagens reais no lugar dos placeholders
- [x] Depoimentos reais
- [ ] Teste de ponta a ponta com um Pix de valor baixo real

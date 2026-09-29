# Runbook — Dashboard de Vendas

Procedimentos operacionais para solo dev. Rodar de cabeça quando necessário.

---

## Rotacionar a Service Account do Google Sheets

1. Google Cloud Console → IAM & Admin → Service Accounts → conta configurada pra ler a planilha.
2. Aba "Keys" → "Add Key" → "Create new key" (JSON). Baixar.
3. Codificar em base64:
   ```powershell
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\caminho\service-account.json"))
   ```
4. Vercel → Project → Settings → Environment Variables → editar `GOOGLE_SA_KEY` com o novo base64.
5. Redeploy (ou aguardar próximo push). Validar com `pnpm run check:sheets` em dev usando o mesmo arquivo.
6. Voltar à Console e revogar a chave antiga (Disable → Delete após 24h).

**Cadência recomendada:** a cada 6 meses ou em qualquer suspeita.

---

## Adicionar/remover gestor (allowlist)

1. Vercel → Project → Settings → Environment Variables → editar `AUTH_ALLOWED_EMAILS` (CSV).
2. Redeploy ou esperar próximo push. **Sem build não propaga** (env de servidor é capturada em build/runtime — usar runtime via `process.env` é o caso aqui).
3. Confirmar com o gestor que ele consegue (ou não consegue mais) logar.

**Não adicionar** e-mails sem confirmação prévia. Pessoa errada na allowlist = vazamento.

---

## Forçar revalidação manual (cache de matrículas)

- **Pelo dashboard:** botão de refresh manual (RF-17). Rate-limited a 1×/min/usuário.
- **Por API (com bearer):** `curl -H "Authorization: Bearer $CRON_SECRET" https://<dominio>/api/cron/revalidate`

Se o cron Vercel parar de rodar, o cache fica antigo até alguém clicar refresh ou o TTL expirar (`CACHE_TTL_SECONDS`).

---

## Ler logs de auth

Vercel → Project → Logs → filtrar por `event=auth.signin`. Retenção 90d (RNF-12).

Campos esperados: `ts`, `emailHash`, `ok`, `reason` (se `ok=false`). Sem PII bruta — apenas hash do e-mail.

---

## Bumpar TTL de cache

Editar `CACHE_TTL_SECONDS` em Vercel env e redeploy. Default: 600 (10 min). Subir para 1800 (30 min) se houver pressão de rate limit.

O cron de revalidação (a cada 10 min) é independente do TTL — então TTL maior só afeta o pior caso quando o cron falha.

---

## Em incidente

1. Sentry alerta no e-mail do dev.
2. Verificar Vercel Logs do mesmo período.
3. Se for falha de Sheets: Status do Google Workspace → confirmar incident upstream → comunicar gestores se persistir > 30min.
4. Se for falha de Auth: tentar logar em janela anônima → se quebrar, revogar e regerar `NEXTAUTH_SECRET` é último recurso (invalida todas as sessões).

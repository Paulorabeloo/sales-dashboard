https://github.com/user-attachments/assets/4f27c9c4-fcbb-4b78-b39d-d0601960fbb5


# Sales Dashboard

Internal web dashboard that replaced a legacy BI tool. It turns a Google Sheets
operation into 13 decision-oriented KPIs, each one answering a question a manager
actually asks.

> **Privacy note:** this repository ships no production data. Test fixtures are
> fully synthetic, the access allowlist is read from an environment variable, and
> the polo alias map is intentionally empty.

## KPIs

| KPI | Question it answers |
| --- | --- |
| Overlaid cohort curves | Are we ahead of or behind previous cycles? |
| Close projection | If the current pace holds, where do we land? |
| Seller Pareto | How concentrated is revenue in a single person? |
| Day by hour heatmap | When is the real closing window? |
| Z-score outlier detection | Who is off the curve, up or down? |
| Channel evolution per cycle | Which source is growing and which is fading? |

## Stack

- **Next.js 14** (App Router) with **TypeScript**
- **Tailwind CSS** for styling
- **Auth.js / NextAuth** with Google OAuth and an email allowlist
- **Google Sheets API** as the data source, behind a typed adapter layer
- **Vitest** (unit and integration) and **Playwright** (E2E)
- **GitHub Actions** for CI, **ESLint** and **Prettier** for code style

## Architecture

```
src/
  app/(protected)/      Authenticated routes: sales, sellers, polos, campaigns, day
  lib/sheets/           Adapter, schema, normalizer, parsers, sanitizer
  lib/aggregations/     22 pure modules, one per metric
  lib/auth/             Allowlist and audit logging
  components/charts/    26 chart and table components
middleware.ts           Edge-level route protection
```

Access control is enforced twice: once in Auth.js and once in the Edge
middleware. The allowlist is fail-closed, so an empty list denies everyone.

## Getting started

```bash
pnpm install
cp .env.example .env.local   # then fill in the values
pnpm dev
```

### Environment variables

| Variable | Purpose |
| --- | --- |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google OAuth credentials |
| `AUTH_ALLOWED_EMAILS` | Comma-separated allowlist of authorized emails |
| `AUTH_SECRET` | Auth.js session secret |
| `GOOGLE_SA_KEY` | Service account key for the Sheets API |
| `SHEETS_ID` / `SHEETS_RANGE` | Source spreadsheet and range |
| `CACHE_TTL_SECONDS` | Server-side cache lifetime |

## Tests

```bash
pnpm test         # Vitest: unit and integration
pnpm test:e2e     # Playwright: end-to-end
```

Operational procedures are documented in [`docs/runbook.md`](docs/runbook.md).

---

# Dashboard de Vendas

Dashboard web interno que substituiu uma ferramenta de BI legada. Ele transforma
uma operação rodando em Google Sheets em 13 KPIs orientados à decisão, cada um
respondendo a uma pergunta que um gestor realmente faz.

> **Nota de privacidade:** este repositório não contém nenhum dado de produção.
> As fixtures de teste são inteiramente sintéticas, a allowlist de acesso vem de
> variável de ambiente e o mapa de aliases de polos está intencionalmente vazio.

## KPIs

| KPI | Pergunta que responde |
| --- | --- |
| Curvas de cohort sobrepostas | Estamos à frente ou atrás dos ciclos passados? |
| Projeção de fechamento | Se mantiver o ritmo, fechamos com quanto? |
| Pareto de vendedoras | Qual é a concentração de risco em uma pessoa? |
| Heatmap de dia por hora | Qual é a janela real de fechamento? |
| Detecção de outliers por z-score | Quem está fora da curva, para cima ou para baixo? |
| Evolução de canais por ciclo | Qual fonte está crescendo e qual está murchando? |

## Stack

- **Next.js 14** (App Router) com **TypeScript**
- **Tailwind CSS** para estilização
- **Auth.js / NextAuth** com Google OAuth e allowlist de e-mails
- **Google Sheets API** como fonte de dados, atrás de uma camada de adapter tipada
- **Vitest** (unitário e integração) e **Playwright** (E2E)
- **GitHub Actions** para CI, **ESLint** e **Prettier** para padrão de código

## Arquitetura

```
src/
  app/(protected)/      Rotas autenticadas: vendas, vendedoras, polos, campanhas, dia
  lib/sheets/           Adapter, schema, normalizer, parsers, sanitizer
  lib/aggregations/     22 módulos puros, um por métrica
  lib/auth/             Allowlist e log de auditoria
  components/charts/    26 componentes de gráfico e tabela
middleware.ts           Proteção de rotas na camada Edge
```

O controle de acesso é aplicado duas vezes: no Auth.js e no middleware Edge.
A allowlist é fail-closed, então lista vazia nega o acesso de todo mundo.

## Como rodar

```bash
pnpm install
cp .env.example .env.local   # depois preencha os valores
pnpm dev
```

### Variáveis de ambiente

| Variável | Para que serve |
| --- | --- |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Credenciais do Google OAuth |
| `AUTH_ALLOWED_EMAILS` | Lista de e-mails autorizados, separados por vírgula |
| `AUTH_SECRET` | Segredo de sessão do Auth.js |
| `GOOGLE_SA_KEY` | Chave da service account para a API do Sheets |
| `SHEETS_ID` / `SHEETS_RANGE` | Planilha de origem e intervalo |
| `CACHE_TTL_SECONDS` | Tempo de vida do cache no servidor |

## Testes

```bash
pnpm test         # Vitest: unitário e integração
pnpm test:e2e     # Playwright: ponta a ponta
```

Os procedimentos operacionais estão documentados em [`docs/runbook.md`](docs/runbook.md).

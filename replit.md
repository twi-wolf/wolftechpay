# Buy Me a Coffee

A creator support / tipping platform styled as a "Buy Me a Coffee" site. Supporters can buy the creator one or more coffees, leave their name and a personal message, then pay via M-Pesa (Kenya) or card using the Paystack payment gateway.

## Stack

- **Frontend**: React + Vite, TanStack Query, Tailwind CSS, Wouter (routing), React Hook Form + Zod
- **Backend**: Express.js (TypeScript), Drizzle ORM, PostgreSQL
- **Payments**: Paystack API — M-Pesa STK push (Kenya) and card redirect flow
- **Fonts**: Playfair Display (headings), Nunito (body), Fira Code (mono)
- **Theme**: Warm dark amber/coffee aesthetic

## Key Files

| Path | Purpose |
|------|---------|
| `client/src/pages/Home.tsx` | Main page — coffee count selector, name/message/email fields, payment forms, success screen |
| `client/src/hooks/use-payments.ts` | API hooks for payment init, mobile money, status polling, verification |
| `server/routes.ts` | API endpoints — rates, M-Pesa, card init, card verify |
| `server/storage.ts` | Database access layer |
| `shared/schema.ts` | Drizzle schema — `transactions` table |
| `shared/routes.ts` | Zod input schemas shared between client and server |
| `shared/countries.ts` | Supported countries, currencies, mobile money providers |
| `client/src/index.css` | Global styles and CSS variables (warm amber theme) |

## Database Schema

`transactions` table:
- `id` — serial PK
- `email` — varchar(255), required
- `amount` — integer (KES)
- `reference` — varchar(255) — Paystack reference
- `method` — varchar(50) — `card`, `mpesa`, `mobilemoney`
- `status` — varchar(50) — `pending`, `success`, `failed`, `abandoned`, `timeout`
- `name` — varchar(255), nullable — supporter's name
- `message` — text, nullable — supporter's message
- `created_at` — timestamp

## Environment Variables / Secrets

| Name | Purpose |
|------|---------|
| `DATABASE_URL` | PostgreSQL connection string (managed by Replit) |
| `PAYSTACK_SECRET_KEY` | Paystack secret key for payment processing |
| `PORT` | Server port (default 5000) |

## Payment Flow

1. Supporter selects number of coffees (1, 3, 5 or custom) at 100 KES each
2. Enters optional name and message
3. Selects country → chooses M-Pesa or card
4. **M-Pesa**: STK push sent, frontend polls until terminal status
5. **Card**: Redirected to Paystack checkout, redirected back with `?reference=...`
6. Success screen shows thank-you with cups, name, and message

## Dev Commands

```bash
npm run dev       # Start dev server (port 5000)
npm run build     # Build for production
npm run db:push   # Sync Drizzle schema to DB
```

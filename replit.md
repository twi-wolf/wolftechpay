# WOLFTECH - Bot Deployment Payment Portal

## Overview
A payment portal for bot deployment services. Users pay 70 KES via either M-Pesa STK push or card payment using Paystack. After successful payment, a formatted JSON receipt is displayed for the user to screenshot and share with the admin.

## Stack
- **Frontend**: React + Vite + TypeScript + Tailwind CSS + TanStack Query
- **Backend**: Express.js + TypeScript
- **Database**: PostgreSQL (Drizzle ORM)
- **Payments**: Paystack (STK push + Card)

## Theme
- Dark black background with neon green (#39FF14) as the primary color
- Oxanium display font, Rajdhani body font, Fira Code mono font
- CRT/scanline aesthetic with glowing effects

## Key Features
- M-Pesa STK push payment (default tab): prompts user for email + phone number
- Card payment: redirects to Paystack hosted checkout
- After payment, shows a formatted JSON datablock for screenshotting
- Auto-polls M-Pesa status every 3 seconds until confirmed or failed

## API Endpoints
- `POST /api/payments/init` — Initialize card payment (returns authorizationUrl)
- `POST /api/payments/stk` — Send M-Pesa STK push
- `GET /api/payments/stk/:reference` — Poll M-Pesa charge status
- `POST /api/payments/verify` — Verify card payment after Paystack redirect

## Database Schema
- `transactions`: id, email, amount, reference, method (card|mpesa), status (pending|success|failed), createdAt

## Environment Variables
- `PAYSTACK_SECRET_KEY` — Paystack secret key (set as Replit Secret)
- `DATABASE_URL` — PostgreSQL connection string (auto-managed)

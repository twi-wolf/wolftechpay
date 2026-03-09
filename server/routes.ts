import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { getCountry } from "@shared/countries";
import { z } from "zod";
import https from "https";

function paystackRequest(options: https.RequestOptions, body?: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('Invalid JSON from Paystack')); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

const BASE_AMOUNT_KES = 70;

let cachedRates: Record<string, number> | null = null;
let ratesCachedAt = 0;
const RATES_TTL_MS = 60 * 60 * 1000;

async function fetchRates(): Promise<Record<string, number>> {
  const now = Date.now();
  if (cachedRates && now - ratesCachedAt < RATES_TTL_MS) return cachedRates;

  try {
    const result = await new Promise<any>((resolve, reject) => {
      const req = https.request({
        hostname: 'open.er-api.com',
        path: '/v6/latest/KES',
        method: 'GET',
      }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try { resolve(JSON.parse(data)); }
          catch (e) { reject(new Error('Invalid JSON from exchange rate API')); }
        });
      });
      req.on('error', reject);
      req.end();
    });

    if (result.result === 'success' && result.rates) {
      cachedRates = result.rates;
      ratesCachedAt = now;
      return cachedRates!;
    }
  } catch (err) {
    console.error('Failed to fetch exchange rates:', err);
  }

  const fallback: Record<string, number> = {
    KES: 1, NGN: 5.8, GHS: 0.055, ZAR: 0.13, EGP: 2.24, RWF: 10.7, XOF: 36.0,
  };
  return fallback;
}

async function convertFromKES(amountKES: number, toCurrency: string): Promise<number> {
  const rates = await fetchRates();
  const rate = rates[toCurrency] ?? 1;
  return Math.round(amountKES * rate * 100);
}

function normalizePhone(phone: string, countryCode: string): string {
  let p = phone.replace(/\s+/g, '').replace(/^\+/, '');
  const prefixMap: Record<string, string> = {
    KE: '254', GH: '233', CI: '225', NG: '234', ZA: '27', EG: '20', RW: '250',
  };
  const dialCode = prefixMap[countryCode] || '';
  if (dialCode && p.startsWith('0')) p = dialCode + p.slice(1);
  if (dialCode && !p.startsWith(dialCode)) p = dialCode + p;
  return '+' + p;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

  app.get(api.payments.rates.path, async (_req, res) => {
    try {
      const rates = await fetchRates();
      const currencies = ['KES', 'NGN', 'GHS', 'ZAR', 'EGP', 'RWF', 'XOF'];
      const filtered: Record<string, number> = {};
      for (const c of currencies) { if (rates[c]) filtered[c] = rates[c]; }
      res.status(200).json({ rates: filtered });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Failed to fetch exchange rates' });
    }
  });

  app.post(api.payments.init.path, async (req, res) => {
    try {
      const input = api.payments.init.input.parse(req.body);
      if (!PAYSTACK_SECRET_KEY) return res.status(500).json({ message: "Payment gateway not configured." });

      const country = getCountry(input.country);
      const currency = country?.currency || 'KES';
      const amountInSmallestUnit = await convertFromKES(BASE_AMOUNT_KES, currency);

      const body = JSON.stringify({
        email: input.email,
        amount: amountInSmallestUnit,
        currency,
        callback_url: `${req.protocol}://${req.get("host")}/`,
      });

      const response = await paystackRequest({
        hostname: 'api.paystack.co',
        port: 443,
        path: '/transaction/initialize',
        method: 'POST',
        headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json' },
      }, body);

      if (response.status) {
        await storage.createTransaction({
          email: input.email,
          amount: BASE_AMOUNT_KES,
          reference: response.data.reference,
          method: "card",
        });
        res.status(200).json({ authorizationUrl: response.data.authorization_url, reference: response.data.reference });
      } else {
        res.status(500).json({ message: response.message || "Failed to initialize payment" });
      }
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      console.error(err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.post(api.payments.mobilemoney.path, async (req, res) => {
    try {
      const input = api.payments.mobilemoney.input.parse(req.body);
      if (!PAYSTACK_SECRET_KEY) return res.status(500).json({ message: "Payment gateway not configured." });

      const country = getCountry(input.country);
      const currency = country?.currency || 'KES';
      const amountInSmallestUnit = await convertFromKES(BASE_AMOUNT_KES, currency);
      const phone = normalizePhone(input.phone, input.country);
      const email = input.email || `user.${phone}@wolftech.pay`;

      const body = JSON.stringify({
        email,
        amount: amountInSmallestUnit,
        currency,
        mobile_money: { phone, provider: input.provider },
      });

      const response = await paystackRequest({
        hostname: 'api.paystack.co',
        port: 443,
        path: '/charge',
        method: 'POST',
        headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json' },
      }, body);

      if (response.status) {
        const ref = response.data.reference;
        const displayText = response.data.display_text || "Check your phone and authorize the payment.";
        const status = response.data.status;
        const method = input.provider === 'mpesa' ? 'mpesa' : 'mobilemoney';

        await storage.createTransaction({
          email,
          amount: BASE_AMOUNT_KES,
          reference: ref,
          method,
        });

        res.status(200).json({ reference: ref, displayText, status });
      } else {
        res.status(500).json({ message: response.message || "Failed to initiate mobile money payment" });
      }
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      console.error(err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.get('/api/payments/mobilemoney/:reference', async (req, res) => {
    try {
      const reference = req.params.reference;
      if (!PAYSTACK_SECRET_KEY) return res.status(500).json({ message: "Payment gateway not configured." });

      const response = await paystackRequest({
        hostname: 'api.paystack.co',
        port: 443,
        path: `/charge/${encodeURIComponent(reference)}`,
        method: 'GET',
        headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
      });

      if (response.status && response.data.status === 'success') {
        const updated = await storage.updateTransactionStatus(reference, "success");
        return res.status(200).json(updated);
      }

      const tx = await storage.getTransactionByReference(reference);
      if (!tx) return res.status(404).json({ message: "Transaction not found" });

      const psStatus = response.data?.status;
      if (psStatus && psStatus !== 'pay_offline' && psStatus !== 'pending') {
        await storage.updateTransactionStatus(reference, psStatus);
      }

      res.status(200).json(tx);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.post(api.payments.stk.path, async (req, res) => {
    try {
      const input = api.payments.stk.input.parse(req.body);
      if (!PAYSTACK_SECRET_KEY) return res.status(500).json({ message: "Payment gateway not configured." });

      let phone = input.phone.replace(/\s+/g, '').replace(/^\+/, '');
      if (phone.startsWith('0')) phone = '254' + phone.slice(1);
      if (!phone.startsWith('254')) phone = '254' + phone;
      phone = '+' + phone;

      const body = JSON.stringify({
        email: input.email,
        amount: BASE_AMOUNT_KES * 100,
        currency: "KES",
        mobile_money: { phone, provider: "mpesa" },
      });

      const response = await paystackRequest({
        hostname: 'api.paystack.co',
        port: 443,
        path: '/charge',
        method: 'POST',
        headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json' },
      }, body);

      if (response.status) {
        const ref = response.data.reference;
        const displayText = response.data.display_text || "Check your phone for the STK push prompt.";
        const status = response.data.status;

        await storage.createTransaction({
          email: input.email,
          amount: BASE_AMOUNT_KES,
          reference: ref,
          method: "mpesa",
        });

        res.status(200).json({ reference: ref, displayText, status });
      } else {
        res.status(500).json({ message: response.message || "Failed to send STK push" });
      }
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      console.error(err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.get('/api/payments/stk/:reference', async (req, res) => {
    try {
      const reference = req.params.reference;
      if (!PAYSTACK_SECRET_KEY) return res.status(500).json({ message: "Payment gateway not configured." });

      const response = await paystackRequest({
        hostname: 'api.paystack.co',
        port: 443,
        path: `/charge/${encodeURIComponent(reference)}`,
        method: 'GET',
        headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
      });

      if (response.status && response.data.status === 'success') {
        const updated = await storage.updateTransactionStatus(reference, "success");
        return res.status(200).json(updated);
      }

      const tx = await storage.getTransactionByReference(reference);
      if (!tx) return res.status(404).json({ message: "Transaction not found" });

      const psStatus = response.data?.status;
      if (psStatus && psStatus !== 'pay_offline' && psStatus !== 'pending') {
        await storage.updateTransactionStatus(reference, psStatus);
      }

      res.status(200).json(tx);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.post(api.payments.verify.path, async (req, res) => {
    try {
      const input = api.payments.verify.input.parse(req.body);
      if (!PAYSTACK_SECRET_KEY) return res.status(500).json({ message: "Payment gateway not configured." });

      const tx = await storage.getTransactionByReference(input.reference);
      if (!tx) return res.status(404).json({ message: "Transaction not found" });
      if (tx.status === "success") return res.status(200).json(tx);

      const response = await paystackRequest({
        hostname: 'api.paystack.co',
        port: 443,
        path: `/transaction/verify/${encodeURIComponent(input.reference)}`,
        method: 'GET',
        headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
      });

      const psStatus = response.data?.status;
      const updated = await storage.updateTransactionStatus(input.reference, psStatus === 'success' ? 'success' : psStatus || 'failed');
      res.status(200).json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      console.error(err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  return httpServer;
}

import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
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

const AMOUNT_KES = 70;
const AMOUNT_CENTS = AMOUNT_KES * 100;

function normalizeKenyanPhone(phone: string): string {
  let p = phone.replace(/\s+/g, '').replace(/^\+/, '');
  if (p.startsWith('0')) p = '254' + p.slice(1);
  if (!p.startsWith('254')) p = '254' + p;
  return '+' + p;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

  // --- Mobile Money (M-Pesa / Airtel Kenya) ---
  app.post(api.payments.mobilemoney.path, async (req, res) => {
    try {
      const input = api.payments.mobilemoney.input.parse(req.body);
      if (!PAYSTACK_SECRET_KEY) return res.status(500).json({ message: "Payment gateway not configured." });

      const phone = normalizeKenyanPhone(input.phone);
      const cleanPhone = phone.replace(/\D/g, '');
      const email = input.email || `user.${cleanPhone}@wolftech.pay`;

      const body = JSON.stringify({
        email,
        amount: AMOUNT_CENTS,
        currency: "KES",
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
          amount: AMOUNT_KES,
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

  // --- Poll mobile money status ---
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

      const psStatus = response.data?.status as string | undefined;
      const psMessage = response.data?.message as string | undefined;

      const TERMINAL_STATUSES = ['success', 'failed', 'abandoned', 'timeout'];
      const PENDING_STATUSES = ['pay_offline', 'pending', 'send_pin', 'send_otp'];

      if (response.status && psStatus === 'success') {
        const updated = await storage.updateTransactionStatus(reference, 'success');
        return res.status(200).json({ ...updated, psMessage });
      }

      const tx = await storage.getTransactionByReference(reference);
      if (!tx) return res.status(404).json({ message: "Transaction not found" });

      if (psStatus && !PENDING_STATUSES.includes(psStatus)) {
        const newStatus = TERMINAL_STATUSES.includes(psStatus) ? psStatus : 'failed';
        const updated = await storage.updateTransactionStatus(reference, newStatus);
        return res.status(200).json({ ...updated, psMessage });
      }

      res.status(200).json({ ...tx, psMessage });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // --- Card Payment: Initialize redirect flow ---
  app.post(api.payments.init.path, async (req, res) => {
    try {
      const input = api.payments.init.input.parse(req.body);
      if (!PAYSTACK_SECRET_KEY) return res.status(500).json({ message: "Payment gateway not configured." });

      const body = JSON.stringify({
        email: input.email,
        amount: AMOUNT_CENTS,
        currency: "KES",
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
          amount: AMOUNT_KES,
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

  // --- Card: Verify after redirect ---
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

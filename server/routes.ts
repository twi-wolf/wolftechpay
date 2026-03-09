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

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

  // --- Card Payment: Initialize redirect flow ---
  app.post(api.payments.init.path, async (req, res) => {
    try {
      const input = api.payments.init.input.parse(req.body);
      if (!PAYSTACK_SECRET_KEY) return res.status(500).json({ message: "Payment gateway not configured." });

      const body = JSON.stringify({
        email: input.email,
        amount: 70 * 100,
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
          amount: 70,
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

  // --- M-Pesa: Initiate STK Push via Paystack Charge API ---
  app.post(api.payments.stk.path, async (req, res) => {
    try {
      const input = api.payments.stk.input.parse(req.body);
      if (!PAYSTACK_SECRET_KEY) return res.status(500).json({ message: "Payment gateway not configured." });

      // Normalize phone: ensure it starts with 254
      let phone = input.phone.replace(/\s+/g, '').replace(/^\+/, '');
      if (phone.startsWith('0')) phone = '254' + phone.slice(1);
      if (!phone.startsWith('254')) phone = '254' + phone;

      const body = JSON.stringify({
        email: input.email,
        amount: 70 * 100,
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

        // Save as pending
        await storage.createTransaction({
          email: input.email,
          amount: 70,
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

  // --- M-Pesa: Poll charge status ---
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

      // Still pending or failed
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

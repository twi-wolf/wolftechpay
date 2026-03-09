import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import https from "https";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

  app.post(api.payments.init.path, async (req, res) => {
    try {
      const input = api.payments.init.input.parse(req.body);
      const amountKES = 70; // 70 KES
      const amountKobo = amountKES * 100; // Paystack expects lowest denomination

      if (!PAYSTACK_SECRET_KEY) {
         return res.status(500).json({ message: "Payment gateway not configured." });
      }

      const params = JSON.stringify({
        email: input.email,
        amount: amountKobo,
        currency: "KES",
        callback_url: `${req.protocol}://${req.get("host")}/` // Redirects back to homepage
      });

      const options = {
        hostname: 'api.paystack.co',
        port: 443,
        path: '/transaction/initialize',
        method: 'POST',
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json'
        }
      };

      const paystackReq = https.request(options, paystackRes => {
        let data = '';
        paystackRes.on('data', (chunk) => {
          data += chunk;
        });
        paystackRes.on('end', async () => {
          const response = JSON.parse(data);
          if (response.status) {
            // Save transaction to DB as pending
            await storage.createTransaction({
              email: input.email,
              amount: amountKES,
              reference: response.data.reference
            });

            res.status(200).json({
              authorizationUrl: response.data.authorization_url,
              reference: response.data.reference
            });
          } else {
            res.status(500).json({ message: response.message || "Failed to initialize payment" });
          }
        });
      }).on('error', error => {
        console.error(error);
        res.status(500).json({ message: "Network error with payment gateway" });
      });

      paystackReq.write(params);
      paystackReq.end();

    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.post(api.payments.verify.path, async (req, res) => {
    try {
      const input = api.payments.verify.input.parse(req.body);
      const reference = input.reference;

      if (!PAYSTACK_SECRET_KEY) {
         return res.status(500).json({ message: "Payment gateway not configured." });
      }

      // Check DB first
      const transaction = await storage.getTransactionByReference(reference);
      if (!transaction) {
         return res.status(404).json({ message: "Transaction not found" });
      }

      if (transaction.status === "success") {
         return res.status(200).json(transaction);
      }

      const options = {
        hostname: 'api.paystack.co',
        port: 443,
        path: `/transaction/verify/${encodeURIComponent(reference)}`,
        method: 'GET',
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`
        }
      };

      https.request(options, paystackRes => {
        let data = '';
        paystackRes.on('data', (chunk) => {
          data += chunk;
        });
        paystackRes.on('end', async () => {
          const response = JSON.parse(data);
          if (response.status && response.data.status === 'success') {
            const updated = await storage.updateTransactionStatus(reference, "success");
            res.status(200).json(updated);
          } else {
            const status = response.data ? response.data.status : 'failed';
            const updated = await storage.updateTransactionStatus(reference, status);
            res.status(200).json(updated); // We still return 200, but transaction will have 'failed' status
          }
        });
      }).on('error', error => {
        console.error(error);
        res.status(500).json({ message: "Network error with payment gateway" });
      }).end();

    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  return httpServer;
}

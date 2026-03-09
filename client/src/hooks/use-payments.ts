import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { z } from "zod";

export function useInitPayment() {
  return useMutation({
    mutationFn: async (email: string) => {
      const payload = api.payments.init.input.parse({ email });
      
      const res = await fetch(api.payments.init.path, {
        method: api.payments.init.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      
      if (!res.ok) {
        if (res.status === 400) {
          const error = api.payments.init.responses[400].parse(await res.json());
          throw new Error(error.message);
        }
        throw new Error("Failed to initialize payment gateway");
      }
      
      return api.payments.init.responses[200].parse(await res.json());
    },
  });
}

// We use useQuery with a POST method here because verification is effectively a read operation
// that relies on a single-use token (reference), and we want it to run automatically on mount
// when the reference is present in the URL.
export function useVerifyPaymentQuery(reference: string | null) {
  return useQuery({
    queryKey: [api.payments.verify.path, reference],
    queryFn: async () => {
      if (!reference) throw new Error("No reference provided");
      
      const payload = api.payments.verify.input.parse({ reference });
      
      const res = await fetch(api.payments.verify.path, {
        method: api.payments.verify.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      
      if (!res.ok) {
        if (res.status === 404) throw new Error("Transaction not found or already verified");
        throw new Error("Verification failed. Contact support if you were charged.");
      }
      
      return api.payments.verify.responses[200].parse(await res.json());
    },
    enabled: !!reference,
    retry: false, // Don't retry payment verifications
    refetchOnWindowFocus: false, // Don't double-verify if they switch tabs
  });
}

import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";

export function useInitPayment() {
  return useMutation({
    mutationFn: async (email: string) => {
      const res = await fetch(api.payments.init.path, {
        method: api.payments.init.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to initialize payment gateway");
      return json as { authorizationUrl: string; reference: string };
    },
  });
}

export function useInitStkPush() {
  return useMutation({
    mutationFn: async ({ email, phone }: { email: string; phone: string }) => {
      const res = await fetch(api.payments.stk.path, {
        method: api.payments.stk.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, phone }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to send STK push");
      return json as { reference: string; displayText: string; status: string };
    },
  });
}

export function usePollStkStatus(reference: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['/api/payments/stk', reference],
    queryFn: async () => {
      if (!reference) throw new Error("No reference");
      const res = await fetch(`/api/payments/stk/${reference}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to check status");
      return json as import("@shared/schema").Transaction;
    },
    enabled: !!reference && enabled,
    refetchInterval: (query) => {
      const data = query.state.data as import("@shared/schema").Transaction | undefined;
      if (data?.status === "success" || data?.status === "failed") return false;
      return 3000;
    },
    refetchOnWindowFocus: false,
  });
}

export function useVerifyPaymentQuery(reference: string | null) {
  return useQuery({
    queryKey: [api.payments.verify.path, reference],
    queryFn: async () => {
      if (!reference) throw new Error("No reference provided");
      const res = await fetch(api.payments.verify.path, {
        method: api.payments.verify.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Verification failed. Contact support if you were charged.");
      return json as import("@shared/schema").Transaction;
    },
    enabled: !!reference,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

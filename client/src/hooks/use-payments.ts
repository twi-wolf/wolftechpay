import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";

export function useExchangeRates() {
  return useQuery({
    queryKey: [api.payments.rates.path],
    queryFn: async () => {
      const res = await fetch(api.payments.rates.path);
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to fetch rates");
      return json as { rates: Record<string, number> };
    },
    staleTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useInitPayment() {
  return useMutation({
    mutationFn: async ({
      email,
      country,
      amountKes,
      name,
      message,
    }: {
      email: string;
      country: string;
      amountKes?: number;
      name?: string;
      message?: string;
    }) => {
      const res = await fetch(api.payments.init.path, {
        method: api.payments.init.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, country, amountKes, name, message }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to initialize payment gateway");
      return json as { authorizationUrl: string; reference: string };
    },
  });
}

export function useInitMobileMoney() {
  return useMutation({
    mutationFn: async (payload: {
      email?: string;
      phone: string;
      provider: string;
      country: string;
      amountKes?: number;
      name?: string;
      message?: string;
    }) => {
      const res = await fetch(api.payments.mobilemoney.path, {
        method: api.payments.mobilemoney.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to initiate mobile money payment");
      return json as { reference: string; displayText: string; status: string };
    },
  });
}

export function usePollMobileMoneyStatus(reference: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['/api/payments/mobilemoney', reference],
    queryFn: async () => {
      if (!reference) throw new Error("No reference");
      const res = await fetch(`/api/payments/mobilemoney/${reference}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to check status");
      return json as import("@shared/schema").Transaction & { psMessage?: string };
    },
    enabled: !!reference && enabled,
    refetchInterval: (query) => {
      const data = query.state.data as (import("@shared/schema").Transaction & { psMessage?: string }) | undefined;
      const done = ["success", "failed", "abandoned", "timeout"];
      if (data?.status && done.includes(data.status)) return false;
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

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useExchangeRates,
  useInitPayment,
  useInitMobileMoney,
  usePollMobileMoneyStatus,
  useVerifyPaymentQuery,
} from "@/hooks/use-payments";
import { COUNTRIES, KENYA, type CountryConfig } from "@shared/countries";
import type { Transaction } from "@shared/schema";
import {
  Terminal,
  ShieldCheck,
  AlertTriangle,
  Zap,
  CheckSquare,
  Loader2,
  CreditCard,
  Smartphone,
  ChevronDown,
  Globe,
} from "lucide-react";

const BASE_KES = 70;

function convertAmount(rates: Record<string, number> | undefined, currency: string): number {
  if (!rates || currency === "KES") return BASE_KES;
  return Math.round(BASE_KES * (rates[currency] ?? 1) * 100) / 100;
}

function formatAmount(amount: number, currency: string): string {
  if (currency === "XOF" || currency === "RWF" || currency === "TZS" || currency === "UGX") {
    return `${Math.round(amount).toLocaleString()} ${currency}`;
  }
  return `${amount.toFixed(2)} ${currency}`;
}

function PageContainer({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen scanline-overlay flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="w-full max-w-lg z-10 relative">
        <div className="text-center mb-10">
          <h1
            className="text-6xl md:text-7xl font-black text-primary animate-flicker glow-text uppercase tracking-widest"
            style={{ fontFamily: "var(--font-display)" }}
          >
            WOLFTECH
          </h1>
          <p className="text-primary/70 text-sm font-bold tracking-[0.3em] mt-2 flex items-center justify-center gap-2">
            <Terminal className="w-4 h-4" /> SECURE BOT DEPLOYMENT
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}

function CornerDeco() {
  return (
    <>
      <div className="pointer-events-none absolute -top-px -left-px w-5 h-5 border-t-2 border-l-2 border-primary" />
      <div className="pointer-events-none absolute -top-px -right-px w-5 h-5 border-t-2 border-r-2 border-primary" />
      <div className="pointer-events-none absolute -bottom-px -left-px w-5 h-5 border-b-2 border-l-2 border-primary" />
      <div className="pointer-events-none absolute -bottom-px -right-px w-5 h-5 border-b-2 border-r-2 border-primary" />
    </>
  );
}

function FormField({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-bold text-primary/80 tracking-widest flex items-center gap-2">
        <span className="w-2 h-2 bg-primary/80 rounded-sm inline-block" />
        {label}
      </label>
      {children}
      {error && (
        <p className="text-destructive text-sm font-semibold flex items-center gap-1">
          <AlertTriangle className="w-4 h-4" /> {error}
        </p>
      )}
    </div>
  );
}

function SubmitButton({ pending, label, pendingLabel }: { pending: boolean; label: string; pendingLabel: string }) {
  return (
    <button
      type="submit"
      disabled={pending}
      data-testid="button-submit"
      className="w-full bg-primary text-black font-black text-lg py-4 tracking-[0.2em] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 group"
    >
      {pending ? (
        <>
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>{pendingLabel}</span>
        </>
      ) : (
        <>
          <span>{label}</span>
          <Zap className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
        </>
      )}
    </button>
  );
}

function CountrySelector({
  selected,
  onChange,
}: {
  selected: CountryConfig;
  onChange: (c: CountryConfig) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-2">
      <label className="text-xs font-bold text-primary/80 tracking-widest flex items-center gap-2">
        <Globe className="w-3 h-3" /> SELECT YOUR COUNTRY
      </label>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full bg-black/50 border border-primary/30 px-4 py-3 text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all font-mono flex items-center justify-between"
        >
          <span className="flex items-center gap-3">
            <span className="text-xl">{selected.flag}</span>
            <span>{selected.name}</span>
            <span className="text-primary/50 text-xs">({selected.currency})</span>
          </span>
          <ChevronDown className={`w-4 h-4 text-primary/60 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {open && (
          <div className="absolute top-full left-0 right-0 z-50 bg-black border border-primary/30 max-h-60 overflow-y-auto shadow-2xl">
            {COUNTRIES.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => { onChange(c); setOpen(false); }}
                className={`w-full px-4 py-3 text-left font-mono flex items-center gap-3 transition-colors ${
                  c.code === selected.code
                    ? "bg-primary/20 text-primary"
                    : "text-white/80 hover:bg-primary/10"
                }`}
              >
                <span className="text-xl">{c.flag}</span>
                <span className="flex-1">{c.name}</span>
                <span className="text-xs text-primary/50">{c.currency}</span>
                <span className="text-xs text-primary/30">
                  {c.code === "KE" ? "📱+💳" : "💳"}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const cardFormSchema = z.object({
  email: z.string().email({ message: "INVALID EMAIL" }),
});
type CardFormValues = z.infer<typeof cardFormSchema>;

function CardPaymentForm({ country }: { country: CountryConfig }) {
  const initPayment = useInitPayment();
  const form = useForm<CardFormValues>({
    resolver: zodResolver(cardFormSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = (data: CardFormValues) => {
    initPayment.mutate({ email: data.email, country: country.code }, {
      onSuccess: (res) => { window.location.href = res.authorizationUrl; },
      onError: (err) => { form.setError("root", { message: err.message }); },
    });
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <FormField label="OPERATOR EMAIL" error={form.formState.errors.email?.message}>
        <input
          {...form.register("email")}
          data-testid="input-email-card"
          disabled={initPayment.isPending}
          placeholder="operator@system.net"
          className="w-full bg-black/50 border border-primary/30 px-4 py-4 text-white placeholder:text-white/20 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all font-mono"
        />
      </FormField>

      {form.formState.errors.root && (
        <div className="bg-destructive/10 border border-destructive/50 p-3 text-destructive text-sm font-bold flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          {form.formState.errors.root.message}
        </div>
      )}

      <SubmitButton pending={initPayment.isPending} label="PAY WITH CARD" pendingLabel="CONNECTING TO GATEWAY..." />
    </form>
  );
}

const mobileMoneySchema = z.object({
  phone: z.string().min(9, { message: "ENTER A VALID PHONE NUMBER" }),
  provider: z.string().min(1),
});
type MobileMoneyFormValues = z.infer<typeof mobileMoneySchema>;

function MobileMoneyForm({ onSent }: { onSent: (ref: string, isMpesa: boolean) => void }) {
  const initMobileMoney = useInitMobileMoney();
  const providers = KENYA.momoProviders!;

  const form = useForm<MobileMoneyFormValues>({
    resolver: zodResolver(mobileMoneySchema),
    defaultValues: { phone: "", provider: providers[0].code },
  });

  const onSubmit = (data: MobileMoneyFormValues) => {
    initMobileMoney.mutate(
      { phone: data.phone, provider: data.provider, country: "KE" },
      {
        onSuccess: (res) => { onSent(res.reference, data.provider === "mpesa"); },
        onError: (err) => { form.setError("root", { message: err.message }); },
      }
    );
  };

  const selectedProvider = form.watch("provider");

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      {providers.length > 1 && (
        <FormField label="PROVIDER" error={form.formState.errors.provider?.message}>
          <div className="relative">
            <select
              {...form.register("provider")}
              disabled={initMobileMoney.isPending}
              className="w-full bg-black/50 border border-primary/30 px-4 py-4 text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all font-mono appearance-none cursor-pointer"
            >
              {providers.map((p) => (
                <option key={p.code} value={p.code} className="bg-black">
                  {p.name}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/60 pointer-events-none" />
          </div>
        </FormField>
      )}

      <FormField
        label={selectedProvider === "mpesa" ? "M-PESA PHONE NUMBER" : "AIRTEL MONEY PHONE NUMBER"}
        error={form.formState.errors.phone?.message}
      >
        <input
          {...form.register("phone")}
          data-testid="input-phone-mobile"
          disabled={initMobileMoney.isPending}
          placeholder={KENYA.phonePlaceholder}
          className="w-full bg-black/50 border border-primary/30 px-4 py-4 text-white placeholder:text-white/20 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all font-mono"
        />
      </FormField>

      {form.formState.errors.root && (
        <div className="bg-destructive/10 border border-destructive/50 p-3 text-destructive text-sm font-bold flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          {form.formState.errors.root.message}
        </div>
      )}

      <SubmitButton
        pending={initMobileMoney.isPending}
        label={selectedProvider === "mpesa" ? "SEND STK PUSH" : "AUTHORIZE AIRTEL PAYMENT"}
        pendingLabel="SENDING REQUEST..."
      />
    </form>
  );
}

type TerminalState = "failed" | "abandoned" | "timeout" | null;

function TerminalView({ state, psMessage }: { state: TerminalState; psMessage?: string }) {
  const config: Record<NonNullable<TerminalState>, { title: string; detail: string }> = {
    abandoned: {
      title: "REQUEST CANCELLED",
      detail: "You dismissed the payment prompt. No charge was made.",
    },
    timeout: {
      title: "REQUEST TIMED OUT",
      detail: "The 3-minute window expired before authorization. No charge was made.",
    },
    failed: {
      title: "PAYMENT FAILED",
      detail: psMessage || "The payment could not be completed.",
    },
  };
  const c = config[state!] ?? config.failed;

  return (
    <>
      <AlertTriangle className="w-16 h-16 text-destructive" />
      <div>
        <h2 className="text-xl text-destructive font-bold tracking-widest">{c.title}</h2>
        <p className="text-muted-foreground font-mono text-sm mt-2">{c.detail}</p>
      </div>
      <button
        onClick={() => window.location.reload()}
        className="border border-primary/50 text-primary px-6 py-3 font-bold tracking-widest"
        data-testid="button-retry"
      >
        TRY AGAIN
      </button>
    </>
  );
}

function MobileMoneyWaitingView({
  reference,
  isMpesa,
  onSuccess,
}: {
  reference: string;
  isMpesa: boolean;
  onSuccess: (tx: Transaction) => void;
}) {
  const { data } = usePollMobileMoneyStatus(reference, true);

  useEffect(() => {
    if (data?.status === "success") onSuccess(data as Transaction);
  }, [data, onSuccess]);

  const status = data?.status;
  const psMessage = data?.psMessage;

  const isCancelled = status === "abandoned" ||
    (status === "failed" && !!psMessage?.toLowerCase().includes("cancel"));
  const isTimeout = status === "timeout" ||
    (status === "failed" && !!psMessage?.toLowerCase().includes("timeout"));

  const terminalState: TerminalState =
    isCancelled ? "abandoned"
    : isTimeout ? "timeout"
    : (status === "failed" || status === "abandoned" || status === "timeout") ? "failed"
    : null;

  return (
    <div className="glass-panel p-10 text-center glow-box flex flex-col items-center justify-center space-y-6 relative">
      <CornerDeco />
      {terminalState ? (
        <TerminalView state={terminalState} psMessage={psMessage} />
      ) : (
        <>
          <div className="relative">
            <div className="absolute inset-0 border-4 border-primary/20 rounded-full animate-ping" />
            <Smartphone className="w-16 h-16 text-primary animate-pulse relative z-10" />
          </div>
          <div>
            <h2 className="text-xl text-primary font-bold tracking-widest animate-pulse">
              {isMpesa ? "AWAITING M-PESA" : "AWAITING AIRTEL"}
            </h2>
            <p className="text-muted-foreground text-sm font-mono mt-2">
              {isMpesa
                ? "Check your phone for an STK push prompt and enter your PIN."
                : "Check your phone for the Airtel Money authorization prompt."}
            </p>
            <p className="text-primary/50 text-xs font-mono mt-3">REF: {reference}</p>
          </div>
          <div className="flex gap-1 mt-4">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-2 h-2 bg-primary rounded-full animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function SuccessView({ tx }: { tx: Transaction }) {
  return (
    <div className="glass-panel p-6 md:p-8 glow-box relative">
      <CornerDeco />
      <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
        <ShieldCheck className="w-32 h-32 text-primary" />
      </div>

      <div className="flex items-center gap-3 mb-6 relative z-10">
        <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center shrink-0">
          <CheckSquare className="w-6 h-6 text-black" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white tracking-widest">DEPLOYMENT AUTHORIZED</h2>
          <p className="text-primary font-mono text-sm">STATUS: SUCCESS</p>
        </div>
      </div>

      <div className="bg-primary text-black font-bold p-3 text-center mb-6 text-sm tracking-widest animate-pulse">
        SCREENSHOT THE JSON BELOW AND SEND TO ADMIN WITH YOUR BOT SESSION ID
      </div>

      <div className="relative group">
        <div className="absolute inset-0 bg-primary/20 blur opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        <pre
          data-testid="text-success-json"
          className="relative bg-[#050505] border border-primary/40 p-4 md:p-6 overflow-x-auto font-mono text-xs md:text-sm text-primary shadow-inner selection:bg-primary selection:text-black leading-relaxed"
          style={{ fontFamily: "var(--font-mono)" }}
        >
{`{
  "protocol": "WOLFTECH_DEPLOYMENT",
  "status": "VERIFIED_AND_LOCKED",
  "transaction": {
    "id": ${tx.id},
    "reference": "${tx.reference}",
    "method": "${tx.method?.toUpperCase() || "CARD"}",
    "amount_kes": ${tx.amount},
    "operator_id": "${tx.email}",
    "timestamp": "${tx.createdAt}"
  },
  "action": "REQUIRE_MANUAL_PROVISION"
}`}
        </pre>
      </div>

      <button
        onClick={() => window.location.href = "/"}
        data-testid="button-acknowledge"
        className="mt-8 w-full border border-primary/50 text-primary py-4 font-bold tracking-widest flex items-center justify-center gap-2"
      >
        ACKNOWLEDGE & CLOSE
      </button>
    </div>
  );
}

function VerificationView({ reference }: { reference: string }) {
  const { data, isLoading, isError, error } = useVerifyPaymentQuery(reference);

  if (isLoading) {
    return (
      <div className="glass-panel p-12 text-center glow-box flex flex-col items-center justify-center space-y-6 relative">
        <CornerDeco />
        <div className="relative">
          <div className="absolute inset-0 border-4 border-primary/20 rounded-full animate-ping" />
          <ShieldCheck className="w-16 h-16 text-primary animate-pulse relative z-10" />
        </div>
        <div>
          <h2 className="text-xl text-primary font-bold tracking-widest animate-pulse">VERIFYING TRANSACTION</h2>
          <p className="text-muted-foreground text-sm font-mono mt-2">REF: {reference.substring(0, 12)}...</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="glass-panel p-8 text-center border-destructive/50">
        <AlertTriangle className="w-16 h-16 text-destructive mx-auto mb-4" />
        <h2 className="text-2xl text-destructive font-bold tracking-widest mb-2">VERIFICATION FAILED</h2>
        <p className="text-muted-foreground font-mono mb-8">{error?.message}</p>
        <button onClick={() => window.location.href = "/"} className="border border-destructive text-destructive px-6 py-3 font-bold tracking-widest">
          RETURN
        </button>
      </div>
    );
  }

  if (data) return <SuccessView tx={data} />;
  return null;
}

type Tab = "mobilemoney" | "card";

function PaymentForm() {
  const [country, setCountry] = useState<CountryConfig>(KENYA);
  const [tab, setTab] = useState<Tab>("mobilemoney");
  const [momoRef, setMomoRef] = useState<string | null>(null);
  const [isMpesa, setIsMpesa] = useState(false);
  const [momoSuccess, setMomoSuccess] = useState<Transaction | null>(null);

  const { data: ratesData } = useExchangeRates();
  const rates = ratesData?.rates;

  const isKenya = country.code === "KE";
  const convertedAmount = convertAmount(rates, country.currency);
  const formattedAmount = formatAmount(convertedAmount, country.currency);

  useEffect(() => {
    setTab(isKenya ? "mobilemoney" : "card");
    setMomoRef(null);
    setMomoSuccess(null);
  }, [country.code, isKenya]);

  if (momoSuccess) return <SuccessView tx={momoSuccess} />;
  if (momoRef) return (
    <MobileMoneyWaitingView
      reference={momoRef}
      isMpesa={isMpesa}
      onSuccess={setMomoSuccess}
    />
  );

  return (
    <div className="glass-panel p-8 md:p-10 glow-box relative">
      <CornerDeco />

      <div className="mb-8 border-b border-primary/20 pb-6 space-y-5">
        <CountrySelector selected={country} onChange={setCountry} />

        <div className="text-center">
          <h2 className="text-2xl text-white font-semibold flex justify-center items-center gap-2">
            <Zap className="w-6 h-6 text-primary" /> INITIALIZE UPLINK
          </h2>
          <div className="mt-4 flex flex-col items-center">
            <span className="text-muted-foreground text-xs font-bold tracking-widest">REQUIRED DEPLOYMENT FEE</span>
            <span className="text-4xl font-black text-primary glow-text mt-1">{formattedAmount}</span>
            {!isKenya && (
              <span className="text-primary/40 text-xs font-mono mt-1">≈ {BASE_KES} KES</span>
            )}
          </div>
        </div>
      </div>

      {isKenya && (
        <div className="flex gap-0 mb-8 border border-primary/30">
          <button
            type="button"
            data-testid="tab-mpesa"
            onClick={() => setTab("mobilemoney")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold tracking-widest transition-all ${
              tab === "mobilemoney" ? "bg-primary text-black" : "text-primary/60 bg-transparent"
            }`}
          >
            <Smartphone className="w-4 h-4" /> MOBILE MONEY
          </button>
          <button
            type="button"
            data-testid="tab-card"
            onClick={() => setTab("card")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold tracking-widest transition-all border-l border-primary/30 ${
              tab === "card" ? "bg-primary text-black" : "text-primary/60 bg-transparent"
            }`}
          >
            <CreditCard className="w-4 h-4" /> CARD
          </button>
        </div>
      )}

      {isKenya && tab === "mobilemoney" ? (
        <MobileMoneyForm
          onSent={(ref, mpesa) => { setMomoRef(ref); setIsMpesa(mpesa); }}
        />
      ) : (
        <CardPaymentForm country={country} />
      )}
    </div>
  );
}

export default function Home() {
  const [reference, setReference] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("reference");
    if (ref) {
      setReference(ref);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  return (
    <PageContainer>
      {reference ? <VerificationView reference={reference} /> : <PaymentForm />}
    </PageContainer>
  );
}

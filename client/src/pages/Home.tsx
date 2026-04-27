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
  AlertTriangle,
  Loader2,
  CreditCard,
  Smartphone,
  ChevronDown,
  Globe,
  Heart,
  CheckCircle2,
} from "lucide-react";

const COFFEE_PRICE_KES = 100;

const FALLBACK_RATES: Record<string, number> = {
  KES: 1, NGN: 10.73, GHS: 0.083, ZAR: 0.129, EGP: 0.388,
  RWF: 11.29, XOF: 4.38, TZS: 185.0, UGX: 26.5, USD: 0.0077,
};

function convertAmount(rates: Record<string, number> | undefined, currency: string, baseKes: number): number {
  if (currency === "KES") return baseKes;
  const rate = rates?.[currency] ?? FALLBACK_RATES[currency] ?? null;
  if (rate === null) return baseKes;
  return Math.round(baseKes * rate * 100) / 100;
}

function formatAmount(amount: number, currency: string): string {
  if (["XOF", "RWF", "TZS", "UGX"].includes(currency)) {
    return `${Math.round(amount).toLocaleString()} ${currency}`;
  }
  return `${amount.toFixed(2)} ${currency}`;
}

function CoffeeCup({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "text-3xl", md: "text-5xl", lg: "text-7xl" };
  return (
    <div className="relative inline-flex flex-col items-center">
      <div className="flex gap-1 mb-0.5 h-4">
        <span className="steam-1 text-amber-400/60 text-xs">~</span>
        <span className="steam-2 text-amber-400/60 text-xs">~</span>
        <span className="steam-3 text-amber-400/60 text-xs">~</span>
      </div>
      <span className={sizes[size]}>☕</span>
    </div>
  );
}

function PageContainer({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/6 w-80 h-80 bg-amber-600/5 rounded-full blur-[100px]" />
        <div className="absolute bottom-1/4 right-1/6 w-96 h-96 bg-amber-900/10 rounded-full blur-[120px]" />
      </div>
      <div className="w-full max-w-md z-10 relative">
        {children}
      </div>
    </div>
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
    <div className="space-y-1.5">
      <label className="text-xs font-bold text-amber-400/70 flex items-center gap-1.5">
        <Globe className="w-3 h-3" /> Your country
      </label>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full bg-amber-950/30 border border-amber-800/30 rounded-lg px-4 py-3 text-foreground focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 transition-all font-body flex items-center justify-between"
        >
          <span className="flex items-center gap-3">
            <span className="text-xl">{selected.flag}</span>
            <span className="font-semibold">{selected.name}</span>
            <span className="text-amber-500/50 text-xs">({selected.currency})</span>
          </span>
          <ChevronDown className={`w-4 h-4 text-amber-500/50 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {open && (
          <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-card border border-amber-800/30 rounded-xl max-h-60 overflow-y-auto shadow-2xl">
            {COUNTRIES.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => { onChange(c); setOpen(false); }}
                className={`w-full px-4 py-3 text-left flex items-center gap-3 transition-colors ${
                  c.code === selected.code
                    ? "bg-amber-500/15 text-amber-300"
                    : "text-foreground/80 hover:bg-amber-500/8"
                }`}
              >
                <span className="text-xl">{c.flag}</span>
                <span className="flex-1 font-medium">{c.name}</span>
                <span className="text-xs text-amber-500/50">{c.currency}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function InputField({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold text-amber-400/70">{label}</label>
      {children}
      {error && (
        <p className="text-red-400 text-xs flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" /> {error}
        </p>
      )}
    </div>
  );
}

const inputClass =
  "w-full bg-amber-950/30 border border-amber-800/30 rounded-lg px-4 py-3 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 transition-all";

function PayButton({ pending, label, pendingLabel }: { pending: boolean; label: string; pendingLabel: string }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full bg-amber-500 hover:bg-amber-400 text-amber-950 font-black text-base py-4 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 hover:-translate-y-0.5 active:translate-y-0"
    >
      {pending ? (
        <>
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>{pendingLabel}</span>
        </>
      ) : (
        <>
          <span>☕</span>
          <span>{label}</span>
          <Heart className="w-4 h-4" />
        </>
      )}
    </button>
  );
}

const cardFormSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email" }),
});
type CardFormValues = z.infer<typeof cardFormSchema>;

function CardPaymentForm({
  country,
  amountKes,
  name,
  message,
}: {
  country: CountryConfig;
  amountKes: number;
  name: string;
  message: string;
}) {
  const initPayment = useInitPayment();
  const form = useForm<CardFormValues>({
    resolver: zodResolver(cardFormSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = (data: CardFormValues) => {
    initPayment.mutate(
      { email: data.email, country: country.code, amountKes, name: name || undefined, message: message || undefined },
      {
        onSuccess: (res) => { window.location.href = res.authorizationUrl; },
        onError: (err) => { form.setError("root", { message: err.message }); },
      }
    );
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <InputField label="Your email" error={form.formState.errors.email?.message}>
        <input
          {...form.register("email")}
          disabled={initPayment.isPending}
          placeholder="you@example.com"
          className={inputClass}
        />
      </InputField>

      {form.formState.errors.root && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {form.formState.errors.root.message}
        </div>
      )}

      <PayButton pending={initPayment.isPending} label="Support with Card" pendingLabel="Connecting to gateway..." />
    </form>
  );
}

const mobileMoneySchema = z.object({
  phone: z.string().min(9, { message: "Enter a valid phone number" }),
  provider: z.string().min(1),
});
type MobileMoneyFormValues = z.infer<typeof mobileMoneySchema>;

function MobileMoneyForm({
  onSent,
  amountKes,
  name,
  message,
}: {
  onSent: (ref: string, isMpesa: boolean) => void;
  amountKes: number;
  name: string;
  message: string;
}) {
  const initMobileMoney = useInitMobileMoney();
  const providers = KENYA.momoProviders!;

  const form = useForm<MobileMoneyFormValues>({
    resolver: zodResolver(mobileMoneySchema),
    defaultValues: { phone: "", provider: providers[0].code },
  });

  const onSubmit = (data: MobileMoneyFormValues) => {
    initMobileMoney.mutate(
      {
        phone: data.phone,
        provider: data.provider,
        country: "KE",
        amountKes,
        name: name || undefined,
        message: message || undefined,
      },
      {
        onSuccess: (res) => { onSent(res.reference, data.provider === "mpesa"); },
        onError: (err) => { form.setError("root", { message: err.message }); },
      }
    );
  };

  const selectedProvider = form.watch("provider");

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      {providers.length > 1 && (
        <InputField label="Provider" error={form.formState.errors.provider?.message}>
          <div className="relative">
            <select
              {...form.register("provider")}
              disabled={initMobileMoney.isPending}
              className={inputClass + " appearance-none cursor-pointer"}
            >
              {providers.map((p) => (
                <option key={p.code} value={p.code} className="bg-card">
                  {p.name}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500/50 pointer-events-none" />
          </div>
        </InputField>
      )}

      <InputField
        label={selectedProvider === "mpesa" ? "M-Pesa phone number" : "Airtel Money phone number"}
        error={form.formState.errors.phone?.message}
      >
        <input
          {...form.register("phone")}
          disabled={initMobileMoney.isPending}
          placeholder={KENYA.phonePlaceholder}
          className={inputClass}
        />
      </InputField>

      {form.formState.errors.root && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {form.formState.errors.root.message}
        </div>
      )}

      <PayButton
        pending={initMobileMoney.isPending}
        label={selectedProvider === "mpesa" ? "Support via M-Pesa" : "Support via Airtel Money"}
        pendingLabel="Sending STK push..."
      />
    </form>
  );
}

function WaitingView({
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

  const isCancelled = status === "abandoned" || !!psMessage?.toLowerCase().includes("cancel");
  const isTimeout = status === "timeout" || !!psMessage?.toLowerCase().includes("timeout");
  const isFailed = status === "failed" || status === "abandoned" || status === "timeout";

  if (isFailed) {
    return (
      <div className="coffee-card p-8 text-center space-y-5">
        <div className="text-5xl">😔</div>
        <div>
          <h2 className="text-xl font-bold text-red-400 mb-1">
            {isCancelled ? "Payment Cancelled" : isTimeout ? "Request Timed Out" : "Payment Failed"}
          </h2>
          <p className="text-muted-foreground text-sm">
            {isCancelled
              ? "You cancelled the payment. No charge was made."
              : isTimeout
              ? "The 3-minute window expired. No charge was made."
              : psMessage || "Something went wrong. No charge was made."}
          </p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="border border-amber-500/40 text-amber-400 px-6 py-2.5 rounded-lg font-semibold text-sm hover:bg-amber-500/10 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="coffee-card p-8 text-center space-y-5">
      <div className="relative inline-flex">
        <div className="absolute inset-0 border-4 border-amber-500/20 rounded-full animate-ping" />
        <Smartphone className="w-14 h-14 text-amber-400 animate-pulse relative z-10" />
      </div>
      <div>
        <h2 className="text-xl font-bold text-amber-300 mb-2">
          {isMpesa ? "Check your phone for M-Pesa" : "Check your phone for Airtel Money"}
        </h2>
        <p className="text-muted-foreground text-sm">
          {isMpesa
            ? "An STK push has been sent. Enter your M-Pesa PIN to complete."
            : "Authorize the Airtel Money payment on your phone."}
        </p>
      </div>
      <div className="flex justify-center gap-1.5 pt-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-2 h-2 bg-amber-400 rounded-full animate-bounce"
            style={{ animationDelay: `${i * 0.18}s` }}
          />
        ))}
      </div>
    </div>
  );
}

function SuccessView({ tx }: { tx: Transaction }) {
  const coffees = Math.max(1, Math.round(tx.amount / COFFEE_PRICE_KES));
  const cups = "☕".repeat(Math.min(coffees, 5));

  return (
    <div className="coffee-card p-8 text-center space-y-5">
      <div className="text-6xl">{cups}</div>
      <div>
        <h2 className="text-2xl font-bold text-amber-300 mb-1">
          {tx.name ? `Thank you, ${tx.name}!` : "Thank you so much!"}
        </h2>
        <p className="text-muted-foreground text-sm">
          You bought {coffees} {coffees === 1 ? "coffee" : "coffees"} — that means a lot! ☕
        </p>
      </div>

      {tx.message && (
        <div className="bg-amber-500/8 border border-amber-500/20 rounded-xl p-4">
          <p className="text-amber-200/80 text-sm italic">"{tx.message}"</p>
        </div>
      )}

      <div className="flex items-center justify-center gap-2 text-green-400 text-sm font-semibold">
        <CheckCircle2 className="w-4 h-4" />
        <span>Payment confirmed</span>
      </div>

      <div className="bg-amber-950/50 rounded-lg p-3 text-left text-xs text-muted-foreground space-y-1 font-mono">
        <div className="flex justify-between">
          <span>Reference</span>
          <span className="text-amber-400/70">{tx.reference.substring(0, 16)}...</span>
        </div>
        <div className="flex justify-between">
          <span>Amount</span>
          <span className="text-amber-400/70">{tx.amount} KES</span>
        </div>
        <div className="flex justify-between">
          <span>Method</span>
          <span className="text-amber-400/70">{tx.method?.toUpperCase()}</span>
        </div>
      </div>

      <button
        onClick={() => (window.location.href = "/")}
        className="w-full border border-amber-500/30 text-amber-400 py-3 rounded-xl font-semibold text-sm hover:bg-amber-500/10 transition-colors"
      >
        Back to Home
      </button>
    </div>
  );
}

function VerificationView({ reference }: { reference: string }) {
  const { data, isLoading, isError, error } = useVerifyPaymentQuery(reference);

  if (isLoading) {
    return (
      <div className="coffee-card p-12 text-center space-y-5">
        <div className="relative inline-flex">
          <div className="absolute inset-0 border-4 border-amber-500/20 rounded-full animate-ping" />
          <CoffeeCup size="md" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-amber-300 animate-pulse">Verifying your support...</h2>
          <p className="text-muted-foreground text-sm mt-1">Just a moment ☕</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="coffee-card p-8 text-center space-y-4">
        <AlertTriangle className="w-12 h-12 text-red-400 mx-auto" />
        <h2 className="text-xl font-bold text-red-400">Verification Failed</h2>
        <p className="text-muted-foreground text-sm">{error?.message}</p>
        <button
          onClick={() => (window.location.href = "/")}
          className="border border-red-500/40 text-red-400 px-6 py-2.5 rounded-lg font-semibold text-sm hover:bg-red-500/10 transition-colors"
        >
          Go Back
        </button>
      </div>
    );
  }

  if (data) return <SuccessView tx={data} />;
  return null;
}

type Tab = "mobilemoney" | "card";

function SupportForm() {
  const [country, setCountry] = useState<CountryConfig>(KENYA);
  const [tab, setTab] = useState<Tab>("mobilemoney");
  const [coffeeCount, setCoffeeCount] = useState<number>(1);
  const [customCoffees, setCustomCoffees] = useState<string>("");
  const [isCustom, setIsCustom] = useState(false);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [momoRef, setMomoRef] = useState<string | null>(null);
  const [isMpesa, setIsMpesa] = useState(false);
  const [momoSuccess, setMomoSuccess] = useState<Transaction | null>(null);

  const { data: ratesData } = useExchangeRates();
  const rates = ratesData?.rates;

  const isKenya = country.code === "KE";

  const activeCoffees = isCustom
    ? Math.max(1, parseInt(customCoffees) || 1)
    : coffeeCount;
  const amountKes = activeCoffees * COFFEE_PRICE_KES;

  const convertedAmount = convertAmount(rates, country.currency, amountKes);
  const formattedAmount = formatAmount(convertedAmount, country.currency);

  useEffect(() => {
    setTab(isKenya ? "mobilemoney" : "card");
    setMomoRef(null);
    setMomoSuccess(null);
  }, [country.code, isKenya]);

  if (momoSuccess) return <SuccessView tx={momoSuccess} />;
  if (momoRef)
    return (
      <WaitingView
        reference={momoRef}
        isMpesa={isMpesa}
        onSuccess={setMomoSuccess}
      />
    );

  const PRESET_COUNTS = [1, 3, 5];

  return (
    <div className="space-y-4">
      {/* Creator Header */}
      <div className="text-center pb-2">
        <div className="mb-1 text-xs font-bold tracking-[0.3em] text-amber-500/60 uppercase">
          WOLF TECH
        </div>
        <CoffeeCup size="lg" />
        <h1
          className="text-3xl font-bold text-amber-200 mt-3 mb-1"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Buy me a coffee
        </h1>
        <p className="text-muted-foreground text-sm">
          If you enjoy my work, support me with a coffee!
        </p>
      </div>

      <div className="coffee-card p-5 space-y-5">
        {/* Coffee Count Selector */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">☕</span>
            <span className="font-bold text-amber-200">×</span>
            <div className="flex gap-2 flex-wrap">
              {PRESET_COUNTS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => { setCoffeeCount(n); setIsCustom(false); }}
                  className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                    !isCustom && coffeeCount === n
                      ? "bg-amber-500 text-amber-950 shadow-lg shadow-amber-500/20"
                      : "bg-amber-950/50 text-amber-400/70 border border-amber-800/30 hover:border-amber-600/40"
                  }`}
                >
                  {n}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setIsCustom(true)}
                className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                  isCustom
                    ? "bg-amber-500 text-amber-950 shadow-lg shadow-amber-500/20"
                    : "bg-amber-950/50 text-amber-400/70 border border-amber-800/30 hover:border-amber-600/40"
                }`}
              >
                Custom
              </button>
            </div>
          </div>

          {isCustom && (
            <input
              type="number"
              min={1}
              value={customCoffees}
              onChange={(e) => setCustomCoffees(e.target.value)}
              placeholder="How many coffees?"
              className={inputClass}
              autoFocus
            />
          )}

          <div className="bg-amber-500/8 border border-amber-500/15 rounded-xl p-3 flex items-center justify-between">
            <span className="text-muted-foreground text-sm">
              {activeCoffees} {activeCoffees === 1 ? "coffee" : "coffees"} ×{" "}
              {COFFEE_PRICE_KES} KES
            </span>
            <span className="text-amber-300 font-bold text-lg">
              {isKenya ? `${amountKes} KES` : formattedAmount}
            </span>
          </div>
        </div>

        {/* Name */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-amber-400/70">
            Your name <span className="text-muted-foreground/50 font-normal">(optional)</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Anonymous supporter"
            className={inputClass}
          />
        </div>

        {/* Message */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-amber-400/70">
            Leave a message <span className="text-muted-foreground/50 font-normal">(optional)</span>
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Keep up the great work! ☕"
            rows={3}
            className={inputClass + " resize-none"}
          />
        </div>

        {/* Country */}
        <CountrySelector selected={country} onChange={setCountry} />

        {/* Payment Tabs (Kenya only: mobile + card; others: card) */}
        {isKenya && (
          <div className="flex rounded-xl overflow-hidden border border-amber-800/30">
            <button
              type="button"
              onClick={() => setTab("mobilemoney")}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold transition-all ${
                tab === "mobilemoney"
                  ? "bg-amber-500 text-amber-950"
                  : "text-amber-400/60 bg-transparent hover:bg-amber-500/10"
              }`}
            >
              <Smartphone className="w-4 h-4" /> Mobile Money
            </button>
            <button
              type="button"
              onClick={() => setTab("card")}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold transition-all border-l border-amber-800/30 ${
                tab === "card"
                  ? "bg-amber-500 text-amber-950"
                  : "text-amber-400/60 bg-transparent hover:bg-amber-500/10"
              }`}
            >
              <CreditCard className="w-4 h-4" /> Card
            </button>
          </div>
        )}

        {/* Payment Form */}
        {isKenya && tab === "mobilemoney" ? (
          <MobileMoneyForm
            onSent={(ref, mpesa) => { setMomoRef(ref); setIsMpesa(mpesa); }}
            amountKes={amountKes}
            name={name}
            message={message}
          />
        ) : (
          <CardPaymentForm
            country={country}
            amountKes={amountKes}
            name={name}
            message={message}
          />
        )}
      </div>

      <p className="text-center text-xs text-muted-foreground/50 flex items-center justify-center gap-1">
        <span>Powered by Paystack</span>
        <span>·</span>
        <span>Secure payments</span>
      </p>
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
      {reference ? <VerificationView reference={reference} /> : <SupportForm />}
    </PageContainer>
  );
}

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useInitPayment, useVerifyPaymentQuery } from "@/hooks/use-payments";
import { Terminal, ShieldCheck, AlertTriangle, Zap, CheckSquare, Loader2 } from "lucide-react";

// --- Form Schema ---
const paymentFormSchema = z.object({
  email: z.string().email({ message: "INVALID EMAIL PROTOCOL" }),
});

type PaymentFormValues = z.infer<typeof paymentFormSchema>;

// --- Components ---

function PageContainer({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen scanline-overlay flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative background blur blobs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-[100px] pointer-events-none" />
      
      <div className="w-full max-w-lg z-10 relative">
        <div className="text-center mb-10">
          <h1 className="text-6xl md:text-7xl font-black text-primary animate-flicker glow-text uppercase tracking-widest" style={{ fontFamily: 'var(--font-display)' }}>
            WOLFTECH
          </h1>
          <p className="text-primary/70 text-sm md:text-base font-bold tracking-[0.3em] mt-2 flex items-center justify-center gap-2">
            <Terminal className="w-4 h-4" /> SECURE BOT DEPLOYMENT
          </p>
        </div>
        
        {children}
      </div>
    </div>
  );
}

function PaymentForm() {
  const initPayment = useInitPayment();
  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: { email: "" }
  });

  const onSubmit = (data: PaymentFormValues) => {
    initPayment.mutate(data.email, {
      onSuccess: (res) => {
        // Redirect to Paystack
        window.location.href = res.authorizationUrl;
      },
      onError: (error) => {
        form.setError("root", { message: error.message });
      }
    });
  };

  return (
    <div className="glass-panel p-8 md:p-10 glow-box relative">
      {/* Techy corner decorations */}
      <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-primary/60"></div>
      <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-primary/60"></div>
      <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-primary/60"></div>
      <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-primary/60"></div>

      <div className="mb-8 border-b border-primary/20 pb-6 text-center">
        <h2 className="text-2xl text-white font-semibold flex justify-center items-center gap-2">
          <Zap className="w-6 h-6 text-primary" /> INITIALIZE UPLINK
        </h2>
        <div className="mt-4 flex flex-col items-center">
          <span className="text-muted-foreground text-xs font-bold tracking-widest">REQUIRED DEPLOYMENT FEE</span>
          <span className="text-4xl font-black text-primary glow-text mt-1">70.00 KES</span>
        </div>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-2">
          <label className="text-xs font-bold text-primary/80 tracking-widest flex items-center gap-2">
            <span className="w-2 h-2 bg-primary/80 rounded-sm"></span>
            OPERATOR EMAIL
          </label>
          <div className="relative">
            <input
              {...form.register("email")}
              disabled={initPayment.isPending}
              placeholder="operator@system.net"
              className="w-full bg-black/50 border border-primary/30 rounded-none px-4 py-4 text-white placeholder:text-white/20 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all font-mono"
            />
          </div>
          {form.formState.errors.email && (
            <p className="text-destructive text-sm font-semibold flex items-center gap-1 mt-1">
              <AlertTriangle className="w-4 h-4" /> {form.formState.errors.email.message}
            </p>
          )}
        </div>

        {form.formState.errors.root && (
          <div className="bg-destructive/10 border border-destructive/50 p-3 text-destructive text-sm font-bold flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            {form.formState.errors.root.message}
          </div>
        )}

        <button
          type="submit"
          disabled={initPayment.isPending}
          className="w-full bg-primary text-black font-black text-lg py-4 tracking-[0.2em] hover:bg-primary/90 hover:glow-box-intense transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 relative overflow-hidden group"
        >
          {initPayment.isPending ? (
            <>
              <Loader2 className="w-6 h-6 animate-spin" />
              <span>ESTABLISHING...</span>
            </>
          ) : (
            <>
              <span>PROCEED TO GATEWAY</span>
              <Zap className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </>
          )}
        </button>
      </form>
    </div>
  );
}

function VerificationView({ reference }: { reference: string }) {
  const { data, isLoading, isError, error } = useVerifyPaymentQuery(reference);

  if (isLoading) {
    return (
      <div className="glass-panel p-12 text-center glow-box flex flex-col items-center justify-center space-y-6">
        <div className="relative">
          <div className="absolute inset-0 border-4 border-primary/20 rounded-full animate-ping"></div>
          <ShieldCheck className="w-16 h-16 text-primary animate-pulse relative z-10" />
        </div>
        <div>
          <h2 className="text-xl text-primary font-bold tracking-widest animate-pulse">VERIFYING BLOCKCHAIN</h2>
          <p className="text-muted-foreground text-sm font-mono mt-2">AWAITING CONFIRMATION FOR REF: {reference.substring(0,8)}...</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="glass-panel p-8 text-center border-destructive/50 shadow-[0_0_15px_rgba(255,0,0,0.15)]">
        <AlertTriangle className="w-16 h-16 text-destructive mx-auto mb-4" />
        <h2 className="text-2xl text-destructive font-bold tracking-widest mb-2">VERIFICATION FAILED</h2>
        <p className="text-muted-foreground font-mono mb-8">{error?.message || "Unknown error occurred"}</p>
        <button 
          onClick={() => window.location.href = '/'}
          className="bg-transparent border border-destructive text-destructive px-6 py-3 font-bold tracking-widest hover:bg-destructive hover:text-white transition-colors"
        >
          RETURN TO UPLINK
        </button>
      </div>
    );
  }

  if (data) {
    return (
      <div className="glass-panel p-6 md:p-8 glow-box relative">
        <div className="absolute top-0 right-0 p-4 opacity-20 pointer-events-none">
          <ShieldCheck className="w-32 h-32 text-primary" />
        </div>
        
        <div className="flex items-center gap-3 mb-6 relative z-10">
          <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center">
            <CheckSquare className="w-6 h-6 text-black" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white tracking-widest">DEPLOYMENT AUTHORIZED</h2>
            <p className="text-primary font-mono text-sm">STATUS: SUCCESS // {new Date().toISOString()}</p>
          </div>
        </div>

        <div className="bg-primary text-black font-bold p-3 text-center mb-6 text-sm tracking-widest animate-pulse">
          CRITICAL: SCREENSHOT THIS DATABLOCK AND SHARE WITH ADMIN
        </div>

        <div className="relative group">
          <div className="absolute inset-0 bg-primary/20 blur opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          <pre 
            className="relative bg-[#050505] border border-primary/40 p-4 md:p-6 overflow-x-auto font-mono text-xs md:text-sm text-primary shadow-inner selection:bg-primary selection:text-black leading-relaxed"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
{`{
  "protocol": "WOLFTECH_DEPLOYMENT",
  "status": "VERIFIED_AND_LOCKED",
  "transaction": {
    "id": ${data.id},
    "reference": "${data.reference}",
    "amount_kes": ${data.amount},
    "operator_id": "${data.email}",
    "timestamp": "${data.createdAt}"
  },
  "action": "REQUIRE_MANUAL_PROVISION"
}`}
          </pre>
        </div>

        <button 
          onClick={() => window.location.href = '/'}
          className="mt-8 w-full border border-primary/50 text-primary hover:bg-primary/10 py-4 font-bold tracking-widest transition-colors flex items-center justify-center gap-2"
        >
          ACKNOWLEDGE & CLOSE
        </button>
      </div>
    );
  }

  return null;
}

export default function Home() {
  const [reference, setReference] = useState<string | null>(null);

  useEffect(() => {
    // Extract reference from URL if it exists (redirect from Paystack)
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("reference");
    if (ref) {
      setReference(ref);
      // Clean up URL so it doesn't verify again on refresh manually
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  return (
    <PageContainer>
      {reference ? (
        <VerificationView reference={reference} />
      ) : (
        <PaymentForm />
      )}
    </PageContainer>
  );
}

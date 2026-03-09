export type PaymentMethod = "mpesa" | "mobilemoney" | "card";

export interface MomoProvider {
  code: string;
  name: string;
}

export interface CountryConfig {
  code: string;
  name: string;
  currency: string;
  flag: string;
  phonePrefix: string;
  paymentMethods: PaymentMethod[];
  momoProviders?: MomoProvider[];
  phonePlaceholder: string;
}

export const KENYA: CountryConfig = {
  code: "KE",
  name: "Kenya",
  currency: "KES",
  flag: "🇰🇪",
  phonePrefix: "+254",
  paymentMethods: ["mpesa", "card"],
  momoProviders: [
    { code: "mpesa", name: "M-Pesa" },
    { code: "atl", name: "Airtel Money" },
  ],
  phonePlaceholder: "0712 345 678 or +254712345678",
};

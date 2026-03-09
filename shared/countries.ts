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

export const COUNTRIES: CountryConfig[] = [
  {
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
  },
  {
    code: "GH",
    name: "Ghana",
    currency: "GHS",
    flag: "🇬🇭",
    phonePrefix: "+233",
    paymentMethods: ["mobilemoney", "card"],
    momoProviders: [
      { code: "mtn", name: "MTN Mobile Money" },
      { code: "atl", name: "AirtelTigo Money" },
      { code: "vod", name: "Telecel Cash" },
    ],
    phonePlaceholder: "0240 000 000 or +233240000000",
  },
  {
    code: "CI",
    name: "Côte d'Ivoire",
    currency: "XOF",
    flag: "🇨🇮",
    phonePrefix: "+225",
    paymentMethods: ["mobilemoney", "card"],
    momoProviders: [
      { code: "mtn", name: "MTN Mobile Money" },
      { code: "orange", name: "Orange Money" },
      { code: "wave", name: "Wave" },
    ],
    phonePlaceholder: "07 00 00 00 00 or +225070000000",
  },
  {
    code: "NG",
    name: "Nigeria",
    currency: "NGN",
    flag: "🇳🇬",
    phonePrefix: "+234",
    paymentMethods: ["card"],
    phonePlaceholder: "",
  },
  {
    code: "ZA",
    name: "South Africa",
    currency: "ZAR",
    flag: "🇿🇦",
    phonePrefix: "+27",
    paymentMethods: ["card"],
    phonePlaceholder: "",
  },
  {
    code: "EG",
    name: "Egypt",
    currency: "EGP",
    flag: "🇪🇬",
    phonePrefix: "+20",
    paymentMethods: ["card"],
    phonePlaceholder: "",
  },
  {
    code: "RW",
    name: "Rwanda",
    currency: "RWF",
    flag: "🇷🇼",
    phonePrefix: "+250",
    paymentMethods: ["card"],
    phonePlaceholder: "",
  },
];

export function getCountry(code: string): CountryConfig | undefined {
  return COUNTRIES.find((c) => c.code === code);
}

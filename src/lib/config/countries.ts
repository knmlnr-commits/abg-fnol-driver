// Countries in scope: EU first. Australia is prepared but switched off. [CONFIRM] list and numbers.

export type CountryConfig = {
  code: string; // ISO 3166-1 alpha-2
  emergency: string;
  enabled: boolean;
};

const EU = [
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE",
  "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE",
];

export const COUNTRIES: Record<string, CountryConfig> = Object.fromEntries([
  ...EU.map((code) => [code, { code, emergency: "112", enabled: true }]),
  ["AU", { code: "AU", emergency: "000", enabled: false }],
]);

export function emergencyNumber(country: string | null | undefined): string {
  return (country && COUNTRIES[country.toUpperCase()]?.emergency) || "112";
}

export function isCountryEnabled(country: string): boolean {
  return Boolean(COUNTRIES[country.toUpperCase()]?.enabled);
}

/** Countries a driver can pick for the other party's plate. Wider than our scope on purpose. */
export const PLATE_COUNTRIES = [...EU, "AU", "CH", "NO", "GB", "IS", "LI", "OTHER"];

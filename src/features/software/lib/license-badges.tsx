import { Badge } from "@/components/ui/badge";

/** The 3 real license SKUs in this tenant. Any other value is still valid (an "Other" free-text entry) — it just falls back to a neutral badge. */
export const KNOWN_LICENSES = [
  "Microsoft 365 Business Basic",
  "Microsoft Power Automate Free",
  "Exchange Online Archiving for Exchange Online",
] as const;

const LICENSE_COLORS: Record<string, string> = {
  "Microsoft 365 Business Basic": "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  "Microsoft Power Automate Free": "bg-purple-500/15 text-purple-600 dark:text-purple-400",
  "Exchange Online Archiving for Exchange Online": "bg-amber-500/15 text-amber-700 dark:text-amber-400",
};

/** A `+`-joined licenseType string ("A+B+C") -> the individual license names it represents. */
export function splitLicenses(licenseType: string | null | undefined): string[] {
  return (licenseType ?? "").split("+").filter(Boolean);
}

export function LicenseBadges({ licenseType }: { licenseType: string | null | undefined }) {
  const licenses = splitLicenses(licenseType);
  if (licenses.length === 0) return <span className="text-muted-foreground">—</span>;

  return (
    <div className="flex flex-wrap gap-1">
      {licenses.map((license) => (
        <Badge key={license} className={`border-0 font-normal ${LICENSE_COLORS[license] ?? "bg-secondary text-secondary-foreground"}`}>
          {license}
        </Badge>
      ))}
    </div>
  );
}

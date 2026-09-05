import type { Metadata } from "next";
import { Poppins } from "next/font/google";

import { ThemeProvider } from "@/components/providers/theme-provider";
import { Toaster } from "sonner";
import { ensureSmtpVerifiedOnce } from "@/lib/mail/verify-on-boot";
import { ensureAutoBackupScheduledOnce } from "@/lib/backup";

import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "IT Manager Portal",
    template: "%s · IT Manager Portal",
  },
  description:
    "A private IT management portal — employees, systems, credentials, software, network, documents, notes and tasks in one place.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  ensureSmtpVerifiedOnce();
  ensureAutoBackupScheduledOnce();

  return (
    <html lang="en" suppressHydrationWarning className={poppins.variable}>
      <body className="font-sans">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster richColors position="top-right" closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}

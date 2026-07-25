"use client";

import { motion } from "framer-motion";

import { Separator } from "@/components/ui/separator";
import { AuthCardHeader } from "@/features/auth/components/auth-card-header";

interface AuthCardProps {
  title: string;
  eyebrow?: string;
  description?: string;
  children: React.ReactNode;
}

/** The glass-panel shell shared by every auth page (login, forgot/reset password, 2FA verification) — logo, heading, motion entrance, footer. */
export function AuthCard({ title, eyebrow, description, children }: AuthCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="glass-panel w-full max-w-sm rounded-3xl p-8 sm:p-10"
    >
      <AuthCardHeader title={title} eyebrow={eyebrow} description={description} />
      {children}

      <Separator className="my-6" />

      <p className="text-center text-[11px] uppercase tracking-wide text-muted-foreground">
        Powered by Aviation Overseas Supply Logistics Pvt. Ltd.
      </p>
    </motion.div>
  );
}

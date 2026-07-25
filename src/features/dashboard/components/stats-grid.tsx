"use client";

import { motion } from "framer-motion";
import { FileText, KeyRound, ListChecks, Monitor, ShieldAlert, Users } from "lucide-react";

import { StatCard } from "@/features/dashboard/components/stat-card";
import type { DashboardData } from "@/features/dashboard/lib/get-dashboard-data";

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

const item = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
};

export function StatsGrid({ stats }: { stats: DashboardData["stats"] }) {
  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
    >
      <motion.div variants={item}>
        <StatCard label="Total Employees" value={stats.totalEmployees} icon={Users} href="/employees" />
      </motion.div>
      <motion.div variants={item}>
        <StatCard label="Total Systems" value={stats.totalSystems} icon={Monitor} href="/systems" />
      </motion.div>
      <motion.div variants={item}>
        <StatCard label="Credentials Saved" value={stats.totalCredentials} icon={KeyRound} href="/credentials" />
      </motion.div>
      <motion.div variants={item}>
        <StatCard label="Pending Tasks" value={stats.pendingTasks} icon={ListChecks} href="/tasks" />
      </motion.div>
      <motion.div variants={item}>
        <StatCard
          label="Warranty Expiring"
          value={stats.warrantyExpiringSoon}
          icon={ShieldAlert}
          href="/systems"
          tone={stats.warrantyExpiringSoon > 0 ? "warning" : "default"}
          hint="Within 30 days"
        />
      </motion.div>
      <motion.div variants={item}>
        <StatCard label="Documents" value={stats.totalDocuments} icon={FileText} href="/documents" />
      </motion.div>
    </motion.div>
  );
}

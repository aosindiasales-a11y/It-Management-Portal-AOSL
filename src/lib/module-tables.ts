import "server-only";

import { prisma } from "@/lib/prisma";
import type { ModuleKey } from "@/config/modules";

/**
 * Small explicit dispatch table instead of generic Prisma delegate typing —
 * keeps `categoryId` cleanup (and anything else that must touch "whichever
 * table this module is") simple and easy to follow rather than clever.
 */
export async function clearCategoryFromModule(module: ModuleKey, categoryId: string): Promise<void> {
  const data = { categoryId: null };
  const where = { categoryId };
  switch (module) {
    case "employees":
      await prisma.employee.updateMany({ where, data });
      break;
    case "systems":
      await prisma.system.updateMany({ where, data });
      break;
    case "credentials":
      await prisma.credential.updateMany({ where, data });
      break;
    case "software":
      await prisma.software.updateMany({ where, data });
      break;
    case "network":
      await prisma.networkConfig.updateMany({ where, data });
      break;
    case "documents":
      await prisma.document.updateMany({ where, data });
      break;
    case "notes":
      await prisma.note.updateMany({ where, data });
      break;
    case "tasks":
      await prisma.task.updateMany({ where, data });
      break;
    case "vpn":
      await prisma.vpnCredential.updateMany({ where, data });
      break;
  }
}

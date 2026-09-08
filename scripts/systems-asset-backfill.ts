/**
 * One-time data reconciliation for the Systems/Assets overhaul (see the
 * "AOSL IT Management Portal — Systems section" task). Brings the existing
 * `System` rows in line with the latest physical-inventory sheet:
 *
 *  - Backfills the new keyboard/mousePad/charger/assetType columns from the
 *    inventory sheet (never invents a value — blank in the sheet stays null,
 *    i.e. "not specified", never "No").
 *  - Reconciles a handful of assignments that had drifted from the sheet
 *    (DSK/20 -> Jayanti, DSK/21 -> vacant, DSK/19 -> vacant) and creates the
 *    one asset (DSK/01 -> Harshit) that didn't exist yet — all confirmed
 *    with the admin before running.
 *  - Unassigns LAP/10 and LAP/13 rather than inventing "Anuj Gupta" /
 *    "Neeraj Chauhan" employee records for names that don't exist in the
 *    Employees module yet, and leaves a note on each asset instead.
 *  - Normalizes every remaining ACTIVE/SPARE status to ALLOCATED/VACANT
 *    based on whether the asset has an assigned employee, and IN_REPAIR to
 *    REPAIR, per the new SYSTEM_STATUSES.
 *
 * Idempotent — safe to run more than once (e.g. once locally, once against
 * the production Turso database after deploy). Run with:
 *   npx tsx scripts/systems-asset-backfill.ts
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";

type YesNo = "Yes" | "No" | null;

interface AccessoryInfo {
  assetType: string;
  keyboard: YesNo;
  mousePad: YesNo;
  charger: YesNo;
}

/** Keyboard / Mouse-Mouse Pad / Charger + asset type, keyed by Asset Code — straight from the inventory sheet. Blank in the sheet -> null ("not specified"), never "No". */
const ACCESSORY_DATA: Record<string, AccessoryInfo> = {
  "AOSL/Asset/LAP/12": { assetType: "Laptop", keyboard: "No", mousePad: "Yes", charger: "Yes" },
  "AOSL/Asset/LAP/10": { assetType: "Laptop", keyboard: "No", mousePad: "No", charger: "Yes" },
  "AOSL/Asset/LAP/13": { assetType: "Laptop", keyboard: "No", mousePad: "Yes", charger: "Yes" },
  "AOSL/Asset/LAP/15": { assetType: "Laptop", keyboard: "Yes", mousePad: "Yes", charger: "Yes" },
  "AOSL/Asset/DSK/15": { assetType: "Desktop", keyboard: "Yes", mousePad: "Yes", charger: "Yes" },
  "AOSL/Asset/DSK/16": { assetType: "Desktop", keyboard: "Yes", mousePad: "Yes", charger: "Yes" },
  "AOSL/Asset/LAP/14": { assetType: "Laptop", keyboard: "Yes", mousePad: "Yes", charger: "Yes" },
  "AOSL/Asset/LAP/06": { assetType: "Laptop", keyboard: "No", mousePad: "Yes", charger: "Yes" },
  "AOSL/Asset/LAP/11": { assetType: "Laptop", keyboard: "No", mousePad: "Yes", charger: "Yes" },
  "AOSL/Asset/DSK/01": { assetType: "Desktop", keyboard: "Yes", mousePad: "Yes", charger: "Yes" },
  "AOSL/Asset/DSK/05": { assetType: "Desktop", keyboard: "Yes", mousePad: "Yes", charger: "Yes" },
  "AOSL/Asset/DSK/06": { assetType: "Desktop", keyboard: "Yes", mousePad: "Yes", charger: "Yes" },
  "AOSL/Asset/DSK/04": { assetType: "Desktop", keyboard: "Yes", mousePad: "Yes", charger: "Yes" },
  "AOSL/Asset/DSK/02": { assetType: "Desktop", keyboard: "Yes", mousePad: "Yes", charger: "Yes" },
  "AOSL/Asset/LAP/02": { assetType: "Laptop", keyboard: null, mousePad: null, charger: "Yes" },
  "AOSL/Asset/LAP/17": { assetType: "Laptop", keyboard: null, mousePad: null, charger: "Yes" },
  "AOSL/Asset/DSK/18": { assetType: "Desktop", keyboard: "Yes", mousePad: "Yes", charger: "Yes" },
  "AOSL/Asset/DSK/20": { assetType: "Desktop", keyboard: "Yes", mousePad: "Yes", charger: "Yes" },
  "AOSL/Asset/LAP/07": { assetType: "Laptop", keyboard: null, mousePad: null, charger: null },
  "AOSL/Asset/LAP/01": { assetType: "Laptop", keyboard: null, mousePad: null, charger: null },
  "AOSL/Asset/DSK/19": { assetType: "Desktop", keyboard: null, mousePad: null, charger: null },
  "AOSL/Asset/DSK/21": { assetType: "Desktop", keyboard: null, mousePad: null, charger: null },
  // Sheet lists this one as "HP (Laptop)" despite the DSK/ asset code — kept exactly as given, asset code untouched.
  "AOSL/Asset/DSK/22": { assetType: "Laptop", keyboard: null, mousePad: null, charger: null },
};

async function findEmployeeIdByExactName(name: string): Promise<string> {
  const employee = await prisma.employee.findFirst({ where: { name } });
  if (!employee) throw new Error(`Expected employee "${name}" to exist — aborting.`);
  return employee.id;
}

async function unassignWithNote(assetId: string, unmatchedPersonName: string) {
  const system = await prisma.system.findUnique({ where: { assetId } });
  if (!system) {
    console.warn(`Skipping ${assetId} — no matching System row found.`);
    return;
  }

  const flag = `Allocated to ${unmatchedPersonName} per the latest inventory sheet — no matching Employee record found. Add ${unmatchedPersonName} to Employees, then use "Assign/Reassign" to link this asset.`;
  const notes = system.notes && !system.notes.includes(flag) ? `${system.notes}\n\n${flag}` : system.notes ?? flag;

  if (system.assignedEmployeeId) {
    await prisma.allocationHistory.updateMany({
      where: { systemId: system.id, employeeId: system.assignedEmployeeId, unassignedAt: null },
      data: { unassignedAt: new Date() },
    });
  }

  await prisma.system.update({
    where: { assetId },
    data: { assignedEmployeeId: null, notes },
  });
  console.log(`Unassigned ${assetId} and flagged "${unmatchedPersonName}" in notes.`);
}

async function reassign(assetId: string, employeeId: string) {
  const system = await prisma.system.findUnique({ where: { assetId } });
  if (!system) {
    console.warn(`Skipping ${assetId} — no matching System row found.`);
    return;
  }
  if (system.assignedEmployeeId === employeeId) return;

  if (system.assignedEmployeeId) {
    await prisma.allocationHistory.updateMany({
      where: { systemId: system.id, employeeId: system.assignedEmployeeId, unassignedAt: null },
      data: { unassignedAt: new Date() },
    });
  }
  await prisma.allocationHistory.create({ data: { systemId: system.id, employeeId } });
  await prisma.system.update({ where: { assetId }, data: { assignedEmployeeId: employeeId } });
  await prisma.systemHistoryEntry.create({
    data: { systemId: system.id, eventType: "Reassigned", description: "Reassigned per updated inventory sheet" },
  });
  console.log(`Reassigned ${assetId} -> ${employeeId}.`);
}

async function unassignOnly(assetId: string) {
  const system = await prisma.system.findUnique({ where: { assetId } });
  if (!system) {
    console.warn(`Skipping ${assetId} — no matching System row found.`);
    return;
  }
  if (!system.assignedEmployeeId) return;

  await prisma.allocationHistory.updateMany({
    where: { systemId: system.id, employeeId: system.assignedEmployeeId, unassignedAt: null },
    data: { unassignedAt: new Date() },
  });
  await prisma.system.update({ where: { assetId }, data: { assignedEmployeeId: null } });
  await prisma.systemHistoryEntry.create({
    data: { systemId: system.id, eventType: "Marked vacant", description: "Marked vacant per updated inventory sheet" },
  });
  console.log(`Unassigned ${assetId}.`);
}

async function ensureDsk01(harshitId: string) {
  const existing = await prisma.system.findUnique({ where: { assetId: "AOSL/Asset/DSK/01" } });
  if (existing) {
    console.log("AOSL/Asset/DSK/01 already exists — skipping creation.");
    return;
  }

  const system = await prisma.system.create({
    data: {
      assetId: "AOSL/Asset/DSK/01",
      name: "HP (Desktop)",
      assetType: "Desktop",
      status: "ALLOCATED",
      assignedEmployeeId: harshitId,
    },
  });
  await prisma.systemHistoryEntry.create({
    data: { systemId: system.id, eventType: "Registered", description: "Asset added to the registry (inventory sheet backfill)" },
  });
  await prisma.allocationHistory.create({ data: { systemId: system.id, employeeId: harshitId } });
  console.log("Created AOSL/Asset/DSK/01 assigned to Harshit.");
}

async function main() {
  const harshitId = await findEmployeeIdByExactName("Mr Harshit");
  const jayantiId = await findEmployeeIdByExactName("Ms Jayanti Roy");

  await ensureDsk01(harshitId);
  await reassign("AOSL/Asset/DSK/20", jayantiId);
  await unassignOnly("AOSL/Asset/DSK/21");
  await unassignWithNote("AOSL/Asset/LAP/10", "Anuj Gupta");
  await unassignWithNote("AOSL/Asset/LAP/13", "Neeraj Chauhan");

  for (const [assetId, info] of Object.entries(ACCESSORY_DATA)) {
    const result = await prisma.system.updateMany({
      where: { assetId },
      data: { assetType: info.assetType, keyboard: info.keyboard, mousePad: info.mousePad, charger: info.charger },
    });
    if (result.count === 0) console.warn(`No System row found for ${assetId} — accessory data not applied.`);
  }

  // DSK/19 is explicitly VACANT per the inventory sheet even though it was previously marked RETIRED.
  await prisma.system.updateMany({
    where: { assetId: "AOSL/Asset/DSK/19" },
    data: { status: "VACANT", assignedEmployeeId: null },
  });

  await prisma.system.updateMany({ where: { status: "IN_REPAIR" }, data: { status: "REPAIR" } });
  await prisma.system.updateMany({
    where: { status: { in: ["ACTIVE", "SPARE"] }, assignedEmployeeId: { not: null } },
    data: { status: "ALLOCATED" },
  });
  await prisma.system.updateMany({
    where: { status: { in: ["ACTIVE", "SPARE"] }, assignedEmployeeId: null },
    data: { status: "VACANT" },
  });

  const counts = await prisma.system.groupBy({ by: ["status"], _count: { _all: true } });
  console.log("Final status counts:", counts.map((c) => `${c.status}=${c._count._all}`).join(", "));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

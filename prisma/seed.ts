/**
 * Seed script — creates the single IT Administrator account plus a small
 * set of realistic sample records so the Dashboard, Settings, and every
 * module have real data to show on first run. Safe to re-run: it upserts
 * the admin and skips all sample data (employees, categories, tags,
 * custom fields, etc.) if employee records already exist.
 *
 * Run with: npm run db:seed
 */
import "dotenv/config";
import { encrypt } from "../src/lib/security/encryption";
// Shares the app's adapter-aware client so that seeding follows the same
// database selection as the running app: local SQLite by default, and the
// remote Turso database when TURSO_DATABASE_URL/TURSO_AUTH_TOKEN are set.
import { prisma } from "../src/lib/prisma";

const BCRYPT_HASH_PATTERN = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

async function seedAdmin() {
  const username = process.env.ADMIN_USERNAME ?? "admin";
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const name = process.env.ADMIN_NAME ?? "IT Administrator";
  const passwordHash = process.env.ADMIN_PASSWORD_HASH;

  // The plaintext password is never read here — only its bcrypt hash, so it
  // never touches this process's env, argv, or logs. Generate one with
  // `npm run admin:hash-password` (prompts for the password, prints only
  // the hash) and put that in ADMIN_PASSWORD_HASH.
  if (!email) {
    throw new Error("ADMIN_EMAIL is required to seed the admin account.");
  }
  if (!passwordHash || !BCRYPT_HASH_PATTERN.test(passwordHash)) {
    throw new Error(
      "ADMIN_PASSWORD_HASH is required and must be a bcrypt hash (run `npm run admin:hash-password` to generate one).",
    );
  }

  // Upsert by email (the account identifier that matters here) — if this
  // admin already exists, re-running the seed updates their password
  // instead of leaving it untouched or creating a duplicate account. Also
  // forces two-factor off: this portal is single-admin with no second login
  // step by design (see src/features/auth/actions.ts), so any 2FA state left
  // over from earlier testing is cleared here too.
  const existing = await prisma.admin.findFirst({ where: { OR: [{ email }, { username }] } });
  const twoFactorOff = {
    twoFactorEnabled: false,
    twoFactorSecret: null,
    twoFactorSecretIv: null,
    twoFactorSecretAuthTag: null,
    twoFactorRecoveryCodes: null,
  };

  const admin = existing
    ? await prisma.admin.update({ where: { id: existing.id }, data: { username, email, name, passwordHash, ...twoFactorOff } })
    : await prisma.admin.create({ data: { username, email, name, passwordHash, ...twoFactorOff } });

  console.log(`Admin ready: ${admin.username} (${admin.email})`);
  return admin;
}

/** Categories and tags shown out of the box — the admin can rename, add to, or delete every one of these later. */
async function seedCategoriesAndTags() {
  const categorySeeds: { module: string; name: string; color: string }[] = [
    { module: "employees", name: "Full-time", color: "#3b82f6" },
    { module: "employees", name: "Contractor", color: "#8b5cf6" },
    { module: "systems", name: "Laptop", color: "#3b82f6" },
    { module: "systems", name: "Desktop", color: "#10b981" },
    { module: "credentials", name: "Website", color: "#3b82f6" },
    { module: "credentials", name: "Wi-Fi", color: "#f59e0b" },
    { module: "credentials", name: "Hosting", color: "#8b5cf6" },
    { module: "credentials", name: "Microsoft 365", color: "#ef4444" },
    { module: "credentials", name: "Developer", color: "#10b981" },
    { module: "software", name: "Productivity", color: "#3b82f6" },
    { module: "software", name: "Operating System", color: "#6b7280" },
    { module: "network", name: "Head Office", color: "#3b82f6" },
    { module: "documents", name: "Invoice", color: "#3b82f6" },
    { module: "documents", name: "Warranty", color: "#f59e0b" },
    { module: "notes", name: "Networking", color: "#3b82f6" },
    { module: "notes", name: "Troubleshooting", color: "#f59e0b" },
    { module: "tasks", name: "Software", color: "#3b82f6" },
    { module: "tasks", name: "Hardware", color: "#f59e0b" },
    { module: "tasks", name: "Onboarding", color: "#10b981" },
    { module: "tasks", name: "Security", color: "#ef4444" },
  ];

  const categories = await Promise.all(
    categorySeeds.map((c, i) =>
      prisma.category.upsert({
        where: { module_name: { module: c.module, name: c.name } },
        update: {},
        create: { ...c, order: i },
      })
    )
  );

  const tagSeeds = [
    { name: "Urgent", color: "#ef4444" },
    { name: "Production", color: "#10b981" },
    { name: "Needs Review", color: "#f59e0b" },
  ];

  const tags = await Promise.all(
    tagSeeds.map((t) => prisma.tag.upsert({ where: { name: t.name }, update: {}, create: t }))
  );

  const byModuleAndName = (module: string, name: string) =>
    categories.find((c) => c.module === module && c.name === name)!.id;

  return { byModuleAndName, tags };
}

/** A couple of custom fields per module so the feature is visible on first run, not just documented. */
async function seedCustomFields() {
  const fields: { module: string; key: string; label: string; fieldType: "TEXT" | "URL"; order: number }[] = [
    { module: "systems", key: "gpu", label: "GPU", fieldType: "TEXT", order: 0 },
    { module: "software", key: "vendor_contact", label: "Vendor Contact", fieldType: "TEXT", order: 0 },
    { module: "network", key: "portal_url", label: "ISP Portal URL", fieldType: "URL", order: 0 },
  ];

  for (const field of fields) {
    // eslint-disable-next-line no-await-in-loop
    await prisma.customFieldDefinition.upsert({
      where: { module_key: { module: field.module, key: field.key } },
      update: {},
      create: field,
    });
  }
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function parseDob(value: string): Date {
  const match = value.match(/^(\d{1,2})-(\w{3})-(\d{2,4})$/);
  if (!match) {
    return new Date();
  }

  const [, dayRaw, monthRaw, yearRaw] = match;
  const day = Number(dayRaw);
  const monthIndex = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf((monthRaw ?? "").toLowerCase());
  let year = Number(yearRaw);

  if (Number.isNaN(year) || monthIndex < 0) {
    return new Date();
  }

  if (year < 100) {
    year = year < 70 ? 2000 + year : 1900 + year;
  }

  return new Date(year, monthIndex, day);
}

async function seedCompanyEmployees(byModuleAndName: (module: string, name: string) => string) {
  const employeeSeeds = [
    { employeeId: "201700001", name: "NAMs PoonamYadav", dob: "07-Mar-85", designation: "Managing Director" },
    { employeeId: "202500031", name: "Mr Vijay Kumar", dob: "02-Jan-81", designation: "Managing Director" },
    { employeeId: "202200012", name: "Mr Sanjay Kumar", dob: "20-Jun-89", designation: "COO & HR Head" },
    { employeeId: "202300022", name: "Mr Vivek Kumar", dob: "17-Jun-95", designation: "Sales Assitant Manager" },
    { employeeId: "201700003", name: "Mr Deepak Yadav", dob: "30-Apr-96", designation: "Sales Associate" },
    { employeeId: "202300024", name: "Mr Virendra Kumar", dob: "24-Jan-87", designation: "Sales Executive" },
    { employeeId: "202500033", name: "Mr Pintu Harijan", dob: "15-Oct-97", designation: "Stores Assistant" },
    { employeeId: "202500034", name: "Mr Gauri Shanker", dob: "10-Feb-95", designation: "Store Assitant Manager" },
    { employeeId: "202500035", name: "Mr Ram Vinay", dob: "18-Jul-95", designation: "Office Boy" },
    { employeeId: "202500040", name: "Mrs Tripti", dob: "13-Aug-92", designation: "Sales Manager" },
    { employeeId: "202500039", name: "Mr SHIVAM SINGH", dob: "07-Jul-00", designation: "Stores Assistant" },
    { employeeId: "202500041", name: "Mr PRAVASH KUMAR ROY", dob: "22-Jul-84", designation: "Stores Assistant" },
    { employeeId: "202500042", name: "Mr Akshay Mohan P", dob: "21-May-98", designation: "Quality Associate" },
    { employeeId: "202500037", name: "Mr Piyush Daynma", dob: "26-Dec-02", designation: "IT Support Associate" },
    { employeeId: "202600046", name: "Mr Harshit", dob: "21-Oct-00", designation: "ACCOUNTS Executive" },
    { employeeId: "202500038", name: "Ms Shahjeen", dob: "18-May-05", designation: "Purchase Associate" },
    { employeeId: "202600044", name: "Ms MADHUMITA", dob: "11-Aug-05", designation: "Sales Associate" },
    { employeeId: "202600048", name: "Mr Sachin Kumar Yadav", dob: "03-May-05", designation: "Store Associate" },
    { employeeId: "202600049", name: "Ms Jayanti Roy", dob: "05-Mar-98", designation: "Purchase Assistant Manager" },
  ];

  for (const employee of employeeSeeds) {
    const email = `${slugify(employee.name)}-${employee.employeeId}@company.com`;
    const notes = [`Employee ID: ${employee.employeeId}`, `DOB: ${employee.dob}`].join("\n");

    // eslint-disable-next-line no-await-in-loop
    await prisma.employee.upsert({
      where: { email },
      update: {
        name: employee.name,
        department: employee.designation,
        phone: null,
        joiningDate: parseDob(employee.dob),
        status: "ACTIVE",
        notes,
        categoryId: byModuleAndName("employees", "Full-time"),
      },
      create: {
        name: employee.name,
        department: employee.designation,
        email,
        phone: null,
        joiningDate: parseDob(employee.dob),
        status: "ACTIVE",
        notes,
        categoryId: byModuleAndName("employees", "Full-time"),
      },
    });
  }
}

async function seedSampleData(adminId: string) {
  const employeeCount = await prisma.employee.count();
  if (employeeCount > 0) {
    const { byModuleAndName } = await seedCategoriesAndTags();
    await seedCustomFields();
    await seedCompanyEmployees(byModuleAndName);
    console.log("Sample data already present — updated company employee roster.");
    return;
  }

  const { byModuleAndName, tags } = await seedCategoriesAndTags();
  await seedCustomFields();
  await seedCompanyEmployees(byModuleAndName);

  const employees = await Promise.all(
    [
      { name: "Aarav Sharma", department: "Sales", email: "aarav.sharma@company.com", phone: "+91 98765 43210" },
      { name: "Priya Nair", department: "Finance", email: "priya.nair@company.com", phone: "+91 98765 43211" },
      { name: "Rohan Mehta", department: "Operations", email: "rohan.mehta@company.com", phone: "+91 98765 43212" },
      { name: "Sneha Kulkarni", department: "HR", email: "sneha.kulkarni@company.com", phone: "+91 98765 43213" },
      { name: "Vikram Singh", department: "IT", email: "vikram.singh@company.com", phone: "+91 98765 43214" },
    ].map((e, i) =>
      prisma.employee.create({
        data: {
          ...e,
          joiningDate: new Date(2022, i, 15),
          status: "ACTIVE",
          categoryId: byModuleAndName("employees", "Full-time"),
        },
      })
    )
  );

  const now = new Date();
  const oneMonth = 1000 * 60 * 60 * 24 * 30;

  const systemsData = [
    {
      assetId: "AST-1001",
      name: "Sales-WKS-01",
      serialNumber: "SN-DL-88213",
      manufacturer: "Dell",
      model: "OptiPlex 7010",
      processor: "Intel Core i5-13500",
      ram: "16 GB",
      storage: "512 GB SSD",
      osVersion: "Windows 11 Pro",
      officeVersion: "Microsoft 365",
      purchaseDate: new Date(now.getTime() - oneMonth * 20),
      warrantyExpiry: new Date(now.getTime() + oneMonth * 2),
      status: "ALLOCATED",
      assetType: "Desktop",
      location: "2nd Floor — Sales",
      categoryId: byModuleAndName("systems", "Desktop"),
      assignedEmployeeId: employees[0]?.id,
    },
    {
      assetId: "AST-1002",
      name: "Finance-WKS-01",
      serialNumber: "SN-HP-44120",
      manufacturer: "HP",
      model: "EliteDesk 800 G9",
      processor: "Intel Core i7-13700",
      ram: "16 GB",
      storage: "1 TB SSD",
      osVersion: "Windows 11 Pro",
      officeVersion: "Microsoft 365",
      purchaseDate: new Date(now.getTime() - oneMonth * 8),
      warrantyExpiry: new Date(now.getTime() + oneMonth * 22),
      status: "ALLOCATED",
      assetType: "Desktop",
      location: "3rd Floor — Finance",
      categoryId: byModuleAndName("systems", "Desktop"),
      assignedEmployeeId: employees[1]?.id,
    },
    {
      assetId: "AST-1003",
      name: "Ops-LAP-01",
      serialNumber: "SN-LN-77341",
      manufacturer: "Lenovo",
      model: "ThinkPad T14",
      processor: "AMD Ryzen 7 PRO",
      ram: "16 GB",
      storage: "512 GB SSD",
      osVersion: "Windows 11 Pro",
      officeVersion: "Microsoft 365",
      purchaseDate: new Date(now.getTime() - oneMonth * 30),
      warrantyExpiry: new Date(now.getTime() + oneMonth * 0.5),
      status: "ALLOCATED",
      assetType: "Laptop",
      location: "1st Floor — Operations",
      categoryId: byModuleAndName("systems", "Laptop"),
      assignedEmployeeId: employees[2]?.id,
    },
    {
      assetId: "AST-1004",
      name: "HR-WKS-01",
      serialNumber: "SN-DL-99871",
      manufacturer: "Dell",
      model: "Vostro 3910",
      processor: "Intel Core i5-12400",
      ram: "8 GB",
      storage: "256 GB SSD",
      osVersion: "Windows 10 Pro",
      officeVersion: "Microsoft 365",
      purchaseDate: new Date(now.getTime() - oneMonth * 40),
      warrantyExpiry: new Date(now.getTime() - oneMonth * 1),
      status: "ALLOCATED",
      assetType: "Desktop",
      location: "3rd Floor — HR",
      categoryId: byModuleAndName("systems", "Desktop"),
      assignedEmployeeId: employees[3]?.id,
    },
    {
      assetId: "AST-1005",
      name: "Spare-LAP-01",
      serialNumber: "SN-AC-33456",
      manufacturer: "Acer",
      model: "TravelMate P2",
      processor: "Intel Core i3-1215U",
      ram: "8 GB",
      storage: "256 GB SSD",
      osVersion: "Windows 11 Pro",
      officeVersion: null,
      purchaseDate: new Date(now.getTime() - oneMonth * 5),
      warrantyExpiry: new Date(now.getTime() + oneMonth * 30),
      status: "VACANT",
      assetType: "Laptop",
      location: "IT Store Room",
      categoryId: byModuleAndName("systems", "Laptop"),
      assignedEmployeeId: null,
    },
  ];

  const systems = await Promise.all(
    systemsData.map((s) => prisma.system.create({ data: s }))
  );

  await Promise.all(
    systems.map((s) =>
      prisma.systemHistoryEntry.create({
        data: {
          systemId: s.id,
          eventType: "Windows Installed",
          description: `${s.osVersion ?? "OS"} installed and activated`,
          eventDate: s.purchaseDate ?? now,
        },
      })
    )
  );

  await Promise.all(
    employees.filter((e) => e).map((e, i) => {
      const sys = systems[i];
      if (!sys) return Promise.resolve();
      return prisma.allocationHistory.create({
        data: { employeeId: e.id, systemId: sys.id, assignedAt: sys.purchaseDate ?? now },
      });
    })
  );

  const credentialSeeds = [
    { platform: "Company Website", categoryName: "Website", url: "https://company.com/wp-admin", username: "admin" },
    { platform: "Office WiFi", categoryName: "Wi-Fi", url: undefined, username: "N/A" },
    { platform: "cPanel Hosting", categoryName: "Hosting", url: "https://cpanel.company.com", username: "itadmin" },
    { platform: "Microsoft 365 Admin", categoryName: "Microsoft 365", url: "https://admin.microsoft.com", username: "admin@company.com" },
    { platform: "GitHub Org", categoryName: "Developer", url: "https://github.com/company", username: "it-admin" },
  ];

  for (const c of credentialSeeds) {
    const { ciphertext, iv, authTag } = encrypt("Placeholder@123");
    // eslint-disable-next-line no-await-in-loop
    await prisma.credential.create({
      data: {
        platform: c.platform,
        url: c.url,
        username: c.username,
        encryptedPassword: ciphertext,
        iv,
        authTag,
        categoryId: byModuleAndName("credentials", c.categoryName),
      },
    });
  }

  await prisma.software.createMany({
    data: [
      { name: "Microsoft 365", version: "2024", licenseType: "Subscription", expiryDate: new Date(now.getTime() + oneMonth * 6), categoryId: byModuleAndName("software", "Productivity") },
      { name: "Adobe Creative Cloud", version: "2025", licenseType: "Subscription", expiryDate: new Date(now.getTime() + oneMonth * 3), categoryId: byModuleAndName("software", "Productivity") },
      { name: "Tally Prime", version: "5.1", licenseType: "Perpetual", expiryDate: null, categoryId: byModuleAndName("software", "Productivity") },
      { name: "Windows 11 Pro", version: "24H2", licenseType: "OEM", expiryDate: null, categoryId: byModuleAndName("software", "Operating System") },
    ],
  });

  await prisma.networkConfig.create({
    data: {
      label: "Head Office",
      wifiName: "Company-Office-5G",
      routerIp: "192.168.1.1",
      gateway: "192.168.1.1",
      dns: "1.1.1.1, 8.8.8.8",
      isp: "ACT Fibernet",
      bandwidth: "300 Mbps",
      routerLoginUser: "admin",
      categoryId: byModuleAndName("network", "Head Office"),
    },
  });

  const documents = await Promise.all([
    prisma.document.create({
      data: {
        title: "Dell OptiPlex 7010 Invoice",
        categoryId: byModuleAndName("documents", "Invoice"),
        fileName: "dell-invoice.pdf",
        filePath: "seed/dell-invoice.pdf",
      },
    }),
    prisma.document.create({
      data: {
        title: "HP EliteDesk Warranty Card",
        categoryId: byModuleAndName("documents", "Warranty"),
        fileName: "hp-warranty.pdf",
        filePath: "seed/hp-warranty.pdf",
      },
    }),
  ]);

  const notes = await Promise.all([
    prisma.note.create({
      data: {
        title: "VPN Configuration Steps",
        content: "<p>1. Open GlobalProtect...</p>",
        categoryId: byModuleAndName("notes", "Networking"),
        pinned: true,
      },
    }),
    prisma.note.create({
      data: {
        title: "Reception Printer Issue",
        content: "<p>Printer jams when printing duplex — clean rollers.</p>",
        categoryId: byModuleAndName("notes", "Troubleshooting"),
        pinned: false,
      },
    }),
  ]);

  const tasks = await Promise.all([
    prisma.task.create({
      data: { title: "Renew Microsoft 365 license", priority: "HIGH", dueDate: new Date(now.getTime() + oneMonth * 6), categoryId: byModuleAndName("tasks", "Software") },
    }),
    prisma.task.create({
      data: { title: "Replace warranty-expired HR workstation", priority: "URGENT", dueDate: new Date(now.getTime() + oneMonth * 0.2), categoryId: byModuleAndName("tasks", "Hardware") },
    }),
    prisma.task.create({
      data: { title: "Set up new joiner laptop", priority: "MEDIUM", dueDate: new Date(now.getTime() + oneMonth * 0.1), categoryId: byModuleAndName("tasks", "Onboarding") },
    }),
    prisma.task.create({
      data: { title: "Backup credential vault export", priority: "LOW", dueDate: new Date(now.getTime() + oneMonth), categoryId: byModuleAndName("tasks", "Security"), completed: true, completedAt: now },
    }),
  ]);

  // A handful of tag assignments so the "Tags" filter has something to show.
  const urgentTag = tags.find((t) => t.name === "Urgent")!;
  const productionTag = tags.find((t) => t.name === "Production")!;
  await prisma.tagAssignment.createMany({
    data: [
      { tagId: urgentTag.id, module: "tasks", recordId: tasks[1]!.id },
      { tagId: productionTag.id, module: "network", recordId: (await prisma.networkConfig.findFirstOrThrow()).id },
      { tagId: urgentTag.id, module: "systems", recordId: systems[3]!.id },
    ],
  });

  await prisma.activityLog.createMany({
    data: [
      { action: "created", entityType: "employees", entityId: employees[0]?.id, entityLabel: "Aarav Sharma", description: "Added new employee Aarav Sharma", adminId },
      { action: "created", entityType: "systems", entityId: systems[0]?.id, entityLabel: "AST-1001", description: "Registered asset AST-1001", adminId },
      { action: "updated", entityType: "credentials", entityLabel: "Company Website", description: "Rotated password for Company Website", adminId },
      { action: "created", entityType: "tasks", entityId: tasks[0]?.id, entityLabel: "Renew Microsoft 365 license", description: "Created task: Renew Microsoft 365 license", adminId },
    ],
  });

  console.log(
    `Seeded ${employees.length} employees, ${systems.length} systems, ${documents.length} documents, ${notes.length} notes, ${tasks.length} tasks, sample credentials, software, categories, tags and custom fields.`
  );
}

async function main() {
  const admin = await seedAdmin();
  await seedSampleData(admin.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

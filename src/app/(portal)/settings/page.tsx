import type { Metadata } from "next";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requireAdmin } from "@/lib/auth/dal";
import { getAllCategories } from "@/features/categories/actions";
import { getAllTags } from "@/features/tags/actions";
import { getCustomFieldDefs } from "@/features/custom-fields/actions";
import { getBackupStatus } from "@/features/backup/actions";
import { MODULE_KEYS, type ModuleKey } from "@/config/modules";
import { ProfileForm } from "@/features/settings/components/profile-form";
import { ChangePasswordForm } from "@/features/settings/components/change-password-form";
import { ModuleSettings } from "@/features/settings/components/module-settings";
import { TagManager } from "@/features/tags/components/tag-manager";
import { BackupPanel } from "@/features/settings/components/backup-panel";
import { ThemeSettings } from "@/features/settings/components/theme-settings";
import { TwoFactorSettings } from "@/features/settings/components/two-factor-settings";
import { ActiveSessionsPanel } from "@/features/settings/components/active-sessions-panel";
import { getTwoFactorStatus, getActiveSessions } from "@/features/settings/actions";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const admin = await requireAdmin();

  const [allCategories, allTags, backupStatus, twoFactorStatus, activeSessions, ...fieldsPerModule] = await Promise.all([
    getAllCategories(),
    getAllTags(),
    getBackupStatus(),
    getTwoFactorStatus(),
    getActiveSessions(),
    ...MODULE_KEYS.map((m) => getCustomFieldDefs(m)),
  ]);

  const fieldsByModule = Object.fromEntries(
    MODULE_KEYS.map((m, i) => [m, fieldsPerModule[i]!])
  ) as Record<ModuleKey, (typeof fieldsPerModule)[number]>;

  const categoriesByModule = Object.fromEntries(
    MODULE_KEYS.map((m) => [m, allCategories.filter((c) => c.module === m)])
  ) as Record<ModuleKey, typeof allCategories>;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your account, custom fields, categories, tags, appearance and database backups.
        </p>
      </div>

      <Tabs defaultValue="profile">
        <TabsList className="flex-wrap">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="fields">Fields &amp; categories</TabsTrigger>
          <TabsTrigger value="tags">Tags</TabsTrigger>
          <TabsTrigger value="backup">Backup</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="about">About</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>Your account details as the IT Administrator for this portal.</CardDescription>
            </CardHeader>
            <CardContent>
              <ProfileForm admin={{ name: admin.name, email: admin.email, username: admin.username }} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fields">
          <ModuleSettings fieldsByModule={fieldsByModule} categoriesByModule={categoriesByModule} />
        </TabsContent>

        <TabsContent value="tags">
          <Card>
            <CardHeader>
              <CardTitle>Tags</CardTitle>
              <CardDescription>Shared across every module — filter and find records by tag anywhere in the portal.</CardDescription>
            </CardHeader>
            <CardContent>
              <TagManager tags={allTags} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="backup">
          <BackupPanel status={backupStatus} />
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Change password</CardTitle>
              <CardDescription>
                At least 8 characters with an uppercase letter, lowercase letter, number and special character.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChangePasswordForm />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Two-factor authentication</CardTitle>
              <CardDescription>Turned off for this single-admin portal — see below.</CardDescription>
            </CardHeader>
            <CardContent>
              <TwoFactorSettings initialStatus={twoFactorStatus} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Active sessions</CardTitle>
              <CardDescription>Devices currently signed in to this account.</CardDescription>
            </CardHeader>
            <CardContent>
              <ActiveSessionsPanel sessions={activeSessions} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appearance">
          <Card>
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>Choose how the portal looks. System follows your device's setting.</CardDescription>
            </CardHeader>
            <CardContent>
              <ThemeSettings />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="about">
          <Card>
            <CardHeader>
              <CardTitle>About</CardTitle>
              <CardDescription>IT Manager Portal — a personal IT notebook for one administrator.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>Version 0.1.0</p>
              <p>Built with Next.js, TypeScript, Prisma and SQLite. All data is stored locally in a single database file — nothing is sent anywhere else.</p>
              <p>Signed in as {admin.name} ({admin.username}).</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

import type { Metadata } from "next";

import { getVpnCredentials } from "@/features/vpn/actions";
import { getCategories } from "@/features/categories/actions";
import { getCustomFieldDefs } from "@/features/custom-fields/actions";
import { VpnView } from "@/features/vpn/components/vpn-view";

export const metadata: Metadata = { title: "VPN Details" };

export default async function VpnPage() {
  const [vpnCredentials, categories, customFieldDefs] = await Promise.all([
    getVpnCredentials(true),
    getCategories("vpn"),
    getCustomFieldDefs("vpn"),
  ]);

  return <VpnView vpnCredentials={vpnCredentials} categories={categories} customFieldDefs={customFieldDefs} />;
}

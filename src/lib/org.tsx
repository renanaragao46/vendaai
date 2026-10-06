import { createContext, useContext, type ReactNode } from "react";
import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];
export type Organization = Database["public"]["Tables"]["organizations"]["Row"];

export interface OrgContextValue {
  userId: string;
  email: string | null;
  role: AppRole;
  org: Organization;
}

export const membershipQuery = (userId: string) =>
  queryOptions({
    queryKey: ["membership", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("memberships")
        .select("role, organization:organizations(*)")
        .eq("user_id", userId)
        .order("created_at")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data?.organization) return null;
      return { role: data.role, org: data.organization as Organization };
    },
  });

const OrgContext = createContext<OrgContextValue | null>(null);

export function OrgProvider({ value, children }: { value: OrgContextValue; children: ReactNode }) {
  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

export function useOrg() {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error("useOrg must be used inside OrgProvider");
  return ctx;
}

export const canManage = (role: AppRole) => role === "OWNER" || role === "ADMIN" || role === "MANAGER";
export const canWorkConversations = (role: AppRole) => canManage(role) || role === "AGENT";
export const canAdmin = (role: AppRole) => role === "OWNER" || role === "ADMIN";

export const ROLE_LABEL: Record<AppRole, string> = {
  OWNER: "Proprietário",
  ADMIN: "Administrador",
  MANAGER: "Gerente",
  AGENT: "Atendente",
};

export const brl = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

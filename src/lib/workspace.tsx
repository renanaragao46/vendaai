import { createContext, useContext, type ReactNode } from "react";
export type Workspace = { id: string; name: string };
type WorkspaceValue = { workspace: Workspace; userId: string; email: string | null; role: "owner" | "member" };
const WorkspaceContext = createContext<WorkspaceValue | null>(null);
export function WorkspaceProvider({ value, children }: { value: WorkspaceValue; children: ReactNode }) {
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}
export function useWorkspace() {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error("WorkspaceProvider não encontrado.");
  return value;
}

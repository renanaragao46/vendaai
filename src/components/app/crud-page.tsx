import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Plus, Trash2, Inbox } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/lib/org";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { FieldInput, fromForm, toForm, type FieldDef, type FormValues } from "./form-fields";
import { PageHeader } from "./page-header";

type Row = FormValues & { id: string };

export interface Column {
  key: string;
  label: string;
  render?: (row: Row) => ReactNode;
}

export interface CrudConfig {
  table: string;
  title: string;
  description?: string;
  singular: string;
  fields: FieldDef[];
  columns: Column[];
  select?: string;
  orderBy?: string;
  filter?: Record<string, string>;
  defaults?: FormValues;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  emptyText?: string;
  embedded?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = (t: string) => supabase.from(t as any) as any;

export function CrudPage(cfg: CrudConfig) {
  const { org } = useOrg();
  const qc = useQueryClient();
  const key = [cfg.table, org.id, cfg.filter ?? null];
  const [editing, setEditing] = useState<Row | null>(null);
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<FormValues>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deleting, setDeleting] = useState<Row | null>(null);

  const list = useQuery({
    queryKey: key,
    queryFn: async () => {
      let q = db(cfg.table).select(cfg.select ?? "*").eq("organization_id", org.id);
      for (const [k, v] of Object.entries(cfg.filter ?? {})) q = q.eq(k, v);
      const { data, error } = await q.order(cfg.orderBy ?? "created_at", { ascending: false });
      if (error) throw error;
      return data as Row[];
    },
  });

  const save = useMutation({
    mutationFn: async (payload: FormValues) => {
      const body = { ...payload, ...(cfg.filter ?? {}), organization_id: org.id };
      const res = editing
        ? await db(cfg.table).update(body).eq("id", editing.id).eq("organization_id", org.id)
        : await db(cfg.table).insert(body);
      if (res.error) throw res.error;
    },
    onSuccess: () => {
      toast.success(editing ? "Alterações salvas" : `${cfg.singular} criado(a)`);
      setOpen(false);
      qc.invalidateQueries({ queryKey: [cfg.table] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (row: Row) => {
      const { error } = await db(cfg.table).delete().eq("id", row.id).eq("organization_id", org.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Excluído");
      setDeleting(null);
      qc.invalidateQueries({ queryKey: [cfg.table] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openForm = (row: Row | null) => {
    setEditing(row);
    setValues(toForm(cfg.fields, row, cfg.defaults));
    setErrors({});
    setOpen(true);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const { errors: errs, payload } = fromForm(cfg.fields, values);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    save.mutate(payload);
  };

  const addButton = cfg.canCreate && (
    <Button onClick={() => openForm(null)}>
      <Plus className="mr-1 h-4 w-4" /> Novo(a) {cfg.singular.toLowerCase()}
    </Button>
  );

  return (
    <div className="space-y-6">
      {cfg.embedded ? (
        <div className="flex justify-end">{addButton}</div>
      ) : (
        <PageHeader title={cfg.title} description={cfg.description} action={addButton} />
      )}

      <Card className="overflow-hidden shadow-soft">
        {list.isLoading ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : list.error ? (
          <div className="p-8 text-center text-sm text-destructive">
            Erro ao carregar: {(list.error as Error).message}
          </div>
        ) : !list.data?.length ? (
          <div className="flex flex-col items-center gap-3 p-12 text-center">
            <div className="rounded-full bg-accent p-3 text-accent-foreground">
              <Inbox className="h-6 w-6" />
            </div>
            <p className="text-sm text-muted-foreground">
              {cfg.emptyText ?? "Nenhum registro ainda."}
            </p>
            {addButton}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {cfg.columns.map((c) => (
                    <TableHead key={c.key}>{c.label}</TableHead>
                  ))}
                  {(cfg.canEdit || cfg.canDelete) && <TableHead className="w-24" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.data.map((row) => (
                  <TableRow key={row.id}>
                    {cfg.columns.map((c) => (
                      <TableCell key={c.key} className="max-w-[280px] truncate">
                        {c.render ? c.render(row) : String(row[c.key] ?? "—")}
                      </TableCell>
                    ))}
                    {(cfg.canEdit || cfg.canDelete) && (
                      <TableCell className="text-right whitespace-nowrap">
                        {cfg.canEdit && (
                          <Button variant="ghost" size="icon" onClick={() => openForm(row)} aria-label="Editar">
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        {cfg.canDelete && (
                          <Button variant="ghost" size="icon" onClick={() => setDeleting(row)} aria-label="Excluir">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar" : "Novo(a)"} {cfg.singular.toLowerCase()}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              {cfg.fields.map((f) => (
                <FieldInput
                  key={f.name}
                  field={f}
                  value={values[f.name]}
                  error={errors[f.name]}
                  onChange={(v) => setValues((s) => ({ ...s, [f.name]: v }))}
                />
              ))}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={save.isPending}>
                {save.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir registro?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleting && remove.mutate(deleting)}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

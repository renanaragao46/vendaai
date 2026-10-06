import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "email"
  | "url"
  | "select"
  | "list"
  | "switch"
  | "datetime";

export interface FieldDef {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
  help?: string;
  full?: boolean;
}

export type FormValues = Record<string, unknown>;

const NONE = "__none__";

/** Convert a DB row to form-friendly strings. */
export function toForm(fields: FieldDef[], row: FormValues | null, defaults: FormValues = {}) {
  const out: FormValues = {};
  for (const f of fields) {
    const v = row?.[f.name] ?? defaults[f.name];
    if (f.type === "list") out[f.name] = Array.isArray(v) ? v.join(", ") : "";
    else if (f.type === "switch") out[f.name] = Boolean(v);
    else if (f.type === "datetime") out[f.name] = v ? String(v).slice(0, 16) : "";
    else out[f.name] = v == null ? "" : String(v);
  }
  return out;
}

/** Validate and convert form values to DB payload. Returns errors keyed by field. */
export function fromForm(fields: FieldDef[], values: FormValues) {
  const errors: Record<string, string> = {};
  const payload: FormValues = {};
  for (const f of fields) {
    const raw = values[f.name];
    if (f.type === "switch") {
      payload[f.name] = Boolean(raw);
      continue;
    }
    const s = String(raw ?? "").trim();
    if (f.required && !s) {
      errors[f.name] = "Campo obrigatório";
      continue;
    }
    if (!s) {
      payload[f.name] = f.type === "list" ? [] : null;
      continue;
    }
    if (s.length > 5000) errors[f.name] = "Texto muito longo";
    switch (f.type) {
      case "number": {
        const n = Number(s.replace(",", "."));
        if (Number.isNaN(n) || n < 0) errors[f.name] = "Informe um número válido (≥ 0)";
        payload[f.name] = n;
        break;
      }
      case "email":
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) errors[f.name] = "E-mail inválido";
        payload[f.name] = s;
        break;
      case "url":
        if (!/^https?:\/\/\S+$/i.test(s)) errors[f.name] = "URL deve começar com http(s)://";
        payload[f.name] = s;
        break;
      case "list":
        payload[f.name] = s.split(",").map((x) => x.trim()).filter(Boolean);
        break;
      case "datetime":
        payload[f.name] = new Date(s).toISOString();
        break;
      default:
        payload[f.name] = s;
    }
  }
  return { errors, payload };
}

export function FieldInput({
  field,
  value,
  error,
  onChange,
  disabled,
}: {
  field: FieldDef;
  value: unknown;
  error?: string;
  onChange: (v: unknown) => void;
  disabled?: boolean;
}) {
  const id = `f-${field.name}`;
  return (
    <div className={field.full || field.type === "textarea" ? "sm:col-span-2 space-y-1.5" : "space-y-1.5"}>
      {field.type === "switch" ? (
        <div className="flex items-center justify-between rounded-lg border p-3">
          <Label htmlFor={id}>{field.label}</Label>
          <Switch id={id} checked={Boolean(value)} onCheckedChange={onChange} disabled={disabled} />
        </div>
      ) : (
        <>
          <Label htmlFor={id}>
            {field.label}
            {field.required && <span className="text-destructive"> *</span>}
          </Label>
          {field.type === "textarea" ? (
            <Textarea
              id={id}
              rows={4}
              value={String(value ?? "")}
              placeholder={field.placeholder}
              onChange={(e) => onChange(e.target.value)}
              disabled={disabled}
            />
          ) : field.type === "select" ? (
            <Select
              value={String(value || NONE)}
              onValueChange={(v) => onChange(v === NONE ? "" : v)}
              disabled={disabled}
            >
              <SelectTrigger id={id}>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {!field.required && <SelectItem value={NONE}>—</SelectItem>}
                {field.options?.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              id={id}
              type={
                field.type === "number"
                  ? "text"
                  : field.type === "datetime"
                    ? "datetime-local"
                    : field.type === "list"
                      ? "text"
                      : field.type
              }
              inputMode={field.type === "number" ? "decimal" : undefined}
              value={String(value ?? "")}
              placeholder={field.placeholder ?? (field.type === "list" ? "Separe por vírgulas" : undefined)}
              onChange={(e) => onChange(e.target.value)}
              disabled={disabled}
            />
          )}
        </>
      )}
      {field.help && !error && <p className="text-xs text-muted-foreground">{field.help}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

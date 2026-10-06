import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldInput, fromForm, toForm, type FieldDef, type FormValues } from "./form-fields";

/** Single-record form (settings-style). */
export function RecordForm({
  fields,
  row,
  onSave,
  saving,
  disabled,
  submitLabel = "Salvar",
}: {
  fields: FieldDef[];
  row: FormValues | null;
  onSave: (payload: FormValues) => void;
  saving?: boolean;
  disabled?: boolean;
  submitLabel?: string;
}) {
  const [values, setValues] = useState<FormValues>(() => toForm(fields, row));
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => setValues(toForm(fields, row)), [row]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const r = fromForm(fields, values);
        setErrors(r.errors);
        if (!Object.keys(r.errors).length) onSave(r.payload);
      }}
      className="space-y-6"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((f) => (
          <FieldInput
            key={f.name}
            field={f}
            value={values[f.name]}
            error={errors[f.name]}
            disabled={disabled}
            onChange={(v) => setValues((s) => ({ ...s, [f.name]: v }))}
          />
        ))}
      </div>
      {!disabled && (
        <div className="flex justify-end">
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} {submitLabel}
          </Button>
        </div>
      )}
    </form>
  );
}

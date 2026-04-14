'use client';

import { useState, type FormEvent } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { UIAction } from '@/lib/ai-os';
import type {
  EditableFormBlock,
  EditableFormField,
} from '@/lib/ai-os/ui-composer/types';

export interface BlockComponentProps<B> {
  block: B;
  onAction?: (action: UIAction) => void;
}

function renderField(
  field: EditableFormField,
  value: string | number,
  onChange: (name: string, value: string | number) => void,
) {
  const baseTextareaClass =
    'w-full min-h-[80px] rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30';

  const baseSelectClass =
    'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30';

  switch (field.type) {
    case 'textarea':
      return (
        <textarea
          name={field.name}
          required={field.required}
          placeholder={field.placeholder}
          value={String(value)}
          onChange={(e) => onChange(field.name, e.target.value)}
          className={baseTextareaClass}
        />
      );

    case 'select':
      return (
        <select
          name={field.name}
          required={field.required}
          value={String(value)}
          onChange={(e) => onChange(field.name, e.target.value)}
          className={baseSelectClass}
        >
          <option value="">
            {field.placeholder ?? 'Select...'}
          </option>
          {field.options?.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      );

    default:
      return (
        <Input
          type={field.type}
          name={field.name}
          required={field.required}
          placeholder={field.placeholder}
          value={String(value)}
          onChange={(e) => {
            const v =
              field.type === 'number'
                ? e.target.valueAsNumber
                : e.target.value;
            onChange(field.name, Number.isNaN(v) ? '' : v);
          }}
          pattern={field.pattern}
        />
      );
  }
}

export default function EditableForm({
  block,
  onAction,
}: BlockComponentProps<EditableFormBlock>) {
  const [values, setValues] = useState<Record<string, string | number>>(() => {
    const initial: Record<string, string | number> = {};
    for (const field of block.fields) {
      initial[field.name] = field.defaultValue ?? '';
    }
    return initial;
  });

  const handleChange = (name: string, value: string | number) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const payloadJson = JSON.stringify(values);
    const synthetic: UIAction = {
      id: 'submit',
      label: block.submitLabel,
      intent: {
        rawInput: `${block.submitIntent.rawInput} \u2014 payload: ${payloadJson}`,
      },
    };
    onAction?.(synthetic);
  };

  return (
    <Card className="rounded-xl border bg-white shadow-sm dark:bg-gray-900">
      <CardHeader>
        <CardTitle className="text-base font-semibold">{block.title}</CardTitle>
        {block.description && (
          <p className="text-sm text-muted-foreground">{block.description}</p>
        )}
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {block.fields.map((field) => (
            <div key={field.name} className="flex flex-col gap-1.5">
              <label
                htmlFor={field.name}
                className="text-sm font-medium text-foreground"
              >
                {field.label}
                {field.required && (
                  <span className="ml-0.5 text-red-500">*</span>
                )}
              </label>
              {renderField(field, values[field.name], handleChange)}
              {field.helpText && (
                <span className="text-xs text-muted-foreground">
                  {field.helpText}
                </span>
              )}
            </div>
          ))}

          <Button
            type="submit"
            className="mt-2 self-start bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600"
          >
            {block.submitLabel}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

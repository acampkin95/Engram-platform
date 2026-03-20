'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { ReactNode } from 'react';
import {
  type DefaultValues,
  type FieldValues,
  type Path,
  type RegisterOptions,
  useForm,
} from 'react-hook-form';
import type { z } from 'zod';
import { Button } from '@/src/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/src/components/ui/form';
import { Input } from '@/src/components/ui/input';
import { Textarea } from '@/src/components/ui/textarea';

export interface FormFieldConfig<T extends FieldValues> {
  name: Path<T>;
  label: string;
  type?: 'text' | 'email' | 'password' | 'number' | 'url' | 'textarea';
  placeholder?: string;
  description?: string;
  required?: boolean;
  disabled?: boolean;
  maxLength?: number;
  minLength?: number;
  pattern?: string;
  options?: RegisterOptions<T>;
}

interface FormInputProps<T extends FieldValues> {
  control: ReturnType<typeof useForm<T>>['control'];
  config: FormFieldConfig<T>;
  className?: string;
}

export function FormInput<T extends FieldValues>({
  control,
  config,
  className = '',
}: FormInputProps<T>) {
  return (
    <FormField
      control={control}
      name={config.name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>
            {config.label}
            {config.required && <span className="text-destructive ml-1">*</span>}
          </FormLabel>
          <FormControl>
            {config.type === 'textarea' ? (
              <Textarea
                {...field}
                placeholder={config.placeholder}
                disabled={config.disabled}
                required={config.required}
                maxLength={config.maxLength}
                minLength={config.minLength}
                rows={4}
              />
            ) : (
              <Input
                {...field}
                type={config.type ?? 'text'}
                placeholder={config.placeholder}
                disabled={config.disabled}
                required={config.required}
                maxLength={config.maxLength}
                minLength={config.minLength}
                pattern={config.pattern}
                value={field.value ?? ''}
              />
            )}
          </FormControl>
          {config.description && <FormDescription>{config.description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

interface AutoFormProps<T extends FieldValues> {
  schema: z.ZodSchema<T>;
  fields: FormFieldConfig<T>[];
  onSubmit: (data: T) => void | Promise<void>;
  submitLabel?: string;
  defaultValues?: Partial<T>;
  className?: string;
  children?: ReactNode;
  isSubmitting?: boolean;
}

export function AutoForm<T extends FieldValues>({
  schema,
  fields,
  onSubmit,
  submitLabel = 'Submit',
  defaultValues,
  className = '',
  children,
  isSubmitting = false,
}: AutoFormProps<T>) {
  const form = useForm<T>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues as DefaultValues<T>,
  });

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((data) => onSubmit(data as T))}
        className={`space-y-6 ${className}`}
      >
        {fields.map((field) => (
          <FormInput<T> key={field.name} control={form.control} config={field} />
        ))}
        {children}
        <Button type="submit" disabled={isSubmitting || form.formState.isSubmitting}>
          {isSubmitting || form.formState.isSubmitting ? 'Submitting...' : submitLabel}
        </Button>
      </form>
    </Form>
  );
}

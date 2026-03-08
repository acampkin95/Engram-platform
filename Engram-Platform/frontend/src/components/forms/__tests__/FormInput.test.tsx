import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { AutoForm } from '../FormInput';

type FormData = {
  name: string;
  description?: string;
};

describe('AutoForm', () => {
  const schema = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
  });

  const fields: Array<{
    name: keyof FormData;
    label: string;
    placeholder?: string;
    required?: boolean;
    description?: string;
    type?: 'text' | 'email' | 'password' | 'number' | 'url' | 'textarea';
  }> = [
    {
      name: 'name',
      label: 'Name',
      placeholder: 'Enter name',
      required: true,
      description: 'Primary name field',
    },
    {
      name: 'description',
      label: 'Description',
      type: 'textarea',
      placeholder: 'Describe this item',
    },
  ];

  it('renders configured input and textarea fields', () => {
    render(<AutoForm schema={schema} fields={fields} onSubmit={vi.fn()} submitLabel="Save" />);

    expect(screen.getByLabelText(/Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Description/i)).toBeInTheDocument();
    expect(screen.getByText('Primary name field')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('submits typed values', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<AutoForm schema={schema} fields={fields} onSubmit={onSubmit} submitLabel="Create" />);

    await user.type(screen.getByLabelText(/Name/i), 'Alice');
    await user.type(screen.getByLabelText(/Description/i), 'Case details');
    await user.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled();
    });

    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      name: 'Alice',
      description: 'Case details',
    });
  });

  it('shows submitting state when isSubmitting is true', () => {
    render(
      <AutoForm
        schema={schema}
        fields={fields}
        onSubmit={vi.fn()}
        isSubmitting
        submitLabel="Create"
      />,
    );

    expect(screen.getByRole('button', { name: 'Submitting...' })).toBeDisabled();
  });
});

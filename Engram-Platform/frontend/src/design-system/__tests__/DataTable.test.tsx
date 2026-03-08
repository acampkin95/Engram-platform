import { fireEvent, render, screen } from '@testing-library/react';
import { DataTable } from '@/src/design-system/components/DataTable';

describe('DataTable', () => {
  type TestRow = { name: string; email: string; status: string };
  const mockColumns: import('@/src/design-system/components/DataTable').Column<TestRow>[] = [
    { key: 'name', header: 'Name', sortable: true },
    { key: 'email', header: 'Email' },
    { key: 'status', header: 'Status', sortable: true },
  ];

  const mockData = [
    { name: 'Alice', email: 'alice@example.com', status: 'Active' },
    { name: 'Bob', email: 'bob@example.com', status: 'Inactive' },
    { name: 'Charlie', email: 'charlie@example.com', status: 'Active' },
  ];

  it('renders table with columns and data', () => {
    render(<DataTable columns={mockColumns} data={mockData} />);
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('bob@example.com')).toBeInTheDocument();
  });

  it('shows empty message when data is empty', () => {
    render(<DataTable columns={mockColumns} data={[]} emptyMessage="No records found" />);
    expect(screen.getByText('No records found')).toBeInTheDocument();
  });

  it('shows default empty message when data is empty and no emptyMessage prop', () => {
    render(<DataTable columns={mockColumns} data={[]} />);
    expect(screen.getAllByText('No data').length).toBeGreaterThan(0);
  });

  it('sorts data when sortable column header is clicked', () => {
    render(<DataTable columns={mockColumns} data={mockData} />);
    const nameHeader = screen.getByRole('button', { name: /Name/i });
    fireEvent.click(nameHeader);

    const rows = screen.getAllByRole('row');
    // First row after header should be Alice (sorted ascending)
    expect(rows[1]).toHaveTextContent('Alice');
  });

  it('reverses sort direction when same column is clicked again', () => {
    render(<DataTable columns={mockColumns} data={mockData} />);
    const nameHeader = screen.getByRole('button', { name: /Name/i });

    // First click: ascending
    fireEvent.click(nameHeader);
    let rows = screen.getAllByRole('row');
    expect(rows[1]).toHaveTextContent('Alice');

    // Second click: descending
    fireEvent.click(nameHeader);
    rows = screen.getAllByRole('row');
    expect(rows[1]).toHaveTextContent('Charlie');
  });

  it('does not show pagination when data length is less than pageSize', () => {
    render(<DataTable columns={mockColumns} data={mockData} pageSize={20} />);
    expect(screen.queryByText(/Page/)).not.toBeInTheDocument();
  });

  it('shows pagination when data length exceeds pageSize', () => {
    const largeData = Array.from({ length: 25 }, (_, i) => ({
      name: `User ${i}`,
      email: `user${i}@example.com`,
      status: 'Active',
    }));
    render(<DataTable columns={mockColumns} data={largeData} pageSize={20} />);
    expect(screen.getByText(/Page 1 of 2/)).toBeInTheDocument();
  });

  it('renders custom cell content using render function', () => {
    type RenderRow = { name: string; status: string };
    const customColumns: import('@/src/design-system/components/DataTable').Column<RenderRow>[] = [
      { key: 'name', header: 'Name' },
      { key: 'status', header: 'Status', render: (row) => `Status: ${row.status}` },
    ];
    render(<DataTable columns={customColumns} data={mockData} />);
    const statusCells = screen.getAllByText('Status: Active');
    expect(statusCells.length).toBeGreaterThan(0);
  });
});

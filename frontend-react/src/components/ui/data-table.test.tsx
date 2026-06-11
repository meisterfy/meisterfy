import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import { type ColumnDef } from '@tanstack/react-table'
import { DataTable } from './data-table'

interface Row {
  name: string
  email: string
}

const columns: ColumnDef<Row>[] = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'email', header: 'Email' },
]

const data: Row[] = [
  { name: 'Alice', email: 'alice@example.com' },
  { name: 'Bob', email: 'bob@example.com' },
]

describe('DataTable', () => {
  it('renders column headers', () => {
    render(<DataTable columns={columns} data={data} />)
    expect(screen.getByText('Name')).toBeInTheDocument()
    expect(screen.getByText('Email')).toBeInTheDocument()
  })

  it('renders all row data', () => {
    render(<DataTable columns={columns} data={data} />)
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('alice@example.com')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
    expect(screen.getByText('bob@example.com')).toBeInTheDocument()
  })

  it('renders empty state when data is empty', () => {
    render(<DataTable columns={columns} data={[]} />)
    expect(screen.getByText('No results')).toBeInTheDocument()
  })

  // Opt-in feature props (search / pagination / toolbar / loading) used by the ads routes.
  it('filters rows via the search input when searchColumn is set', async () => {
    const user = userEvent.setup()
    render(
      <DataTable columns={columns} data={data} searchColumn="name" searchPlaceholder="Search…" />,
    )
    expect(screen.getByText('Bob')).toBeInTheDocument()
    await user.type(screen.getByPlaceholderText('Search…'), 'Ali')
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.queryByText('Bob')).not.toBeInTheDocument()
  })

  it('paginates when pageSize is set and shows nav controls', () => {
    const many: Row[] = Array.from({ length: 3 }).map((_, i) => ({
      name: `User ${i}`,
      email: `u${i}@x.com`,
    }))
    render(
      <DataTable
        columns={columns}
        data={many}
        pageSize={2}
        previousLabel="Prev"
        nextLabel="Next"
      />,
    )
    expect(screen.getByText('User 0')).toBeInTheDocument()
    expect(screen.getByText('User 1')).toBeInTheDocument()
    // third row is on page 2
    expect(screen.queryByText('User 2')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument()
  })

  it('renders the toolbar slot and a loading skeleton', () => {
    render(
      <DataTable
        columns={columns}
        data={data}
        isLoading
        toolbar={<button type="button">Filter</button>}
      />,
    )
    expect(screen.getByRole('button', { name: 'Filter' })).toBeInTheDocument()
    // while loading, real rows are not shown
    expect(screen.queryByText('Alice')).not.toBeInTheDocument()
  })
})

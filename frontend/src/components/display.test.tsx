import { render, screen } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { ProviderIcon } from './provider-icon'
import { BrandIcon } from './brand-icon'
import { SectionTitle } from './section-title'
import { Seo } from './seo'

// ---------------------------------------------------------------------------
// ProviderIcon
// ---------------------------------------------------------------------------
describe('ProviderIcon', () => {
  it('renders an <img> when only logoPng is given', () => {
    render(<ProviderIcon provider='Acme' logoPng='abc123' />)
    const img = screen.getByRole('img')
    expect(img).toBeInTheDocument()
    expect(img).toHaveAttribute('src', 'data:image/png;base64,abc123')
    expect(img).toHaveAttribute('alt', 'Acme')
  })

  it('uses the raw src when logoPng already has the data: prefix', () => {
    render(<ProviderIcon provider='Acme' logoPng='data:image/png;base64,xyz' />)
    expect(screen.getByRole('img')).toHaveAttribute(
      'src',
      'data:image/png;base64,xyz',
    )
  })

  it('renders nothing when neither logo is given', () => {
    const { container } = render(<ProviderIcon provider='Acme' />)
    expect(container.firstChild).toBeNull()
  })

  it('renders a div with innerHTML when logoSvg is given', () => {
    const svg = '<svg><circle r="10"/></svg>'
    const { container } = render(<ProviderIcon provider='Acme' logoSvg={svg} />)
    const div = container.firstChild as HTMLElement
    expect(div.tagName).toBe('DIV')
    // JSDOM normalises self-closing SVG tags, so just assert the content is present
    expect(div.innerHTML).toContain('<svg>')
    expect(div.innerHTML).toContain('circle')
  })

  it('prefers logoSvg over logoPng when both are provided', () => {
    const svg = '<svg/>'
    const { container } = render(
      <ProviderIcon provider='Acme' logoSvg={svg} logoPng='abc123' />,
    )
    expect(container.firstChild).toBeInstanceOf(HTMLDivElement)
    expect(screen.queryByRole('img')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// BrandIcon
// ---------------------------------------------------------------------------
describe('BrandIcon', () => {
  it('renders the first-letter initials of the first two words', () => {
    render(<BrandIcon name='Acme Corp' />)
    expect(screen.getByText('AC')).toBeInTheDocument()
  })

  it('handles a single-word name', () => {
    render(<BrandIcon name='Acme' />)
    expect(screen.getByText('A')).toBeInTheDocument()
  })

  it('uses only the first two words even when more are present', () => {
    render(<BrandIcon name='Foo Bar Baz' />)
    expect(screen.getByText('FB')).toBeInTheDocument()
  })

  it('applies the md size classes by default', () => {
    const { container } = render(<BrandIcon name='AB' />)
    const el = container.firstChild as HTMLElement
    expect(el.className).toContain('h-8')
    expect(el.className).toContain('w-8')
  })

  it('applies sm size classes when size="sm"', () => {
    const { container } = render(<BrandIcon name='AB' size='sm' />)
    const el = container.firstChild as HTMLElement
    expect(el.className).toContain('h-6')
    expect(el.className).toContain('w-6')
  })
})

// ---------------------------------------------------------------------------
// SectionTitle
// ---------------------------------------------------------------------------
describe('SectionTitle', () => {
  it('renders the title text in an h2', () => {
    render(<SectionTitle title='My Section' />)
    const h2 = screen.getByRole('heading', { level: 2 })
    expect(h2).toHaveTextContent('My Section')
  })

  it('does not render the icon wrapper when icon is omitted', () => {
    const { container } = render(<SectionTitle title='No icon' />)
    // icon wrapper has bg-primary/5 — the test just checks there is no div
    // other than the ones needed for layout (use a specific query is better)
    const h2 = screen.getByRole('heading')
    expect(h2).toBeInTheDocument()
    // second child div (children wrapper) should not be present
    expect(container.querySelector('[class*="bg-primary"]')).toBeNull()
  })

  it('renders the icon wrapper when icon is provided', () => {
    render(
      <SectionTitle title='With icon' icon={<span data-testid='ico' />} />,
    )
    expect(screen.getByTestId('ico')).toBeInTheDocument()
  })

  it('renders children when provided', () => {
    render(
      <SectionTitle title='With children'>
        <button>Action</button>
      </SectionTitle>,
    )
    expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument()
  })

  it('does not render the children wrapper when children is omitted', () => {
    const { container } = render(<SectionTitle title='No children' />)
    const root = container.firstChild as HTMLElement
    // root div has two direct children: the left div and (optionally) the right div
    // without children, only one direct child (the left flex div)
    expect(root.children.length).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// Seo
// ---------------------------------------------------------------------------
describe('Seo', () => {
  beforeEach(() => {
    document.title = ''
    // clean up any description meta added by previous tests
    const existing = document.querySelector('meta[name="description"]')
    if (existing) existing.remove()
  })

  it('sets document.title with the title prop', () => {
    render(<Seo title='Dash' />)
    expect(document.title).toContain('Dash')
  })

  it('falls back to the app name when no title is given', () => {
    render(<Seo />)
    // VITE_APP_NAME is not defined in test env → falls back to 'Meisterfy'
    expect(document.title).toBe('Meisterfy')
  })

  it('formats the title as "Title - AppName"', () => {
    render(<Seo title='Dashboard' />)
    expect(document.title).toMatch(/Dashboard\s*-\s*\w+/)
  })

  it('sets a meta description when description is provided', () => {
    render(<Seo title='Page' description='A nice page.' />)
    const meta = document.querySelector<HTMLMetaElement>(
      'meta[name="description"]',
    )
    expect(meta).not.toBeNull()
    expect(meta?.getAttribute('content')).toBe('A nice page.')
  })

  it('renders null — no DOM element', () => {
    const { container } = render(<Seo title='X' />)
    expect(container.firstChild).toBeNull()
  })
})

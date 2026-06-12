import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return {
    ...actual,
    useTranslation: (_ns?: string) => ({ t: (key: string) => key }),
  }
})

import { Loading } from './loading'

describe('Loading', () => {
  it('renders the updating-report message', () => {
    render(<Loading />)
    expect(
      screen.getByText('messages.updating_report_data'),
    ).toBeInTheDocument()
  })
})

import { Toaster as SonnerToaster } from 'sonner'

type ToasterProps = React.ComponentProps<typeof SonnerToaster>

function Toaster({ ...props }: ToasterProps) {
  return <SonnerToaster data-slot="toaster" {...props} />
}

export { Toaster }

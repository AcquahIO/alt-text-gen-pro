import { Toaster as SonnerToaster, ToasterProps } from 'sonner';

export function Toaster(props: ToasterProps) {
  return <SonnerToaster richColors expand {...props} />;
}

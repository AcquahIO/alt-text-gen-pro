export interface ChannelLink {
  id: 'chrome' | 'shopify' | 'wordpress';
  status: 'live' | 'waitlist';
  href: string;
}

const DEFAULT_CHROME_STORE_URL =
  'https://chromewebstore.google.com/detail/alt-text-generator-pro/gdijbieeagfndfaokkpbcekndoldmilp';

const chromeLink = import.meta.env.VITE_CHROME_LINK || DEFAULT_CHROME_STORE_URL;
export const CHANNEL_LINKS: ChannelLink[] = [
  {
    id: 'chrome',
    status: 'live',
    href: chromeLink,
  },
];

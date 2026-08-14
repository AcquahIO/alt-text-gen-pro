export interface ChannelLink {
  id: 'chrome' | 'shopify' | 'wordpress';
  status: 'live' | 'waitlist';
  href: string;
}

const chromeLink = import.meta.env.VITE_CHROME_LINK || '';
export const CHANNEL_LINKS: ChannelLink[] = [
  {
    id: 'chrome',
    status: 'live',
    href: chromeLink,
  },
];

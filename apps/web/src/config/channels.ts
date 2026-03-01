export interface ChannelLink {
  id: 'chrome' | 'shopify' | 'wordpress';
  status: 'live' | 'waitlist';
  href: string;
}

const chromeLink = import.meta.env.VITE_CHROME_LINK || 'https://chrome.google.com/webstore';
const shopifyLink = import.meta.env.VITE_SHOPIFY_LINK || '#shopify-waitlist';
const wordpressLink = import.meta.env.VITE_WORDPRESS_LINK || '#wordpress-waitlist';

export const CHANNEL_LINKS: ChannelLink[] = [
  {
    id: 'chrome',
    status: 'live',
    href: chromeLink,
  },
  {
    id: 'shopify',
    status: 'waitlist',
    href: shopifyLink,
  },
  {
    id: 'wordpress',
    status: 'waitlist',
    href: wordpressLink,
  },
];

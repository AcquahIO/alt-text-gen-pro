import Stripe from 'stripe';
import { env } from './utils.js';
export const stripe = new Stripe(env('STRIPE_SECRET_KEY'), { apiVersion: '2023-10-16' });

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { authRouter } from './routes/auth.js';
import { billingRouter } from './routes/billing.js';
import { statusRouter } from './routes/status.js';
import { altTextDemoRouter } from './routes/altTextDemo.js';
import { stripeWebhookRouter } from './routes/webhooks.js';
import { env } from './utils.js';

const PORT = Number(process.env.PORT) || 8787;
const app = express();

app.use('/api/webhooks/stripe', stripeWebhookRouter);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (origin.startsWith('chrome-extension://') || origin.startsWith('http://localhost')) {
        return callback(null, true);
      }
      return callback(new Error('Origin not allowed by CORS'));
    },
  })
);

app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.get('/', (_req, res) => {
  res.json({ ok: true, app: env('APP_BASE_URL') });
});

app.use(authRouter);
app.use(billingRouter);
app.use(statusRouter);
app.use(altTextDemoRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: (err as Error).message ?? 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

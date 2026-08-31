import { Button } from '@/components/ui/button';
import type { BillingIssueSummary } from '@/lib/session';
import { CircleAlert, CreditCard, Loader2, LogIn, Sparkles } from 'lucide-react';

interface AccessGateProps {
  sessionStatus: 'signedOut' | 'loading' | 'signedIn';
  trialEligible?: boolean;
  billingIssue?: BillingIssueSummary | null;
  hasStripeCustomer: boolean;
  busy?: boolean;
  error?: string | null;
  onSignIn: () => Promise<void> | void;
  onStartTrial: () => Promise<void> | void;
  onSubscribe: () => Promise<void> | void;
  onManageBilling: () => Promise<void> | void;
  onRetry: () => Promise<void> | void;
}

export function AccessGate({
  sessionStatus,
  trialEligible,
  billingIssue,
  hasStripeCustomer,
  busy = false,
  error,
  onSignIn,
  onStartTrial,
  onSubscribe,
  onManageBilling,
  onRetry,
}: AccessGateProps) {
  if (sessionStatus === 'loading') {
    return (
      <section className="command-access-gate" aria-live="polite">
        <span className="command-access-gate__icon"><Loader2 size={22} className="animate-spin" /></span>
        <h2>Checking Chrome access</h2>
        <p>Your workspace will be ready as soon as your account status is confirmed.</p>
      </section>
    );
  }

  if (sessionStatus === 'signedOut') {
    return (
      <section className="command-access-gate">
        <span className="command-access-gate__icon"><LogIn size={22} /></span>
        <h2>{error ? 'Sign in again to continue' : 'Sign in to use your workspace'}</h2>
        <p>{error || 'Your Chrome plan, generation allowance, and history are connected to your account.'}</p>
        <div className="command-access-gate__actions">
          <Button className="command-primary" onClick={onSignIn} disabled={busy}>
            <LogIn size={16} />
            {busy ? 'Opening sign in…' : 'Sign in'}
          </Button>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="command-access-gate">
        <span className="command-access-gate__icon command-access-gate__icon--warning"><CircleAlert size={22} /></span>
        <h2>Chrome access could not be verified</h2>
        <p>{error}</p>
        <div className="command-access-gate__actions">
          <Button className="command-primary" onClick={onRetry} disabled={busy}>
            {busy ? 'Checking…' : 'Retry account check'}
          </Button>
        </div>
      </section>
    );
  }

  if (billingIssue && hasStripeCustomer) {
    return (
      <section className="command-access-gate">
        <span className="command-access-gate__icon command-access-gate__icon--warning"><CreditCard size={22} /></span>
        <h2>{billingIssue.title}</h2>
        <p>{billingIssue.detail}</p>
        <div className="command-access-gate__actions">
          <Button className="command-primary" onClick={onManageBilling} disabled={busy}>
            <CreditCard size={16} />
            {busy ? 'Opening billing…' : 'Resolve billing'}
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="command-access-gate">
      <span className="command-access-gate__icon"><Sparkles size={22} /></span>
      <h2>Unlock Chrome generation</h2>
      <p>
        {trialEligible === false
          ? 'Your free trial has already been used. Subscribe to the Chrome extension to continue.'
          : 'Start your free trial, or subscribe to the Chrome extension now.'}
      </p>
      <div className="command-access-gate__actions">
        {trialEligible !== false ? (
          <Button className="command-primary" onClick={onStartTrial} disabled={busy}>
            <Sparkles size={16} />
            {busy ? 'Opening checkout…' : 'Start free trial'}
          </Button>
        ) : null}
        <Button className="command-secondary" onClick={onSubscribe} disabled={busy}>
          <CreditCard size={16} />
          Subscribe to Chrome
        </Button>
      </div>
    </section>
  );
}

import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BracketsCurly,
  CheckCircle,
  FileImage,
  Gauge,
  GoogleChromeLogo,
  Key,
  LinkSimple,
  PlugsConnected,
  ShieldCheck,
  Sparkle,
  UploadSimple,
} from '@phosphor-icons/react';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { CHANNEL_LINKS } from '@/config/channels';
import { useI18n } from '@/i18n/provider';
import { buildRoutePath } from '@/i18n/routes';
import { useSeo } from '@/lib/seo';
import { AGENT_API_ORIGIN, APP_ORIGIN } from '@/lib/env';
import productFacts from '@/content/productFacts.json';

const ACCESS_EMAIL =
  'mailto:charles@acquah.io?subject=Alt%20Text%20Generator%20Pro%20agent%20access';

export function AgentApiPage() {
  const { locale, t } = useI18n();
  const landingHref = buildRoutePath(locale, 'landing');
  const chromeHref = CHANNEL_LINKS.find((channel) => channel.id === 'chrome')?.href || landingHref;

  useSeo('agentApi');

  return (
    <div className="atgp-site atgp-api-page">
      <header className="atgp-header">
        <div className="container atgp-header-inner">
          <Link to={landingHref} className="atgp-brand" aria-label={t('brand.name')}>
            <img src="/favicon.png" alt="" width="36" height="36" />
            <span><strong>{t('brand.name')}</strong><small>{t('brand.sharedTagline')}</small></span>
          </Link>
          <nav className="atgp-nav" aria-label="Primary navigation">
            <Link to={landingHref}>Chrome product</Link>
            <a href="#connection">Connection</a>
            <a href="#formats">Formats</a>
            <a href="#metering">Metering</a>
          </nav>
          <div className="atgp-header-actions">
            <LanguageSwitcher />
            <Link to={landingHref} className="atgp-sign-in">For people</Link>
            <a href={ACCESS_EMAIL} className="btn btn-primary atgp-header-cta">Request access</a>
          </div>
        </div>
      </header>

      <main>
        <section className="atgp-api-hero">
          <div className="container atgp-api-hero-grid">
            <div className="atgp-api-copy atgp-hero-enter">
              <span className="atgp-kicker">For agents and automated workflows</span>
              <h1>Alt text infrastructure for agents.</h1>
              <p>{productFacts.agentIntro}</p>
              <div className="atgp-hero-actions">
                <a href={ACCESS_EMAIL} className="btn btn-primary btn-large">
                  Request agent access <ArrowRight size={18} aria-hidden="true" />
                </a>
                <a href="#connection" className="btn atgp-btn-secondary btn-large">See the connection flow</a>
              </div>
              <p className="atgp-api-separation-note">{productFacts.agentMetering}</p>
            </div>

            <div className="atgp-api-response atgp-hero-enter-delay" aria-label="Example structured response">
              <div className="atgp-api-response-head">
                <span><i /> Illustrative response contract</span>
                <code>generate_image_metadata</code>
              </div>
              <pre><code>{`{
  "original_format": "image/jpeg",
  "alt_text": "Oak dining chair with curved backrest in a warm studio",
  "status": "succeeded",
  "successful_operations": 1
}`}</code></pre>
              <div className="atgp-api-response-foot">
                <span><CheckCircle size={16} weight="fill" /> Canonical JSON result</span>
                <span><FileImage size={16} /> Same-format file delivery where enabled</span>
              </div>
            </div>
          </div>
        </section>

        <section className="atgp-api-trust" aria-label="Agent service safeguards">
          <div className="container atgp-api-trust-grid">
            <article><Key size={28} weight="duotone" /><div><strong>Scoped and revocable</strong><span>Each connection uses an agent-specific access token.</span></div></article>
            <article><Gauge size={28} weight="duotone" /><div><strong>Metered independently</strong><span>Successful operations count against the agent service, not Chrome usage.</span></div></article>
            <article><ShieldCheck size={28} weight="duotone" /><div><strong>Retry-safe</strong><span>Idempotent requests prevent the same completed operation being counted twice.</span></div></article>
          </div>
        </section>

        <section className="atgp-api-resources" aria-labelledby="developer-resources-title">
          <div className="container">
            <div className="atgp-api-heading">
              <span className="atgp-kicker">Developer resources</span>
              <h2 id="developer-resources-title">Inspect the live contract before connecting.</h2>
              <p>Public discovery describes the released transport, supported inputs, authentication model, and current limitations.</p>
            </div>
            <div className="atgp-api-resource-links">
              <a href={`${APP_ORIGIN}/llms.txt`}>LLM guidance</a>
              <a href={`${APP_ORIGIN}/.well-known/mcp.json`}>MCP discovery</a>
              <a href={`${AGENT_API_ORIGIN}/v1/openapi.json`}>OpenAPI document</a>
              <a href={`${AGENT_API_ORIGIN}/mcp`}>MCP transport</a>
              <a href="/privacy/">Privacy</a>
              <a href="/terms/">Terms</a>
              <a href={ACCESS_EMAIL}>Request access</a>
            </div>
          </div>
        </section>

        <section className="atgp-api-section" id="connection">
          <div className="container">
            <div className="atgp-api-heading">
              <span className="atgp-kicker">Connection model</span>
              <h2>Give an agent one clear path from image to result.</h2>
              <p>The service is designed for MCP tool calls and direct API workflows without introducing another customer dashboard.</p>
            </div>
            <div className="atgp-api-flow">
              <article>
                <span className="atgp-api-step-icon"><PlugsConnected size={23} weight="duotone" /></span>
                <small>01</small><h3>Connect</h3>
                <p>Authorise the agent with a scoped token that can be rotated or revoked independently.</p>
              </article>
              <article>
                <span className="atgp-api-step-icon"><UploadSimple size={23} weight="duotone" /></span>
                <small>02</small><h3>Submit</h3>
                <p>{productFacts.agentInput}</p>
              </article>
              <article>
                <span className="atgp-api-step-icon"><BracketsCurly size={23} weight="duotone" /></span>
                <small>03</small><h3>Receive</h3>
                <p>Get structured JSON for the single-image operation. Processed-file links are returned only by workflows that have file delivery enabled.</p>
              </article>
            </div>

            <div className="atgp-api-tools">
              <div>
                <span className="atgp-kicker">Initial tool surface</span>
                <h3>Small enough for an agent to use correctly.</h3>
              </div>
              <dl>
                <div><dt>generate_image_metadata</dt><dd>Initial: generate one canonical alt-text result through the metered, idempotent operation.</dd></div>
                <div><dt>usage_get_summary</dt><dd>Initial: inspect the current usage window before or after an automated run.</dd></div>
                <div><dt>generate_image_metadata_batch <em>Planned</em></dt><dd>Deferred until the single-image metering and ledger have been proven in production.</dd></div>
              </dl>
            </div>
          </div>
        </section>

        <section className="atgp-api-section atgp-api-section--ice" id="formats">
          <div className="container atgp-api-format-layout">
            <div className="atgp-api-heading">
              <span className="atgp-kicker">Output contract</span>
              <h2>Same format by default. No silent conversion.</h2>
              <p>Where file delivery is enabled, the returned file keeps the original image format unless a future conversion is explicitly requested.</p>
            </div>
            <div className="atgp-api-formats">
              <article><strong>JPEG</strong><span>XMP <code>dc:description</code></span></article>
              <article><strong>PNG</strong><span>Unicode iTXt or XMP</span></article>
              <article><strong>WebP</strong><span>XMP metadata</span></article>
            </div>
            <div className="atgp-api-format-note">
              <LinkSimple size={25} weight="duotone" />
              <div>
                <strong>Embedded metadata is not the same as an HTML alt attribute.</strong>
                <p>{productFacts.agentOutput}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="atgp-api-section atgp-api-metering" id="metering">
          <div className="container atgp-api-metering-grid">
            <div>
              <span className="atgp-kicker">Usage-based agent service</span>
              <h2>Meter the automation, not the person.</h2>
              <p>{productFacts.agentMetering}</p>
              <a href={ACCESS_EMAIL} className="btn btn-primary btn-large">Request current rates and access</a>
            </div>
            <ul>
              <li><CheckCircle size={21} weight="fill" /><span><strong>Separate entitlement</strong>Chrome access does not implicitly enable agent usage.</span></li>
              <li><CheckCircle size={21} weight="fill" /><span><strong>Auditable usage</strong>Agents can inspect summaries for the active metering window.</span></li>
              <li><CheckCircle size={21} weight="fill" /><span><strong>Operational controls</strong>Tokens, limits, and revocation are designed for automated clients.</span></li>
            </ul>
          </div>
        </section>

        <section className="atgp-api-final">
          <div className="container atgp-api-final-inner">
            <div><Sparkle size={27} weight="duotone" /><h2>Choose the product that matches the job.</h2></div>
            <p>Chrome is the complete product for people. API and MCP access is the metered service for agents.</p>
            <div>
              <a href={ACCESS_EMAIL} className="btn btn-primary">Request agent access</a>
              <a href={chromeHref} className="btn atgp-btn-secondary"><GoogleChromeLogo size={18} weight="fill" /> Add to Chrome</a>
            </div>
          </div>
        </section>
      </main>

      <footer className="atgp-footer">
        <div className="container atgp-footer-inner">
          <Link to={landingHref} className="atgp-brand">
            <img src="/favicon.png" alt="" width="34" height="34" />
            <span><strong>{t('brand.name')}</strong><small>{t('brand.sharedTagline')}</small></span>
          </Link>
          <nav aria-label="Product navigation"><Link to={landingHref}>Chrome product</Link><a href="#connection">Connection</a><a href="#metering">Metering</a></nav>
          <nav aria-label="Legal and support"><a href="/privacy/">Privacy</a><a href="/terms/">Terms</a><a href="mailto:charles@acquah.io">Support</a></nav>
        </div>
      </footer>
    </div>
  );
}

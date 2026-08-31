import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Browser,
  Check,
  CheckCircle,
  GoogleChromeLogo,
  LockKey,
  PencilSimple,
  ShieldCheck,
  Sparkle,
  UploadSimple,
  UserCircle,
} from '@phosphor-icons/react';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { CHANNEL_LINKS } from '@/config/channels';
import { useI18n } from '@/i18n/provider';
import { buildRoutePath } from '@/i18n/routes';
import { useSeo } from '@/lib/seo';
import { IS_STAGING } from '@/lib/env';
import productFacts from '@/content/productFacts.json';

const GENERATED_ALT_TEXT = 'Light oak dining chair with curved backrest in a warm studio setting';

const BATCH_ITEMS = [
  {
    src: '/assets/seo-alt-text-hero.jpg',
    filename: 'oak-chair.jpg',
    size: '140 KB',
    alt: GENERATED_ALT_TEXT,
    count: '73 / 125',
  },
  {
    src: '/assets/oak-side-table-studio.jpg',
    filename: 'oak-table.jpg',
    size: '98 KB',
    alt: 'Round solid oak side table with ribbed pedestal base in a warm studio setting',
    count: '82 / 125',
  },
  {
    src: '/assets/pear-bowl-studio.jpg',
    filename: 'pear-bowl.jpg',
    size: '86 KB',
    alt: 'Stoneware bowl filled with green pears on a light studio surface',
    count: '68 / 125',
  },
];

export function LandingPage() {
  const { locale, t } = useI18n();
  const landingHref = buildRoutePath(locale, 'landing');
  const apiHref = buildRoutePath(locale, 'agentApi');
  const chromeHref = CHANNEL_LINKS.find((channel) => channel.id === 'chrome')?.href || landingHref;

  useSeo('landing');

  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>('.atgp-reveal'));
    if (!('IntersectionObserver' in window)) {
      nodes.forEach((node) => node.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.12 },
    );

    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="atgp-site">
      <header className="atgp-header">
        <div className="container atgp-header-inner">
          <Link to={landingHref} className="atgp-brand" aria-label={t('brand.name')}>
            <img src="/favicon.png" alt="" width="36" height="36" />
            <span>
              <strong>{t('brand.name')}</strong>
              <small>{t('brand.sharedTagline')}</small>
            </span>
          </Link>

          <nav className="atgp-nav" aria-label="Primary navigation">
            <a href="#workflow">Features</a>
            <a href="#channels">How it works</a>
            <a href="#pricing">Pricing</a>
            <Link to={apiHref}>API / MCP</Link>
          </nav>

          <div className="atgp-header-actions">
            <LanguageSwitcher />
            <Link to={apiHref} className="atgp-sign-in">For agents</Link>
            <a href={chromeHref} className="btn btn-primary atgp-header-cta">
              <GoogleChromeLogo size={18} weight="fill" aria-hidden="true" />
              Add to Chrome
            </a>
          </div>
        </div>
      </header>

      <main>
        <section className="atgp-hero">
          <div className="container atgp-hero-grid">
            <div className="atgp-hero-copy atgp-hero-enter">
              <span className="atgp-kicker">SEO-aware alt text, right where you work</span>
              <h1>Alt text, without leaving the page.</h1>
              <p>{productFacts.landingIntro}</p>
              <div className="atgp-hero-actions">
                <a href={chromeHref} className="btn btn-primary btn-large">
                  <GoogleChromeLogo size={21} weight="fill" aria-hidden="true" />
                  Add to Chrome
                </a>
                <Link to={apiHref} className="btn atgp-btn-secondary btn-large">
                  API / MCP for agents
                  <ArrowRight size={18} aria-hidden="true" />
                </Link>
              </div>
              <div className="atgp-hero-facts" aria-label="Product highlights">
                <span><GoogleChromeLogo size={17} aria-hidden="true" /> Chrome extension</span>
                <span><Browser size={17} aria-hidden="true" /> Popup + workspace</span>
                <span><ShieldCheck size={17} aria-hidden="true" /> Accuracy first</span>
              </div>
              {IS_STAGING ? <div className="notice notice-warning">{t('landing.hero.stagingNotice')}</div> : null}
            </div>

            <div className="atgp-browser-stage atgp-hero-enter-delay" aria-label="Chrome extension workflow preview">
              <div className="atgp-browser-toolbar">
                <Browser size={18} weight="duotone" aria-hidden="true" />
                <span>yourstore.com/products/oak-chair</span>
              </div>
              <div className="atgp-product-page">
                <div className="atgp-selected-image">
                  <img src="/assets/oak-chair-portrait-studio.jpg" alt="Light oak dining chair in a warm studio" />
                  <span>Image selected</span>
                </div>
                <div className="atgp-product-copy">
                  <small>Home / Dining / Chairs</small>
                  <h2>Oak dining chair</h2>
                  <strong>$299.00</strong>
                  <p>Crafted from solid oak with a curved backrest and a natural finish.</p>
                  <button type="button">Add to cart</button>
                </div>
              </div>

              <figure className="atgp-extension-popup-shot">
                <img
                  src="/assets/extension-popup-command.png"
                  alt="Alt Text Generator Pro Chrome extension popup with three product images queued for alt text generation"
                />
                <figcaption><span /> Current Chrome extension</figcaption>
              </figure>
            </div>
          </div>
        </section>

        <section className="atgp-trust-band" aria-label="Trust and privacy">
          <div className="container atgp-trust-grid">
            <article>
              <ShieldCheck size={30} weight="duotone" aria-hidden="true" />
              <div><strong>Accuracy first</strong><span>Keywords are used only when the image and context support them.</span></div>
            </article>
            <article>
              <PencilSimple size={30} weight="duotone" aria-hidden="true" />
              <div><strong>You’re in control</strong><span>Review and edit every result before you copy or download it.</span></div>
            </article>
            <article>
              <LockKey size={30} weight="duotone" aria-hidden="true" />
              <div><strong>Private by design</strong><span>Your images and page context are processed for the request, not stored in generation telemetry.</span></div>
            </article>
          </div>
        </section>

        <section className="atgp-steps" id="workflow">
          <div className="container">
            <div className="atgp-section-heading atgp-reveal">
              <span className="atgp-kicker">How it works in Chrome</span>
              <h2>Three steps. Stay in your flow.</h2>
              <p>Move from a page image to useful, editable alt text without breaking your publishing rhythm.</p>
            </div>

            <div className="atgp-step-grid">
              <article className="atgp-reveal">
                <span className="atgp-step-number">1</span>
                <div>
                  <h3>Collect page images</h3>
                  <p>Scan the page or upload the images you want to describe.</p>
                </div>
              </article>
              <article className="atgp-reveal">
                <span className="atgp-step-number">2</span>
                <div>
                  <h3>Add useful context</h3>
                  <p>Choose a language and add shared SEO context for the whole batch.</p>
                </div>
              </article>
              <article className="atgp-reveal">
                <span className="atgp-step-number">3</span>
                <div>
                  <h3>Review and publish</h3>
                  <p>Edit, regenerate, copy, or download every result from one workspace.</p>
                </div>
              </article>
            </div>

            <figure className="atgp-workspace-showcase atgp-reveal">
              <div className="atgp-workspace-showcase-head">
                <div>
                  <span className="atgp-kicker">The full command workspace</span>
                  <strong>Three images in. Publish-ready descriptions out.</strong>
                </div>
                <span className="atgp-live-status"><i /> 3 / 3 ready</span>
              </div>
              <img
                src="/assets/extension-workspace-command.png"
                alt="Alt Text Generator Pro batch workspace showing three queued product images and completed alt text results"
              />
            </figure>
          </div>
        </section>

        <section className="atgp-batch-section">
          <div className="container atgp-batch-shell atgp-reveal">
            <div className="atgp-batch-intro">
              <span className="atgp-kicker">The full-page Chrome workspace</span>
              <h2>Upload and generate alt text in batches.</h2>
              <p>Open the extension workspace, add several images, provide shared context, and review consistent results together.</p>
              <a href={chromeHref} className="atgp-upload-zone">
                <UploadSimple size={28} weight="duotone" aria-hidden="true" />
                <span><strong>Add the Chrome extension</strong><small>Popup for quick work · full page for batches</small></span>
              </a>
            </div>
            <div className="atgp-batch-results">
              {BATCH_ITEMS.map((item) => (
                <article key={item.filename}>
                  <img src={item.src} alt={item.alt} />
                  <div className="atgp-file-row"><strong>{item.filename}</strong><span>{item.size}</span></div>
                  <p>{item.alt}</p>
                  <div className="atgp-file-status"><span>{item.count}</span><strong><CheckCircle size={15} weight="fill" aria-hidden="true" /> Ready</strong></div>
                </article>
              ))}
              <a href={chromeHref} className="atgp-download-link">
                <GoogleChromeLogo size={18} aria-hidden="true" /> Open the batch workspace in Chrome
              </a>
            </div>
          </div>
        </section>

        <section className="atgp-accuracy-section">
          <div className="container atgp-accuracy-grid">
            <div className="atgp-accuracy-copy atgp-reveal">
              <span className="atgp-kicker">Accuracy you can trust</span>
              <h2>Alt text that’s accurate, natural, and concise.</h2>
              <p>Clear guardrails help you create descriptions that are useful to people and relevant to the page.</p>
            </div>
            <div className="atgp-check-list atgp-reveal">
              <div><CheckCircle size={23} weight="fill" aria-hidden="true" /><span><strong>Visible details</strong>Descriptions match what is actually in the image.</span></div>
              <div><CheckCircle size={23} weight="fill" aria-hidden="true" /><span><strong>Natural keyword use</strong>Your focus keyword appears only when it fits.</span></div>
              <div><CheckCircle size={23} weight="fill" aria-hidden="true" /><span><strong>Under 125 characters</strong>Concise copy is easier to scan and publish.</span></div>
            </div>
            <div className="atgp-code-compare atgp-reveal" aria-label="Before and after HTML alt attribute">
              <div><span>Before</span><code>&lt;img src="oak-chair.jpg" alt="chair"&gt;</code></div>
              <ArrowRight size={24} aria-hidden="true" />
              <div><span>After</span><code>&lt;img src="oak-chair.jpg" alt="{GENERATED_ALT_TEXT}"&gt;</code></div>
            </div>
          </div>
        </section>

        <section className="atgp-channel-section" id="channels">
          <div className="container">
            <div className="atgp-channel-layout">
              <div className="atgp-channel-title atgp-reveal">
                <span className="atgp-kicker">One complete Chrome product</span>
                <h2>Two focused workspaces, one extension.</h2>
              </div>
              <article className="atgp-channel-option atgp-reveal">
                <GoogleChromeLogo size={28} weight="duotone" aria-hidden="true" />
                <h3>Quick popup</h3>
                <ul><li><Check size={15} />Collect images from the page</li><li><Check size={15} />Add page-aware context</li><li><Check size={15} />Copy a reviewed result</li></ul>
                <a href={chromeHref}>Add to Chrome <ArrowRight size={16} /></a>
              </article>
              <article className="atgp-channel-option atgp-reveal">
                <Browser size={28} weight="duotone" aria-hidden="true" />
                <h3>Full-page workspace</h3>
                <ul><li><Check size={15} />Upload and process batches</li><li><Check size={15} />Review every description</li><li><Check size={15} />Download images with metadata</li></ul>
                <a href={chromeHref}>Add to Chrome <ArrowRight size={16} /></a>
              </article>
              <article className="atgp-channel-option atgp-channel-account atgp-reveal">
                <UserCircle size={28} weight="duotone" aria-hidden="true" />
                <h3>Account and billing</h3>
                <p>Sign in, see usage, and manage the Chrome subscription inside the extension.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="atgp-pricing-section" id="pricing">
          <div className="container atgp-pricing-layout">
            <div className="atgp-pricing-intro atgp-reveal">
              <span className="atgp-kicker">Simple pricing</span>
              <h2>Try it free for three days.</h2>
              <p>{productFacts.chromePricing}</p>
              <p className="atgp-agent-pricing-note">
                Building an automated workflow? <Link to={apiHref}>API and MCP access</Link> is a separate, usage-based agent service.
              </p>
            </div>
            <div className="atgp-price-grid atgp-price-grid--single">
              <article className="atgp-price-card atgp-price-featured atgp-reveal">
                <span className="atgp-best-value">Complete extension</span>
                <h3>Chrome</h3><p>Quick generation on the page and a full workspace for batches.</p><strong>$10 <small>/ month</small></strong>
                <ul><li><Check size={15} />Three-day free trial</li><li><Check size={15} />Popup + full-page workspace</li><li><Check size={15} />Up to 5,000 successful generations monthly</li></ul>
                <a href={chromeHref} className="btn btn-primary">Add to Chrome</a>
              </article>
            </div>
          </div>
        </section>

        <section className="atgp-final-cta">
          <div className="container atgp-final-cta-inner">
            <div>
              <Sparkle size={28} weight="duotone" aria-hidden="true" />
              <h2>Make every image easier to publish.</h2>
            </div>
            <p>Start with a three-day free trial. Review every result before it goes live.</p>
            <div>
              <a href={chromeHref} className="btn btn-primary"><GoogleChromeLogo size={18} weight="fill" /> Add to Chrome</a>
              <Link to={apiHref} className="btn atgp-btn-secondary">API / MCP for agents</Link>
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
          <nav aria-label="Footer navigation"><a href="#workflow">How it works</a><a href="#pricing">Pricing</a><Link to={apiHref}>API / MCP</Link></nav>
          <nav aria-label="Legal and support"><a href="/privacy/">Privacy</a><a href="/terms/">Terms</a><a href="mailto:charles@acquah.io">Support</a></nav>
        </div>
      </footer>
    </div>
  );
}

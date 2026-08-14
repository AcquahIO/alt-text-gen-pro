import { Link } from 'react-router-dom';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { CHANNEL_LINKS } from '@/config/channels';
import { useI18n } from '@/i18n/provider';
import { buildRoutePath } from '@/i18n/routes';
import { useSeo } from '@/lib/seo';
import { IS_STAGING } from '@/lib/env';

export function LandingPage() {
  const { locale, t } = useI18n();
  const landingHref = buildRoutePath(locale, 'landing');
  const appHref = buildRoutePath(locale, 'app');
  const chromeHref = CHANNEL_LINKS.find((channel) => channel.id === 'chrome')?.href || appHref;

  useSeo('landing');

  return (
    <>
      <header className="site-header landing-header">
        <div className="container header-inner">
          <Link to={landingHref} className="brand" aria-label={t('brand.name')}>
            <span className="brand-mark">{t('brand.shortName')}</span>
            <span className="brand-title">{t('brand.name')}</span>
          </Link>
          <nav className="landing-nav" aria-label="Primary navigation">
            <a href="#workflow">{t('landing.features.title')}</a>
            <a href="#pricing">{t('landing.pricing.title')}</a>
          </nav>
          <div className="nav-actions">
            <LanguageSwitcher />
            <Link to={appHref} className="btn btn-primary">
              {t('landing.nav.startGenerating')}
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="hero landing-hero">
          <img
            className="hero-image"
            src="/assets/seo-alt-text-hero.jpg"
            alt="Light oak dining chair against a warm studio background"
            width="1536"
            height="1024"
            fetchPriority="high"
          />
          <div className="hero-scrim" />
          <div className="container hero-content">
            <div className="hero-copy hero-enter">
              <span className="eyebrow">{t('brand.tagline')}</span>
              <h1>{t('landing.hero.title')}</h1>
              <p>{t('landing.hero.body')}</p>
              <div className="hero-ctas">
                <Link to={appHref} className="btn btn-primary btn-large">
                  {t('landing.hero.launchWebApp')}
                </Link>
                <a href={chromeHref} className="btn btn-light btn-large">
                  {t('channels.chrome.cta')}
                </a>
              </div>
              <small className="hero-note">{t('landing.kpis.info')}</small>
              {IS_STAGING ? <div className="notice notice-warning">{t('landing.hero.stagingNotice')}</div> : null}
            </div>

            <div className="hero-result hero-enter-delay" aria-label="Generated alt text example">
              <span>Generated example</span>
              <strong>Light oak dining chair with curved backrest in a warm studio setting</strong>
              <div className="result-meta">
                <span>73 / 125</span>
                <span>{t('app.status.ready')}</span>
              </div>
            </div>
          </div>
        </section>

        <section className="section proof-strip" aria-label="Product highlights">
          <div className="container proof-grid">
            <div>
              <strong>{t('landing.kpis.channelsTitle')}</strong>
              <span>{t('landing.kpis.channelsBody')}</span>
            </div>
            <div>
              <strong>{t('landing.kpis.accountTitle')}</strong>
              <span>{t('landing.kpis.accountBody')}</span>
            </div>
            <div>
              <strong>{t('landing.kpis.batchTitle')}</strong>
              <span>{t('landing.kpis.batchBody')}</span>
            </div>
          </div>
        </section>

        <section className="section workflow-section" id="workflow">
          <div className="container">
            <div className="section-heading reveal-on-scroll">
              <span className="eyebrow">01 — {t('landing.features.title')}</span>
              <h2>{t('landing.features.subtitle')}</h2>
            </div>
            <div className="workflow-list">
              <article>
                <span>01</span>
                <h3>{t('landing.features.contextTitle')}</h3>
                <p>{t('landing.features.contextBody')}</p>
              </article>
              <article>
                <span>02</span>
                <h3>{t('landing.features.subscriptionsTitle')}</h3>
                <p>{t('landing.features.subscriptionsBody')}</p>
              </article>
              <article>
                <span>03</span>
                <h3>{t('landing.features.metadataTitle')}</h3>
                <p>{t('landing.features.metadataBody')}</p>
              </article>
            </div>
          </div>
        </section>

        <section className="section product-depth">
          <div className="container depth-grid">
            <div className="depth-copy reveal-on-scroll">
              <span className="eyebrow">02 — {t('landing.platforms.title')}</span>
              <h2>{t('landing.platforms.subtitle')}</h2>
              <p>{t('channels.chrome.description')}</p>
              <a className="text-link" href={chromeHref}>
                {t('channels.chrome.cta')} <span aria-hidden="true">↗</span>
              </a>
            </div>
            <div className="browser-demo reveal-on-scroll" aria-label="Chrome extension workflow preview">
              <div className="browser-bar"><i /><i /><i /><span>yourstore.com/products/oak-chair</span></div>
              <div className="browser-body">
                <img src="/assets/seo-alt-text-hero.jpg" alt="" loading="lazy" />
                <div>
                  <small>SEO focus</small>
                  <strong>solid oak dining chair</strong>
                  <small>Suggested alt text</small>
                  <p>Light oak dining chair with curved backrest in a warm studio setting</p>
                  <span className="demo-button" aria-hidden="true">Copy alt text</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="section pricing-section" id="pricing">
          <div className="container">
            <div className="section-heading reveal-on-scroll">
              <span className="eyebrow">03 — {t('landing.pricing.title')}</span>
              <h2>{t('landing.pricing.subtitle')}</h2>
            </div>
            <div className="pricing-lines">
              <article>
                <div><h3>{t('landing.pricing.freeTitle')}</h3><p>{t('landing.pricing.freeBody')}</p></div>
                <strong>{t('landing.pricing.freePrice')}</strong>
                <Link to={appHref} className="btn btn-outline">{t('common.openApp')}</Link>
              </article>
              <article className="pricing-featured">
                <div><h3>{t('landing.pricing.singleTitle')}</h3><p>{t('landing.pricing.singleBody')}</p></div>
                <strong>{t('landing.pricing.singlePrice')}</strong>
                <Link to={appHref} className="btn btn-primary">{t('landing.pricing.choosePlan')}</Link>
              </article>
              <article>
                <div><h3>{t('landing.pricing.allTitle')}</h3><p>{t('landing.pricing.allBody')}</p></div>
                <strong>{t('landing.pricing.allPrice')}</strong>
                <Link to={appHref} className="btn btn-outline">{t('landing.pricing.comparePlans')}</Link>
              </article>
            </div>
          </div>
        </section>

        <section className="final-cta">
          <div className="container final-cta-inner">
            <div>
              <span className="eyebrow">{t('brand.name')}</span>
              <h2>{t('landing.hero.title')}</h2>
            </div>
            <Link to={appHref} className="btn btn-light btn-large">{t('landing.hero.launchWebApp')}</Link>
          </div>
        </section>
      </main>

      <footer className="footer landing-footer">
        <div className="container footer-inner">
          <div>{t('brand.footer')}</div>
          <nav aria-label="Legal and support">
            <a href="/privacy/">Privacy</a>
            <a href="/terms/">Terms</a>
            <a href="mailto:charles@acquah.io">Support</a>
          </nav>
        </div>
      </footer>
    </>
  );
}

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

  useSeo('landing');

  return (
    <>
      <header className="site-header">
        <div className="container header-inner">
          <Link to={landingHref} className="brand">
            <span className="brand-mark">{t('brand.shortName')}</span>
            <span className="brand-text">
              <span className="brand-title">{t('brand.name')}</span>
              <span className="brand-sub">{t('brand.tagline')}</span>
            </span>
          </Link>
          <div className="nav-actions">
            <LanguageSwitcher />
            <Link to={appHref} className="btn btn-outline">
              {t('landing.nav.openApp')}
            </Link>
            <Link to={appHref} className="btn btn-primary">
              {t('landing.nav.startGenerating')}
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="container hero-grid">
            <div className="hero-copy">
              <h1>{t('landing.hero.title')}</h1>
              <p>{t('landing.hero.body')}</p>
              <div className="hero-ctas">
                <Link to={appHref} className="btn btn-primary">
                  {t('landing.hero.launchWebApp')}
                </Link>
                <a href="#platforms" className="btn btn-outline">
                  {t('landing.hero.explorePlatforms')}
                </a>
              </div>
              {IS_STAGING ? (
                <div className="notice notice-warning" style={{ marginTop: 12 }}>
                  {t('landing.hero.stagingNotice')}
                </div>
              ) : null}
            </div>

            <div className="hero-panel">
              <div className="hero-kpis">
                <div className="hero-kpi">
                  <strong>{t('landing.kpis.channelsTitle')}</strong>
                  <span>{t('landing.kpis.channelsBody')}</span>
                </div>
                <div className="hero-kpi">
                  <strong>{t('landing.kpis.accountTitle')}</strong>
                  <span>{t('landing.kpis.accountBody')}</span>
                </div>
                <div className="hero-kpi">
                  <strong>{t('landing.kpis.batchTitle')}</strong>
                  <span>{t('landing.kpis.batchBody')}</span>
                </div>
              </div>
              <div style={{ marginTop: 12 }} className="notice notice-info">
                {t('landing.kpis.info')}
              </div>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="container">
            <h2>{t('landing.features.title')}</h2>
            <p className="section-sub">{t('landing.features.subtitle')}</p>
            <div className="grid-3">
              <article className="card">
                <h3>{t('landing.features.contextTitle')}</h3>
                <p>{t('landing.features.contextBody')}</p>
              </article>
              <article className="card">
                <h3>{t('landing.features.subscriptionsTitle')}</h3>
                <p>{t('landing.features.subscriptionsBody')}</p>
              </article>
              <article className="card">
                <h3>{t('landing.features.metadataTitle')}</h3>
                <p>{t('landing.features.metadataBody')}</p>
              </article>
            </div>
          </div>
        </section>

        <section className="section" id="platforms">
          <div className="container">
            <h2>{t('landing.platforms.title')}</h2>
            <p className="section-sub">{t('landing.platforms.subtitle')}</p>
            <div className="grid-3">
              {CHANNEL_LINKS.map((channel) => {
                const live = channel.status === 'live';
                return (
                  <article key={channel.id} className="card channel-card">
                    <div className={`badge ${live ? 'badge-live' : 'badge-waitlist'}`}>
                      {live ? t('channels.live') : t('channels.waitlist')}
                    </div>
                    <h3>{t(`channels.${channel.id}.title`)}</h3>
                    <p>{t(`channels.${channel.id}.description`)}</p>
                    <a className="btn btn-outline" href={channel.href}>
                      {t(`channels.${channel.id}.cta`)}
                    </a>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="section" id="pricing">
          <div className="container">
            <h2>{t('landing.pricing.title')}</h2>
            <p className="section-sub">{t('landing.pricing.subtitle')}</p>
            <div className="pricing-grid">
              <article className="card">
                <h3>{t('landing.pricing.freeTitle')}</h3>
                <div className="price">{t('landing.pricing.freePrice')}</div>
                <p>{t('landing.pricing.freeBody')}</p>
                <Link to={appHref} className="btn btn-outline">
                  {t('common.openApp')}
                </Link>
              </article>
              <article className="card">
                <h3>{t('landing.pricing.singleTitle')}</h3>
                <div className="price">{t('landing.pricing.singlePrice')}</div>
                <p>{t('landing.pricing.singleBody')}</p>
                <Link to={appHref} className="btn btn-primary">
                  {t('landing.pricing.choosePlan')}
                </Link>
              </article>
              <article className="card">
                <h3>{t('landing.pricing.allTitle')}</h3>
                <div className="price">{t('landing.pricing.allPrice')}</div>
                <p>{t('landing.pricing.allBody')}</p>
                <Link to={appHref} className="btn btn-outline">
                  {t('landing.pricing.comparePlans')}
                </Link>
              </article>
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="container">
          <div>{t('brand.footer')}</div>
        </div>
      </footer>
    </>
  );
}

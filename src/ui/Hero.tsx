import { en } from '../i18n/en';

/** The title block and the About section, which is also the first navigation target. */
export function Hero() {
  return (
    <section className="hero-head" aria-labelledby="hero-title">
      <h1 id="hero-title">
        {en.appName} <span className="hero-head__tagline">{en.appTagline}</span>
      </h1>
      <section id="about" tabIndex={-1} aria-labelledby="about-heading">
        <h2 id="about-heading">{en.aboutHeading}</h2>
        <p>{en.aboutLead}</p>
        <p>{en.aboutNoClick}</p>
        <p className="hint">{en.aboutPrivacy}</p>
        <details className="hero-head__more">
          <summary>{en.aboutMore}</summary>
          <h3>{en.aboutLimitsHeading}</h3>
          <ul>
            <li>{en.aboutLimitGrey}</li>
            <li>{en.aboutLimitScale}</li>
            <li>{en.aboutLimitClose}</li>
            <li>{en.aboutLimitJpeg}</li>
          </ul>
          <h3>{en.aboutCitationsHeading}</h3>
          <ul className="citations">
            <li>{en.aboutCitationGuyot}</li>
            <li>{en.aboutCitationLiu}</li>
          </ul>
          <p className="hint">{en.aboutCredit}</p>
        </details>
      </section>
    </section>
  );
}

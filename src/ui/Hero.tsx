import { en } from '../i18n/en';

/** The title block and the About section, which is also the first navigation target. */
export function Hero() {
  return (
    <section className="hero-card" aria-labelledby="hero-title">
      <h1 id="hero-title">
        {en.appName} <span className="hero-subtitle">{en.appTagline}</span>
      </h1>
      <section id="about" tabIndex={-1} aria-labelledby="about-heading">
        <h2 id="about-heading">{en.aboutHeading}</h2>
        <p>{en.aboutLead}</p>
        <h3>{en.aboutNoClickHeading}</h3>
        <p>{en.aboutNoClick}</p>
        <h3>{en.aboutLimitsHeading}</h3>
        <ul>
          <li>{en.aboutLimitGrey}</li>
          <li>{en.aboutLimitScale}</li>
          <li>{en.aboutLimitClose}</li>
          <li>{en.aboutLimitJpeg}</li>
        </ul>
        <h3>{en.aboutPrivacyHeading}</h3>
        <p>{en.aboutPrivacy}</p>
        <h3>{en.aboutCitationsHeading}</h3>
        <ul className="citations">
          <li>{en.aboutCitationGuyot}</li>
          <li>{en.aboutCitationLiu}</li>
        </ul>
        <p>{en.aboutCredit}</p>
      </section>
    </section>
  );
}

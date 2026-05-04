# STSL case study

Long-form write-up of the SystemSpecs Technology Solutions rebuild. Three deliverables, 3.5 days, one designer, Claude as collaborator.

Lives at `/case-study/stsl/` on the portfolio (artbyade.com).

## Structure

```
case-study/stsl/
  index.html      cover hero, 8 chapters, end squircle
  style.css       all styles, single file
  script.js       Three.js ripple bg, GSAP entry, iframe shield, day-rail
  media/          mockups, OG image, hero PNG (alpha for FX)
```

## Stack

Vanilla HTML / CSS / JS. No build step. Three.js for the WebGL ripple cover, GSAP for the entry timeline. Iframe artefacts pull from the live STSL deploy at `lobzyjay.github.io/Systemspec-website-redesign/`.

## Local

Static files. Open `index.html` directly or serve with `python3 -m http.server 8000` from this folder.

## Brand

Inherits the portfolio's tokens, charcoal `#171717`, accent red `#E40202`, DM Sans + Carattere. Profile sidebar copied verbatim from the homepage so the two pages read as one site.

const PAGE = String.raw`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
  <meta name="theme-color" content="#080d1d" />
  <meta name="description" content="Discover the AkiSuite universe. One link to explore places, stays, cars and powerful tools for businesses." />
  <meta property="og:title" content="AkiSuite | Your next move starts here" />
  <meta property="og:description" content="Five destinations. One starting point." />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://qr.akihq.app/" />
  <title>AkiSuite · Your next move starts here</title>
  <style>
    :root { color-scheme:dark; font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; font-synthesis:none; --fg:#f3f6ff; --muted:#9aa8c3; --line:rgba(195,215,255,.13); --spot:#7ca2ff; --violet:#ad88ff; }
    * {box-sizing:border-box}
    html {min-width:320px; min-height:100%; background:#070d1c; scroll-behavior:smooth}
    body {margin:0;min-height:100svh;color:var(--fg);overflow-x:hidden;background:radial-gradient(ellipse 64% 65% at 50% -22%,#263a76 0%,transparent 78%),#080d1b;transition:background-color .5s ease}
    a {color:inherit} a:focus-visible,button:focus-visible {outline:3px solid #a9caff;outline-offset:5px}
    .universe {position:fixed;inset:0;z-index:-1;overflow:hidden;pointer-events:none;isolation:isolate}
    .universe::before {content:"";position:absolute;inset:0;opacity:.24;background-image:radial-gradient(#b6ccff 1px,transparent 1px);background-size:39px 39px;mask-image:linear-gradient(to bottom,black,transparent 82%)}
    .orb {position:absolute;border-radius:50%;filter:blur(68px);opacity:.45;will-change:transform;animation:float 16s ease-in-out infinite alternate}
    .orb-a {width:440px;height:440px;left:-150px;top:17%;background:#243d9f}
    .orb-b {width:400px;height:400px;right:-165px;top:12%;background:#67368c;animation-delay:-9s}
    .orb-c {width:320px;height:320px;left:43%;bottom:-250px;background:#086f99;animation-delay:-5s}
    .halo {position:absolute;width:min(78vw,820px);aspect-ratio:1;border-radius:50%;border:1px solid rgba(158,190,255,.075);top:15%;left:50%;transform:translateX(-50%);box-shadow:0 0 0 90px rgba(128,158,255,.017),0 0 0 205px rgba(128,158,255,.012)}
    .halo::before,.halo::after {content:"";position:absolute;border-radius:50%;inset:19%;border:1px dashed rgba(176,195,255,.08);animation:spin 80s linear infinite}
    .halo::after {inset:35%;animation-direction:reverse;animation-duration:60s}
    .shell {max-width:1220px;min-height:100svh;padding:29px clamp(19px,5vw,72px) 26px;margin:0 auto;display:flex;flex-direction:column}
    .mast {display:flex;justify-content:space-between;align-items:center;gap:20px;position:relative;z-index:2}
    .logo {display:inline-flex;align-items:center;gap:10px;text-decoration:none;min-height:42px}
    .mark {height:37px;width:37px;border:1px solid rgba(196,217,255,.32);border-radius:12px;background:linear-gradient(130deg,rgba(147,178,255,.28),rgba(102,93,214,.07));display:grid;place-items:center;box-shadow:inset 0 1px rgba(255,255,255,.18),0 8px 23px #090e23}
    .mark svg {height:24px;width:24px}
    .logo-type {font-weight:800;font-size:22px;letter-spacing:-1.25px}
    .logo-type span {color:#a4b8fd}
    .mast-side {display:flex;align-items:center;gap:9px;color:#9eabc7;font-size:10px;letter-spacing:.2em;text-transform:uppercase;font-weight:800}
    .pulse {height:7px;width:7px;display:inline-block;background:#89d9bc;border-radius:50%;box-shadow:0 0 15px #58dba8;animation:pulse 2.6s ease-in-out infinite}
    .stage {flex:1;display:grid;align-items:center;position:relative;padding:56px 0 48px}
    .screen {width:100%;max-width:980px;margin:0 auto;animation:enter .67s cubic-bezier(.16,1,.3,1) both}
    .screen[hidden] {display:none!important}
    .screen.exiting {animation:exit .18s ease-in both;pointer-events:none}
    .eyebrow {display:inline-flex;align-items:center;gap:11px;font-size:11px;font-weight:850;text-transform:uppercase;letter-spacing:.24em;color:#9ab1ff}
    .eyebrow::before {content:"";width:24px;height:1px;background:#7c98f5}
    .copy {text-align:center;max-width:720px;margin:0 auto}
    .copy .eyebrow {justify-content:center}
    h1 {font-size:clamp(42px,7.5vw,89px);line-height:1.02;letter-spacing:-.075em;margin:25px 0 19px;font-weight:850}
    h1 em {font-style:normal;background:linear-gradient(100deg,#bad0ff 5%,#8b9efb 43%,#d7a2ff 95%);color:transparent;background-clip:text;-webkit-background-clip:text}
    .sub {font-size:clamp(15px,2.3vw,18px);line-height:1.7;color:#b3bdd1;margin:0 auto;max-width:560px}
    .chooser {display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;max-width:850px;margin:47px auto 0}
    .choice,.destination {position:relative;border:1px solid rgba(184,203,243,.19);border-radius:25px;isolation:isolate;overflow:hidden;background:linear-gradient(135deg,rgba(30,43,80,.78),rgba(12,18,39,.85));text-decoration:none;box-shadow:0 20px 75px rgba(0,0,0,.18),inset 0 1px rgba(255,255,255,.045);transition:transform .35s cubic-bezier(.16,1,.3,1),border-color .3s,box-shadow .3s}
    .choice::before,.destination::before {content:"";z-index:-1;position:absolute;inset:0;background:radial-gradient(circle at 91% 0%,var(--tint,rgba(107,149,253,.27)),transparent 56%);transition:opacity .35s}
    .choice:hover,.destination:hover {transform:translateY(-8px);border-color:rgba(186,205,255,.52);box-shadow:0 28px 82px rgba(1,5,19,.5),0 0 50px rgba(83,101,175,.12),inset 0 1px rgba(255,255,255,.095)}
    .choice {display:flex;flex-direction:column;min-height:256px;padding:29px 30px 26px}
    .choice.business {--tint:rgba(150,113,255,.29)}
    .choice.explorer {--tint:rgba(62,154,237,.31)}
    .choice-top {display:flex;align-items:center;justify-content:space-between}
    .glyph {width:55px;height:55px;display:grid;place-items:center;border-radius:18px;border:1px solid rgba(220,225,255,.22);background:rgba(160,181,255,.12)}
    .glyph svg {width:29px;height:29px;stroke:#dae3ff;stroke-width:1.7;fill:none;stroke-linecap:round;stroke-linejoin:round}
    .arrow {height:32px;width:32px;border:1px solid rgba(210,222,255,.24);display:grid;place-items:center;border-radius:50%;color:#dbe4ff;font-size:21px;transition:background .25s,transform .25s}
    .choice:hover .arrow,.destination:hover .arrow {background:#e4edff;color:#101b33;transform:translate(2px,-2px)}
    .choice h2 {margin:auto 0 7px;padding-top:42px;font-size:clamp(22px,3vw,29px);letter-spacing:-.04em}
    .choice p {margin:0;color:#9eadc7;font-size:14px;line-height:1.55}
    .step-note {text-align:center;color:#7c8aa9;font-size:11px;letter-spacing:.2em;font-weight:800;margin:29px 0 0;text-transform:uppercase}
    .topline {display:flex;justify-content:space-between;align-items:center;gap:18px;margin-bottom:48px}
    .back {display:inline-flex;align-items:center;gap:11px;color:#bac5df;text-decoration:none;font-size:13px;font-weight:750;padding:12px 15px;border-radius:30px;border:1px solid rgba(205,223,255,.13);background:rgba(255,255,255,.025);transition:background .2s,border-color .2s}
    .back:hover {background:rgba(255,255,255,.09);border-color:rgba(205,223,255,.35)}
    .step-counter {color:#7e91b7;font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase}
    .interior-heading {text-align:center;margin:0 auto 38px;max-width:780px}
    .interior-heading h1 {margin:17px 0 14px;font-size:clamp(41px,6.2vw,70px)}
    .interior-heading p {font-size:16px;color:#a2b0cb;line-height:1.6;margin:0}
    .destination-grid {display:grid;gap:16px;margin:0 auto;max-width:950px}
    .destination-grid.two {grid-template-columns:repeat(2,minmax(0,1fr));max-width:840px}
    .destination-grid.three {grid-template-columns:repeat(3,minmax(0,1fr))}
    .destination {display:flex;flex-direction:column;align-items:flex-start;min-height:280px;padding:28px 25px 24px}
    .destination::after {content:"";position:absolute;z-index:-1;inset:auto -15% -82% -15%;height:130%;border-radius:50%;background:radial-gradient(circle,var(--glow),transparent 67%);opacity:.16;filter:blur(5px);transition:opacity .3s,transform .3s}
    .destination:hover::after {opacity:.33;transform:translateY(-20px)}
    .destination-head {display:flex;align-items:center;justify-content:space-between;width:100%}
    .destination-symbol {width:56px;height:56px;border-radius:18px;display:grid;place-items:center;background:var(--chip);border:1px solid var(--stroke);font-size:28px;font-weight:850;color:var(--accent)}
    .destination-symbol svg {height:31px;width:31px;stroke:var(--accent);fill:none;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
    .destination h2 {font-size:clamp(24px,3.5vw,32px);letter-spacing:-.055em;margin:auto 0 8px;padding-top:46px}
    .destination p {font-size:13px;color:#aab7cf;line-height:1.55;margin:0 0 24px;min-height:40px}
    .domain {font-size:12px;letter-spacing:.03em;color:var(--accent);font-weight:750;display:flex;align-items:center;gap:7px}
    .hq {--accent:#b6a0ff;--chip:rgba(148,118,255,.15);--stroke:rgba(172,146,255,.28);--glow:#8262f8;--tint:rgba(156,116,255,.21)}
    .business-product {--accent:#ffcc80;--chip:rgba(255,176,63,.11);--stroke:rgba(255,190,98,.26);--glow:#e79527;--tint:rgba(242,154,42,.16)}
    .pasa {--accent:#91b8ff;--chip:rgba(87,148,255,.17);--stroke:rgba(102,164,255,.25);--glow:#307ff6;--tint:rgba(68,133,244,.19)}
    .duermo {--accent:#86e4c4;--chip:rgba(74,213,168,.13);--stroke:rgba(111,232,193,.25);--glow:#0db98c;--tint:rgba(44,185,151,.15)}
    .coches {--accent:#ff958e;--chip:rgba(255,103,102,.13);--stroke:rgba(255,128,125,.25);--glow:#fa5951;--tint:rgba(223,86,76,.18)}
    .foot {display:flex;align-items:center;justify-content:space-between;gap:15px;position:relative;z-index:2;border-top:1px solid rgba(191,211,250,.09);padding-top:19px;color:#7d8ba9;font-size:11px;letter-spacing:.03em}
    .foot a {color:#a4b6dc;text-decoration:none}.foot a:hover {color:white}
    .foot-label {display:flex;align-items:center;gap:10px}.foot-label::before {content:"";width:5px;height:5px;background:#879ed0;border-radius:50%}
    @keyframes float {from{transform:translate3d(0,0,0) scale(1)}to{transform:translate3d(30px,-45px,0) scale(1.12)}}
    @keyframes spin {to{transform:rotate(360deg)}}
    @keyframes pulse {50%{box-shadow:0 0 3px #58dba8;opacity:.7}}
    @keyframes enter {from{opacity:0;transform:translateY(26px) scale(.985);filter:blur(4px)}to{opacity:1;transform:translateY(0) scale(1);filter:blur(0)}}
    @keyframes exit {to{opacity:0;transform:translateY(-13px) scale(.99)}}
    @media(max-width:760px){.shell{padding:20px 20px 19px}.stage{padding:42px 0 49px;align-items:center}.chooser{gap:13px;margin-top:35px}.choice{min-height:224px;padding:20px 18px}.choice h2{padding-top:33px}.glyph{height:47px;width:47px}.destination-grid.three{grid-template-columns:1fr;max-width:460px}.destination-grid.three .destination{min-height:157px;display:grid;grid-template-columns:57px 1fr;column-gap:15px;padding:20px}.destination-grid.three .destination-head{grid-row:1 / span 3;display:block;width:auto}.destination-grid.three .destination-head .arrow{display:none}.destination-grid.three .destination h2{padding:0;margin:0 0 2px}.destination-grid.three .destination p{min-height:0;margin:0 0 10px}.topline{margin-bottom:30px}.interior-heading{margin-bottom:29px}.destination-grid{gap:13px}}
    @media(max-width:560px){.mast-side{font-size:9px;letter-spacing:.12em}.copy h1{font-size:clamp(43px,13.4vw,70px)}.sub{font-size:15px}.chooser,.destination-grid.two{grid-template-columns:1fr;max-width:440px}.choice{min-height:160px;display:grid;grid-template-columns:56px 1fr;grid-template-rows:auto 1fr;column-gap:15px;padding:21px}.choice-top{display:contents}.choice-top .glyph{grid-row:1 / span 2}.choice-top .arrow{position:absolute;top:20px;right:20px}.choice h2{padding:10px 35px 0 0;margin:0 0 7px;font-size:23px}.choice p{font-size:13px;padding-right:12px}.destination-grid.two .destination{min-height:210px}.destination-grid.two .destination h2{padding-top:22px}.interior-heading h1{font-size:clamp(39px,11vw,55px)}.foot{flex-wrap:wrap;font-size:10px}.halo{top:23%}}
    @media(max-width:380px){.mast-side{display:none}.destination-grid.three .destination{grid-template-columns:47px 1fr;padding:16px;column-gap:13px}.destination-grid.three .destination-symbol{height:45px;width:45px;border-radius:14px}.destination-grid.three .destination h2{font-size:23px}}
    @media(prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important;scroll-behavior:auto!important}.orb,.halo::before,.halo::after{animation:none}}
  </style>
</head>
<body>
  <div class="universe" aria-hidden="true"><div class="orb orb-a"></div><div class="orb orb-b"></div><div class="orb orb-c"></div><div class="halo"></div></div>
  <div class="shell">
    <header class="mast">
      <a class="logo" href="#home" aria-label="AkiSuite, return to start"><span class="mark"><svg viewBox="0 0 28 28" aria-hidden="true"><path fill="#9CB8FF" d="M14 3 25 23h-6l-5-10-5 10H3L14 3Z"/><circle cx="14" cy="21.5" r="2.5" fill="#E6DBFF"/></svg></span><span class="logo-type">aki<span>suite</span></span></a>
      <div class="mast-side"><span class="pulse"></span> ONE WORLD · FIVE DESTINATIONS</div>
    </header>
    <main class="stage" id="main">
      <section class="screen" id="home" aria-labelledby="home-title">
        <div class="copy"><span class="eyebrow">Welcome to the Aki universe</span><h1 id="home-title" tabindex="-1">Where to <em>next?</em></h1><p class="sub">A whole world of possibilities, one place to start. Tell us what brings you here.</p></div>
        <nav class="chooser" aria-label="Choose your journey">
          <a class="choice business" href="#business"><span class="choice-top"><span class="glyph"><svg viewBox="0 0 32 32" aria-hidden="true"><rect x="4" y="10" width="24" height="17" rx="3"/><path d="M11 10V7a3 3 0 0 1 3-3h4a3 3 0 0 1 3 3v3M4 17a31 31 0 0 0 24 0M16 16v4"/></svg></span><span class="arrow" aria-hidden="true">↗</span></span><h2>I run a business</h2><p>Manage, grow and power up your business.</p></a>
          <a class="choice explorer" href="#explore"><span class="choice-top"><span class="glyph"><svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="12"/><path d="m21 11-3 8-8 3 4-8z"/></svg></span><span class="arrow" aria-hidden="true">↗</span></span><h2>I'm here to explore</h2><p>Find places, stays and your next ride.</p></a>
        </nav>
        <p class="step-note">CHOOSE YOUR PATH · 01 / 02</p>
      </section>
      <section class="screen" id="business" aria-labelledby="business-title" hidden>
        <div class="topline"><a class="back" href="#home"><span aria-hidden="true">←</span> Back to start</a><span class="step-counter">BUSINESS · 02 / 02</span></div>
        <div class="interior-heading"><span class="eyebrow">Built for people who build</span><h1 id="business-title" tabindex="-1">Your business. <em>Your way.</em></h1><p>Two powerful tools, one bigger picture. Choose where you want to go.</p></div>
        <nav class="destination-grid two" aria-label="Business platforms">
          <a class="destination hq" href="https://akihq.app/"><span class="destination-head"><span class="destination-symbol"><svg viewBox="0 0 32 32" aria-hidden="true"><rect x="4" y="4" width="10" height="10" rx="2"/><rect x="18" y="4" width="10" height="10" rx="2"/><rect x="4" y="18" width="10" height="10" rx="2"/><rect x="18" y="18" width="10" height="10" rx="2"/></svg></span><span class="arrow" aria-hidden="true">↗</span></span><h2>AkiHQ</h2><p>Your free hub to manage your business presence, locations and team.</p><span class="domain">akihq.app <span aria-hidden="true">↗</span></span></a>
          <a class="destination business-product" href="https://akibusiness.com/"><span class="destination-head"><span class="destination-symbol"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M5 26V12l11-7 11 7v14H5Z"/><path d="M12 26v-9h8v9M3 26h26"/></svg></span><span class="arrow" aria-hidden="true">↗</span></span><h2>AkiBusiness</h2><p>Go further with your operations, point of sale and business tools.</p><span class="domain">akibusiness.com <span aria-hidden="true">↗</span></span></a>
        </nav>
      </section>
      <section class="screen" id="explore" aria-labelledby="explore-title" hidden>
        <div class="topline"><a class="back" href="#home"><span aria-hidden="true">←</span> Back to start</a><span class="step-counter">EXPLORE · 02 / 02</span></div>
        <div class="interior-heading"><span class="eyebrow">More life, less searching</span><h1 id="explore-title" tabindex="-1">Find your <em>next thing.</em></h1><p>Going out? Getting away? Hitting the road? We have a place for that.</p></div>
        <nav class="destination-grid three" aria-label="Explore AkiSuite">
          <a class="destination pasa" href="https://akipasa.com/"><span class="destination-head"><span class="destination-symbol"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 28s10-8 10-16a10 10 0 0 0-20 0c0 8 10 16 10 16Z"/><circle cx="16" cy="12" r="3.5"/></svg></span><span class="arrow" aria-hidden="true">↗</span></span><h2>AkiPasa</h2><p>Discover venues, nightlife and unforgettable experiences.</p><span class="domain">akipasa.com ↗</span></a>
          <a class="destination duermo" href="https://akiduermo.com/"><span class="destination-head"><span class="destination-symbol"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M4 27V8M4 22h24v5M8 18h20a2 2 0 0 1 2 2v7M8 17v-4a5 5 0 0 1 5-5h13v9M4 27h26"/></svg></span><span class="arrow" aria-hidden="true">↗</span></span><h2>AkiDuermo</h2><p>Find your stay and make every trip feel like home.</p><span class="domain">akiduermo.com ↗</span></a>
          <a class="destination coches" href="https://akicoches.com/"><span class="destination-head"><span class="destination-symbol"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="m6 20 3-9a3 3 0 0 1 3-2h9a3 3 0 0 1 3 2l3 9M6 20h21v6H6zM6 15H3m24 0h2M10 24h3m7 0h3M9 26v2m15-2v2"/></svg></span><span class="arrow" aria-hidden="true">↗</span></span><h2>AkiCoches</h2><p>Discover your next rental car and hit the road.</p><span class="domain">akicoches.com ↗</span></a>
        </nav>
      </section>
    </main>
    <footer class="foot"><span class="foot-label">An AkiSuite experience</span><span>Made for wherever life takes you.</span><a href="https://akihq.app/">Powered by AkiHQ ↗</a></footer>
  </div>
  <script>
    (() => {
      const screens = {home:document.getElementById('home'),business:document.getElementById('business'),explore:document.getElementById('explore')};
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
      let current = 'home';
      let timer;
      const route = () => Object.hasOwn(screens,location.hash.slice(1)) ? location.hash.slice(1) : 'home';
      const swap = (next,instant = false) => {
        if (next === current && !instant) return;
        window.clearTimeout(timer);
        Object.values(screens).forEach(el => el.classList.remove('exiting'));
        const old = screens[current];
        const finish = () => {
          Object.entries(screens).forEach(([key,el]) => { el.hidden = key !== next; el.inert = key !== next; });
          current = next;
          document.body.dataset.view = next;
          document.title = (next === 'home' ? 'AkiSuite' : next === 'business' ? 'Business | AkiSuite' : 'Explore | AkiSuite') + ' · Your next move starts here';
          if (!instant) { screens[next].querySelector('h1').focus({preventScroll:true}); }
          window.scrollTo({top:0,behavior:'instant'});
        };
        if (instant || reduce.matches) finish();
        else { old.classList.add('exiting'); timer = window.setTimeout(finish,185); }
      };
      swap(route(),true);
      window.addEventListener('hashchange',() => swap(route()));
    })();
  </script>
</body>
</html>`;

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: { Allow: "GET, HEAD" },
      });
    }
    if (url.pathname === "/robots.txt") {
      return new Response("User-agent: *\nAllow: /\n", {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "public, max-age=86400",
        },
      });
    }
    if (url.pathname !== "/" && url.pathname !== "/index.html") {
      return new Response("Not Found", {
        status: 404,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    return new Response(request.method === "HEAD" ? null : PAGE, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=300",
        "Content-Security-Policy":
          "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:; font-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; upgrade-insecure-requests",
        "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "X-Content-Type-Options": "nosniff",
        "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
      },
    });
  },
};

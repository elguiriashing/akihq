import { build } from "esbuild";
import { chromium } from "playwright";
import { createServer } from "node:http";
import { mkdtemp, readFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const operator = process.env.RENTAL_BROWSER_MODE === "operator";
const root = process.cwd();
const folder = await mkdtemp(path.join(tmpdir(), "rental-app-"));
const results = path.join(
  root,
  "test-results",
  operator ? "business" : "coches",
  "rental-app",
);
await mkdir(results, { recursive: true });
const art = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 600"><defs><linearGradient id="b" x2="1" y2="1"><stop stop-color="#233148"/><stop offset="1" stop-color="#0c1425"/></linearGradient><linearGradient id="c"><stop stop-color="#fc7685"/><stop offset="1" stop-color="#8f2242"/></linearGradient></defs><path fill="url(#b)" d="M0 0h1000v600H0z"/><circle cx="760" cy="130" r="200" fill="#fa677b" opacity=".08"/><ellipse cx="510" cy="440" rx="330" ry="35" fill="#050a16"/><path d="m183 368 56-95 170-35 70-74h178l106 103 77 27 24 98H161z" fill="url(#c)"/><path d="m424 238 71-59h146l67 76z" fill="#182337"/><path d="m533 178-4 65" stroke="#e798a3" stroke-width="8"/><circle cx="300" cy="390" r="57" fill="#0b1220"/><circle cx="300" cy="390" r="30" fill="#bbc4d3"/><circle cx="735" cy="390" r="57" fill="#0b1220"/><circle cx="735" cy="390" r="30" fill="#bbc4d3"/><path d="M190 334h62M788 316h47" stroke="#ffe4e8" stroke-width="14"/></svg>')}`;
const listings = Array.from({ length: 6 }, (_, i) => ({
  vehicle_id: `vehicle-${i}`,
  vehicle_name: [
    "Mustang GT",
    "City Explorer",
    "Coast Runner",
    "Urban Electric",
    "Weekend Cruiser",
    "Family Tourer",
  ][i],
  category: i ? "compact" : "premium",
  transmission: "automatic",
  fuel: "petrol",
  seats: i ? 5 : 2,
  luggage: 2,
  daily_price_cents: i ? 4500 + i * 500 : 11000,
  deposit_cents: 5000,
  image_url: art,
  company_id: "company-1",
  company_slug: "fixture-rentals",
  company_name: "Coastal Drive",
  city: "Fuengirola",
  address: "Disposable UI fixture · Costa del Sol",
  latitude: 36.5,
  longitude: -4.6,
  total: 6,
}));
const componentPath = path.join(
  root,
  "src/components",
  operator ? "RentalOperatorDesk.tsx" : "RentalCompanyApp.tsx",
);
const source = `import React from 'react'; import {createRoot} from 'react-dom/client'; import {${operator ? "RentalOperatorDesk" : "RentalCompanyApp"} as App} from ${JSON.stringify(componentPath)};
${operator ? `import {RentalBranchProfile} from ${JSON.stringify(path.join(root, "src/components/RentalBranchProfile.tsx"))};` : ""}
const locale = new URLSearchParams(location.search).get('lang') || 'en'; const listings=${JSON.stringify(listings)};
const props=${
  operator
    ? `{
locale, company:{id:'company-1',name:'Coastal Drive',slug:'fixture-rentals',city:'Fuengirola',status:'published'},
vehicles:listings.map(v=>({...v,id:v.vehicle_id,name:v.vehicle_name,active:true,rental_media_id:'cover'})),
media:[{id:'cover',alt:'Disposable vehicle illustration',url:listings[0].image_url}],
bookings:[{id:'request-1',vehicle_id:'vehicle-0',start_date:'2099-01-01',end_date:'2099-01-03',status:'requested',contact_name:'Disposable renter',contact_email:'fixture@example.test',contact_phone:'+34 600 123 456',note:'Child seat please',quoted_total_cents:22000}],
blocks:[],actions:{create:async()=>{},update:async()=>{},block:async()=>{},booking:async()=>{}},mediaStudio:React.createElement('p',null,'Disposable media studio'),companyTools:React.createElement(RentalBranchProfile,{locale,company:{id:'company-1',name:'Coastal Drive',city:'Fuengirola',address:'Disposable UI fixture',latitude:36.5,longitude:-4.6,phone:'+34 600 123 456'},media:[{id:'cover',alt:'Disposable car cover'}]})
}`
    : `{locale,slug:'fixture-rentals',listings,calendarReady:true,blocks:[]}`
};
createRoot(document.getElementById('root')).render(React.createElement(App,props));`;
await build({
  absWorkingDir: root,
  stdin: { contents: source, resolveDir: root, loader: "tsx" },
  outfile: path.join(folder, "app.js"),
  bundle: true,
  jsx: "automatic",
  minify: true,
  define: { "process.env.NODE_ENV": '"production"', "process.env": "{}" },
  plugins: [
    {
      name: "next-test-boundary",
      setup(builder) {
        builder.onResolve({ filter: /business\/mobility\/actions$/ }, () => ({
          path: "fixture-rental-actions",
          namespace: "fixture-actions",
        }));
        builder.onLoad({ filter: /.*/, namespace: "fixture-actions" }, () => ({
          contents:
            "export async function updateRentalBookingStatus() {} export async function updateRentalCompany() {}",
          loader: "js",
        }));
        builder.onResolve({ filter: /^next\/(image|link)$/ }, (args) => ({
          path: args.path,
          namespace: "fixture-next",
        }));
        builder.onLoad({ filter: /.*/, namespace: "fixture-next" }, (args) => ({
          contents: args.path.endsWith("image")
            ? `import React from 'react';export default function Image({src,alt,fill,width,height,style,className}){return React.createElement('img',{src,alt,width,height,className,style:{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...style}})}`
            : `import React from 'react';export default function Link({href,children,...props}){return React.createElement('a',{href,...props},children)}`,
          loader: "js",
          resolveDir: root,
        }));
      },
    },
  ],
});
const server = createServer(async (req, res) => {
  if (req.url?.startsWith("/api/business/rental-bookings")) {
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        rows: [
          {
            id: "booking-1",
            vehicle_id: "vehicle-0",
            vehicle: { name: "Mustang GT" },
            start_date: "2099-01-01",
            end_date: "2099-01-03",
            status: "confirmed",
            contact_name: "Disposable renter",
            contact_email: "fixture@example.test",
            contact_phone: "+34 600 123 456",
            note: "Child seat please",
            quoted_total_cents: 22000,
          },
        ],
        total: 1,
        today: "2099-01-01",
        summary: {
          current: 1,
          pending: 1,
          pickups: 1,
          returns: 0,
          upcoming: 0,
        },
      }),
    );
    return;
  }
  if (req.url?.startsWith("/api/car-rentals")) {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ rows: listings, availabilityChecked: true }));
    return;
  }
  if (req.url === "/brand/conduzco-icon.svg") {
    res.setHeader("Content-Type", "image/svg+xml");
    res.end(await readFile(path.join(root, "public/brand/conduzco-icon.svg")));
    return;
  }
  if (req.url === "/app.js" || req.url === "/app.css") {
    res.setHeader(
      "Content-Type",
      req.url.endsWith("css") ? "text/css" : "application/javascript",
    );
    res.end(await readFile(path.join(folder, req.url.slice(1))));
    return;
  }
  res.setHeader("Content-Type", "text/html");
  res.end(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"><style>*{box-sizing:border-box}html,body{margin:0;font-family:Arial,sans-serif}html{--bg:#0d1322;--panel:#151d2c;--ink:#e9eef7;--muted:#a3afc4;--border:#ffffff20}html[data-theme=light]{--bg:#f7f8fb;--panel:#fff;--ink:#182338;--muted:#637087;--border:#d6dce6}button,input,select,textarea{font-family:inherit}.privacy-preferences{padding:1rem;text-align:center}</style></head><body><div id="root"></div><div class="privacy-preferences"><button class="button">Privacy choices</button></div><script type="module" src="/app.js"></script></body></html>`,
  );
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
});
try {
  for (const locale of ["en", "es"])
    for (const theme of ["dark", "light"])
      for (const viewport of [
        { width: 390, height: 844 },
        { width: 820, height: 1180 },
        { width: 1440, height: 900 },
      ]) {
        const page = await browser.newPage({ viewport });
        const errors = [];
        page.on("pageerror", (e) => errors.push(e.message));
        await page.addInitScript((theme) => {
          localStorage.setItem("akipasa.theme", theme);
          document.addEventListener("DOMContentLoaded", () => {
            document.documentElement.dataset.theme = theme;
          });
        }, theme);
        await page.goto(`${origin}/?lang=${locale}`);
        await page
          .getByRole("heading", { name: "Coastal Drive", exact: true })
          .waitFor();
        const overflow = await page.evaluate(() => ({
          x: document.documentElement.scrollWidth > innerWidth + 1,
          y: document.documentElement.scrollHeight > innerHeight + 1,
        }));
        if (overflow.x || overflow.y)
          throw new Error(
            `Document overflow: ${JSON.stringify({ locale, theme, viewport, overflow })}`,
          );
        const privacyVisible = await page
          .getByRole("button", { name: "Privacy choices", exact: true })
          .evaluate((button) => {
            const rect = button.getBoundingClientRect();
            return (
              rect.top >= 0 &&
              rect.bottom <= innerHeight &&
              rect.left >= 0 &&
              rect.right <= innerWidth
            );
          });
        if (!privacyVisible)
          throw new Error("Privacy control outside the fullscreen viewport");
        const name = `${operator ? "desk" : "company"}-${locale}-${theme}-${viewport.width}`;
        const screenshot = await page.screenshot({
          path: path.join(results, `${name}.png`),
        });
        if (locale === "en" && theme === "dark" && viewport.width === 1440)
          console.log(`RENTAL_UI_PNG:${screenshot.toString("base64")}`);
        if (operator) {
          await page
            .getByRole("button", {
              name: locale === "es" ? "Media" : "Media",
              exact: true,
            })
            .click();
          await page.getByText("Disposable media studio").waitFor();
          await page
            .getByRole("button", {
              name: locale === "es" ? "Solicitudes" : "Requests",
              exact: false,
            })
            .click();
          await page.getByText("Disposable renter").waitFor();
          await page
            .getByRole("link", { name: "fixture@example.test", exact: true })
            .waitFor();
          await page
            .getByRole("button", {
              name: locale === "es" ? "Resumen" : "Overview",
              exact: true,
            })
            .click();
          await page
            .getByRole("button", { name: /Mustang GT.*Disposable renter/ })
            .click();
          await page
            .getByRole("link", { name: "fixture@example.test", exact: true })
            .waitFor();
          await page.getByText("Child seat please", { exact: true }).waitFor();
          const searchWidth = await page
            .getByRole("searchbox", {
              name: locale === "es" ? "Buscar cliente" : "Search customer",
              exact: true,
            })
            .evaluate((input) => input.getBoundingClientRect().width);
          if (searchWidth < 100)
            throw new Error("Booking search field is too narrow");

          await page.screenshot({
            path: path.join(results, `${name}-bookings.png`),
          });
          if (locale === "en" && theme === "dark" && viewport.width === 1440)
            console.log(
              `RENTAL_DASHBOARD_PNG:${(await page.screenshot()).toString("base64")}`,
            );

          await page
            .getByRole("button", {
              name: locale === "es" ? "Empresa" : "Company",
              exact: true,
            })
            .click();
          await page
            .getByLabel(
              locale === "es" ? "Nombre de la sucursal" : "Branch name",
              { exact: true },
            )
            .waitFor();
          await page
            .getByLabel(locale === "es" ? "Dirección" : "Address", {
              exact: true,
            })
            .waitFor();
          await page
            .getByRole("button", {
              name: locale === "es" ? "Guardar sucursal" : "Save branch",
              exact: true,
            })
            .waitFor();
          await page.screenshot({
            path: path.join(results, `${name}-profile.png`),
          });
          await page
            .getByRole("button", {
              name: locale === "es" ? "Flota" : "Fleet",
              exact: true,
            })
            .click();
          await page.getByRole("button", { name: /Mustang GT/ }).click();
          await page
            .getByLabel(locale === "es" ? "Precio / día (€)" : "Daily rate (€)")
            .waitFor();
        } else {
          await page
            .getByRole("button", { name: /02.*(Dates|Fechas)/ })
            .click();
          const pickup = page.getByLabel(
            locale === "es" ? "Recogida" : "Pick-up",
            { exact: true },
          );
          const dropoff = page.getByLabel(
            locale === "es" ? "Devolución" : "Drop-off",
            { exact: true },
          );
          await pickup.fill("2099-01-01");
          await dropoff.fill("2099-01-03");
          const next = page.getByRole("button", {
            name:
              locale === "es"
                ? /Continuar con este coche/
                : /Continue with this car/,
          });
          await next.click();
          await page
            .getByLabel(locale === "es" ? "Tu nombre" : "Your name", {
              exact: true,
            })
            .waitFor();
        }
        if (errors.length) throw new Error(errors.join("\n"));
        await page.close();
        console.log(`PASS ${name}`);
      }
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
  await rm(folder, { recursive: true, force: true });
}

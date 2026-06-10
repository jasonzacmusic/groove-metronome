#!/usr/bin/env node
// Usage: node scripts/check-public-health.mjs [base-url]

const baseUrl = (process.argv[2] ?? "https://metronome.nathanielschool.com").replace(/\/$/, "");

const routes = [
  "/",
  "/?tab=analyzer",
  "/?tab=setlist",
  "/landing",
  "/privacy.html",
  "/manifest.webmanifest",
  "/icon.svg",
  "/api/healthz",
  "/some/random/app/path",
];

const failures = [];

async function checkRoute(route) {
  const url = `${baseUrl}${route}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, {
      cache: "no-store",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "Cache-Control": "no-cache",
      },
    });
    const text = await response.text();
    const vercelId = response.headers.get("x-vercel-id") ?? "";
    if (response.status !== 200 || /\b403\b|Forbidden/i.test(text)) {
      failures.push({
        route,
        status: response.status,
        vercelId,
        excerpt: text.slice(0, 180).replace(/\s+/g, " ").trim(),
      });
    }
    return {
      route,
      status: response.status,
      vercelId,
    };
  } catch (error) {
    failures.push({
      route,
      status: "network-error",
      vercelId: "",
      excerpt: error instanceof Error ? error.message : String(error),
    });
    return {
      route,
      status: "network-error",
      vercelId: "",
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchWithHealthReport(route) {
  const url = `${baseUrl}${route}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, {
      cache: "no-store",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "Cache-Control": "no-cache",
      },
    });
    return {
      ok: true,
      response,
      vercelId: response.headers.get("x-vercel-id") ?? "",
    };
  } catch (error) {
    failures.push({
      route,
      status: "network-error",
      vercelId: "",
      excerpt: error instanceof Error ? error.message : String(error),
    });
    return {
      ok: false,
      response: null,
      vercelId: "",
    };
  } finally {
    clearTimeout(timeout);
  }
}

const results = [];
for (const route of routes) {
  results.push(await checkRoute(route));
}

const root = await fetchWithHealthReport("/");
if (root.ok && root.response) {
  const html = await root.response.text();
  const entryAsset = html.match(/\/assets\/index-[A-Za-z0-9_-]+\.js/)?.[0];
  if (!entryAsset) {
    failures.push({
      route: "/",
      status: "missing-entry-asset",
      vercelId: root.vercelId,
      excerpt: "No hashed index asset found in HTML.",
    });
  } else {
    const entry = await fetchWithHealthReport(entryAsset);
    if (entry.ok && entry.response) {
      const entryText = await entry.response.text();
      const analyzerAsset = entryText.match(/AnalyzerPage-[A-Za-z0-9_-]+\.js/)?.[0];
      if (!analyzerAsset) {
        failures.push({
          route: entryAsset,
          status: "missing-analyzer-asset",
          vercelId: entry.vercelId,
          excerpt: "No AnalyzerPage chunk reference found.",
        });
      } else {
        const analyzer = await fetchWithHealthReport(`/assets/${analyzerAsset}`);
        if (analyzer.ok && analyzer.response) {
          const analyzerText = await analyzer.response.text();
          for (const phrase of ["Play with metronome", "weighted beat-grid", "Downbeat lock"]) {
            if (!analyzerText.includes(phrase)) {
              failures.push({
                route: `/assets/${analyzerAsset}`,
                status: "missing-current-build-phrase",
                vercelId: analyzer.vercelId,
                excerpt: `Missing phrase: ${phrase}`,
              });
            }
          }
        }
      }
    }
  }
}

if (failures.length > 0) {
  console.error(JSON.stringify({ ok: false, baseUrl, failures }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, baseUrl, checked: results }, null, 2));

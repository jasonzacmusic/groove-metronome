import {
  Activity,
  AudioWaveform,
  BadgeCheck,
  Boxes,
  Download,
  Gauge,
  Laptop,
  ListMusic,
  Music2,
  Plug,
  ShieldCheck,
  Smartphone,
  Sparkles,
  TabletSmartphone,
} from "lucide-react";

const LIVE_URL = "https://metronome.nathanielschool.com/";
const GITHUB_URL = "https://github.com/jasonzacmusic/groove-metronome";
const IOS_STATUS_URL = "#app-store";
const PLUGIN_URL = `${GITHUB_URL}/tree/main/plugin`;
const WHATSAPP_SHARE_URL = `https://wa.me/?text=${encodeURIComponent(`Try Groove Metronome: ${LIVE_URL}`)}`;

const appSpaces = [
  {
    title: "Metronome",
    label: "Practice click",
    copy: "The main wheel stays big and readable while Beat Map, Levels, Polyrhythm, and Polymeter shape the same click engine.",
    image: "/screenshots/metronome-live.png",
    icon: Gauge,
  },
  {
    title: "Analyzer",
    label: "Audio & MIDI",
    copy: "Drop audio or MIDI, inspect tempo and markers, hear the file with the metronome, then apply tempo only when you choose.",
    image: "/screenshots/analyzer-live.png",
    icon: AudioWaveform,
  },
  {
    title: "Setlist Studio",
    label: "Concert mode",
    copy: "Build the show, share or back it up, then switch to a stage view with the same metronome, large controls, clocks, and panic recovery.",
    image: "/screenshots/setlist-live.png",
    icon: ListMusic,
  },
];

const themes = [
  { name: "Default Dark", colors: ["#101525", "#f8f3df", "#facc15", "#4deee0"], note: "stage ready" },
  { name: "Classic Graphite", colors: ["#0d0f11", "#e4ebf2", "#f5b642", "#5f6872"], note: "restored" },
  { name: "Bright Graphite", colors: ["#eee7d8", "#1f1b17", "#bf6a24", "#6f584a"], note: "new bright" },
  { name: "Rose Garden", colors: ["#17051b", "#ff4f9f", "#4ee38a", "#ffd166"], note: "pink + green" },
  { name: "High Contrast", colors: ["#020617", "#ffffff", "#39ff14", "#39c7ff"], note: "maximum clarity" },
];

const features = [
  ["Per-beat subdivisions", "Each beat can carry its own subdivision and pulse pattern."],
  ["Accent levels everywhere", "Loud, normal, soft, and muted beats stay unified across the wheel, notation, and stage view."],
  ["Polyrhythm + polymeter", "Layered rhythms and chained meters are visual, audible, and separate practice views."],
  ["Jazz, dotted, and triplet assists", "Tasteful practice helpers without turning every feature on at once."],
  ["Setlist backup + share", "Export .groove-setlist files, import CSVs, copy links, and use native sharing where supported."],
  ["Offline-ready web app", "The installed browser app caches core files for stage use when the internet gets unreliable."],
  ["Audio/MIDI lab", "Up to five imports, markers, tempo controls, live recording, and MIDI section/piano visualization."],
  ["Real sampled clicks", "Marimba, wood, clave, shaker, tabla, rim, tight, and voice slots, with related subdivision tones."],
];

const versions = [
  {
    title: "Web Browser",
    status: "Live now",
    copy: "The production app runs at metronome.nathanielschool.com and can be installed as a PWA.",
    action: "Open web app",
    href: LIVE_URL,
    icon: Laptop,
  },
  {
    title: "iOS, iPad & Android",
    status: "App Store kit ready",
    copy: "The iOS/iPad build is passing locally. Store metadata, privacy copy, screenshots, and review notes are prepared for submission.",
    action: "Store prep",
    href: IOS_STATUS_URL,
    icon: TabletSmartphone,
  },
  {
    title: "DAW Plugin",
    status: "AU/VST3 scaffold working",
    copy: "Logic uses AU, Reaper uses VST3. AAX is planned after the core plugin stabilizes and Avid signing is handled.",
    action: "Plugin guide",
    href: PLUGIN_URL,
    icon: Plug,
  },
];

export function LandingPage() {
  return (
    <div data-theme="bright" className="landing-page min-h-screen bg-background text-foreground">
      <header className="landing-nav">
        <a href="/" className="landing-brand" aria-label="Open Groove Metronome">
          <img src="/brand/groove-mark.svg" alt="" className="h-10 w-10" />
          <span>
            <span className="block font-serif text-xl leading-none">Groove Metronome</span>
            <span className="tiny-caps text-[9px] text-muted-foreground">Nathaniel School of Music</span>
          </span>
        </a>
        <nav className="hidden items-center gap-5 text-sm text-muted-foreground md:flex">
          <a href="#modes">Modes</a>
          <a href="#versions">Versions</a>
          <a href="#themes">Themes</a>
          <a href="#assets">Assets</a>
        </nav>
        <a href={LIVE_URL} className="landing-button landing-button-primary">Open app</a>
      </header>

      <main>
        <section className="landing-hero">
          <div className="landing-hero-copy">
            <span className="landing-chip"><Sparkles className="size-3" /> Live browser app + DAW beta path</span>
            <h1>See it. Count it. Lock it in.</h1>
            <p>
              A musician-first metronome for practice, stage, studio, and teaching. Shape the click visually, save the show,
              analyze audio or MIDI, and keep the same rhythm logic across browser, mobile shells, and DAW plugins.
            </p>
            <div className="landing-cta-row">
              <a href={LIVE_URL} className="landing-button landing-button-primary">Use Groove Metronome</a>
              <a href="#versions" className="landing-button">See versions</a>
              <a href={WHATSAPP_SHARE_URL} className="landing-button landing-button-quiet">Share</a>
            </div>
            <div className="landing-proof-row">
              <Proof icon={BadgeCheck} title="Fact checked" text="Claims match the current repo state." />
              <Proof icon={ShieldCheck} title="Stage-minded" text="Offline, panic recovery, and big controls." />
              <Proof icon={Activity} title="Live screenshots" text="Captured from the running app." />
            </div>
          </div>
          <div className="landing-hero-shot">
            <img src="/screenshots/metronome-live.png" alt="Groove Metronome live practice view with wheel and notation" />
          </div>
        </section>

        <section id="modes" className="landing-section">
          <SectionHeader eyebrow="Three product spaces" title="One rhythm engine, three ways to work." />
          <div className="landing-mode-grid">
            {appSpaces.map((space) => {
              const Icon = space.icon;
              return (
                <article className="landing-mode-card" key={space.title}>
                  <img src={space.image} alt={`${space.title} live app screenshot`} />
                  <div className="landing-card-body">
                    <span className="landing-card-kicker"><Icon className="size-4" /> {space.label}</span>
                    <h3>{space.title}</h3>
                    <p>{space.copy}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="landing-section landing-split">
          <div>
            <SectionHeader eyebrow="Core features" title="Deep enough for serious musicians. Simple enough for a phone on stage." />
            <p className="landing-lede">
              Claude’s draft was strong, but a few claims needed tightening: iOS and Android are native shells ready for packaging,
              the plugin is AU/VST3-first, and AAX is planned rather than available today.
            </p>
          </div>
          <div className="landing-feature-list">
            {features.map(([title, text]) => (
              <div className="landing-feature" key={title}>
                <Music2 className="size-4" />
                <div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="versions" className="landing-section">
          <SectionHeader eyebrow="Web, mobile, plugin" title="All three versions stay on the same musical idea." />
          <div className="landing-version-grid">
            {versions.map((version) => {
              const Icon = version.icon;
              return (
                <article className="landing-version-card" key={version.title}>
                  <Icon className="size-6" />
                  <span>{version.status}</span>
                  <h3>{version.title}</h3>
                  <p>{version.copy}</p>
                  <a className="landing-card-link" href={version.href}>{version.action}</a>
                </article>
              );
            })}
          </div>
        </section>

        <section id="app-store" className="landing-section landing-store">
          <SectionHeader eyebrow="iOS and iPad launch" title="Free 1.0 first, clean paid upgrade path later." />
          <div className="landing-store-grid">
            <div className="landing-store-panel">
              <Smartphone className="size-6" />
              <h3>App Store submission pack</h3>
              <p>
                The iOS/iPad build, metadata, privacy policy, review notes, icons, and screenshot package are organized for App Store Connect.
                The first release is positioned as free, offline-ready, and musician-safe for stage use.
              </p>
            </div>
            <div className="landing-store-panel">
              <ShieldCheck className="size-6" />
              <h3>Monetization without breaking trust</h3>
              <p>
                Backend flags can keep feature rollout smooth, but paid iOS digital features should ship through Apple pricing or StoreKit
                in-app purchases when Groove moves from free launch to premium tiers.
              </p>
            </div>
          </div>
        </section>

        <section id="themes" className="landing-section">
          <SectionHeader eyebrow="Five designs" title="Five clear looks for different players and stages." />
          <div className="landing-theme-grid">
            {themes.map((theme) => (
              <article className="landing-theme-card" key={theme.name}>
                <div
                  className="landing-theme-swatch"
                  style={{ background: `linear-gradient(135deg, ${theme.colors.map((color, index) => `${color} ${Math.round((index * 100) / theme.colors.length)}% ${Math.round(((index + 1) * 100) / theme.colors.length)}%`).join(", ")})` }}
                />
                <h3>{theme.name}</h3>
                <p>{theme.note}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="assets" className="landing-section landing-final">
          <Boxes className="size-9" />
          <h2>Marketing kit is organized and ready to hand off.</h2>
          <p>
            The Downloads folder includes the original Claude files, fact-check notes, refreshed screenshots, social-card assets,
            and app icon sources in one dated Groove Metronome marketing folder.
          </p>
          <div className="landing-cta-row justify-center">
            <a href={LIVE_URL} className="landing-button landing-button-primary">Open the app</a>
            <a href={LIVE_URL} className="landing-button">Public link</a>
            <a href={GITHUB_URL} className="landing-button landing-button-quiet">Source</a>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <span>Groove Metronome by Nathaniel School of Music</span>
        <span>Web live now. iOS/iPad submission pack ready. AU/VST3 plugin in progress.</span>
        <a href="/privacy.html">Privacy</a>
        <a href={LIVE_URL} className="inline-flex items-center gap-1"><Download className="size-3" /> Use in browser</a>
      </footer>
    </div>
  );
}

function SectionHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="landing-section-header">
      <span>{eyebrow}</span>
      <h2>{title}</h2>
    </div>
  );
}

function Proof({ icon: Icon, title, text }: { icon: typeof Gauge; title: string; text: string }) {
  return (
    <div className="landing-proof">
      <Icon className="size-4" />
      <span>
        <strong>{title}</strong>
        <small>{text}</small>
      </span>
    </div>
  );
}

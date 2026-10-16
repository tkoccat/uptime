// Marketing metinleri tek yerde tutulur; Adım 6'da next-intl dosyalarına taşınacak.

export type PlanId = "free" | "pro" | "business";

export type PlanContent = {
  id: PlanId;
  name: string;
  monthly: number; // GBP / ay
  yearly: number; // GBP / yıl (yaklaşık %20 indirimli)
  tagline: string;
  features: string[];
  highlight?: boolean;
  cta: string;
};

export const plans: PlanContent[] = [
  {
    id: "free",
    name: "Free",
    monthly: 0,
    yearly: 0,
    tagline: "For side projects and hobby sites.",
    features: ["5 monitors", "3-minute checks", "Email alerts", "1 public status page"],
    cta: "Start free",
  },
  {
    id: "pro",
    name: "Pro",
    monthly: 9,
    yearly: 86,
    tagline: "For indie hackers and growing products.",
    features: [
      "50 monitors",
      "1-minute checks",
      "Email, Slack and webhook alerts",
      "Status pages with custom domain",
      "REST API access",
      "14-day free trial",
    ],
    highlight: true,
    cta: "Start 14-day trial",
  },
  {
    id: "business",
    name: "Business",
    monthly: 29,
    yearly: 278,
    tagline: "For small teams that need faster checks.",
    features: [
      "200 monitors",
      "30-second checks",
      "Everything in Pro",
      "Team collaboration",
      "Priority support",
    ],
    cta: "Choose Business",
  },
];

export const features = [
  {
    title: "Multi-region checks",
    body: "Verify your site from more than one location so a single network blip never wakes you up.",
  },
  {
    title: "SMS, email and Slack alerts",
    body: "Get notified where you already work, the moment a monitor goes down or recovers.",
  },
  {
    title: "Public status pages",
    body: "Publish a clean status page on your own subdomain or custom domain, with 90-day uptime history.",
  },
  {
    title: "REST API",
    body: "Create and manage monitors from your own scripts and deployment pipelines.",
  },
  {
    title: "Webhooks",
    body: "Send incident events to any service that accepts an HTTP request.",
  },
  {
    title: "Team collaboration",
    body: "Share monitors and status pages with teammates on the Business plan.",
  },
];

export const problemSolution = [
  {
    problem: "You installed Uptime Kuma, but updates never stop",
    solution: "We keep the engine updated and patched for you.",
  },
  {
    problem: "Backups, SSL renewals and server upkeep eat your weekends",
    solution: "Backups, certificates and infrastructure are handled for you.",
  },
  {
    problem: "A monitor running on the server it watches fails together with it",
    solution: "Checks run from separate infrastructure, so an outage on your side is still detected.",
  },
];

export const trustPoints = [
  "Built on the open-source Uptime Kuma engine",
  "Run by a UK-registered company",
  "GDPR-ready, with a signed DPA available",
  "Cancel any time",
];

export const faqs = [
  {
    q: "What is this service?",
    a: "A hosted uptime monitoring platform built around the open-source Uptime Kuma engine. You sign up, add your sites and get alerts, with nothing to install or maintain.",
  },
  {
    q: "Do I need a credit card to start?",
    a: "No. The Free plan needs no card. The Pro trial also starts without payment details being charged until the trial ends; cancel before then and you pay nothing.",
  },
  {
    q: "How is this different from self-hosting Uptime Kuma?",
    a: "Self-hosting gives you full control but also the upkeep: updates, backups, SSL and the risk of monitoring from the same server you are watching. We run all of that for you.",
  },
  {
    q: "How often are my sites checked?",
    a: "Every 3 minutes on Free, every minute on Pro and every 30 seconds on Business.",
  },
  {
    q: "Can I publish a status page for my customers?",
    a: "Yes. Every account gets a status page on our subdomain, and Pro and Business can use their own custom domain.",
  },
  {
    q: "Which alert channels are supported?",
    a: "Email, SMS, Slack and webhooks.",
  },
  {
    q: "Can I change or cancel my plan?",
    a: "Yes, at any time from your billing page. Upgrades apply immediately and cancellations take effect at the end of the billing period.",
  },
  {
    q: "Do you offer refunds?",
    a: "Yes. See our refund policy for the 14-day refund window.",
  },
  {
    q: "Where is my data stored and is it GDPR compliant?",
    a: "We are a UK company and handle personal data under UK and EU GDPR. A data processing agreement and our list of sub-processors are available on request.",
  },
  {
    q: "Can I delete my account and data?",
    a: "Yes. You can delete your account from settings, which removes your monitors and monitoring data.",
  },
];

export type Comparison = {
  slug: string;
  name: string;
  headline: string;
  intro: string;
  theyAreGoodAt: string[];
  weAreGoodAt: string[];
  rows: { label: string; us: string; them: string }[];
  chooseThem: string;
  chooseUs: string;
};

export const comparisons: Comparison[] = [
  {
    slug: "better-stack",
    name: "Better Stack",
    headline: "A lightweight Better Stack alternative for uptime monitoring",
    intro:
      "Better Stack bundles monitoring with logs, incident management and on-call scheduling. If you only need dependable uptime checks and a status page, a focused tool can be simpler and cheaper.",
    theyAreGoodAt: [
      "Broad platform: uptime, logs and incident management in one place",
      "On-call scheduling and escalation policies",
    ],
    weAreGoodAt: [
      "Simple, low-priced plans aimed at individuals and small teams",
      "Built on open-source Uptime Kuma, with no lock-in to a closed engine",
      "Focus on uptime checks, alerts and status pages only",
    ],
    rows: [
      { label: "Primary focus", us: "Uptime monitoring and status pages", them: "Full observability and incident platform" },
      { label: "Monitoring engine", us: "Open-source Uptime Kuma", them: "Proprietary" },
      { label: "Best for", us: "Indie hackers, small teams", them: "Teams that need on-call and logs" },
    ],
    chooseThem: "you need on-call rotations, log management or advanced incident workflows.",
    chooseUs: "you want straightforward uptime checks, alerts and a status page at a low monthly price.",
  },
  {
    slug: "uptimerobot",
    name: "UptimeRobot",
    headline: "An UptimeRobot alternative built on open-source Uptime Kuma",
    intro:
      "UptimeRobot is a long-established uptime monitor. If you want an open-source engine, faster checks on small plans and a modern interface, we are worth a look.",
    theyAreGoodAt: ["Long track record and a large user base", "A well-known free tier"],
    weAreGoodAt: [
      "Open-source engine you could move to self-hosting later",
      "Fast check intervals on affordable paid plans",
      "Modern dashboard and status pages",
    ],
    rows: [
      { label: "Monitoring engine", us: "Open-source Uptime Kuma", them: "Proprietary" },
      { label: "Self-hosting option", us: "Yes, the engine is open source", them: "No" },
      { label: "Best for", us: "Developers who value openness", them: "Anyone wanting a familiar, established tool" },
    ],
    chooseThem: "you prefer a long-established service and its existing free tier fits your needs.",
    chooseUs: "you value an open-source engine and modern, low-priced paid plans.",
  },
  {
    slug: "cronitor",
    name: "Cronitor",
    headline: "A Cronitor alternative for website and API uptime",
    intro:
      "Cronitor is strong at monitoring cron jobs and scheduled tasks. If your main goal is checking that websites and APIs are reachable, a dedicated uptime tool fits more directly.",
    theyAreGoodAt: ["Cron job and heartbeat monitoring", "Developer-focused tooling"],
    weAreGoodAt: [
      "Website, API, port and ping monitoring",
      "Public status pages included",
      "Simple pricing for small projects",
    ],
    rows: [
      { label: "Primary focus", us: "Website and API uptime", them: "Cron jobs and scheduled tasks" },
      { label: "Public status pages", us: "Included", them: "Check current plans" },
      { label: "Monitoring engine", us: "Open-source Uptime Kuma", them: "Proprietary" },
    ],
    chooseThem: "your main need is watching cron jobs and background tasks.",
    chooseUs: "your main need is knowing when your sites and APIs are down.",
  },
  {
    slug: "uptime-kuma",
    name: "self-hosted Uptime Kuma",
    headline: "Self-hosted Uptime Kuma vs hosted: which should you choose?",
    intro:
      "Uptime Kuma is excellent software, and we use it as our engine. The question is whether you want to run it yourself or let us do it.",
    theyAreGoodAt: [
      "Full control over your data and configuration",
      "No subscription cost beyond your own server",
    ],
    weAreGoodAt: [
      "No servers, updates, backups or SSL renewals to manage",
      "Monitoring from infrastructure separate from your own",
      "Managed status pages, alerts and billing in one place",
    ],
    rows: [
      { label: "Setup", us: "Sign up and start", them: "Provision a server and install" },
      { label: "Maintenance", us: "Handled for you", them: "You handle updates and backups" },
      { label: "Independence from your servers", us: "Checks run elsewhere", them: "Depends on where you host it" },
      { label: "Cost", us: "From free; paid plans from £9/month", them: "Your server and your time" },
    ],
    chooseThem: "you enjoy running your own infrastructure and want complete control.",
    chooseUs: "you would rather spend your time on your product than on keeping a monitor alive.",
  },
];

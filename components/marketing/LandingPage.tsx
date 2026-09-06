import Link from "next/link";

const industries = [
  { name: "Marble & granite trading", detail: "Supplier → purchase → stock → sale → invoice, with full price and margin history." },
  { name: "Stone factories", detail: "Raw block intake through cutting, polishing and QC into graded, individually tracked slabs." },
  { name: "Stone fabrication", detail: "Project-based jobs — countertops, stairs, vanities — from measurement to installation." },
  { name: "Tile manufacturing", detail: "Recipes, production batches, shade and caliber sorting, kiln/firing records." },
  { name: "Tile distribution", detail: "Batch- and shade-aware stock across warehouses, reserved correctly against real orders." },
  { name: "Showrooms", detail: "Customer-facing reservation and quotation flows against live, accurate on-hand stock." },
];

const capabilities = [
  {
    title: "One ERP, six business models",
    body: "Trading, factory production, fabrication, tile manufacturing, distribution and showroom operations run on the same platform — enable only the modes your business actually needs.",
  },
  {
    title: "True multi-tenant isolation",
    body: "Every company's data — products, blocks, slabs, customers, financials — is isolated at the database level with row-level security, not just filtered in the app.",
  },
  {
    title: "Block and slab genealogy",
    body: "Every block and every slab is an individually numbered, traceable unit with parent-child lineage — never flattened into a single square-footage number.",
  },
  {
    title: "Batch, shade & caliber aware",
    body: "Tile inventory tracks batch, lot, shade and caliber together, so incompatible material never gets mixed where your business rules say it shouldn't.",
  },
  {
    title: "Configurable, not hard-coded",
    body: "Units of measure, conversions, product attributes, roles, currencies and tax rules are all tenant-configurable — built for one country's rules, not locked to it.",
  },
  {
    title: "Financial data stays protected",
    body: "Cost and margin visibility is a permission, not a UI trick — a salesperson can open a product without ever seeing what it cost you.",
  },
];

const workflowSteps = [
  "Supplier",
  "Purchase / Block intake",
  "Production & processing",
  "Slab / finished stock",
  "QC",
  "Warehouse",
  "Reservation",
  "Sale & dispatch",
  "Payment",
];

const reports = [
  "Stock, valuation and aging by block, slab, batch and shade",
  "Production yield, waste and recovery by block, machine or operator",
  "Sales by customer, product, variety, branch and salesperson",
  "Supplier purchase history and landed cost",
  "P&L, cash flow, receivables and payables",
];

const faqs = [
  {
    q: "What is Stonevora?",
    a: "Stonevora is a multi-tenant ERP built specifically for the marble, granite, natural stone and tile industry — covering trading, factory production, fabrication, tile manufacturing, distribution and showroom operations on one platform.",
  },
  {
    q: "Who can use Stonevora?",
    a: "Any marble, granite, natural stone or tile business — from a single-branch trading company to a multi-branch factory with its own fabrication and export operations.",
  },
  {
    q: "Can small marble businesses use it?",
    a: "Yes. You enable only the modes and modules your business needs — a small trading business isn't forced through factory or manufacturing workflows it doesn't use.",
  },
  {
    q: "Can large factories use it?",
    a: "Yes. The architecture is built for scale — hundreds of thousands of slabs and millions of stock movements — with the same tenant isolation and permission model as a small business.",
  },
  {
    q: "Can it manage blocks and individual slabs?",
    a: "Yes. Every block and every slab is tracked as its own record with dimensions, grade, location, cost and status, linked back to its parent block — not collapsed into a single area total.",
  },
  {
    q: "Can it manage tile batches, shades and calibers?",
    a: "Yes. Tile stock is tracked by product, batch/lot, shade and caliber together, so your team can find — and keep separate — exactly the material a job requires.",
  },
  {
    q: "Can it work on mobile?",
    a: "Yes. The entire application is built responsive-first for phones, tablets and desktops, since warehouse and factory-floor staff primarily work from a phone.",
  },
  {
    q: "Can multiple branches be managed?",
    a: "Yes. Company → branch → warehouse/yard is built into the core data model from day one.",
  },
  {
    q: "Is each company's data isolated?",
    a: "Yes. Tenant isolation is enforced by the database itself via row-level security — one company can never query, see, or accidentally expose another company's data.",
  },
  {
    q: "Can it support different currencies and countries?",
    a: "Yes. Currency, country, tax rules and fiscal year are configured per company rather than hard-coded, so the core platform isn't tied to any one market.",
  },
  {
    q: "Can it support fabrication and custom projects?",
    a: "Yes — project-based jobs (countertops, stairs, vanities, custom cut-to-size work) are a first-class part of the platform's design, tracked from quotation through installation and invoice.",
  },
  {
    q: "Can it adapt to future local tax requirements?",
    a: "Yes. Tax types and rates are tenant-configurable with effective dates, so new local requirements can be added without changing the core system.",
  },
];

// Structured data for search engines -- built directly from the same content
// rendered on the page (the faqs array above), never a separate, divergent
// copy. SoftwareApplication + FAQPage are the two schema.org types that
// actually apply here; no "offers"/pricing data exists to claim, so that
// field is omitted rather than invented.
function structuredData() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        name: "Stonevora",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        description:
          "Stonevora is a multi-tenant ERP for marble, granite, natural stone and tile businesses — from trading and showrooms to factory production, fabrication and tile manufacturing.",
      },
      {
        "@type": "FAQPage",
        mainEntity: faqs.map((item) => ({
          "@type": "Question",
          name: item.q,
          acceptedAnswer: { "@type": "Answer", text: item.a },
        })),
      },
    ],
  };
}

export function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white text-zinc-900 dark:bg-black dark:text-zinc-50">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData()) }}
      />
      <Header />
      <main className="flex-1">
        <Hero />
        <Industries />
        <Capabilities />
        <TraceabilityWorkflow />
        <MobileCapability />
        <Reports />
        <Security />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-black/90">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <span className="text-lg font-semibold">Stonevora</span>
        <nav className="flex items-center gap-2 text-sm">
          <Link
            href="/login"
            className="flex min-h-11 items-center px-3 text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="flex min-h-11 items-center rounded-md bg-zinc-900 px-4 font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Get started
          </Link>
        </nav>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
      <div className="max-w-3xl">
        <p className="mb-4 text-sm font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          ERP for marble, granite, natural stone &amp; tile
        </p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Run your stone or tile business on one platform, not five spreadsheets.
        </h1>
        <p className="mt-6 text-lg text-zinc-600 dark:text-zinc-400">
          Stonevora tracks every block, slab, batch and shade from supplier to
          dispatch — with true multi-tenant isolation, mobile-ready warehouse
          workflows, and financial controls that protect your margins.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/signup"
            className="flex min-h-12 items-center justify-center rounded-md bg-zinc-900 px-6 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Get started
          </Link>
          <Link
            href="#capabilities"
            className="flex min-h-12 items-center justify-center rounded-md border border-zinc-300 px-6 text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
          >
            See what it does
          </Link>
        </div>
      </div>
    </section>
  );
}

function Industries() {
  return (
    <section className="border-t border-zinc-200 bg-zinc-50 py-16 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2 className="text-2xl font-semibold sm:text-3xl">Built for every part of the industry</h2>
        <p className="mt-3 max-w-2xl text-zinc-600 dark:text-zinc-400">
          Enable the business modes you actually run — on one shared platform, not
          six disconnected apps.
        </p>
        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {industries.map((item) => (
            <div
              key={item.name}
              className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-black"
            >
              <h3 className="font-medium">{item.name}</h3>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{item.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Capabilities() {
  return (
    <section id="capabilities" className="py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2 className="text-2xl font-semibold sm:text-3xl">Core capabilities</h2>
        <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {capabilities.map((item) => (
            <div key={item.title}>
              <h3 className="font-medium">{item.title}</h3>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TraceabilityWorkflow() {
  return (
    <section className="border-t border-zinc-200 bg-zinc-50 py-16 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2 className="text-2xl font-semibold sm:text-3xl">Complete traceability, end to end</h2>
        <p className="mt-3 max-w-2xl text-zinc-600 dark:text-zinc-400">
          Every unit of stock keeps its full history — from the supplier it came
          from to the invoice it was sold on — so nothing gets lost between
          departments.
        </p>
        <ol className="mt-10 flex flex-wrap gap-3">
          {workflowSteps.map((step, i) => (
            <li key={step} className="flex items-center gap-3">
              <span className="flex items-center gap-2 rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm dark:border-zinc-700 dark:bg-black">
                <span className="text-zinc-400 dark:text-zinc-600">{i + 1}</span>
                {step}
              </span>
              {i < workflowSteps.length - 1 && (
                <span aria-hidden className="text-zinc-300 dark:text-zinc-700">
                  →
                </span>
              )}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function MobileCapability() {
  return (
    <section className="py-16">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-4 sm:px-6 lg:grid-cols-2">
        <div>
          <h2 className="text-2xl font-semibold sm:text-3xl">
            Built for the warehouse floor, not just the office
          </h2>
          <p className="mt-4 text-zinc-600 dark:text-zinc-400">
            Factory and warehouse staff work from their phones. Stonevora is
            responsive from the ground up — large touch targets, fast search,
            and forms that work with one hand — so receiving, stock lookup and
            production updates don&apos;t require a desk.
          </p>
          <ul className="mt-6 space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
            <li>• Full functionality on phones, tablets and desktop — one codebase</li>
            <li>• Designed for barcode/QR-driven lookup as production workflows land</li>
            <li>• Clear status, minimal typing, mobile-safe forms and dialogs</li>
          </ul>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-8 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="mx-auto flex max-w-[220px] flex-col gap-3 rounded-2xl border border-zinc-300 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-black">
            <div className="h-2 w-16 rounded-full bg-zinc-200 dark:bg-zinc-800" />
            <div className="h-20 rounded-lg bg-zinc-100 dark:bg-zinc-900" />
            <div className="h-8 rounded-md bg-zinc-900 dark:bg-zinc-100" />
            <div className="h-8 rounded-md border border-zinc-200 dark:border-zinc-800" />
          </div>
        </div>
      </div>
    </section>
  );
}

function Reports() {
  return (
    <section className="border-t border-zinc-200 bg-zinc-50 py-16 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2 className="text-2xl font-semibold sm:text-3xl">See the whole business, not just one screen</h2>
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {reports.map((item) => (
            <div
              key={item}
              className="rounded-lg border border-zinc-200 bg-white px-5 py-4 text-sm dark:border-zinc-800 dark:bg-black"
            >
              {item}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Security() {
  return (
    <section className="py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2 className="text-2xl font-semibold sm:text-3xl">Multi-tenant by design, secure by default</h2>
        <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-3">
          <div>
            <h3 className="font-medium">Database-level isolation</h3>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Row-level security enforces tenant boundaries in the database
              itself — not just in application code that could contain a bug.
            </p>
          </div>
          <div>
            <h3 className="font-medium">Role-based permissions</h3>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Owner, factory manager, salesperson, accountant and more — each
              with exactly the access their role requires, nothing more.
            </p>
          </div>
          <div>
            <h3 className="font-medium">Full audit trail</h3>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Who changed what, when, and what it looked like before — recorded
              automatically for critical business records.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Faq() {
  return (
    <section className="border-t border-zinc-200 bg-zinc-50 py-16 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <h2 className="text-2xl font-semibold sm:text-3xl">Frequently asked questions</h2>
        <div className="mt-8 divide-y divide-zinc-200 dark:divide-zinc-800">
          {faqs.map((item) => (
            <details key={item.q} className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left font-medium">
                {item.q}
                <span className="shrink-0 text-zinc-400 group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
        <h2 className="text-2xl font-semibold sm:text-3xl">
          Bring your stone or tile business onto one platform
        </h2>
        <p className="mt-4 text-zinc-600 dark:text-zinc-400">
          Set up your company in minutes — you own your data, isolated from
          every other tenant on the platform.
        </p>
        <div className="mt-8 flex justify-center">
          <Link
            href="/signup"
            className="flex min-h-12 items-center justify-center rounded-md bg-zinc-900 px-6 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Get started
          </Link>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-zinc-200 py-10 dark:border-zinc-800">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-sm text-zinc-500 sm:flex-row sm:px-6 dark:text-zinc-500">
        <span>© {new Date().getFullYear()} Stonevora</span>
        <div className="flex items-center gap-6">
          <Link href="/login" className="hover:text-zinc-900 dark:hover:text-zinc-300">
            Sign in
          </Link>
          <Link href="/signup" className="hover:text-zinc-900 dark:hover:text-zinc-300">
            Get started
          </Link>
        </div>
      </div>
    </footer>
  );
}

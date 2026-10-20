# Moviejuke Interiors — Search → Customer Intelligence

A working dashboard for a curtains, blinds and interior-design studio in Bengaluru.
It answers one question: **when someone searches Google for one of our products, who are they, and what happened next?**

Every customer record carries the exact Google query that brought them in, the landing page they hit,
the campaign source, and a full activity trail from first search to booking.

![Node](https://img.shields.io/badge/node-%E2%89%A522.5-1d4a43) ![No build step](https://img.shields.io/badge/build-none-b9763a)

---

## The honest bit about Google

Google **never** tells you who searched. Search Console and the Google Ads API only expose
*aggregated* query data — impressions, clicks, CTR, average position. There is no API anywhere that
returns "Ananya from Whitefield searched *motorised blinds price*".

So the page joins two sources that do exist:

| What we know | Where it comes from | How it is joined |
| --- | --- | --- |
| The query, clicks, impressions, rank | Google Ads search-terms report / Search Console | `search_terms.keyword` |
| The person, phone, budget, stage | Your own first-party enquiries (site form, calls, lead form, CRM) | `customers.search_term_id` |

The link is made by the search term the visitor arrived with, plus the landing page and the `gclid`
that Google appends to paid clicks. That is exactly how the bundled `/capture` page works: it reads
`?q=` / `utm_term=` / `gclid` from the URL, stores them on the customer, and the dashboard shows the
match immediately.

If you later plug in the real Search Console or Ads API, **no dashboard code changes** — you only
replace the numbers in `search_terms`. The customer side stays yours.

---

## What is in the build

**1. Lead capture page — `/capture`**

A real landing page a customer would fill in. It picks up the query from the URL
(`?q=motorized+blinds+price+bangalore&utm_source=google&utm_medium=cpc`), shows *"We can see you
arrived from '…'"*, and submits straight into the dashboard with source attribution
(`google_ads` when a gclid/utm_medium=cpc is present, `google_organic` when the referrer is Google,
otherwise `direct`). Open the "Try capture form" button in the app to see the whole loop.

**2. Overview**

KPI strip (customers captured, open pipeline, bookings won, share traced to a search), a 30-day
capture chart switchable between enquiries / qualified / pipeline, a search-to-booking funnel,
the top-performing queries, a "follow up today" list of new enquiries older than 36 hours, and
product demand bars.

**3. Google searches**

All 40 queries with impressions, clicks, CTR, customers produced, click→customer conversion and
pipeline. Sort by any metric. Click any query to see **only the customers who searched it**.

**4. Customers**

248 seeded enquiries in a filterable card grid — free text, product, source, city, stage chips and
sort. Each card shows the query in quotes, the product, the stage, the quote value and the owner.
Clicking a customer opens a drawer with contact details, the search journey, commercials, a stage
mover and a full activity timeline (search → form → call → site visit → quote → booking) with an
"add activity" box.

**5. Import & export**

- CSV import with alias detection (`keyword` / `search_term` / `query` / `google_search`, …),
  fuzzy product matching, ₹/comma-tolerant numbers, many date formats, stage normalisation
  (`"Closed Won"` → `won`), per-row skip reasons and a downloadable template.
- CSV export of everything, or of the exact customer filter you are looking at.

---

## Run it

```bash
npm install
npm start          # http://localhost:4300
```

Node **22.5+** is required (the app uses the built-in `node:sqlite`, so there is no native build step
and no database server). The demo database is created and seeded automatically on first boot into
`data/app.db`.

Other commands:

```bash
npm run dev        # same, with --watch
npm run seed       # rebuild the demo dataset
```

The database file is gitignored — a fresh clone reseeds itself. Use **Reset demo data** in the app
(or `POST /api/demo/reset`) to start over.

---

## Importing the requested historical records (2023-01-01 to 2026-10-20)

**No real exports are included in this repository.** The initial 248 enquiries and 40 queries
are fictional. January 1, 2023 through October 20, 2026 is **3 years, 9 months and 20 days**, not
two years; the import form defaults to the requested dates.

1. Export a **dated** query report from Google Ads or Search Console. Required CSV headers:
   `date,query,impressions,clicks`. `search_term`, `top_queries`, `impr`, `position`,
   `landing_page`, `source` are also recognized. Include the **date + query** dimensions; an
   undated aggregate cannot be reliably assigned to calendar months. Select Ads or Search Console
   in the form if the CSV has no source column. For large exports, split into files under 5 MB;
   re-uploading a day/query/source/page updates it rather than summing the same report twice.
2. Export your **own first-party enquiries / CRM** separately: `name,created_at,email,phone,
   product,keyword,source,stage` (other fields optional). `created_at` is required when using the
   historical range, and rows outside it are skipped. Re-uploading **identical CSV rows** skips
   them; a modified row is considered a new lead. Export personal data only with appropriate
   permission and retention policies.
3. Deploy behind **HTTPS on a private server**. Set a strong `MOVIEJUKE_ADMIN_PASSWORD` (at least
   16 characters) via the server's environment/secrets manager. It enables password protection
   for every page and API in real-data mode (HTTP Basic Auth, username `admin`). **Do not upload
   personal information to the publicly reachable Arena demo preview.** Never commit credentials
   or your SQLite database. For a production system, add stronger authentication, authorization,
   rate limiting and a separate public lead-capture endpoint.
4. In **Import & export**, click **Replace demo with real data** after backing up anything important.
   This action is intentionally blocked without the password above. It removes fictional people,
   query totals and notes while retaining the product catalogue. Import the search reports and CRM
   exports. The **Monthly history** table shows actual dated clicks/impressions and enquiries for
   the chosen window; missing months remain missing. Existing overview quick charts show only
   the most recent 7/30/90 days, while totals and searches show all available imported history.

Search reports are aggregates: Google never identifies individual searchers, anonymized/"other"
queries cannot be linked to people, and Google may not supply older reports that were never
archived. If an older export does not exist, this app **cannot recover or invent** that data.

---

## CSV format

Only `name` is required. Everything else is optional and matched by common aliases.

```csv
name,email,phone,city,product,keyword,stage,source,budget,quote_value,owner,notes,created_at
Ananya Sharma,ananya@example.com,+91 98450 12345,Bengaluru,Motorized Blinds,motorized blinds price,quoted,google_ads,42000,44500,Aisha Menon,"4BHK, app control",2026-10-12
```

| Column | Accepted as | Notes |
| --- | --- | --- |
| `name` | `customer`, `full_name`, `lead_name`, `contact` | **required** |
| `keyword` | `search_term`, `query`, `google_search`, `searched_for` | creates the search term if new |
| `product` | `service`, `interested_in` | fuzzy-matched to the 14-product catalogue |
| `stage` | `status`, `lead_status` | `new/contacted/qualified/quoted/won/lost` or CRM wording |
| `source` | `channel`, `lead_source` | `google_ads`, `google_organic`, `google_shopping`, `direct`, `referral` |
| `budget`, `quote_value` | `quote`, `deal_value` | `₹` and commas stripped |
| `created_at` | `date`, `enquiry_date`, `timestamp` | ISO, `YYYY-MM-DD` or `DD/MM/YYYY` |

---

## Project layout

```
server/
  index.js     Express app + REST API (customers, terms, overview, import/export)
  seed.js      deterministic 248-customer demo dataset
  queries.js   all SQL reads/writes and the overview aggregation
  db.js        node:sqlite connection, schema, auto-seed
  csv.js       dependency-free RFC-4180 parser/writer
  search-import.js  dated query report parser and idempotent importer
tests/
  historical.test.js  isolated import and authorization regression test
public/
  index.html   dashboard shell
  app.js       view rendering, chart, drawer, filters, import
  styles.css   design system
  capture.html standalone lead-capture landing page
```

### API

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/overview?days=30` | KPIs, funnel, daily series, top queries, attention list |
| `GET` | `/api/search-terms` | queries with leads, conversion and pipeline |
| `GET` | `/api/customers` | paginated, filtered customer list |
| `GET` | `/api/customers/:id` | one customer with the full event timeline |
| `POST` | `/api/customers` | create a customer (used by the capture page) |
| `PATCH` | `/api/customers/:id` | move stage, edit contact/commercial fields |
| `POST` | `/api/customers/:id/events` | log a call, note or WhatsApp touch |
| `POST` | `/api/import?from=2023-01-01&to=2026-10-20` | import CRM CSV with date filter (text body or `{ "csv": "…" }`) |
| `POST` | `/api/import/search?from=…&to=…&source=google_ads` | import dated query CSV; upsert matching observations |
| `GET` | `/api/history?from=…&to=…` | monthly dated report and customer totals |
| `POST` | `/api/demo/replace` | remove fictional records (requires admin password) |
| `GET` | `/api/export` | CSV export honouring the customer filters |
| `GET` | `/api/import/template` and `/api/import/search/template` | sample CSVs |
| `POST` | `/api/demo/reset` | wipe and reseed the demo data |

---

## Taking it live

1. **Capture real queries.** Verify the site in Search Console, then pull
   `searchanalytics.query` (dimensions: `query`, `page`) into `search_terms`. For paid traffic use the
   Google Ads `search_stream` / search-terms report with the same keyword strings.
2. **Capture real people.** Point your site form at `POST /api/customers`, keeping `q`, `gclid`,
   `utm_*` and the landing page from the URL. Google Ads lead-form extensions can be exported to CSV
   and pushed through `/api/import`.
3. **Keep the join.** Always write the query onto the customer at the moment of enquiry. Retrofitting
   attribution later is the one thing that cannot be recovered.

The seeded dataset is labelled demo data. **Do not use Reset demo data to import real records** — it wipes all records and creates fictional ones. Follow the protected **Replace demo with real data** flow above instead.

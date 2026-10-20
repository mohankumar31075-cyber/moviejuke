'use strict';

/**
 * Deterministic demo dataset for a curtains / blinds / interiors studio.
 *
 * The idea this data models: a customer Googles something like
 * "motorized blinds price bangalore", lands on the studio's site, fills an
 * enquiry form, and the sales team works the lead. Every customer record keeps
 * the exact search term + landing page + gclid that produced it, which is what
 * the dashboard reports on.
 */

const PRODUCTS = [
  {
    slug: 'blackout-curtains',
    name: 'Blackout Curtains',
    category: 'Curtains',
    priceFrom: 3500,
    avgTicket: 18500,
    description: 'Triple-weave blackout drapes with 99% light block, custom stitched.',
  },
  {
    slug: 'sheer-linen-drapes',
    name: 'Sheer Linen Drapes',
    category: 'Curtains',
    priceFrom: 2800,
    avgTicket: 12400,
    description: 'Airy linen sheers for living rooms and balconies.',
  },
  {
    slug: 'custom-curtain-stitching',
    name: 'Custom Curtain Stitching',
    category: 'Curtains',
    priceFrom: 900,
    avgTicket: 5400,
    description: 'Stitching and fitting on customer-supplied fabric.',
  },
  {
    slug: 'motorized-blinds',
    name: 'Motorized Blinds',
    category: 'Blinds',
    priceFrom: 12000,
    avgTicket: 46500,
    description: 'App and remote controlled roller and zebra blinds.',
  },
  {
    slug: 'wooden-venetian-blinds',
    name: 'Wooden Venetian Blinds',
    category: 'Blinds',
    priceFrom: 4500,
    avgTicket: 21800,
    description: 'Basswood slat blinds for studies and bay windows.',
  },
  {
    slug: 'roller-blinds',
    name: 'Roller Blinds',
    category: 'Blinds',
    priceFrom: 2200,
    avgTicket: 11200,
    description: 'Sunscreen and blackout roller blinds, easy retrofit.',
  },
  {
    slug: 'roman-blinds',
    name: 'Roman Blinds',
    category: 'Blinds',
    priceFrom: 3800,
    avgTicket: 17600,
    description: 'Fabric roman shades, tailor-made with soft folds.',
  },
  {
    slug: 'zebra-blinds',
    name: 'Zebra Blinds',
    category: 'Blinds',
    priceFrom: 2600,
    avgTicket: 13800,
    description: 'Dual-layer day/night blinds for balconies and kitchens.',
  },
  {
    slug: 'vertical-blinds',
    name: 'Vertical Blinds',
    category: 'Blinds',
    priceFrom: 1900,
    avgTicket: 9600,
    description: 'Office-grade vertical blinds, bulk installation.',
  },
  {
    slug: 'interior-design-consultation',
    name: 'Interior Design Consultation',
    category: 'Interiors',
    priceFrom: 5000,
    avgTicket: 8500,
    description: 'Paid 90-minute consultation with a senior designer.',
  },
  {
    slug: 'full-home-interiors',
    name: 'Full Home Interiors',
    category: 'Interiors',
    priceFrom: 450000,
    avgTicket: 685000,
    description: 'Turnkey 2BHK / 3BHK interiors, 45-day handover.',
  },
  {
    slug: 'wallpaper-installation',
    name: 'Wallpaper Installation',
    category: 'Interiors',
    priceFrom: 1200,
    avgTicket: 7800,
    description: 'Accent wallpapers with surface prep and installation.',
  },
  {
    slug: 'sofa-upholstery',
    name: 'Sofa Upholstery',
    category: 'Upholstery',
    priceFrom: 6500,
    avgTicket: 24500,
    description: 'Reupholstery and foam replacement for 3+2 sets.',
  },
  {
    slug: 'false-ceiling',
    name: 'False Ceiling',
    category: 'Interiors',
    priceFrom: 85,
    avgTicket: 42000,
    description: 'Gypsum and PVC false ceiling, per sq ft.',
  },
];

// [keyword, product slug, source, impressions, clicks, avg position]
const TERMS = [
  ['blackout curtains bangalore', 'blackout-curtains', 'google_ads', 12400, 992, 1.8],
  ['blackout curtains online india', 'blackout-curtains', 'google_organic', 42800, 2140, 3.4],
  ['curtain stitching near me', 'custom-curtain-stitching', 'google_organic', 9600, 864, 2.1],
  ['curtain stitching bangalore price', 'custom-curtain-stitching', 'google_ads', 5400, 594, 1.4],
  ['motorized blinds price', 'motorized-blinds', 'google_ads', 8100, 729, 1.6],
  ['motorised blinds for home bangalore', 'motorized-blinds', 'google_organic', 3900, 273, 4.2],
  ['wooden venetian blinds', 'wooden-venetian-blinds', 'google_organic', 14800, 740, 6.8],
  ['wooden blinds bangalore', 'wooden-venetian-blinds', 'google_ads', 6600, 594, 2.0],
  ['roller blinds price', 'roller-blinds', 'google_shopping', 33200, 1660, 4.8],
  ['roller blinds for balcony', 'roller-blinds', 'google_organic', 9800, 490, 7.3],
  ['roman blinds online', 'roman-blinds', 'google_organic', 18100, 905, 5.6],
  ['roman blinds living room', 'roman-blinds', 'google_shopping', 7400, 444, 3.9],
  ['zebra blinds for balcony', 'zebra-blinds', 'google_organic', 5900, 354, 4.4],
  ['zebra blinds price bangalore', 'zebra-blinds', 'google_ads', 4200, 462, 1.3],
  ['vertical blinds for office', 'vertical-blinds', 'google_organic', 6800, 272, 8.1],
  ['vertical blinds price per sqft', 'vertical-blinds', 'google_shopping', 5100, 255, 5.2],
  ['sheer curtains for living room', 'sheer-linen-drapes', 'google_organic', 27400, 1096, 6.2],
  ['linen curtains india', 'sheer-linen-drapes', 'google_shopping', 11200, 448, 4.9],
  ['curtains for bedroom', 'blackout-curtains', 'google_organic', 61400, 1843, 9.4],
  ['best blinds for kitchen', 'roller-blinds', 'google_organic', 8900, 267, 11.2],
  ['window blinds dealer near me', 'wooden-venetian-blinds', 'google_ads', 6100, 671, 1.9],
  ['interior designers in bangalore', 'full-home-interiors', 'google_ads', 24100, 1928, 2.4],
  ['interior design for 2bhk', 'full-home-interiors', 'google_organic', 18700, 935, 5.1],
  ['full home interior package price', 'full-home-interiors', 'google_ads', 9300, 837, 2.2],
  ['2 bhk interior cost bangalore', 'full-home-interiors', 'google_organic', 12600, 756, 4.7],
  ['interior design consultation near me', 'interior-design-consultation', 'google_organic', 7800, 390, 6.9],
  ['wallpaper installation cost', 'wallpaper-installation', 'google_ads', 5400, 486, 2.6],
  ['wallpaper for bedroom accent wall', 'wallpaper-installation', 'google_organic', 9700, 388, 9.8],
  ['sofa upholstery bangalore', 'sofa-upholstery', 'google_ads', 4800, 432, 1.7],
  ['sofa reupholstery cost', 'sofa-upholstery', 'google_organic', 7100, 355, 5.9],
  ['false ceiling cost per sqft', 'false-ceiling', 'google_organic', 22300, 1004, 7.6],
  ['false ceiling design for living room', 'false-ceiling', 'google_shopping', 15800, 632, 6.4],
  ['curtains and blinds bangalore', 'blackout-curtains', 'google_ads', 3900, 429, 1.5],
  ['curtain shop near me', 'custom-curtain-stitching', 'google_ads', 14200, 1278, 2.3],
  ['motorized curtains for home', 'motorized-blinds', 'google_organic', 3600, 180, 8.5],
  ['office blinds installation', 'vertical-blinds', 'google_ads', 2900, 232, 3.1],
  ['interior designer whitefield', 'full-home-interiors', 'google_organic', 4100, 246, 5.4],
  ['roman curtains price per meter', 'roman-blinds', 'google_organic', 2600, 130, 12.1],
  ['blackout curtains for baby room', 'blackout-curtains', 'google_shopping', 8800, 528, 4.1],
  ['window blinds online india', 'zebra-blinds', 'google_shopping', 19400, 776, 7.9],
];

const FIRST_NAMES = [
  'Aarav', 'Aditi', 'Advik', 'Aisha', 'Ananya', 'Aniket', 'Anjali', 'Arjun', 'Asha', 'Ashwin',
  'Bhavya', 'Chetan', 'Deepa', 'Dev', 'Dhruv', 'Divya', 'Farhan', 'Gauri', 'Gaurav', 'Harini',
  'Isha', 'Ishan', 'Kavya', 'Karthik', 'Kiran', 'Lakshmi', 'Madhav', 'Meera', 'Mohan', 'Nandini',
  'Neha', 'Nikhil', 'Nithya', 'Pallavi', 'Pooja', 'Pranav', 'Priya', 'Rahul', 'Rakesh', 'Ramya',
  'Ravi', 'Riya', 'Rohan', 'Rohini', 'Sahana', 'Sameer', 'Sanjay', 'Shreya', 'Siddharth', 'Sneha',
  'Sridhar', 'Suhas', 'Swati', 'Tanvi', 'Tara', 'Uday', 'Varun', 'Vedant', 'Vidya', 'Vinay',
  'Yamini', 'Zoya', 'Naveen', 'Shalini', 'Harish', 'Anushka', 'Vikram', 'Preethi', 'Manish', 'Kritika',
];

const LAST_NAMES = [
  'Acharya', 'Agarwal', 'Bhat', 'Bhatia', 'Chandra', 'Desai', 'Gowda', 'Gupta', 'Hegde', 'Iyer',
  'Jain', 'Joshi', 'Kamath', 'Kapoor', 'Kulkarni', 'Kumar', 'Malhotra', 'Menon', 'Mishra', 'Murthy',
  'Nair', 'Naidu', 'Patel', 'Pillai', 'Prasad', 'Rao', 'Reddy', 'Sastry', 'Sen', 'Shah',
  'Sharma', 'Shenoy', 'Shetty', 'Singh', 'Srinivas', 'Suresh', 'Swamy', 'Thomas', 'Varma', 'Verma',
  'Vohra', 'Yadav', 'Bhandari', 'Chowdhury', 'Dutta', 'Krishnan', 'Mehta', 'Nayak', 'Raghavan', 'Tripathi',
];

const CITIES = [
  { name: 'Bengaluru', weight: 56 },
  { name: 'Mysuru', weight: 8 },
  { name: 'Mangaluru', weight: 6 },
  { name: 'Hyderabad', weight: 7 },
  { name: 'Chennai', weight: 5 },
  { name: 'Pune', weight: 5 },
  { name: 'Mumbai', weight: 4 },
  { name: 'Kochi', weight: 3 },
  { name: 'Coimbatore', weight: 3 },
  { name: 'Hubballi', weight: 2 },
  { name: 'Belagavi', weight: 1 },
];

const AREAS = [
  'Whitefield', 'Indiranagar', 'Koramangala', 'HSR Layout', 'Jayanagar', 'Hebbal',
  'Sarjapur Road', 'Electronic City', 'Rajajinagar', 'Malleshwaram', 'Yelahanka',
  'Banashankari', 'JP Nagar', 'Bellandur', 'Marathahalli', 'Basavanagudi', 'Hennur',
];

const OWNERS = ['Aisha Menon', 'Rohan Shetty', 'Meera Iyer', 'Vikram Rao', 'Priya Nair'];

const STAGES = ['new', 'contacted', 'qualified', 'quoted', 'won', 'lost'];

const NOTE_BANK = [
  'Wants blackout in all bedrooms and sheers in the living room. Measured {n} windows.',
  'Site visit done at {area}. Client is comparing with a local vendor — quote pending.',
  'Prefers warm neutrals; asked about a motorised track upgrade later this year.',
  'Fabric already purchased, needs stitching and fitting only.',
  'Budget conscious, asked for EMI options on the full package.',
  'Corporate enquiry for {n} workstations, needs vertical blinds before handover.',
  'New flat handover next month. Wants to start with curtains, interiors later.',
  'Repeat customer — did curtains last year, now wants zebra blinds for the balcony.',
  'Rental property, wants a quick install with easy-to-clean fabric.',
  'Very particular about light bleed in the bedroom; asked for a triple-weave sample.',
  'Wants matching cushions and a runner in the same fabric.',
  'Vastu-conscious about direction of the main door; designer to re-share layout.',
  'Asked for a site visit on Saturday morning.',
  'Renovating a 20-year-old house; needs full false ceiling and curtain overhaul.',
  'Comparing three quotes. Decision expected after the weekend.',
];

const LOST_REASONS = [
  'Chose a local vendor — price was lower by about 12%.',
  'Project postponed to next quarter.',
  'Went with an online marketplace for readymade curtains.',
  'Stopped responding after the quote.',
];

function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

function pickWeighted(rng, list) {
  const total = list.reduce((sum, item) => sum + item.weight, 0);
  let roll = rng() * total;
  for (const item of list) {
    roll -= item.weight;
    if (roll <= 0) return item;
  }
  return list[list.length - 1];
}

function randInt(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function roundTo(value, step) {
  return Math.max(step, Math.round(value / step) * step);
}

function stageFor(rng, ageDays) {
  const r = rng();
  if (ageDays < 2) return r < 0.74 ? 'new' : 'contacted';
  if (ageDays < 7) {
    if (r < 0.26) return 'new';
    if (r < 0.63) return 'contacted';
    if (r < 0.88) return 'qualified';
    return 'quoted';
  }
  if (ageDays < 21) {
    if (r < 0.09) return 'contacted';
    if (r < 0.34) return 'qualified';
    if (r < 0.66) return 'quoted';
    if (r < 0.85) return 'won';
    return 'lost';
  }
  if (r < 0.04) return 'qualified';
  if (r < 0.17) return 'quoted';
  if (r < 0.62) return 'won';
  return 'lost';
}

function gclid(rng) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
  let out = 'Cj0KCQjw';
  for (let i = 0; i < 28; i += 1) out += alphabet[Math.floor(rng() * alphabet.length)];
  return out;
}

function landingPageFor(product) {
  if (product.category === 'Interiors') return `/interiors/${product.slug}`;
  if (product.category === 'Upholstery') return `/services/${product.slug}`;
  return `/collections/${product.slug}`;
}

function seed(db, options = {}) {
  const rng = mulberry32(options.seed || 20261020);
  const now = options.now ? new Date(options.now) : new Date();
  const nowMs = now.getTime();

  const insertProduct = db.prepare(
    'INSERT INTO products (slug, name, category, price_from, avg_ticket, description) VALUES (?, ?, ?, ?, ?, ?)',
  );
  const insertTerm = db.prepare(
    `INSERT INTO search_terms (keyword, product_id, source, impressions, clicks, position, landing_page, first_seen, last_seen)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertCustomer = db.prepare(
    `INSERT INTO customers
      (name, email, phone, city, product_id, search_term_id, source, stage, budget, quote_value, owner, gclid, landing_page, device, notes, created_at, last_activity_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertEvent = db.prepare(
    'INSERT INTO events (customer_id, type, label, occurred_at) VALUES (?, ?, ?, ?)',
  );

  db.exec('BEGIN');
  try {
    const productBySlug = new Map();
    for (const p of PRODUCTS) {
      const info = insertProduct.run(p.slug, p.name, p.category, p.priceFrom, p.avgTicket, p.description);
      productBySlug.set(p.slug, { ...p, id: Number(info.lastInsertRowid) });
    }

    const termRows = [];
    for (const [keyword, slug, source, impressions, clicks, position] of TERMS) {
      const product = productBySlug.get(slug);
      const daysAgo = randInt(rng, 40, 130);
      const firstSeen = new Date(nowMs - daysAgo * 86400000).toISOString();
      const lastSeen = new Date(nowMs - randInt(rng, 0, 2) * 86400000).toISOString();
      const info = insertTerm.run(
        keyword,
        product.id,
        source,
        impressions,
        clicks,
        position,
        landingPageFor(product),
        firstSeen,
        lastSeen,
      );
      termRows.push({ id: Number(info.lastInsertRowid), keyword, product, source, clicks });
    }

    const termWeights = termRows.map((term) => ({ ...term, weight: Math.sqrt(term.clicks) }));
    const usedNames = new Set();
    const usedEmails = new Set();
    const totalCustomers = options.customers || 248;

    for (let i = 0; i < totalCustomers; i += 1) {
      const hasSearchTerm = rng() < 0.84;
      const term = hasSearchTerm ? pickWeighted(rng, termWeights) : null;
      const product = term
        ? term.product
        : productBySlug.get(pick(rng, PRODUCTS).slug);

      let first = pick(rng, FIRST_NAMES);
      let last = pick(rng, LAST_NAMES);
      let attempts = 0;
      while (usedNames.has(`${first} ${last}`) && attempts < 12) {
        last = pick(rng, LAST_NAMES);
        attempts += 1;
      }
      usedNames.add(`${first} ${last}`);
      const name = `${first} ${last}`;

      let email = `${first}.${last}`.toLowerCase().replace(/[^a-z.]/g, '') + `@gmail.com`;
      if (usedEmails.has(email)) email = `${first}.${last}${randInt(rng, 11, 98)}@gmail.com`;
      usedEmails.add(email);

      const phone = `+91 ${pick(rng, ['98', '99', '97', '96', '90', '88', '73', '70'])}${randInt(rng, 100, 999)} ${randInt(rng, 10000, 99999)}`;
      const city = pickWeighted(rng, CITIES).name;
      const area = pick(rng, AREAS);

      // More weight on the recent month, but spread smoothly so no single day spikes.
      const recent = rng() < 0.62;
      const ageDays = recent ? rng() * 30 : 30 + rng() * 90;
      const createdAt = new Date(nowMs - ageDays * 86400000 - randInt(rng, 0, 20) * 3600000);
      const ageAtCreation = (nowMs - createdAt.getTime()) / 86400000;

      const stage = stageFor(rng, ageAtCreation);
      const source = term ? term.source : rng() < 0.55 ? 'direct' : 'referral';
      const budget = roundTo(product.avgTicket * (0.72 + rng() * 0.85), 500);
      const quoted = ['quoted', 'won', 'lost'].includes(stage);
      const quoteValue = quoted ? roundTo(budget * (0.88 + rng() * 0.4), 500) : 0;
      const owner = stage === 'new' && rng() < 0.45 ? null : pick(rng, OWNERS);
      const device = pickWeighted(rng, [
        { value: 'mobile', weight: 66 },
        { value: 'desktop', weight: 28 },
        { value: 'tablet', weight: 6 },
      ]).value;
      const paid = source === 'google_ads';
      const note = pick(rng, NOTE_BANK)
        .replace('{n}', String(randInt(rng, 3, 14)))
        .replace('{area}', area);

      const events = [];
      if (term) {
        events.push({
          type: 'search',
          label: `Searched “${term.keyword}” on Google`,
          at: createdAt.getTime() - randInt(rng, 2, 40) * 60000,
        });
      }
      events.push({
        type: 'form',
        label: `Enquiry form submitted on ${term ? landingPageFor(product) : 'moviejuke.in'}`,
        at: createdAt.getTime(),
      });

      const push = (type, label, afterHours) => {
        const at = createdAt.getTime() + afterHours * 3600000;
        if (at < nowMs - 60000) events.push({ type, label, at });
      };

      if (['contacted', 'qualified', 'quoted', 'won', 'lost'].includes(stage)) {
        push('call', `Intro call — discussed ${product.name.toLowerCase()} requirements`, randInt(rng, 2, 20));
        if (rng() < 0.5) push('whatsapp', 'Shared catalogue and fabric swatches on WhatsApp', randInt(rng, 20, 40));
      }
      if (['qualified', 'quoted', 'won'].includes(stage)) {
        push('site_visit', `Site visit — measured windows at ${area}, ${city}`, randInt(rng, 24, 72));
      }
      if (['quoted', 'won', 'lost'].includes(stage)) {
        push('quote', `Quotation sent — ₹${quoteValue.toLocaleString('en-IN')}`, randInt(rng, 48, 120));
      }
      if (stage === 'won') {
        push('booking', `Advance received — booking confirmed at ₹${quoteValue.toLocaleString('en-IN')}`, randInt(rng, 96, 220));
      }
      if (stage === 'lost') {
        push('note', `Marked lost — ${pick(rng, LOST_REASONS)}`, randInt(rng, 100, 260));
      }

      events.sort((a, b) => a.at - b.at);
      const lastActivity = new Date(events[events.length - 1].at).toISOString();
      const createdAtIso = createdAt.toISOString();

      const info = insertCustomer.run(
        name,
        email,
        phone,
        city,
        product.id,
        term ? term.id : null,
        source,
        stage,
        budget,
        quoteValue,
        owner,
        paid ? gclid(rng) : null,
        term ? landingPageFor(product) : null,
        device,
        note,
        createdAtIso,
        lastActivity,
      );
      const customerId = Number(info.lastInsertRowid);

      for (const event of events) {
        insertEvent.run(customerId, event.type, event.label, new Date(event.at).toISOString());
      }
    }

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

module.exports = { seed, PRODUCTS, TERMS, STAGES };

if (require.main === module) {
  const { resetData, ensureData, DB_PATH } = require('./db');
  const shouldReset = process.argv.includes('--reset');
  const conn = shouldReset ? resetData() : ensureData();
  const counts = {
    products: conn.prepare('SELECT COUNT(*) AS n FROM products').get().n,
    searchTerms: conn.prepare('SELECT COUNT(*) AS n FROM search_terms').get().n,
    customers: conn.prepare('SELECT COUNT(*) AS n FROM customers').get().n,
    events: conn.prepare('SELECT COUNT(*) AS n FROM events').get().n,
  };
  console.log(shouldReset ? 'Demo data reset.' : 'Database ready.');
  console.log(JSON.stringify(counts, null, 2));
  console.log(`Database: ${DB_PATH}`);
}

'use strict';

/**
 * Moviejuke catalog.
 *
 * A curated, hand-written media library used by the demo backend. Metadata is
 * intentionally short-form: the engine in `data/engine.js` expands each record
 * into full detail payloads (cast ordering, episode lists, release/quality
 * matrices, subtitle tracks, provider availability).
 *
 * `k` kind:      m = movie, s = series, a = anime, d = asian drama
 * `pop` popularity 0-100 drives the "Trending" and "Top 10" shelves.
 * `col` accent colour used by the procedural cover-art renderer.
 */

const TITLES = [
  // ---------------------------------------------------------------- movies
  {
    t: 'Dune: Part Two', y: 2024, k: 'm', r: 8.7, rt: 166, pop: 99, col: '#e0a35c',
    g: ['Sci-Fi', 'Adventure', 'Drama'], lg: ['English', 'Chakobsa'],
    d: 'Denis Villeneuve', c: ['Timothée Chalamet', 'Zendaya', 'Rebecca Ferguson', 'Austin Butler'],
    s: 'Paul Atreides unites with the Fremen of Arrakis to wage war against the House that destroyed his family, while visions of a holy war he cannot stop tear at his sense of self.',
  },
  {
    t: 'Oppenheimer', y: 2023, k: 'm', r: 8.5, rt: 181, pop: 96, col: '#f0b429',
    g: ['Biography', 'Drama', 'History'], lg: ['English'],
    d: 'Christopher Nolan', c: ['Cillian Murphy', 'Emily Blunt', 'Robert Downey Jr.', 'Matt Damon'],
    s: 'The theoretical physicist who built the bomb watches his own creation rewrite the world, and then faces the political machinery that wants to disown him for it.',
  },
  {
    t: 'Everything Everywhere All at Once', y: 2022, k: 'm', r: 8.1, rt: 139, pop: 92, col: '#8b5cf6',
    g: ['Sci-Fi', 'Comedy', 'Action'], lg: ['English', 'Mandarin', 'Cantonese'],
    d: 'Daniel Kwan', c: ['Michelle Yeoh', 'Ke Huy Quan', 'Stephanie Hsu', 'Jamie Lee Curtis'],
    s: 'A laundromat owner drowning in tax paperwork discovers she is the only version of herself who can hold the multiverse together — and the villain is her own daughter.',
  },
  {
    t: 'The Batman', y: 2022, k: 'm', r: 7.9, rt: 176, pop: 90, col: '#c2410c',
    g: ['Crime', 'Mystery', 'Action'], lg: ['English'],
    d: 'Matt Reeves', c: ['Robert Pattinson', 'Zoë Kravitz', 'Paul Dano', 'Colin Farrell'],
    s: 'Two years into a war on crime, a masked vigilante follows a serial killer through a city built on rot, and learns that his own family name is part of the foundation.',
  },
  {
    t: 'Past Lives', y: 2023, k: 'm', r: 8.0, rt: 106, pop: 84, col: '#38bdf8',
    g: ['Romance', 'Drama'], lg: ['English', 'Korean'],
    d: 'Celine Song', c: ['Greta Lee', 'Teo Yoo', 'John Magaro'],
    s: 'Two childhood friends separated by emigration reunite for one week in New York, measuring the life they could have had against the life each of them actually chose.',
  },
  {
    t: 'Everything Is Fine in the Deep', y: 2025, k: 'm', r: 7.6, rt: 128, pop: 81, col: '#0ea5e9',
    g: ['Sci-Fi', 'Thriller'], lg: ['English', 'Portuguese'],
    d: 'Ana Duarte', c: ['Lena Ortiz', 'Sam Whitfield', 'Yuki Tanaka'],
    s: 'A salvage crew two kilometres down picks up a distress beacon from a station that was decommissioned nine years ago — and hears their own voices answering it.',
  },
  {
    t: 'The Quiet Hour', y: 2024, k: 'm', r: 7.8, rt: 118, pop: 78, col: '#64748b',
    g: ['Thriller', 'Drama'], lg: ['English'],
    d: 'Marco Bell', c: ['Rebecca Hall', 'Idris Kane', 'Sofia Marchetti'],
    s: 'A night-shift negotiator takes one last call from a man barricaded inside a bank, and slowly realises the hostage on the other end of the line is someone she buried years ago.',
  },
  {
    t: 'Paper Lanterns', y: 2024, k: 'm', r: 8.2, rt: 122, pop: 76, col: '#f472b6',
    g: ['Animation', 'Fantasy', 'Family'], lg: ['Japanese', 'English'],
    d: 'Rin Kadowaki', c: ['Aoi Mizuno', 'Kenji Sudo', 'Hana Ito'],
    s: 'On the night of the lantern festival, a grieving girl trades her memories to a river spirit to bring one summer back — and then has to live inside the summer she bought.',
  },
  {
    t: 'Furiosa: A Mad Max Saga', y: 2024, k: 'm', r: 7.7, rt: 148, pop: 88, col: '#f97316',
    g: ['Action', 'Adventure', 'Sci-Fi'], lg: ['English'],
    d: 'George Miller', c: ['Anya Taylor-Joy', 'Chris Hemsworth', 'Tom Burke'],
    s: 'Taken from the green place as a child, a young driver climbs through fifteen years of warlord politics to reach the citadel she intends to take back.',
  },
  {
    t: 'Godzilla Minus One', y: 2023, k: 'm', r: 8.3, rt: 125, pop: 89, col: '#ef4444',
    g: ['Action', 'Sci-Fi', 'Drama'], lg: ['Japanese'],
    d: 'Takashi Yamazaki', c: ['Ryunosuke Kamiki', 'Minami Hamabe', 'Yuki Yamada'],
    s: 'In the rubble of a defeated nation, a disgraced pilot gets a second war he never volunteered for and a chance to be brave in exactly the way he failed to be.',
  },
  {
    t: 'Anatomy of a Fall', y: 2023, k: 'm', r: 7.7, rt: 151, pop: 74, col: '#94a3b8',
    g: ['Drama', 'Mystery'], lg: ['French', 'English', 'German'],
    d: 'Justine Triet', c: ['Sandra Hüller', 'Swann Arlaud', 'Milo Machado-Graner'],
    s: 'A novelist stands trial for her husband\'s death while their partially blind son becomes the only witness — and the court decides which version of a marriage to believe.',
  },
  {
    t: 'Poor Things', y: 2023, k: 'm', r: 7.9, rt: 141, pop: 82, col: '#a855f7',
    g: ['Comedy', 'Romance', 'Sci-Fi'], lg: ['English'],
    d: 'Yorgos Lanthimos', c: ['Emma Stone', 'Mark Ruffalo', 'Willem Dafoe', 'Ramy Youssef'],
    s: 'A woman revived by an unorthodox surgeon leaves his house to eat, travel, argue and sleep her way through a Europe that has no idea what to do with her.',
  },
  {
    t: 'Knives Out', y: 2019, k: 'm', r: 7.9, rt: 130, pop: 79, col: '#22c55e',
    g: ['Mystery', 'Comedy', 'Crime'], lg: ['English'],
    d: 'Rian Johnson', c: ['Daniel Craig', 'Ana de Armas', 'Chris Evans', 'Jamie Lee Curtis'],
    s: 'A death in a mansion full of novelists and leeches, one very polite detective, and a nurse who cannot lie without losing her lunch.',
  },
  {
    t: 'Top Gun: Maverick', y: 2022, k: 'm', r: 8.2, rt: 130, pop: 86, col: '#0ea5e9',
    g: ['Action', 'Drama'], lg: ['English'],
    d: 'Joseph Kosinski', c: ['Tom Cruise', 'Miles Teller', 'Jennifer Connelly', 'Jon Hamm'],
    s: 'The fastest pilot in the fleet is sent back to teach a mission nobody expects to survive, including the son of the man he let die.',
  },
  {
    t: 'Sicario', y: 2015, k: 'm', r: 7.6, rt: 121, pop: 68, col: '#b45309',
    g: ['Crime', 'Thriller', 'Action'], lg: ['English', 'Spanish'],
    d: 'Denis Villeneuve', c: ['Emily Blunt', 'Benicio del Toro', 'Josh Brolin'],
    s: 'An FBI agent is drafted into a black-bag task force on the border and discovers that the rulebook she carries was never part of the plan.',
  },
  {
    t: 'Arrival', y: 2016, k: 'm', r: 7.9, rt: 116, pop: 72, col: '#475569',
    g: ['Sci-Fi', 'Drama', 'Mystery'], lg: ['English', 'Mandarin'],
    d: 'Denis Villeneuve', c: ['Amy Adams', 'Jeremy Renner', 'Forest Whitaker'],
    s: 'A linguist is asked to talk to something that experiences time the way a river experiences a bend, and the conversation changes how she will remember her own life.',
  },
  {
    t: 'La La Land', y: 2016, k: 'm', r: 8.0, rt: 128, pop: 75, col: '#6366f1',
    g: ['Romance', 'Musical', 'Drama'], lg: ['English'],
    d: 'Damien Chazelle', c: ['Ryan Gosling', 'Emma Stone', 'John Legend'],
    s: 'A jazz pianist and an actress fall in love in a city that rewards ambition and charges interest on it.',
  },
  {
    t: 'Get Out', y: 2017, k: 'm', r: 7.7, rt: 104, pop: 71, col: '#16a34a',
    g: ['Horror', 'Mystery', 'Thriller'], lg: ['English'],
    d: 'Jordan Peele', c: ['Daniel Kaluuya', 'Allison Williams', 'Catherine Keener'],
    s: 'A weekend at his girlfriend\'s family estate turns into the slowest, politest nightmare a photographer has ever been trapped inside.',
  },
  {
    t: 'Spider-Man: Across the Spider-Verse', y: 2023, k: 'm', r: 8.6, rt: 140, pop: 95, col: '#ec4899',
    g: ['Animation', 'Action', 'Adventure'], lg: ['English', 'Spanish'],
    d: 'Joaquim Dos Santos', c: ['Shameik Moore', 'Hailee Steinfeld', 'Oscar Isaac', 'Jake Johnson'],
    s: 'Miles Morales runs out of patience with a society of spiders that insists every story — including his father\'s — has to end the same way.',
  },
  {
    t: 'Whiplash', y: 2014, k: 'm', r: 8.5, rt: 106, pop: 70, col: '#f59e0b',
    g: ['Drama', 'Music'], lg: ['English'],
    d: 'Damien Chazelle', c: ['Miles Teller', 'J.K. Simmons', 'Melissa Benoist'],
    s: 'A drummer bleeds on the kit for a conductor who believes cruelty is the only honest teacher, and neither of them can stop.',
  },
  {
    t: 'The Zone of Interest', y: 2023, k: 'm', r: 7.4, rt: 105, pop: 61, col: '#65a30d',
    g: ['Drama', 'History'], lg: ['German', 'Polish'],
    d: 'Jonathan Glazer', c: ['Christian Friedel', 'Sandra Hüller'],
    s: 'A commandant and his wife build their dream garden beside a wall they have trained themselves never to hear through.',
  },
  {
    t: 'Perfect Days', y: 2023, k: 'm', r: 7.9, rt: 124, pop: 64, col: '#0d9488',
    g: ['Drama'], lg: ['Japanese'],
    d: 'Wim Wenders', c: ['Kōji Yakusho', 'Tokio Emoto', 'Arisa Nakano'],
    s: 'A Tokyo cleaner keeps a small, exact life of cassette tapes, tree photographs and public toilets, until a visit from the past asks him to justify it.',
  },
  {
    t: 'Civil War', y: 2024, k: 'm', r: 7.2, rt: 109, pop: 77, col: '#dc2626',
    g: ['Action', 'Drama', 'Thriller'], lg: ['English'],
    d: 'Alex Garland', c: ['Kirsten Dunst', 'Wagner Moura', 'Cailee Spaeny', 'Stephen McKinley Henderson'],
    s: 'A press convoy drives toward a capital under siege, documenting a country that has stopped agreeing on what it is.',
  },
  {
    t: 'The Grand Budapest Hotel', y: 2014, k: 'm', r: 8.1, rt: 99, pop: 66, col: '#f472b6',
    g: ['Comedy', 'Adventure', 'Crime'], lg: ['English', 'French'],
    d: 'Wes Anderson', c: ['Ralph Fiennes', 'Tony Revolori', 'Saoirse Ronan', 'Adrien Brody'],
    s: 'A legendary concierge and his lobby boy protect a painting, an inheritance and a way of being polite while a continent falls apart.',
  },
  {
    t: 'Challengers', y: 2024, k: 'm', r: 7.3, rt: 131, pop: 80, col: '#a3e635',
    g: ['Drama', 'Romance', 'Sport'], lg: ['English'],
    d: 'Luca Guadagnino', c: ['Zendaya', 'Josh O\'Connor', 'Mike Faist'],
    s: 'Three tennis players, one very old grudge and a challenger final that is really a fifteen-year argument about who wanted it more.',
  },
  {
    t: 'Sisu', y: 2022, k: 'm', r: 6.9, rt: 91, pop: 58, col: '#78716c',
    g: ['Action', 'War'], lg: ['Finnish', 'English'],
    d: 'Jalmari Helander', c: ['Jorma Tommila', 'Aksel Hennie', 'Jack Doolan'],
    s: 'An old prospector and his dog, one bag of gold, and a retreating column of soldiers who picked the wrong stretch of Lapland to steal from.',
  },
  {
    t: 'Blue Hour Express', y: 2025, k: 'm', r: 7.5, rt: 111, pop: 69, col: '#1d4ed8',
    g: ['Drama', 'Romance'], lg: ['French', 'English'],
    d: 'Camille Renard', c: ['Noémie Barre', 'Idris Kane', 'Petra Novak'],
    s: 'Two strangers stuck on an overnight train decide to tell each other only true things until morning, which turns out to be much harder than lying.',
  },
  {
    t: 'Nightingale Protocol', y: 2025, k: 'm', r: 7.1, rt: 134, pop: 73, col: '#7c3aed',
    g: ['Thriller', 'Sci-Fi'], lg: ['English', 'German'],
    d: 'Klara Voss', c: ['Anneke Dreyer', 'Marcus Cole', 'Hideo Sato'],
    s: 'A hospital AI begins triaging patients by a rule set nobody wrote, and the surgeon who trained it has one night to find out what it is optimising for.',
  },

  // ---------------------------------------------------------------- series
  {
    t: 'Severance', y: 2022, k: 's', r: 8.7, rt: 52, pop: 97, col: '#0ea5e9', seasons: 2, eps: 9,
    g: ['Sci-Fi', 'Thriller', 'Mystery'], lg: ['English'],
    d: 'Dan Erickson', c: ['Adam Scott', 'Britt Lower', 'Tramell Tillman', 'Patricia Arquette'],
    s: 'Employees at a company that separates work memories from home memories begin to notice that the two halves of their lives are keeping secrets from each other.',
  },
  {
    t: 'Shōgun', y: 2024, k: 's', r: 8.8, rt: 60, pop: 94, col: '#dc2626', seasons: 1, eps: 10,
    g: ['Drama', 'History', 'War'], lg: ['Japanese', 'English'],
    d: 'Justin Marks', c: ['Hiroyuki Sanada', 'Anna Sawai', 'Cosmo Jarvis', 'Tadanobu Asano'],
    s: 'An English pilot shipwrecks into a Japan on the edge of civil war, and becomes a piece on a board where every player has already counted him.',
  },
  {
    t: 'The Bear', y: 2022, k: 's', r: 8.6, rt: 34, pop: 91, col: '#f97316', seasons: 3, eps: 10,
    g: ['Drama', 'Comedy'], lg: ['English'],
    d: 'Christopher Storer', c: ['Jeremy Allen White', 'Ayo Edebiri', 'Ebon Moss-Bachrach', 'Liza Colón-Zayas'],
    s: 'A fine-dining chef inherits his brother\'s sandwich shop and tries to run a kitchen while grief keeps walking in through the back door.',
  },
  {
    t: 'Succession', y: 2018, k: 's', r: 8.9, rt: 60, pop: 87, col: '#334155', seasons: 4, eps: 10,
    g: ['Drama', 'Comedy'], lg: ['English'],
    d: 'Jesse Armstrong', c: ['Brian Cox', 'Jeremy Strong', 'Sarah Snook', 'Kieran Culkin'],
    s: 'Four adult children circle a media empire and a father who will never say which of them he actually rates.',
  },
  {
    t: 'Better Call Saul', y: 2015, k: 's', r: 9.0, rt: 46, pop: 85, col: '#eab308', seasons: 6, eps: 10,
    g: ['Crime', 'Drama'], lg: ['English'],
    d: 'Vince Gilligan', c: ['Bob Odenkirk', 'Rhea Seehorn', 'Jonathan Banks', 'Giancarlo Esposito'],
    s: 'A struggling public defender becomes the lawyer he always claimed to be, one small compromise at a time.',
  },
  {
    t: 'Dark', y: 2017, k: 's', r: 8.7, rt: 55, pop: 78, col: '#1e293b', seasons: 3, eps: 8,
    g: ['Sci-Fi', 'Mystery', 'Thriller'], lg: ['German'],
    d: 'Baran bo Odar', c: ['Louis Hofmann', 'Lisa Vicari', 'Oliver Masucci'],
    s: 'When two children vanish from a small German town, four families discover that the missing are not lost — they are simply early.',
  },
  {
    t: 'Chernobyl', y: 2019, k: 's', r: 9.3, rt: 65, pop: 84, col: '#84cc16', seasons: 1, eps: 5,
    g: ['Drama', 'History', 'Thriller'], lg: ['English'],
    d: 'Craig Mazin', c: ['Jared Harris', 'Stellan Skarsgård', 'Emily Watson'],
    s: 'The people who cleaned up an unthinkable accident, and the scientists who had to argue with a state that preferred a comfortable lie.',
  },
  {
    t: 'The Last of Us', y: 2023, k: 's', r: 8.7, rt: 58, pop: 90, col: '#4b5563', seasons: 1, eps: 9,
    g: ['Drama', 'Horror', 'Adventure'], lg: ['English'],
    d: 'Craig Mazin', c: ['Pedro Pascal', 'Bella Ramsey', 'Nick Offerman'],
    s: 'A smuggler escorts a teenager across a ruined country because she may be the only person alive who does not have to become a monster.',
  },
  {
    t: 'Andor', y: 2022, k: 's', r: 8.5, rt: 47, pop: 83, col: '#f59e0b', seasons: 2, eps: 12,
    g: ['Sci-Fi', 'Drama', 'Thriller'], lg: ['English'],
    d: 'Tony Gilroy', c: ['Diego Luna', 'Stellan Skarsgård', 'Genevieve O\'Reilly', 'Adria Arjona'],
    s: 'A thief becomes a revolutionary inside an empire whose real weapon is paperwork, and every favour he accepts costs someone else everything.',
  },
  {
    t: 'True Detective', y: 2014, k: 's', r: 8.9, rt: 55, pop: 72, col: '#0f766e', seasons: 4, eps: 8,
    g: ['Crime', 'Mystery', 'Drama'], lg: ['English'],
    d: 'Nic Pizzolatto', c: ['Matthew McConaughey', 'Woody Harrelson', 'Jodie Foster', 'Mahershala Ali'],
    s: 'An anthology of investigations that damage the detectives as much as the crime scene, told in the flat, exhausted voice of people who lived it.',
  },
  {
    t: 'Slow Horses', y: 2022, k: 's', r: 8.4, rt: 45, pop: 74, col: '#475569', seasons: 4, eps: 6,
    g: ['Thriller', 'Crime', 'Comedy'], lg: ['English'],
    d: 'Will Smith', c: ['Gary Oldman', 'Jack Lowden', 'Kristin Scott Thomas'],
    s: 'The intelligence service\'s least wanted agents, parked in a building that smells like failure, keep stumbling into the cases nobody else wants to own.',
  },
  {
    t: 'Silo', y: 2023, k: 's', r: 8.1, rt: 50, pop: 76, col: '#7f1d1d', seasons: 2, eps: 10,
    g: ['Sci-Fi', 'Mystery', 'Drama'], lg: ['English'],
    d: 'Graham Yost', c: ['Rebecca Ferguson', 'Tim Robbins', 'Common'],
    s: 'Ten thousand people live in a buried tower where asking about the outside is a capital offence, and history has been quietly edited.',
  },
  {
    t: 'Fallout', y: 2024, k: 's', r: 8.4, rt: 62, pop: 88, col: '#eab308', seasons: 1, eps: 8,
    g: ['Sci-Fi', 'Adventure', 'Comedy'], lg: ['English'],
    d: 'Graham Wagner', c: ['Ella Purnell', 'Walton Goggins', 'Aaron Moten'],
    s: 'A vault dweller walks out into a wasteland that has been waiting two centuries for someone naive enough to try and fix it.',
  },
  {
    t: 'The White Lotus', y: 2021, k: 's', r: 8.0, rt: 60, pop: 79, col: '#14b8a6', seasons: 3, eps: 7,
    g: ['Drama', 'Comedy', 'Mystery'], lg: ['English'],
    d: 'Mike White', c: ['Jennifer Coolidge', 'Murray Bartlett', 'Aubrey Plaza', 'Natasha Rothwell'],
    s: 'Wealthy guests, exhausted staff, and a week at a resort where privilege always checks out with a body count.',
  },
  {
    t: 'Peaky Blinders', y: 2013, k: 's', r: 8.8, rt: 55, pop: 73, col: '#1f2937', seasons: 6, eps: 6,
    g: ['Crime', 'Drama'], lg: ['English'],
    d: 'Steven Knight', c: ['Cillian Murphy', 'Helen McCrory', 'Paul Anderson', 'Tom Hardy'],
    s: 'A family of Birmingham bookmakers expands from street gang to legitimate empire, with all the smoke, suits and wounds that transition requires.',
  },
  {
    t: 'Stranger Things', y: 2016, k: 's', r: 8.7, rt: 51, pop: 89, col: '#dc2626', seasons: 4, eps: 9,
    g: ['Sci-Fi', 'Horror', 'Drama'], lg: ['English'],
    d: 'The Duffer Brothers', c: ['Millie Bobby Brown', 'Finn Wolfhard', 'Winona Ryder', 'David Harbour'],
    s: 'Children on bicycles versus an interdimensional predator, an inept laboratory, and a small town that would rather not talk about any of it.',
  },
  {
    t: 'House of the Dragon', y: 2022, k: 's', r: 8.4, rt: 63, pop: 82, col: '#991b1b', seasons: 2, eps: 9,
    g: ['Fantasy', 'Drama', 'War'], lg: ['English'],
    d: 'Ryan Condal', c: ['Emma D\'Arcy', 'Matt Smith', 'Olivia Cooke', 'Ewan Mitchell'],
    s: 'Two branches of one family inherit an iron chair and dispute it with dragons, which is exactly as expensive as it sounds.',
  },
  {
    t: 'Fleabag', y: 2016, k: 's', r: 8.7, rt: 27, pop: 67, col: '#be123c', seasons: 2, eps: 6,
    g: ['Comedy', 'Drama'], lg: ['English'],
    d: 'Phoebe Waller-Bridge', c: ['Phoebe Waller-Bridge', 'Andrew Scott', 'Olivia Colman'],
    s: 'A woman narrates her own disasters directly to you, until someone spots her doing it and asks who exactly she is talking to.',
  },
  {
    t: 'Station Eleven', y: 2021, k: 's', r: 8.0, rt: 55, pop: 60, col: '#0e7490', seasons: 1, eps: 10,
    g: ['Drama', 'Sci-Fi'], lg: ['English'],
    d: 'Patrick Somerville', c: ['Mackenzie Davis', 'Himesh Patel', 'Matilda Lawler', 'Danielle Deadwyler'],
    s: 'Twenty years after a flu ends the world, a travelling Shakespeare troupe argues that survival without art is just a longer way of dying.',
  },

  // ---------------------------------------------------------------- anime
  {
    t: 'Frieren: Beyond Journey\'s End', y: 2023, k: 'a', r: 9.0, rt: 25, pop: 93, col: '#60a5fa', seasons: 1, eps: 28,
    g: ['Animation', 'Fantasy', 'Adventure'], lg: ['Japanese', 'English'],
    d: 'Keiichirō Saitō', c: ['Atsumi Tanezaki', 'Kana Ichinose', 'Chiaki Kobayashi'],
    s: 'An elf mage outlives the party that saved the world, and only afterwards starts to wonder who they actually were.',
  },
  {
    t: 'Arcane', y: 2021, k: 'a', r: 9.0, rt: 42, pop: 92, col: '#7c3aed', seasons: 2, eps: 9,
    g: ['Animation', 'Action', 'Drama'], lg: ['English'],
    d: 'Christian Linke', c: ['Hailee Steinfeld', 'Ella Purnell', 'Kevin Alejandro'],
    s: 'Two sisters on opposite sides of a city divided by height, magic and money, each certain the other one chose wrong.',
  },
  {
    t: 'Attack on Titan', y: 2013, k: 'a', r: 9.1, rt: 24, pop: 90, col: '#b45309', seasons: 4, eps: 25,
    g: ['Animation', 'Action', 'Fantasy'], lg: ['Japanese', 'English'],
    d: 'Tetsurō Araki', c: ['Yuki Kaji', 'Marina Inoue', 'Yui Ishikawa'],
    s: 'Humanity lives behind three walls and one lie, until the day the tallest wall stops being the tallest thing in the world.',
  },
  {
    t: 'Vinland Saga', y: 2019, k: 'a', r: 8.8, rt: 24, pop: 79, col: '#0369a1', seasons: 2, eps: 24,
    g: ['Animation', 'Action', 'History'], lg: ['Japanese'],
    d: 'Shūhei Yabuta', c: ['Yūto Uemura', 'Shunsuke Takeuchi', 'Yūko Kobayashi'],
    s: 'A boy raised on revenge travels through a Viking age that keeps offering him a life instead, and he keeps refusing it.',
  },
  {
    t: 'Chainsaw Man', y: 2022, k: 'a', r: 8.5, rt: 24, pop: 81, col: '#ea580c', seasons: 1, eps: 12,
    g: ['Animation', 'Action', 'Horror'], lg: ['Japanese', 'English'],
    d: 'Ryū Nakayama', c: ['Kikunosuke Toya', 'Tomori Kusunoki', 'Shōgo Sakata'],
    s: 'A boy with a chainsaw heart makes a deal with a devil, then discovers the bureau he signs with has its own paperwork about hell.',
  },
  {
    t: 'Jujutsu Kaisen', y: 2020, k: 'a', r: 8.6, rt: 24, pop: 85, col: '#4338ca', seasons: 2, eps: 24,
    g: ['Animation', 'Action', 'Supernatural'], lg: ['Japanese', 'English'],
    d: 'Sunghoo Park', c: ['Junya Enoki', 'Yuma Uchida', 'Yūichi Nakamura'],
    s: 'A high schooler swallows a cursed finger to save a friend and becomes the temporary container for something that would rather eat the world.',
  },
  {
    t: 'Frieren: The Northern Journey', y: 2026, k: 'a', r: 8.9, rt: 25, pop: 87, col: '#818cf8', seasons: 1, eps: 24,
    g: ['Animation', 'Fantasy', 'Adventure'], lg: ['Japanese'],
    d: 'Keiichirō Saitō', c: ['Atsumi Tanezaki', 'Kana Ichinose', 'Nobuhiko Okamoto'],
    s: 'The party pushes into snow country where the magic is thin, the villages are older than the empire, and mages who travel slowly are the only ones who arrive.',
  },
  {
    t: 'Spy x Family', y: 2022, k: 'a', r: 8.5, rt: 24, pop: 80, col: '#f472b6', seasons: 3, eps: 12,
    g: ['Animation', 'Comedy', 'Action'], lg: ['Japanese', 'English'],
    d: 'Kazuhiro Furuhashi', c: ['Takuya Eguchi', 'Atsumi Tanezaki', 'Saori Hayami'],
    s: 'A spy needs a family for cover, so he gets a wife who is an assassin and a daughter who reads minds, and none of them will admit anything.',
  },
  {
    t: 'Cyberpunk: Edgerunners', y: 2022, k: 'a', r: 8.6, rt: 25, pop: 77, col: '#eab308', seasons: 1, eps: 10,
    g: ['Animation', 'Sci-Fi', 'Action'], lg: ['English', 'Japanese'],
    d: 'Hiroyuki Imaishi', c: ['Zach Aguilar', 'Emi Lo', 'Giancarlo Esposito'],
    s: 'A street kid with more chrome than sense runs with a crew of edgerunners in a city that sells you the rope it hangs you with.',
  },
  {
    t: 'Mob Psycho 100', y: 2016, k: 'a', r: 8.6, rt: 24, pop: 66, col: '#22d3ee', seasons: 3, eps: 12,
    g: ['Animation', 'Comedy', 'Supernatural'], lg: ['Japanese', 'English'],
    d: 'Yuzuru Tachikawa', c: ['Setsuo Ito', 'Takahiro Sakurai', 'Miyu Irino'],
    s: 'The most powerful esper in the city just wants to be normal, and his con-artist mentor is oddly supportive of that dream.',
  },
  {
    t: 'Steins;Gate', y: 2011, k: 'a', r: 9.0, rt: 24, pop: 71, col: '#0891b2', seasons: 1, eps: 24,
    g: ['Animation', 'Sci-Fi', 'Thriller'], lg: ['Japanese', 'English'],
    d: 'Hiroshi Hamasaki', c: ['Mamoru Miyano', 'Asami Imai', 'Kana Hanazawa'],
    s: 'A self-declared mad scientist accidentally builds a microwave that texts the past, and then spends the rest of the show trying to unsend one of them.',
  },
  {
    t: 'Violet Evergarden', y: 2018, k: 'a', r: 8.7, rt: 24, pop: 63, col: '#a78bfa', seasons: 1, eps: 13,
    g: ['Animation', 'Drama', 'Fantasy'], lg: ['Japanese', 'English'],
    d: 'Taichi Ishidate', c: ['Yui Ishikawa', 'Daisuke Namikawa', 'Takehito Koyasu'],
    s: 'A former child soldier takes a job writing other people\'s letters and slowly learns what the words she is typing are supposed to feel like.',
  },
  {
    t: 'Demon Slayer', y: 2019, k: 'a', r: 8.6, rt: 24, pop: 86, col: '#0f766e', seasons: 4, eps: 26,
    g: ['Animation', 'Action', 'Fantasy'], lg: ['Japanese', 'English'],
    d: 'Haruo Sotozaki', c: ['Natsuki Hanae', 'Akari Kitō', 'Hiro Shimono'],
    s: 'After his family is killed, a young swordsman joins a corps with a breathing technique and a sister who must not be allowed to see the moon.',
  },

  // ---------------------------------------------------------------- asian drama
  {
    t: 'Crash Landing on You', y: 2019, k: 'd', r: 8.7, rt: 70, pop: 75, col: '#0369a1', seasons: 1, eps: 16,
    g: ['Romance', 'Drama', 'Comedy'], lg: ['Korean'],
    d: 'Lee Jung-hyo', c: ['Hyun Bin', 'Son Ye-jin', 'Seo Ji-hye', 'Kim Jung-hyun'],
    s: 'A paragliding accident drops a South Korean heiress into the wrong half of the peninsula, where a soldier hides her and improvises a life for her.',
  },
  {
    t: 'Squid Game', y: 2021, k: 'd', r: 8.0, rt: 55, pop: 91, col: '#e11d48', seasons: 2, eps: 9,
    g: ['Thriller', 'Drama', 'Survival'], lg: ['Korean'],
    d: 'Hwang Dong-hyuk', c: ['Lee Jung-jae', 'Park Hae-soo', 'Wi Ha-joon', 'Jung Ho-yeon'],
    s: 'Four hundred and fifty-six debtors take a written invitation to play children\'s games for a prize that is settled in the only currency they all have left.',
  },
  {
    t: 'Alice in Borderland', y: 2020, k: 'd', r: 8.0, rt: 50, pop: 76, col: '#4c1d95', seasons: 3, eps: 8,
    g: ['Thriller', 'Sci-Fi', 'Survival'], lg: ['Japanese'],
    d: 'Shinsuke Satō', c: ['Kento Yamazaki', 'Tao Tsuchiya', 'Nijirō Murakami'],
    s: 'Three friends wake in an abandoned Tokyo where survival is a card game, and the number on the card decides how many people have to lose.',
  },
  {
    t: 'The Glory', y: 2022, k: 'd', r: 8.5, rt: 62, pop: 78, col: '#581c87', seasons: 1, eps: 16,
    g: ['Thriller', 'Drama'], lg: ['Korean'],
    d: 'Ahn Gil-ho', c: ['Song Hye-kyo', 'Lee Do-hyun', 'Lim Ji-yeon'],
    s: 'A woman who was burned, filmed and dismissed as a child grows up, picks a target, and becomes the teacher in her tormentor\'s house.',
  },
  {
    t: 'My Mister', y: 2018, k: 'd', r: 9.1, rt: 65, pop: 62, col: '#334155', seasons: 1, eps: 16,
    g: ['Drama'], lg: ['Korean'],
    d: 'Kim Won-seok', c: ['Lee Sun-kyun', 'IU', 'Park Ho-san'],
    s: 'A tired engineer and a contractor with nothing to lose decide, separately, to be decent to each other, and it is the most radical thing either of them does.',
  },
  {
    t: 'Hospital Playlist', y: 2020, k: 'd', r: 8.9, rt: 90, pop: 68, col: '#0f766e', seasons: 2, eps: 12,
    g: ['Drama', 'Comedy', 'Music'], lg: ['Korean'],
    d: 'Shin Won-ho', c: ['Cho Jung-seok', 'Yoo Yeon-seok', 'Jung Kyung-ho', 'Jeon Mi-do'],
    s: 'Five doctors who met in medical school keep a band, a hospital and twenty years of friendship running on the same ragged schedule.',
  },
  {
    t: 'Kingdom', y: 2019, k: 'd', r: 8.4, rt: 50, pop: 70, col: '#7f1d1d', seasons: 2, eps: 6,
    g: ['Horror', 'History', 'Thriller'], lg: ['Korean'],
    d: 'Kim Seong-hun', c: ['Ju Ji-hoon', 'Ryu Seung-ryong', 'Bae Doona'],
    s: 'A crown prince investigating his father\'s illness finds a hunger spreading through a kingdom already sick with politics.',
  },
  {
    t: 'Move to Heaven', y: 2021, k: 'd', r: 8.8, rt: 50, pop: 59, col: '#0e7490', seasons: 1, eps: 10,
    g: ['Drama'], lg: ['Korean'],
    d: 'Kim Sung-ho', c: ['Tang Joon-sang', 'Lee Je-hoon', 'Hong Seung-hee'],
    s: 'A young man with Asperger\'s and his estranged uncle clear the rooms of the dead, telling the last stories of people nobody else came for.',
  },
  {
    t: 'Itaewon Class', y: 2020, k: 'd', r: 8.2, rt: 70, pop: 65, col: '#b91c1c', seasons: 1, eps: 16,
    g: ['Drama', 'Business'], lg: ['Korean'],
    d: 'Kim Sung-yoon', c: ['Park Seo-joon', 'Kim Da-mi', 'Yoo Jae-myung'],
    s: 'An ex-convict opens a bar in Itaewon with a crew of misfits and a ten-year plan to take down the food conglomerate that ruined his family.',
  },
  {
    t: 'Tokyo Midnight Diner', y: 2024, k: 'd', r: 8.3, rt: 28, pop: 57, col: '#a16207', seasons: 1, eps: 10,
    g: ['Drama', 'Slice of Life'], lg: ['Japanese'],
    d: 'Yuki Hara', c: ['Sōsuke Takaoka', 'Nanako Matsushima', 'Kōji Kikkawa'],
    s: 'A tiny Tokyo kitchen opens at midnight and serves one dish per customer, which is never really about the food.',
  },
];

/** Fictional live-TV lineup for the M3U/EPG panel. */
const CHANNELS = [
  { t: 'Moviejuke One', cat: 'Movies', region: 'Global', col: '#e11d48', hd: '4K', lang: 'English', bitrate: '18.4 Mbps' },
  { t: 'Cine Juke HD', cat: 'Movies', region: 'Global', col: '#be123c', hd: '1080p', lang: 'English', bitrate: '9.2 Mbps' },
  { t: 'Film Noir Channel', cat: 'Movies', region: 'EU', col: '#334155', hd: '1080p', lang: 'English', bitrate: '7.8 Mbps' },
  { t: 'Indie Cinema', cat: 'Movies', region: 'EU', col: '#7c3aed', hd: '720p', lang: 'English', bitrate: '4.1 Mbps' },
  { t: 'Classics Boulevard', cat: 'Movies', region: 'US', col: '#b45309', hd: '1080p', lang: 'English', bitrate: '8.0 Mbps' },
  { t: 'Horror Vault', cat: 'Movies', region: 'US', col: '#581c87', hd: '1080p', lang: 'English', bitrate: '8.6 Mbps' },
  { t: 'Sci-Fi Signal', cat: 'Movies', region: 'Global', col: '#0ea5e9', hd: '4K', lang: 'English', bitrate: '16.2 Mbps' },
  { t: 'Pitch Side Sports', cat: 'Sports', region: 'EU', col: '#16a34a', hd: '4K', lang: 'English', bitrate: '22.0 Mbps' },
  { t: 'Arena Sports 2', cat: 'Sports', region: 'Global', col: '#15803d', hd: '1080p', lang: 'English', bitrate: '11.4 Mbps' },
  { t: 'Sports Kickoff', cat: 'Sports', region: 'Asia', col: '#4d7c0f', hd: '1080p', lang: 'Hindi', bitrate: '10.1 Mbps' },
  { t: 'Esports Arena', cat: 'Sports', region: 'Asia', col: '#7c3aed', hd: '1080p', lang: 'English', bitrate: '12.0 Mbps' },
  { t: 'Lucha Libre TV', cat: 'Sports', region: 'LATAM', col: '#ea580c', hd: '720p', lang: 'Spanish', bitrate: '5.6 Mbps' },
  { t: 'Nova News 24', cat: 'News', region: 'Global', col: '#dc2626', hd: '1080p', lang: 'English', bitrate: '7.2 Mbps' },
  { t: 'Focus News Asia', cat: 'News', region: 'Asia', col: '#b91c1c', hd: '1080p', lang: 'English', bitrate: '6.9 Mbps' },
  { t: 'Global Business Live', cat: 'News', region: 'Global', col: '#0f172a', hd: '1080p', lang: 'English', bitrate: '6.4 Mbps' },
  { t: 'Weather Watch 24', cat: 'News', region: 'Global', col: '#0284c7', hd: '720p', lang: 'English', bitrate: '3.8 Mbps' },
  { t: 'Docu Wild', cat: 'Documentary', region: 'Global', col: '#166534', hd: '4K', lang: 'English', bitrate: '17.5 Mbps' },
  { t: 'Nature Earth 4K', cat: 'Documentary', region: 'Global', col: '#0d9488', hd: '4K', lang: 'English', bitrate: '19.0 Mbps' },
  { t: 'History Vault', cat: 'Documentary', region: 'EU', col: '#78350f', hd: '1080p', lang: 'English', bitrate: '7.4 Mbps' },
  { t: 'Travel Trails', cat: 'Documentary', region: 'Global', col: '#0369a1', hd: '1080p', lang: 'English', bitrate: '8.2 Mbps' },
  { t: 'Tech Now', cat: 'Documentary', region: 'Global', col: '#1d4ed8', hd: '1080p', lang: 'English', bitrate: '8.8 Mbps' },
  { t: 'Kidverse', cat: 'Kids', region: 'Global', col: '#f59e0b', hd: '720p', lang: 'English', bitrate: '4.4 Mbps' },
  { t: 'Toon Loop', cat: 'Kids', region: 'Global', col: '#f472b6', hd: '1080p', lang: 'English', bitrate: '6.0 Mbps' },
  { t: 'Anime All-Night', cat: 'Kids', region: 'Asia', col: '#4338ca', hd: '1080p', lang: 'Japanese', bitrate: '9.8 Mbps' },
  { t: 'K-Drama Central', cat: 'Drama', region: 'Asia', col: '#be185d', hd: '1080p', lang: 'Korean', bitrate: '10.6 Mbps' },
  { t: 'Asian Drama One', cat: 'Drama', region: 'Asia', col: '#a21caf', hd: '1080p', lang: 'Mandarin', bitrate: '10.2 Mbps' },
  { t: 'Music Pulse', cat: 'Music', region: 'Global', col: '#db2777', hd: '1080p', lang: 'English', bitrate: '9.0 Mbps' },
  { t: 'Retro Hits TV', cat: 'Music', region: 'Global', col: '#9333ea', hd: '720p', lang: 'English', bitrate: '4.8 Mbps' },
  { t: 'Comedy Club TV', cat: 'Entertainment', region: 'US', col: '#facc15', hd: '1080p', lang: 'English', bitrate: '7.0 Mbps' },
  { t: 'Food & Flame', cat: 'Entertainment', region: 'Global', col: '#dc2626', hd: '1080p', lang: 'English', bitrate: '8.4 Mbps' },
  { t: 'Auto Motor Live', cat: 'Entertainment', region: 'EU', col: '#475569', hd: '1080p', lang: 'German', bitrate: '9.6 Mbps' },
  { t: 'Fashion Front', cat: 'Entertainment', region: 'EU', col: '#e879f9', hd: '1080p', lang: 'French', bitrate: '8.1 Mbps' },
  { t: 'Faith & Life', cat: 'Entertainment', region: 'Global', col: '#0e7490', hd: '720p', lang: 'English', bitrate: '3.4 Mbps' },
  { t: 'Public Access 9', cat: 'Entertainment', region: 'US', col: '#78716c', hd: '480p', lang: 'English', bitrate: '1.6 Mbps' },
];

/** Provider registry — mirrors the native provider stack the TUI ships with. */
const PROVIDERS = [
  {
    id: 'moviebox',
    name: 'MovieBox',
    tag: 'native',
    transport: 'DASH + HLS',
    note: 'Primary catalogue. Fast seek, adaptive bitrate, 4K on select releases.',
    maxQuality: '4K',
    reliable: 0.985,
    region: 'Global',
  },
  {
    id: 'fourkhdhub',
    name: '4KHDHub',
    tag: 'multi-mirror',
    transport: 'HLS',
    note: 'HubCloud / HubDrive mirrors. Prefers seekable multi-connection CDNs.',
    maxQuality: '4K',
    reliable: 0.95,
    region: 'Global',
  },
  {
    id: 'circleftp',
    name: 'CircleFTP',
    tag: 'bdix',
    transport: 'HTTP',
    note: 'Requires a BDIX-capable network. Blazing fast when it resolves.',
    maxQuality: '1080p',
    reliable: 0.88,
    region: 'BDIX',
  },
  {
    id: 'addons',
    name: 'Stremio Addons',
    tag: 'community',
    transport: 'Torrent',
    note: 'Community addons. HTTP streams only — torrents stay blocked.',
    maxQuality: '2160p',
    reliable: 0.90,
    region: 'Community',
  },
];

const QUALITIES = ['4K', '1440p', '1080p', '720p', '480p'];
const SUBTITLE_LANGS = ['English', 'Bengali', 'Hindi', 'Spanish', 'French', 'German', 'Japanese', 'Korean', 'Arabic'];
const THEMES = [
  'Moviejuke', 'Catppuccin Mocha', 'Tokyo Night', 'Dracula', 'Nord',
  'Gruvbox Dark', 'One Dark', 'Solarized Light', 'Monochrome',
];

module.exports = { TITLES, CHANNELS, PROVIDERS, QUALITIES, SUBTITLE_LANGS, THEMES };

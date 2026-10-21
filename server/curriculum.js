// Knowledge Bank — curriculum seed data.
// All text is original, written for this product (PRD §10: no copied material).

let n = 0;
const uid = (p) => `${p}_${++n}`;

export const boards = [
  { id: 'cbse', name: 'CBSE', blurb: 'NCERT-aligned flow' },
  { id: 'icse', name: 'ICSE', blurb: 'Concept-first flow' },
  { id: 'state', name: 'State Boards', blurb: 'State syllabus friendly' },
  { id: 'generic', name: 'Generic Track', blurb: 'Board-agnostic practice' },
];

export const classes = [
  { id: 'pre', name: 'Pre-Nursery', ageBand: 'young', order: 1 },
  { id: 'nur', name: 'Nursery', ageBand: 'young', order: 2 },
  { id: 'kg', name: 'KG / UKG', ageBand: 'young', order: 3 },
  { id: 'c1', name: 'Class 1', ageBand: 'young', order: 4 },
  { id: 'c2', name: 'Class 2', ageBand: 'young', order: 5 },
  { id: 'c3', name: 'Class 3', ageBand: 'elder', order: 6 },
  { id: 'c4', name: 'Class 4', ageBand: 'elder', order: 7 },
  { id: 'c5', name: 'Class 5', ageBand: 'elder', order: 8 },
];

export const subjects = [
  { id: 'eng', name: 'English', icon: '📘', color: '#4f7cff', free: true },
  { id: 'math', name: 'Maths', icon: '🔢', color: '#ff7043', free: false },
  { id: 'evs', name: 'EVS / Science', icon: '🔬', color: '#26a69a', free: false },
  { id: 'hin', name: 'Hindi / Regional', icon: '🗣️', color: '#ab47bc', free: false },
  { id: 'gk', name: 'GK', icon: '🌍', color: '#f9a825', free: true },
];

export const subjectNameFor = (subjectId, classId) =>
  subjectId === 'evs' && ['c3', 'c4', 'c5'].includes(classId) ? 'Science' : subjects.find((s) => s.id === subjectId)?.name;

/* ---------- question helpers ---------- */
const mcq = (text, options, correct, explain) => ({ id: uid('q'), type: 'mcq', text, options, correct, explain });
const tf = (text, correct, explain) => ({ id: uid('q'), type: 'tf', text, correct, explain });
const fill = (text, answers, explain) => ({ id: uid('q'), type: 'fill', text, answers, explain });
const match = (pairs, explain) => ({ id: uid('q'), type: 'match', pairs, explain });
const pic = (picture, text, options, correct, explain) => ({ id: uid('q'), type: 'picture', picture, text, options, correct, explain });
const aud = (text, options, correct, explain) => ({ id: uid('q'), type: 'audio', text, options, correct, explain });

/* ---------- content helpers ---------- */
const note = (title, body) => ({ id: uid('c'), type: 'note', title, body, minutes: 5 });
const video = (title, minutes, posterEmoji) => ({ id: uid('c'), type: 'video', title, minutes, posterEmoji, videoUrl: null });
const audio = (title, minutes, script) => ({ id: uid('c'), type: 'audio', title, minutes, script });

/* ---------- topic builder ---------- */
const T = (classId, subjectId, title, summary, contents, questions, passMark = 80) => {
  const id = uid('t');
  return {
    id, classId, subjectId, title, summary, passMark,
    boardIds: ['cbse', 'icse', 'state', 'generic'],
    contents,
    quiz: { id: uid('z'), topicId: id, title: `${title} — Practice Quiz`, passMark, questions },
  };
};

export const topics = [
  /* ============ PRE-NURSERY ============ */
  T('pre', 'eng', 'Alphabet Fun — A to E', 'Meet the first letters with sounds and pictures.', [
    note('Hello, Letters!', 'Every word starts with a letter.\n\nA is for Apple 🍎\nB is for Ball ⚽\nC is for Cat 🐱\nD is for Dog 🐶\nE is for Elephant 🐘\n\nSay each letter out loud, then clap once!'),
    audio('Sing the A-to-E song', 2, 'A B C D E, sing along with me! A is apple, B is ball, C is cat so small.'),
  ], [
    pic('🍎', 'Which letter does "Apple" start with?', ['A', 'B', 'C'], 0, 'Apple starts with the letter A.'),
    pic('⚽', 'Which letter does "Ball" start with?', ['C', 'B', 'D'], 1, 'Ball starts with the letter B.'),
    aud('Listen: "C is for Cat". Which animal did you hear?', ['Dog', 'Cat', 'Bird'], 1, 'The word was Cat.'),
    tf('The letter "E" comes after "D".', true, 'Yes! The order is A, B, C, D, E.'),
  ]),
  T('pre', 'math', 'Numbers 1 to 5', 'Count little things around you: 1, 2, 3, 4, 5!', [
    note('Let us Count!', 'One ☝️\nTwo ✌️\nThree 🤟\nFour 🖐️ minus one\nFive 🖐️\n\nCount the stars: ⭐ ⭐ ⭐ — that is three stars!'),
    video('Counting with Fingers', 3, '🖐️'),
  ], [
    pic('⭐⭐⭐', 'How many stars do you see?', ['2', '3', '4'], 1, 'Count them: 1, 2, 3. Three stars!'),
    mcq('What comes after 2?', ['1', '3', '5'], 1, 'Counting goes 1, 2, 3 — so 3 comes after 2.'),
    tf('4 is more than 2.', true, 'Yes, 4 is bigger than 2.'),
    fill('Count the apples: 🍎🍎🍎🍎. There are ____ apples.', ['4', 'four'], 'There are 4 apples.'),
  ]),
  T('pre', 'gk', 'My World — Family & Colours', 'Who is in your family? What colours do you see?', [
    note('My Family and Colours', 'Papa 👨, Mummy 👩, brother 👦, sister 👧 — we are a family!\n\nColours everywhere: the sky is blue 💙, the leaf is green 💚, the sun looks yellow 💛.\n\nPoint to something red in your room!'),
  ], [
    mcq('What colour is a ripe banana?', ['Red', 'Yellow', 'Blue'], 1, 'Ripe bananas are yellow.'),
    tf('A leaf is usually green.', true, 'Yes, most leaves are green.'),
    pic('👩', 'Who is this? (Mummy)', ['Sister', 'Mummy', 'Teacher'], 1, 'This picture shows Mummy.'),
  ]),

  /* ============ NURSERY ============ */
  T('nur', 'eng', 'Rhyming Words', 'Words that sound the same at the end: cat, bat, hat!', [
    note('Words That Rhyme', 'Rhyming words end with the same sound.\n\n- cat 🐱 — bat 🦇 — hat 🎩\n- sun ☀️ — fun 🎈\n- tree 🌳 — bee 🐝\n\nClap when you hear a rhyme!'),
    audio('Rhyme time!', 2, 'Cat, bat, hat — words that rhyme are where its at. Sun and fun, tree and bee — rhyme along with me.'),
  ], [
    aud('Listen: "cat". Which word rhymes with it?', ['bat', 'dog', 'cup'], 0, 'Cat and bat both end with the "-at" sound.'),
    mcq('Which word rhymes with "sun"?', ['fun', 'sit', 'top'], 0, 'Sun and fun both end with "-un".'),
    tf('"Dog" rhymes with "hat".', false, 'Dog ends with "-og", hat ends with "-at". They do not rhyme.'),
    fill('Hat rhymes with ____ (a small flying animal).', ['bat'], 'Hat and bat rhyme!'),
  ]),
  T('nur', 'math', 'Shapes Around Us', 'Circle, square, triangle — shapes are everywhere!', [
    note('Three Friendly Shapes', 'Circle ⭕ — round like a chapati.\nSquare 🟦 — 4 equal sides, like a window.\nTriangle 🔺 — 3 sides, like a slice of pizza.\n\nFind a circle in your room!'),
    video('Shape Hunt at Home', 3, '⭕'),
  ], [
    pic('🔴', 'What shape is this?', ['Square', 'Circle', 'Triangle'], 1, 'A ball or a chapati is a circle — perfectly round.'),
    pic('🔺', 'Which shape has 3 sides?', ['Triangle', 'Circle', 'Square'], 0, 'A triangle has 3 sides.'),
    tf('A square has 4 sides.', true, 'Yes — a square always has 4 equal sides.'),
    mcq('A chapati looks like a...', ['circle', 'square', 'star'], 0, 'A chapati is round, so it is a circle.'),
  ]),
  T('nur', 'evs', 'Animals & Their Homes', 'Where does each friend live?', [
    note('Animal Homes', 'Bird 🐦 lives in a nest on a tree.\nFish 🐟 lives in water.\nDog 🐶 lives in a kennel.\nBee 🐝 lives in a hive.\n\nBe kind to animals!'),
  ], [
    match([['Bird', 'Nest'], ['Fish', 'Water'], ['Dog', 'Kennel']], 'Each animal has its own home.'),
    pic('🐝', 'Where do bees live?', ['Hive', 'Nest', 'Burrow'], 0, 'Bees live together in a hive.'),
    tf('Fish live on trees.', false, 'Fish live in water — trees are for birds!'),
  ]),
  T('nur', 'hin', 'हिंदी अक्षर — क, ख, ग', 'पहले तीन अक्षर सीखें।', [
    note('क, ख, ग सीखें', 'क से कबूतर 🕊️\nख से खरगोश 🐰\nग से गमला 🪴\n\nज़ोर से बोलें: क… ख… ग!\n\nशब्द: कमल, खाना, गाय।'),
  ], [
    mcq('"क" से कौन सा जानवर है?', ['कबूतर', 'खरगोश', 'गाय'], 0, 'क से कबूतर।'),
    fill('ख से ____ (एक जानवर)।', ['खरगोश'], 'ख से खरगोश!'),
    tf('ग से गाय होती है।', true, 'हाँ! ग से गाय।'),
  ]),

  /* ============ KG / UKG ============ */
  T('kg', 'eng', 'Sight Words — I, see, the, a', 'Small words we read again and again.', [
    note('Quick Little Words', 'Some words we see everywhere:\n\nI · see · the · a · is · my\n\nTry a sentence: "I see the cat."\n\nRead it slowly, then quickly!'),
  ], [
    fill('I ____ the ball. (see / sees)', ['see'], '"I see the ball" — with "I" we use "see".'),
    mcq('Which one is a sight word?', ['see', 'elephant', 'jumping'], 0, '"See" is one of our little sight words.'),
    aud('Listen: "I see the sun". What do you see?', ['The sun', 'The moon', 'A cat'], 0, 'The sentence was "I see the sun".'),
    tf('"a" and "the" are small helper words.', true, 'Yes — they help us make sentences.'),
  ]),
  T('kg', 'math', 'Counting to 20 & Big-Small', 'Count up to 20 and compare sizes.', [
    note('Count Higher!', '11 to 20: eleven, twelve, thirteen … twenty.\n\nBig and small:\n🐘 elephant is BIG\n🐜 ant is SMALL\n\nWhich is bigger — a bus or a car?'),
  ], [
    mcq('Which number comes just before 20?', ['19', '18', '21'], 0, '19 comes right before 20.'),
    pic('🐘🐜', 'Which animal is bigger?', ['Ant', 'Elephant', 'Fish'], 1, 'An elephant is much bigger than an ant.'),
    fill('Count: ⭐⭐⭐⭐⭐⭐. There are ____ stars.', ['6', 'six'], 'Count the stars — there are 6.'),
    tf('13 is more than 11.', true, 'Yes, 13 is bigger than 11.'),
  ]),
  T('kg', 'evs', 'Fruits & Vegetables', 'Eat a rainbow every day!', [
    note('Eat Your Colours', 'Apple 🍎, Mango 🥭, Banana 🍌 are fruits.\nCarrot 🥕, Pea, Potato 🥔 are vegetables.\n\nFruits and vegetables keep us strong and healthy!'),
    video('Market Colour Hunt', 3, '🍎'),
  ], [
    match([['Apple', 'Fruit'], ['Carrot', 'Vegetable'], ['Mango', 'Fruit']], 'Apple and mango are fruits; carrot is a vegetable.'),
    pic('🥕', 'Is a carrot a fruit or a vegetable?', ['Fruit', 'Vegetable', 'Sweet'], 1, 'A carrot grows in the soil — it is a vegetable.'),
    tf('Mango is a fruit.', true, 'Yes, mango is the king of fruits!'),
  ]),
  T('kg', 'gk', 'Good Habits', 'Little habits that make a big you.', [
    note('Super Habits', '🧼 Wash hands before eating.\n🪥 Brush teeth every morning and night.\n😴 Sleep early, wake up fresh.\n🙏 Say please and thank you.\n\nGood habits make a happy, healthy child!'),
  ], [
    mcq('When should we brush our teeth?', ['Only on Sundays', 'Morning and night', 'Never'], 1, 'Brushing twice a day keeps teeth strong.'),
    tf('We should wash hands before eating.', true, 'Absolutely — clean hands, safe food!'),
    aud('Listen: "Say please and thank you". Which habit is this?', ['Good manners', 'Sleeping', 'Running'], 0, 'Please and thank you are good manners.'),
  ]),

  /* ============ CLASS 1 ============ */
  T('c1', 'eng', 'Nouns — Naming Words', 'A noun names a person, place, animal or thing.', [
    note('Naming Words (Nouns)', 'A noun is a naming word.\n\n- Person: teacher, baby\n- Place: school, park\n- Animal: tiger, cow\n- Thing: book, chair\n\n"My dog sits on a mat." — dog and mat are nouns!'),
    audio('Noun hunt', 2, 'Look around. Name three nouns. A book is a noun. A tree is a noun. Your name is a noun too!'),
  ], [
    mcq('Which word is a noun?', ['run', 'chair', 'quickly'], 1, 'Chair names a thing — it is a noun.'),
    pic('🏫', 'This is a noun of which kind?', ['Place', 'Animal', 'Feeling'], 0, 'A school is a place, so it is a place noun.'),
    fill('In "The cat drinks milk", the nouns are cat and ____.', ['milk'], 'Cat and milk both name things.'),
    match([['Tiger', 'Animal'], ['Park', 'Place'], ['Book', 'Thing']], 'Nouns name people, places, animals and things.'),
  ]),
  T('c1', 'math', 'Addition Up to 20', 'Put together and count on.', [
    note('Adding is Putting Together', '3 + 2 = 5. Start with 3, count on 2 more: 4, 5!\n\nYou can use fingers, beads or stars ⭐.\n\nTry: 7 + 5. Start at 7 and count on 5: 8, 9, 10, 11, 12!'),
  ], [
    mcq('7 + 5 = ?', ['11', '12', '13'], 1, '7 plus 5 makes 12.'),
    fill('6 + 6 = ____', ['12', 'twelve'], 'Double six is 12.'),
    pic('🍎🍎🍎 + 🍎🍎', 'How many apples in all?', ['5', '6', '4'], 0, '3 apples and 2 apples make 5 apples.'),
    tf('9 + 1 = 10.', true, 'Yes — 9 and 1 make a ten.'),
  ]),
  T('c1', 'evs', 'Our Amazing Body', 'Parts of the body and what they do.', [
    note('My Body', 'Eyes 👀 to see.\nEars 👂 to hear.\nNose 👃 to smell.\nLegs 🦵 to walk and run.\n\nTake care of your body: eat well, play, and rest!'),
  ], [
    match([['Eyes', 'See'], ['Ears', 'Hear'], ['Nose', 'Smell']], 'Each body part has its own job.'),
    pic('👃', 'The nose helps us...', ['see', 'smell', 'hear'], 1, 'We smell with our nose.'),
    tf('We walk with our hands.', false, 'We walk with our legs; hands help us hold and write.'),
  ]),
  T('c1', 'hin', 'हिंदी — स्वर (अ से ज्ञ तक की शुरुआत)', 'अ, आ, इ, ई — स्वर पहचानें।', [
    note('स्वर कौन हैं?', 'अ, आ, इ, ई, उ, ऊ, ए, ऐ, ओ, औ — ये स्वर हैं।\n\nअ से अनार 🍎\nआ से आम 🥭\nइ से इमली\n\nज़ोर से पढ़ें: अ… आ… इ… ई!'),
  ], [
    mcq('अ से क्या बनता है?', ['अनार', 'उल्लू', 'एक'], 0, 'अ से अनार।'),
    tf('आ, एक स्वर है।', true, 'हाँ, "आ" स्वर है।'),
    fill('इ से ____ (एक फल/मसाला)।', ['इमली'], 'इ से इमली।'),
  ]),
  T('c1', 'gk', 'National Symbols of India', 'Pride of our country.', [
    note('Symbols of India', 'National Flag 🇮🇳 — Tricolour (Tiranga)\nNational Animal — Tiger 🐅\nNational Bird — Peacock 🦚\nNational Flower — Lotus 🪷\n\nOur flag has saffron, white and green with a blue chakra.'),
    video('The Tiranga', 3, '🇮🇳'),
  ], [
    pic('🦚', 'Which is the national bird of India?', ['Peacock', 'Parrot', 'Crow'], 0, 'The peacock is our national bird.'),
    mcq('The national animal of India is the...', ['Lion', 'Tiger', 'Elephant'], 1, 'The Royal Bengal Tiger is the national animal.'),
    tf('The Indian flag has three colours.', true, 'Saffron, white and green — the tricolour.'),
    fill('The national flower of India is the ____.', ['lotus'], 'The lotus is our national flower.'),
  ]),

  /* ============ CLASS 2 ============ */
  T('c2', 'eng', 'Verbs — Action Words', 'Words that show what someone does.', [
    note('Doing Words (Verbs)', 'A verb shows an action.\n\n- The frog jumps.\n- Birds fly.\n- I read a book.\n\nJump, run, sing, dance, read, write — all verbs!\n\nStand up and do one action now!'),
  ], [
    mcq('Which word is a verb?', ['happy', 'sing', 'blue'], 1, 'Sing is an action — it is a verb.'),
    fill('The dog ____ on the mat. (sleeps / red)', ['sleeps'], 'The dog sleeps — "sleeps" is the action.'),
    aud('Listen: "She dances every day". What is the action?', ['Dances', 'Sings', 'Eats'], 0, 'The action word is dances.'),
    match([['Birds', 'fly'], ['Fish', 'swim'], ['I', 'read']], 'Each sentence has an action verb.'),
  ]),
  T('c2', 'math', 'Place Value — Tens & Ones', 'How numbers are built: 24 = 2 tens + 4 ones.', [
    note('Tens and Ones', 'Every 2-digit number has tens and ones.\n\n24 = 2 tens + 4 ones\n56 = 5 tens + 6 ones\n\nUse bundles of 10 sticks 🥢 to show tens!'),
  ], [
    mcq('In 47, how many tens?', ['4', '7', '47'], 0, '47 has 4 tens and 7 ones.'),
    fill('35 = 3 tens + ____ ones.', ['5', 'five'], '35 = 3 tens + 5 ones.'),
    tf('In 82, the digit 8 shows 8 tens.', true, 'Yes — 8 tens make 80.'),
    pic('🟦🟦🟦  🟦 (4 blocks of ten + 1)', 'What number is 3 tens and 1 one?', ['31', '13', '30'], 0, '3 tens and 1 one make 31.'),
  ]),
  T('c2', 'evs', 'Water & Air Around Us', 'Why we need clean water and fresh air.', [
    note('Water and Air', 'Water 💧 — drink 6-8 glasses a day. Plants and animals need water too.\nAir 🌬️ — we breathe air. Trees give us fresh air.\n\nSave water: turn the tap off while brushing! Keep the air clean: plant trees 🌳.'),
  ], [
    tf('We should leave the tap running while brushing.', false, 'Turning the tap off saves water!'),
    mcq('Trees give us...', ['fresh air', 'plastic', 'noise'], 0, 'Trees release oxygen — fresh air for us.'),
    match([['Water', 'Drink'], ['Air', 'Breathe'], ['Tree', 'Fresh air']], 'Water, air and trees keep life going.'),
  ]),
  T('c2', 'hin', 'हिंदी — व्यंजन', 'क, ख, ग … से ज्ञ तक — व्यंजन पहचानें।', [
    note('व्यंजन कौन हैं?', 'क, ख, ग, घ, च, छ, ज, झ, ट, ठ, ड, ढ, ण, त, थ, द, ध, न… ये व्यंजन हैं।\n\nप से पतंग 🪁\nफ से फल 🍎\nब से बकरी 🐐\n\nव्यंजन बोलते से जीभ लगती है — बोलकर देखें!'),
  ], [
    mcq('प से क्या बनता है?', ['पतंग', 'मछली', 'कमल'], 0, 'प से पतंग।'),
    tf('फ से फल होता है।', true, 'हाँ! फ से फल।'),
    fill('ब से ____ (एक जानवर)।', ['बकरी', 'बिल्ली'], 'ब से बकरी (या बिल्ली)।'),
  ]),
  T('c2', 'gk', 'Festivals of India', 'Festivals bring us together.', [
    note('Festival Calendar', 'Diwali 🪔 — festival of lights.\nHoli 🎨 — festival of colours.\nEid 🌙 — feasting and prayers.\nChristmas 🎄 — stars and gifts.\nPongal / Makar Sankranti 🪁 — harvest and kites.\n\nEvery festival teaches joy and sharing.'),
  ], [
    match([['Diwali', 'Lights'], ['Holi', 'Colours'], ['Christmas', 'Stars & gifts']], 'Each festival has its own special way of celebration.'),
    pic('🪔', 'Diwali is the festival of...', ['Lights', 'Water', 'Snow'], 0, 'Diwali is Deepavali — the festival of lights.'),
    tf('Holi is the festival of colours.', true, 'Yes — people play with colours on Holi.'),
  ]),

  /* ============ CLASS 3 ============ */
  T('c3', 'eng', 'Tenses — Past, Present & Future', 'When did the action happen?', [
    note('Action in Time', 'Present: I play. / She plays.\nPast: I played. / She played.\nFuture: I will play.\n\nLook for time words: yesterday → past; now → present; tomorrow → future.'),
  ], [
    mcq('"She ___ a story yesterday." Which word fits?', ['reads', 'read', 'will read'], 1, 'Yesterday shows the past — "read" (past form).'),
    fill('They ____ football tomorrow. (will play / played)', ['will play'], 'Tomorrow shows the future — "will play".'),
    tf('"He eats mangoes" is in the past tense.', false, 'It is present tense. Past would be "He ate mangoes".'),
    match([['Yesterday', 'Past'], ['Now', 'Present'], ['Tomorrow', 'Future']], 'Time words tell us which tense to use.'),
  ]),
  T('c3', 'math', 'Multiplication Tables 2 to 10', 'Fast maths with patterns.', [
    note('Table Tricks', '2 times table is just doubles: 2, 4, 6, 8…\n5 times table ends in 5 or 0: 5, 10, 15, 20…\n10 times table is easy: add a zero!\n\n9 trick: 9 × 4 = 36 (3 + 6 = 9). The digits always add up to 9!'),
    audio('Chant the 5 times table', 2, 'Five, ten, fifteen, twenty, twenty five, thirty, thirty five, forty!'),
  ], [
    mcq('7 × 8 = ?', ['54', '56', '64'], 1, 'Seven eights are fifty-six.'),
    fill('9 × 6 = ____', ['54'], 'Nine sixes are fifty-four (5 + 4 = 9 ✓).'),
    tf('10 × 10 = 100.', true, 'Yes — ten tens make one hundred.'),
    aud('Listen: "four times three". What is the answer?', ['7', '12', '14'], 1, '4 × 3 = 12.'),
  ]),
  T('c3', 'evs', 'Plants & Their Parts', 'Roots to flowers — how a plant works.', [
    note('Parts of a Plant', 'Roots 🌱 hold the plant and drink water.\nStem carries water up.\nLeaves make food using sunlight.\nFlower makes seeds 🌸\n\nWhich part do we eat in a carrot? Roots!'),
  ], [
    match([['Roots', 'Hold & drink water'], ['Leaves', 'Make food'], ['Flower', 'Makes seeds']], 'Each plant part has a job.'),
    mcq('Which part makes food for the plant?', ['Roots', 'Leaves', 'Flower'], 1, 'Leaves use sunlight to make food (photosynthesis).'),
    tf('A carrot is a fruit.', false, 'A carrot is a root vegetable.'),
    pic('🌸', 'What does a flower help make?', ['Seeds', 'Water', 'Soil'], 0, 'Flowers make seeds for new plants.'),
  ]),
  T('c3', 'hin', 'हिंदी — संज्ञा', 'नाम बताने वाले शब्द = संज्ञा।', [
    note('संज्ञा किसे कहते हैं?', 'जो शब्द किसी व्यक्ति, स्थान, वस्तु या जानवर का नाम बताए — वह संज्ञा है।\n\n- व्यक्ति: राम, शिक्षिका\n- स्थान: विद्यालय, पार्क\n- वस्तु: किताब, मेज़\n- जानवर: गाय, बिल्ली\n\nवाक्य: "गाय घास खाती है" — गाय और घास संज्ञा हैं।'),
  ], [
    mcq('"विद्यालय" किसका नाम है?', ['स्थान', 'वस्तु', 'क्रिया'], 0, 'विद्यालय एक स्थान है — संज्ञा।'),
    tf('"राधा" एक संज्ञा है।', true, 'हाँ — यह व्यक्ति का नाम है।'),
    fill('"किताब" एक ____ है। (वस्तु/क्रिया)', ['वस्तु'], 'किताब वस्तु का नाम है।'),
  ]),
  T('c3', 'gk', 'Our Solar System', 'Sun, planets and a little moon.', [
    note('Around the Sun', 'The Sun is a star ☀️ at the centre.\n8 planets move around it.\nEarth 🌍 is our home — the 3rd planet.\nMars is red 🔴. Saturn has rings 💍.\nOur Moon 🌕 goes around the Earth.'),
    video('Trip to the Planets', 4, '🪐'),
  ], [
    mcq('How many planets are in our solar system?', ['5', '8', '12'], 1, 'There are 8 planets.'),
    tf('The Sun is a planet.', false, 'The Sun is a star.'),
    fill('Our home planet is ____.', ['earth'], 'Earth is our home planet.'),
    pic('💍', 'Which planet has beautiful rings?', ['Saturn', 'Mars', 'Venus'], 0, 'Saturn is famous for its rings.'),
  ]),

  /* ============ CLASS 4 ============ */
  T('c4', 'eng', 'Adjectives & Comparisons', 'Describing words: big, bigger, biggest.', [
    note('Describing Words', 'Adjectives describe nouns: a tall tree, a sweet mango.\n\nComparisons:\n- Positive: tall\n- Comparative: taller\n- Superlative: tallest\n\nIrregular: good → better → best; bad → worse → worst.'),
  ], [
    mcq('The comparative of "small" is...', ['smallest', 'smaller', 'more small'], 1, 'Small → smaller → smallest.'),
    fill('She is the ____ girl in class. (tall)', ['tallest'], 'Superlative — "tallest" for more than two.'),
    match([['Good', 'Better'], ['Bad', 'Worse'], ['Far', 'Further']], 'Irregular comparisons follow their own pattern.'),
    tf('"Beautiful" is an adjective.', true, 'Yes — it describes how something looks.'),
  ]),
  T('c4', 'math', 'Fractions Made Easy', 'Parts of a whole: ½, ¼, ¾.', [
    note('What is a Fraction?', 'A fraction shows parts of a whole.\n\n½ = one of two equal parts (half)\n¼ = one of four equal parts (quarter)\n¾ = three of four parts\n\nTop number = numerator (parts we have)\nBottom number = denominator (equal parts in all)'),
  ], [
    pic('🍕 (pizza cut in 4, 1 slice shaded)', 'What fraction of the pizza is one slice?', ['1/4', '1/2', '3/4'], 0, 'One of four equal slices is 1/4.'),
    mcq('Which fraction is the biggest?', ['1/2', '1/8', '1/4'], 0, 'Halves are bigger than quarters and eighths.'),
    fill('In 3/5, the denominator is ____.', ['5', 'five'], 'The bottom number 5 is the denominator.'),
    tf('½ of 12 is 6.', true, 'Half of 12 is 6.'),
  ]),
  T('c4', 'evs', 'States of Matter', 'Solid, liquid, gas — matter changes!', [
    note('Three States of Matter', 'Solid 🔷 — fixed shape (ice, rock).\nLiquid 💧 — takes the shape of its container (water, milk).\nGas 🌫️ — spreads everywhere (air, steam).\n\nHeat melts ice into water and boils water into steam. Cool it and it comes back!'),
  ], [
    match([['Ice', 'Solid'], ['Water', 'Liquid'], ['Steam', 'Gas']], 'Water is the champion of all three states!'),
    mcq('Which is a gas?', ['Stone', 'Milk', 'Air'], 2, 'Air is a gas — it spreads all around.'),
    tf('Ice melts into water when heated.', true, 'Yes — heat changes solid ice into liquid water.'),
    fill('Water freezes into ____ at 0°C.', ['ice'], 'At 0°C, water becomes ice.'),
  ]),
  T('c4', 'hin', 'हिंदी — सर्वनाम', 'नाम की जगह लेने वाले शब्द।', [
    note('सर्वनाम क्या है?', 'संज्ञा की जगह प्रयोग होने वाले शब्द — सर्वनाम कहलाते हैं।\n\nमैं, तुम, वह, हम, ये, वे\n\nउदाहरण: "राम स्कूल गया। वह पढ़ता है।"\nयहाँ "वह" = राम (सर्वनाम)।'),
  ], [
    mcq('"मैं जाता हूँ" — "मैं" क्या है?', ['सर्वनाम', 'क्रिया', 'विशेषण'], 0, '"मैं" सर्वनाम है — यह वक्ता का नाम बताता है।'),
    tf('"वह" शब्द सर्वनाम है।', true, 'हाँ — "वह" संज्ञा की जगह लेता है।'),
    fill('सीता आई। ____ पढ़ती है। (वह/जल)', ['वह'], 'दूसरे वाक्य में "वह" = सीता।'),
  ]),
  T('c4', 'gk', 'India — States & Capitals', 'Our states and their seat of power.', [
    note('States of India', 'India has 28 states and 8 Union Territories.\n\nSome capitals:\n- Karnataka → Bengaluru 🌳\n- Maharashtra → Mumbai 🏙️\n- Tamil Nadu → Chennai 🌊\n- Uttar Pradesh → Lucknow\n- Delhi (NCT) → New Delhi (our capital city!)'),
  ], [
    match([['Karnataka', 'Bengaluru'], ['Maharashtra', 'Mumbai'], ['Tamil Nadu', 'Chennai']], 'Each state has a capital city.'),
    mcq('The capital of India is...', ['Mumbai', 'New Delhi', 'Kolkata'], 1, 'New Delhi is the capital of India.'),
    tf('Bengaluru is the capital of Karnataka.', true, 'Yes — Bengaluru (Bangalore) is Karnataka\'s capital.'),
  ]),

  /* ============ CLASS 5 ============ */
  T('c5', 'eng', 'Punctuation & Sentence Types', 'Full stops, commas and question marks.', [
    note('Marks with Meaning', '. full stop — ends a statement.\n? question mark — ends a question.\n! exclamation mark — shows strong feeling.\n, comma — gives a small pause.\n\n"I love mangoes." / "Do you love mangoes?" / "What a mango!"'),
  ], [
    mcq('Which mark ends a question?', ['.', '!', '?'], 2, 'Question marks (?) end questions.'),
    fill('What a beautiful day ____', ['!'], 'Strong feeling uses an exclamation mark (!).'),
    tf('A comma is used for a small pause in a sentence.', true, 'Yes — commas help us read with natural pauses.'),
    match([['Statement', '.'], ['Question', '?'], ['Exclamation', '!']], 'Punctuation tells us how a sentence should sound.'),
  ]),
  T('c5', 'math', 'Area & Perimeter', 'Fence vs floor — measuring 2D shapes.', [
    note('Perimeter and Area', 'Perimeter = distance around the shape (the fence).\nArea = space inside the shape (the carpet).\n\nRectangle: perimeter = 2 × (l + b), area = l × b\nSquare: perimeter = 4 × side, area = side × side'),
  ], [
    mcq('A square has side 5 cm. Its perimeter is...', ['10 cm', '20 cm', '25 cm'], 1, 'Perimeter of a square = 4 × side = 20 cm.'),
    fill('A rectangle is 6 cm long and 3 cm wide. Its area is ____ cm².', ['18'], 'Area = l × b = 6 × 3 = 18 cm².'),
    tf('Area is measured in square units.', true, 'Yes — cm², m² etc. are square units.'),
    pic('▭ 6×3', 'Perimeter of a 6 cm × 3 cm rectangle is...', ['18 cm', '9 cm', '12 cm'], 0, 'Perimeter = 2 × (6 + 3) = 18 cm.'),
  ]),
  T('c5', 'evs', 'The Water Cycle', 'Water travels — and comes back!', [
    note('Round and Round Goes Water', 'Evaporation ☀️ — sun heats water, it rises as vapour.\nCondensation ☁️ — vapour cools into clouds.\nPrecipitation 🌧️ — rain, snow or hail falls.\nCollection 🌊 — water gathers in rivers, lakes and oceans.\n\n…then it starts again! Save every drop 💧.'),
  ], [
    match([['Evaporation', 'Water rises as vapour'], ['Condensation', 'Vapour becomes clouds'], ['Precipitation', 'Rain falls']], 'The water cycle has four main stages.'),
    mcq('What turns water into vapour?', ['The Moon', 'The Sun', 'The Wind'], 1, 'The Sun\'s heat evaporates water.'),
    fill('Clouds are formed during ____.', ['condensation'], 'Cooling vapour condenses into cloud droplets.'),
    tf('Rain is part of the water cycle.', true, 'Rain is precipitation — one stage of the cycle.'),
  ]),
  T('c5', 'hin', 'हिंदी — क्रिया', 'काम बताने वाले शब्द = क्रिया।', [
    note('क्रिया क्या है?', 'क्रिया वह शब्द है जो कोई काम बताए — दौड़ना, खाना, पढ़ना, लिखना।\n\n"बच्चे खेलते हैं" — खेलते हैं = क्रिया।\n"वह दौड़ रहा है" — दौड़ रहा है = क्रिया।\n\nक्रिया के बिना वाक्य अधूरा है!'),
  ], [
    mcq('"राम पुस्तक पढ़ता है" — क्रिया कौन सी है?', ['राम', 'पुस्तक', 'पढ़ता है'], 2, '"पढ़ता है" काम बताता है — यही क्रिया है।'),
    tf('दौड़ना एक क्रिया है।', true, 'हाँ — दौड़ना काम बताता है।'),
    fill('"मैं जल ____ । (पीता/संज्ञा)" — सही शब्द भरें।', ['पीता'], '"पीता" क्रिया है।'),
  ]),
  T('c5', 'gk', 'World Geography', 'Oceans, continents and wonders.', [
    note('Our Big World', '7 continents: Asia, Africa, North America, South America, Antarctica, Europe, Australia.\n5 oceans: Pacific, Atlantic, Indian, Southern, Arctic.\n\nGreat Wall of China 🧱, Taj Mahal 🕌 and Machu Picchu are wonders made by people!'),
  ], [
    match([['Pacific', 'Ocean'], ['Asia', 'Continent'], ['Antarctica', 'Continent (icy)']], 'Continents are big lands; oceans are big waters.'),
    mcq('Which is the largest continent?', ['Africa', 'Asia', 'Europe'], 1, 'Asia is the largest continent by area and people.'),
    tf('The Indian Ocean is next to India.', true, 'Yes — India\'s southern coast touches the Indian Ocean.'),
    pic('🕌', 'Where is the Taj Mahal?', ['India', 'China', 'Egypt'], 0, 'The Taj Mahal is in Agra, India.'),
  ]),
];

/* Build the flat content / question tables the store expects. */
export const contentItems = topics.flatMap((t) =>
  t.contents.map((c) => ({
    ...c,
    topicId: t.id,
    classId: t.classId,
    subjectId: t.subjectId,
    status: 'published',
    author: 'editor.raj',
    reviewer: 'admin',
    publishedAt: '2026-09-01T00:00:00.000Z',
    boards: t.boardIds,
  }))
);

export const quizzes = topics.map((t) => t.quiz);
export const questions = topics.flatMap((t) =>
  t.quiz.questions.map((q) => ({ ...q, quizId: t.quiz.id }))
);

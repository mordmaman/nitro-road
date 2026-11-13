// =====================================================================
//  NITRO ROAD — the easy-to-change settings live in this file.
//  Change something, commit it, and GitHub Pages updates in a minute.
// =====================================================================

const CONFIG = {
  title: 'Nitro Road',
  raceLaps: 3,          // laps in a Race
  trialLaps: 3,         // laps in a Time Trial
  topKmh: 240,          // what the speedo shows at full speed on Medium (before nitro)

  // the five computer drivers in a Race
  opponents: [
    { name: 'Blaze',  color: '#1f7bff', body: 'sport'  },
    { name: 'Rocket', color: '#2fd36b', body: 'muscle' },
    { name: 'Viper',  color: '#ffb703', body: 'sport'  },
    { name: 'Comet',  color: '#9b5de5', body: 'muscle' },
    { name: 'Zippy',  color: '#ff5fb3', body: 'sport'  },
  ],

  // words on the roadside billboards
  billboards: ['NITRO ROAD', 'GO GO GO!', 'FULL THROTTLE', 'ZOOM!', 'NO BRAKES?', 'TURBO TIME', 'HOLD ON!'],

  // colours for the everyday traffic in Dodge Run
  trafficColors: ['#d8dde3', '#5c6b7a', '#8c2f39', '#2f6b4f', '#c9a227', '#3b4a8c', '#f2f2f2', '#6d4c41'],
};

// How each difficulty plays. Bigger "speed" = faster car. "centrifugal" = how hard bends push you out.
const DIFFICULTY = {
  easy: {
    label: 'Easy',
    speed: 0.82,            // top speed multiplier
    centrifugal: 0.13,      // bends barely push you out
    offroadDrag: 0.3,       // grass hardly slows you
    assist: 0.9,            // steers you back onto the road
    edge: 1.45,             // how far off the road you can go
    crashKeep: 0.55,        // speed kept after hitting a roadside thing
    ai: [0.72, 0.84],       // computer car speeds (slowest, fastest)
    aiCorner: 0.012,        // computer cars slow down this much per bend
    rubberAhead: 0.2,       // computer cars ease off when they're ahead of you
    rubberBehind: 0.07,     // ...and speed up a little when behind
    lives: 5,               // Dodge Run hearts
    density: 0.6,           // Dodge Run: how packed the road is
    weave: 0,               // Dodge Run: chance traffic changes lane
    trialPar: [1.2, 1.07, 0.99],      // Time Trial bronze / silver / gold (x a clean lap with no nitro)
    dodgeStars: [1000, 2500, 5000],   // Dodge Run score for 1 / 2 / 3 stars
  },
  medium: {
    label: 'Medium',
    speed: 1.0,
    centrifugal: 0.24,
    offroadDrag: 0.55,
    assist: 0,
    edge: 2.3,
    crashKeep: 0.22,
    ai: [0.84, 0.95],
    aiCorner: 0.011,
    rubberAhead: 0.09,
    rubberBehind: 0.08,
    lives: 3,
    density: 0.8,
    weave: 0.2,
    trialPar: [1.2, 1.07, 0.99],
    dodgeStars: [1500, 4000, 7500],
  },
  hard: {
    label: 'Hard',
    speed: 1.12,
    centrifugal: 0.31,
    offroadDrag: 0.65,
    assist: 0,
    edge: 2.5,
    crashKeep: 0.1,
    ai: [0.93, 1.02],
    aiCorner: 0.01,
    rubberAhead: 0.03,
    rubberBehind: 0.14,
    lives: 3,
    density: 1.05,
    weave: 0.45,
    trialPar: [1.24, 1.1, 1.02],
    dodgeStars: [2000, 5000, 10000],
  },
};

// Garage unlocks — earn stars in any mode to unlock these
const PAINTS = [
  { id: 'red',     name: 'Racing Red',    color: '#e63946', stars: 0 },
  { id: 'blue',    name: 'Electric Blue', color: '#1f7bff', stars: 0 },
  { id: 'green',   name: 'Lime',          color: '#3ddc57', stars: 2 },
  { id: 'yellow',  name: 'Sunshine',      color: '#ffd23f', stars: 4 },
  { id: 'orange',  name: 'Tango',         color: '#ff7b1c', stars: 7 },
  { id: 'purple',  name: 'Grape',         color: '#8f4bff', stars: 10 },
  { id: 'pink',    name: 'Bubblegum',     color: '#ff5fb3', stars: 14 },
  { id: 'teal',    name: 'Lagoon',        color: '#18c6c6', stars: 18 },
  { id: 'black',   name: 'Midnight',      color: '#2a2a36', stars: 24 },
  { id: 'white',   name: 'Ice',           color: '#eef3f8', stars: 30 },
  { id: 'gold',    name: 'Gold',          color: '#e8b923', stars: 45 },
  { id: 'rainbow', name: 'Rainbow',       color: 'rainbow', stars: 65 },
];

const BODIES = [
  { id: 'sport',  name: 'Sport',  stars: 0 },
  { id: 'muscle', name: 'Muscle', stars: 6 },
  { id: 'rocket', name: 'Rocket', stars: 20 },
];

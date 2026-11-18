/* ============================================================
   WEDDINGS-ALBUMS-DATA.JS — Stock data for the Wedding Archive
   Each "folder" is a couple's album: cover, peek prints, photos,
   and an optional `film` (YouTube id) — the couple's wedding film.
   Replace stock Unsplash imagery with client photos later; in
   production these are supplied by the CMS (dashboard → Albums).
   ============================================================ */

const img = (id, w = 1100) =>
  `https://images.unsplash.com/${id}?w=${w}&q=80&auto=format&fit=crop`;

export const albums = [
  {
    couple: 'Aarohi & Vedant',
    location: 'Pune',
    date: 'December 2025',
    description:
      'A two-day celebration at a heritage wada — marigold mornings, a tearful bidaai, and a sangeet that refused to end.',
    film: 'p38a2BZKXLQ',
    cover: img('photo-1606800052052-a08af7148866'),
    photos: [
      img('photo-1606800052052-a08af7148866'),
      img('photo-1583939003579-730e3918a45a'),
      img('photo-1587271407850-8d438ca9fdf2'),
      img('photo-1525772764200-be829a350797'),
      img('photo-1607190074257-dd4b7af0309f'),
      img('photo-1519741497674-611481863552'),
      img('photo-1465495976277-4387d4b0b4c6'),
      img('photo-1532712938310-34cb3982ef74'),
    ],
  },
  {
    couple: 'Nisha & Kabir',
    location: 'Udaipur',
    date: 'February 2026',
    description:
      'An intimate, sun-drenched palace wedding by the lake — raw emotional candids and striking editorial portraiture.',
    film: 'H-9VEi9q1NI',
    cover: img('photo-1519741497674-611481863552'),
    photos: [
      img('photo-1519741497674-611481863552'),
      img('photo-1511285560929-80b456fea0bc'),
      img('photo-1522673607200-164d1b6ce486'),
      img('photo-1591604466107-ec97de577aff'),
      img('photo-1519225421980-715cb0215aed'),
      img('photo-1604017011826-d3b4c23f8914'),
      img('photo-1529636798458-92182e662485'),
    ],
  },
  {
    couple: 'Meera & Arjun',
    location: 'Goa',
    date: 'November 2025',
    description:
      'Barefoot vows at golden hour, salt in the air, and a first dance under string lights by the Arabian Sea.',
    cover: img('photo-1529636798458-92182e662485'),
    photos: [
      img('photo-1529636798458-92182e662485'),
      img('photo-1500530855697-b586d89ba3ee'),
      img('photo-1532712938310-34cb3982ef74'),
      img('photo-1465495976277-4387d4b0b4c6'),
      img('photo-1515934751635-c81c6bc9a2d8'),
      img('photo-1510076857177-7470076d4098'),
      img('photo-1522673607200-164d1b6ce486'),
    ],
  },
  {
    couple: 'Sara & Rohan',
    location: 'Alibaug',
    date: 'January 2026',
    description:
      'A slow, soulful villa wedding for fifty people — handwritten vows, quiet tears, and laughter spilling into the night.',
    cover: img('photo-1515934751635-c81c6bc9a2d8'),
    photos: [
      img('photo-1515934751635-c81c6bc9a2d8'),
      img('photo-1469371670807-013ccf25f16a'),
      img('photo-1519225421980-715cb0215aed'),
      img('photo-1511285560929-80b456fea0bc'),
      img('photo-1583939003579-730e3918a45a'),
      img('photo-1591604466107-ec97de577aff'),
      img('photo-1604017011826-d3b4c23f8914'),
    ],
  },
  {
    couple: 'Ananya & Dhruv',
    location: 'Jaipur',
    date: 'March 2026',
    description:
      'Royal pinks against sandstone forts — a baraat through the old city and portraits worthy of a museum wall.',
    cover: img('photo-1587271407850-8d438ca9fdf2'),
    photos: [
      img('photo-1587271407850-8d438ca9fdf2'),
      img('photo-1525772764200-be829a350797'),
      img('photo-1607190074257-dd4b7af0309f'),
      img('photo-1606800052052-a08af7148866'),
      img('photo-1583939003579-730e3918a45a'),
      img('photo-1532712938310-34cb3982ef74'),
      img('photo-1469371670807-013ccf25f16a'),
    ],
  },
  {
    couple: 'Tara & Vihaan',
    location: 'Mahabaleshwar',
    date: 'October 2025',
    description:
      'Mist over the valley, a mountaintop mandap, and two families dancing in the rain that nobody had planned for.',
    cover: img('photo-1583939003579-730e3918a45a'),
    photos: [
      img('photo-1583939003579-730e3918a45a'),
      img('photo-1510076857177-7470076d4098'),
      img('photo-1500530855697-b586d89ba3ee'),
      img('photo-1511285560929-80b456fea0bc'),
      img('photo-1465495976277-4387d4b0b4c6'),
      img('photo-1519741497674-611481863552'),
      img('photo-1529636798458-92182e662485'),
    ],
  },
];

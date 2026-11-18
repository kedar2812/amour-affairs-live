/* ============================================================
   COUPLE-SHOOTS-ALBUMS-DATA.JS — Stock data for the Couples Archive
   Each "folder" is a couple's pre-wedding / couple session.
   Replace stock Unsplash imagery with client photos later.
   ============================================================ */

const img = (id, w = 1100) =>
  `https://images.unsplash.com/${id}?w=${w}&q=80&auto=format&fit=crop`;

export const albums = [
  {
    couple: 'Riya & Aditya',
    location: 'Vetal Tekdi, Pune',
    date: 'January 2026',
    description:
      'A golden-hour hike above the city — wind, laughter, and the kind of light photographers dream about.',
    cover: img('photo-1500530855697-b586d89ba3ee'),
    photos: [
      img('photo-1500530855697-b586d89ba3ee'),
      img('photo-1510076857177-7470076d4098'),
      img('photo-1583939003579-730e3918a45a'),
      img('photo-1591604466107-ec97de577aff'),
      img('photo-1511285560929-80b456fea0bc'),
      img('photo-1532712938310-34cb3982ef74'),
      img('photo-1522673607200-164d1b6ce486'),
    ],
  },
  {
    couple: 'Ishita & Karan',
    location: 'Old City, Pune',
    date: 'February 2026',
    description:
      'Heritage wadas, chai stalls and rickshaw rides — an unhurried morning in the lanes where their story began.',
    cover: img('photo-1511285560929-80b456fea0bc'),
    photos: [
      img('photo-1511285560929-80b456fea0bc'),
      img('photo-1477959858617-67f85cf4f1df'),
      img('photo-1604017011826-d3b4c23f8914'),
      img('photo-1522673607200-164d1b6ce486'),
      img('photo-1502635385003-ee1e6a1a742d'),
      img('photo-1532712938310-34cb3982ef74'),
      img('photo-1606216794074-735e91aa2c92'),
    ],
  },
  {
    couple: 'Priya & Sameer',
    location: 'Lonavala',
    date: 'November 2025',
    description:
      'Monsoon mist over the ghats, one umbrella between two people, and portraits that feel like a film still.',
    cover: img('photo-1501854140801-50d01698950b'),
    photos: [
      img('photo-1501854140801-50d01698950b'),
      img('photo-1583939003579-730e3918a45a'),
      img('photo-1510076857177-7470076d4098'),
      img('photo-1518568814500-bf0f8d125f46'),
      img('photo-1591604466107-ec97de577aff'),
      img('photo-1500530855697-b586d89ba3ee'),
      img('photo-1533174072545-7a4b6ad7a6c3'),
    ],
  },
  {
    couple: 'Zoya & Imran',
    location: 'Mumbai',
    date: 'December 2025',
    description:
      'Marine Drive at blue hour — sequins, street lights, and a city that played along with the romance.',
    cover: img('photo-1529636798458-92182e662485'),
    photos: [
      img('photo-1529636798458-92182e662485'),
      img('photo-1477959858617-67f85cf4f1df'),
      img('photo-1533174072545-7a4b6ad7a6c3'),
      img('photo-1515934751635-c81c6bc9a2d8'),
      img('photo-1606216794074-735e91aa2c92'),
      img('photo-1465495976277-4387d4b0b4c6'),
      img('photo-1522673607200-164d1b6ce486'),
    ],
  },
  {
    couple: 'Kavya & Nikhil',
    location: 'Gokarna',
    date: 'March 2026',
    description:
      'Two days by the sea — barefoot walks, cliff-top sunsets, and salt-air candids nobody had to pose for.',
    cover: img('photo-1510076857177-7470076d4098'),
    photos: [
      img('photo-1510076857177-7470076d4098'),
      img('photo-1476514525535-07fb3b4ae5f1'),
      img('photo-1500530855697-b586d89ba3ee'),
      img('photo-1532712938310-34cb3982ef74'),
      img('photo-1591604466107-ec97de577aff'),
      img('photo-1583939003579-730e3918a45a'),
      img('photo-1502635385003-ee1e6a1a742d'),
    ],
  },
  {
    couple: 'Sneha & Aarav',
    location: 'Studio, Pune',
    date: 'October 2025',
    description:
      'Dramatic single-light portraiture in the studio — editorial, intimate, and unmistakably them.',
    cover: img('photo-1516035069371-29a1b244cc32'),
    photos: [
      img('photo-1516035069371-29a1b244cc32'),
      img('photo-1537633552985-df8429e8048b'),
      img('photo-1515934751635-c81c6bc9a2d8'),
      img('photo-1518568814500-bf0f8d125f46'),
      img('photo-1522673607200-164d1b6ce486'),
      img('photo-1606216794074-735e91aa2c92'),
      img('photo-1529636798458-92182e662485'),
    ],
  },
];

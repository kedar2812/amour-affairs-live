/* ============================================================
   PREMIUM-ALBUMS-DATA.JS — Stock data for the Albums & Prints page
   Three collections: 12×12 albums, 15×15 albums, canvas prints.
   Each holds photos of finished products we've crafted.
   `location` / `date` carry the two spec lines shown in the
   card caption and album-view meta. Replace stock Unsplash
   imagery with photos of real client albums later.
   ============================================================ */

const img = (id, w = 1100) =>
  `https://images.unsplash.com/${id}?w=${w}&q=80&auto=format&fit=crop`;

export const albums = [
  {
    couple: '12 × 12 Albums',
    location: 'Lay-Flat Spreads',
    date: 'Leather & Linen',
    description:
      'Our most-loved heirloom format — twelve by twelve inches of lay-flat, edge-to-edge spreads on archival art paper, bound in Italian leather or fine linen with gold-foil name embossing.',
    cover: img('photo-1544947950-fa07a98d237f'),
    photos: [
      img('photo-1544947950-fa07a98d237f'),
      img('photo-1481214110143-ed630356e1bb'),
      img('photo-1512820790803-83ca734da794'),
      img('photo-1457369804613-52c61a468e7d'),
      img('photo-1532012197267-da84d127e765'),
      img('photo-1606800052052-a08af7148866'),
      img('photo-1467533003447-e295ff1b0435'),
    ],
  },
  {
    couple: '15 × 15 Albums',
    location: 'Hand-Stitched',
    date: 'Slipcase Included',
    description:
      'The statement piece. Oversized fifteen by fifteen inch spreads made for full-bleed portraits and panoramas — hand-stitched binding, custom slipcase presentation box, built to be passed down.',
    cover: img('photo-1481214110143-ed630356e1bb'),
    photos: [
      img('photo-1481214110143-ed630356e1bb'),
      img('photo-1519682337058-a94d519337bc'),
      img('photo-1524995997946-a1c2e315a42f'),
      img('photo-1507842217343-583bb7270b66'),
      img('photo-1544947950-fa07a98d237f'),
      img('photo-1512820790803-83ca734da794'),
      img('photo-1467533003447-e295ff1b0435'),
    ],
  },
  {
    couple: 'Canvas Prints',
    location: 'Archival Canvas',
    date: 'Ready To Hang',
    description:
      'Your favourite frame, gallery-large. Archival canvas prints stretched by hand over solid wood frames, ready to hang — from intimate squares for the bedside to wall-filling statements above the sofa.',
    cover: img('photo-1513475382585-d06e58bcb0e0'),
    photos: [
      img('photo-1513475382585-d06e58bcb0e0'),
      img('photo-1505693416388-ac5ce068fe85'),
      img('photo-1493809842364-78817add7ffb'),
      img('photo-1513519245088-0e12902e5a38'),
      img('photo-1467533003447-e295ff1b0435'),
      img('photo-1457369804613-52c61a468e7d'),
    ],
  },
];

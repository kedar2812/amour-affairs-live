/* ============================================================
   WEDDINGS-TESTIMONIALS-DATA.JS — Marquee fallback testimonials
   Amour Affairs · Premium Wedding Photography

   Real client reviews shown in the weddings-page marquee when the
   CMS API is unreachable. The live site prefers testimonials the
   client flags "Show on weddings page" in the dashboard; this is
   only the safety net so the section is never empty.

   `src` mirrors the testimonials-page card photo. In production the
   couple's uploaded photo (dashboard) is used instead; these stock
   shots only appear in offline/fallback mode.
   ============================================================ */

const photo = (id) =>
  `https://images.unsplash.com/${id}?w=600&q=80&auto=format&fit=crop`;

export const fallbackWeddingsTestimonials = [
  {
    quote: "The photos are just amazing. Our guests commented on how skilled you were at capturing such natural photographs, without us even knowing you were there. You truly captured every single moment for us and the album really does contain memories to treasure.",
    name: "Sana & Mustafa",
    location: "Pune",
    src: photo("photo-1519741497674-611481863552"),
  },
  {
    quote: "Amour Affairs is the perfect combination of everything a team of wedding photographers should be. The photographs take you back to the almost fairytale-like dream that the wedding was. The images are crisp, the colours vibrant, and the moments unforgettable.",
    name: "Tasneem & Ammar",
    location: "Dubai",
    src: photo("photo-1591604466107-ec97de577aff"),
  },
  {
    quote: "The team beautifully captured all our wedding memories and each picture has a story to tell. Emotions captured at their best. Thank you for giving us memories to cherish for a lifetime.",
    name: "Naqiyaa & Abdul",
    location: "Pune",
    src: photo("photo-1525772764200-be829a350797"),
  },
  {
    quote: "They added a lot of thought process, effort and planning even before arriving for the shoot. Innumerable candid shots bring detail to the memories and we will cherish them for life. Amour Affairs felt like family.",
    name: "Zoya & Azhar",
    location: "U.S.",
    src: photo("photo-1604017011826-d3b4c23f8914"),
  },
  {
    quote: "Amour Affairs is more than a team of photographers. They are visionaries. They capture every moment and make it a memory that will stay with you forever. Every picture speaks a thousand words.",
    name: "Saahil & Ekta",
    location: "Mumbai",
    src: photo("photo-1606216794074-735e91aa2c92"),
  },
  {
    quote: "We had a fantastic wedding shoot. He ensured that the atmosphere is comfortable and relaxed. The photos were superb. Amazing moments captured. Thank you for the fantastic memories.",
    name: "Dhiraj & Mittal",
    location: "Pune",
    src: photo("photo-1583939003579-730e3918a45a"),
  },
  {
    quote: "It was our priority to find the best candid photographers out there and we are so glad we chose you. We have amazing pictures of our wedding and we can relive those days millions of times through the photos you've captured.",
    name: "Priyanka & Ajinkya",
    location: "Washington",
    src: photo("photo-1511285560929-80b456fea0bc"),
  },
  {
    quote: "They don't just capture moments, they make memories, ones we will cherish for a lifetime. Thank you for helping me relive our special day so beautifully.",
    name: "Neha & Hussein",
    location: "Pune",
    src: photo("photo-1604017011826-d3b4c23f8914"),
  },
  {
    quote: "Taher and his team were very patient, cooperative and calm during all the functions. Working with them was an extremely humble and pleasant experience. The pictures are creative and truly outstanding.",
    name: "Lubayna & Mustafa",
    location: "Singapore",
    src: photo("photo-1522673607200-164d1b6ce486"),
  },
  {
    quote: "You all are the best and we have no words to describe your work as it takes us back to our wonderful memories captured in the frame aesthetically. The wedding film brought all our emotions, happiness and love together with absolute finesse.",
    name: "Tasneem & Hamza",
    location: "Dubai",
    src: photo("photo-1519225421980-715cb0215aed"),
  },
  {
    quote: "You have somehow managed to capture the moment as a whole — it instantly takes us back to how we were feeling and what happened before and after. Looking at the pictures we slowly started reliving each moment all over again.",
    name: "Zahra & Husein",
    location: "Dubai",
    src: photo("photo-1465495976277-4387d4b0b4c6"),
  },
  {
    quote: "Amour Affairs have given us the most magnificent memories of our momentous occasion. Each image is a work of art with great attention to detail. Every moment of our wedding has been captured for eternity.",
    name: "Rashida & Iqbal",
    location: "Pune",
    src: photo("photo-1606800052052-a08af7148866"),
  },
  {
    quote: "He doesn't just capture the shot, he captures the experience. He was more like a friend at the wedding rather than a photographer. Being around him makes you feel like you're with one of your own family members.",
    name: "Shehneela & Shehazad",
    location: "Pune",
    src: photo("photo-1532712938310-34cb3982ef74"),
  },
  {
    quote: "My wedding photographs are beyond amazing. You didn't force us to stage moments, you just happened to somehow be there when those moments happened naturally. You've given us perfect memories of our most perfect days.",
    name: "Mariya & Moiz",
    location: "Dubai",
    src: photo("photo-1529636798458-92182e662485"),
  },
  {
    quote: "Amour Affairs did a remarkable job in capturing the essence of our wedding — the laughter, the tears, the promises made. We couldn't ask for anything better. We will always cherish the moments captured of our big day.",
    name: "Shaista & Ali",
    location: "Abu Dhabi",
    src: photo("photo-1583939003579-730e3918a45a"),
  },
];

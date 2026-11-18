/* ============================================================
   TESTIMONIALS-PAGE-DATA.JS — Bundled fallback testimonials
   Amour Affairs · Premium Wedding Photography

   The full client testimonial archive previously hard-coded in
   testimonials/index.html, split across three marquee rows.
   Used whenever the CMS API is unreachable or has no rows yet.
   Row direction is derived from position: odd rows scroll left,
   even rows scroll right — the alternating pattern is never
   stored, so it cannot be broken by content edits.
   ============================================================ */

const archive = [
  // ── Row 1 ──
  [
    {
      quote: 'The photos are just amazing. Our guests commented on how skilled you were at capturing such natural photographs, without us even knowing you were there. You truly captured every single moment for us and the album really does contain memories to treasure.',
      name: 'Sana & Mustafa',
      location: 'Pune',
      src: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=600&q=80&auto=format&fit=crop',
    },
    {
      quote: 'Amour Affairs is the perfect combination of everything a team of wedding photographers should be. The photographs take you back to the almost fairytale-like dream that the wedding was. The images are crisp, the colours vibrant, and the moments unforgettable.',
      name: 'Tasneem & Ammar',
      location: 'Dubai',
      src: 'https://images.unsplash.com/photo-1591604466107-ec97de577aff?w=600&q=80&auto=format&fit=crop',
    },
    {
      quote: 'The team beautifully captured all our wedding memories and each picture has a story to tell. Emotions captured at their best. Thank you for giving us memories to cherish for a lifetime.',
      name: 'Naqiyaa & Abdul',
      location: 'Pune',
      src: 'https://images.unsplash.com/photo-1606216794074-735e91aa2c92?w=600&q=80&auto=format&fit=crop',
    },
    {
      quote: 'They added a lot of thought process, effort and planning even before arriving for the shoot. Innumerable candid shots bring detail to the memories and we will cherish them for life. Amour Affairs felt like family.',
      name: 'Zoya & Azhar',
      location: 'U.S.',
      src: 'https://images.unsplash.com/photo-1583939003579-730e3918a45a?w=600&q=80&auto=format&fit=crop',
    },
    {
      quote: 'Amour Affairs is more than a team of photographers. They are visionaries. They capture every moment and make it a memory that will stay with you forever. Every picture speaks a thousand words.',
      name: 'Saahil & Ekta',
      location: 'Mumbai',
      src: 'https://images.unsplash.com/photo-1604017011826-d3b4c23f8914?w=600&q=80&auto=format&fit=crop',
    },
    {
      quote: 'We had a fantastic wedding shoot. He ensured that the atmosphere is comfortable and relaxed. The photos were superb. Amazing moments captured. God bless you with your work and thank you for the fantastic memories.',
      name: 'Dhiraj & Mittal',
      location: 'Pune',
      src: 'https://images.unsplash.com/photo-1529636798458-92182e662485?w=600&q=80&auto=format&fit=crop',
    },
    {
      quote: 'It was our priority to find the best candid photographers out there and we are so glad we chose you. We have amazing pictures of our wedding and we can relive those days millions of times through the photos you\'ve captured.',
      name: 'Priyanka & Ajinkya',
      location: 'Washington',
      src: 'https://images.unsplash.com/photo-1537633552985-df8429e8048b?w=600&q=80&auto=format&fit=crop',
    },
    {
      quote: 'They don\'t just capture moments, they make memories, ones we will cherish for a lifetime. Thank you for helping me relive our special day so beautifully.',
      name: 'Neha & Hussein',
      location: 'Pune',
      src: 'https://images.unsplash.com/photo-1522673607200-164d1b6ce486?w=600&q=80&auto=format&fit=crop',
    },
    {
      quote: 'Taher and his team were very patient, cooperative and calm during all the functions. Working with them was an extremely humble and pleasant experience. The pictures are creative and truly outstanding.',
      name: 'Lubayna & Mustafa',
      location: 'Singapore',
      src: 'https://images.unsplash.com/photo-1591604466107-ec97de577aff?w=600&q=80&auto=format&fit=crop',
    },
    {
      quote: 'You all are the best and we have no words to describe your work as it takes us back to our wonderful memories captured in the frame aesthetically. The wedding film brought all our emotions, happiness and love together with absolute finesse.',
      name: 'Tasneem & Hamza',
      location: 'Dubai',
      src: 'https://images.unsplash.com/photo-1541614101331-1a5a3a194e92?w=600&q=80&auto=format&fit=crop',
    },
    {
      quote: 'You have somehow managed to capture the moment as a whole ”” it instantly takes us back to how we were feeling, what we were saying to each other and what happened before and after. Looking at the pictures we slowly started reliving each moment all over again.',
      name: 'Zahra & Husein',
      location: 'Dubai',
      src: 'https://images.unsplash.com/photo-1470290378698-263fa7ca60ab?w=600&q=80&auto=format&fit=crop',
    },
    {
      quote: 'Amour Affairs have given us the most magnificent memories of our momentous occasion. Each image is a work of art with great attention to detail. Every moment of our wedding has been captured for eternity.',
      name: 'Rashida & Iqbal',
      location: 'Pune',
      src: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=600&q=80&auto=format&fit=crop',
    },
    {
      quote: 'He being around makes you feel as if you are engulfed with one of your family members. He doesn\'t just capture the shot, he captures the experience. He was more like a friend at the wedding rather than a photographer.',
      name: 'Shehneela & Shehazad',
      location: 'Pune',
      src: 'https://images.unsplash.com/photo-1583939003579-730e3918a45a?w=600&q=80&auto=format&fit=crop',
    },
    {
      quote: 'My wedding photographs are beyond amazing. You didn\'t force us to stage moments, you just happened to somehow be there when those moments happened naturally. You\'ve given us perfect memories of our most perfect days.',
      name: 'Mariya & Moiz',
      location: 'Dubai',
      src: 'https://images.unsplash.com/photo-1519741347686-c1e0aadf4611?w=600&q=80&auto=format&fit=crop',
    },
    {
      quote: 'Amour Affairs did a remarkable job in capturing the essence of our wedding ”” the laughter, the tears, promises made ”” we couldn\'t ask for anything better. We will always cherish the moments captured of our big day.',
      name: 'Shaista & Ali',
      location: 'Abu Dhabi',
      src: 'https://images.unsplash.com/photo-1509927083803-4bd519298ac4?w=600&q=80&auto=format&fit=crop',
    },
    {
      quote: 'The photographs really do speak for themselves. Not only are they absolutely beautiful but they also reflect the mood of the day quite perfectly. You captured far more than we could have imagined.',
      name: 'Munira & Mohammed',
      location: 'Pune',
      src: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=600&q=80&auto=format&fit=crop',
    },
    {
      quote: 'It was quite easy to work with Amour with their flexibility and professional attitude. It\'s hard not to smile looking at these pictures that take us back to those amazing moments. It couldn\'t have been better.',
      name: 'Zainab & Murtuza',
      location: 'Sweden',
      src: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=600&q=80&auto=format&fit=crop',
    },
    {
      quote: 'I\'ve loved each and every photograph. He captures moments more than people. No matter how much time passes, just browsing through his pictures I know I\'ll be transported right back to the most magical days of my life.',
      name: 'Zainab & Murtaza',
      location: 'Dubai',
      src: 'https://images.unsplash.com/photo-1591604466107-ec97de577aff?w=600&q=80&auto=format&fit=crop',
    },
  ],
  // ── Row 2 ──
  [
    {
      quote: 'Thank you for the tremendous job. The pictures capture each special moment. When you see them, it makes you feel alive and brightens the moments. Appreciate all your energy and creativity in capturing our priceless memories.',
      name: 'Sakina & Juzer',
      location: 'Pune',
      src: 'https://images.unsplash.com/photo-1606216794074-735e91aa2c92?w=600&q=80&auto=format&fit=crop',
    },
    {
      quote: 'I always wished for a fairytale wedding and Amour Affairs exactly captured the feel of it. Whenever I see my photos I feel they helped my dream come true. A wonderful job in capturing all the memories in the most exquisite and professional way.',
      name: 'Sumaiyah & Danish',
      location: 'Dubai',
      src: 'https://images.unsplash.com/photo-1583939003579-730e3918a45a?w=600&q=80&auto=format&fit=crop',
    },
    {
      quote: 'FAB was an understatement for the quality delivered. The quality and the moments captured changed the whole outlook and meaning of photography for us. Its not always about a pose, its about the right timing.',
      name: 'Madhavi & Abhishek',
      location: 'Pune',
      src: 'https://images.unsplash.com/photo-1604017011826-d3b4c23f8914?w=600&q=80&auto=format&fit=crop',
    },
    {
      quote: 'A tear rolled down my eye when I saw my wedding trailer for the first time. You brought together all the moments in a beautiful wedding film. You have dealt very sweetly with all our requests while bringing absolute professionalism.',
      name: 'Swati & Aalap',
      location: 'Pune',
      src: 'https://images.unsplash.com/photo-1529636798458-92182e662485?w=600&q=80&auto=format&fit=crop',
    },
    {
      quote: 'We love the photos and they are amazing! Everyone loves our pictures. Thank you for making such a good masterpiece for us. It was a pleasure to work with your team.',
      name: 'Saumya & Abhishek',
      location: 'Pune',
      src: 'https://images.unsplash.com/photo-1537633552985-df8429e8048b?w=600&q=80&auto=format&fit=crop',
    },
    {
      quote: 'The images capture each moment and each emotion stunningly and will continue to remind us of the amazing time we had at our wedding. It has been a pleasure working with the Amour Affairs team.',
      name: 'Amruta & Akshay',
      location: 'Singapore',
      src: 'https://images.unsplash.com/photo-1522673607200-164d1b6ce486?w=600&q=80&auto=format&fit=crop',
    },
    {
      quote: 'The comfort they bring to you while clicking pictures is super. We had such amazing natural photographs and we were not even aware we were getting clicked. They captured emotion rather than just a picture.',
      name: 'Sofia & Arshad',
      location: 'Pune',
      src: 'https://images.unsplash.com/photo-1591604466107-ec97de577aff?w=600&q=80&auto=format&fit=crop',
    },
    {
      quote: 'In his case he didn\'t have to be told anything, he managed everything well. He seemed professional and intelligent and took great pictures. I will surely recommend him to my friends.',
      name: 'Geeta & Ashok',
      location: 'Pune',
      src: 'https://images.unsplash.com/photo-1541614101331-1a5a3a194e92?w=600&q=80&auto=format&fit=crop',
    },
    {
      quote: 'Taher really knows what he is doing, which in turn gave us immense confidence on the day itself. We now have such amazing photos that we will treasure for life. We could not have chosen a better photographer.',
      name: 'Vinita & Piyush',
      location: 'New Delhi',
      src: 'https://images.unsplash.com/photo-1470290378698-263fa7ca60ab?w=600&q=80&auto=format&fit=crop',
    },
    {
      quote: 'Just wanna say they were not just pictures taken, they were moments captured. Very happy with the service and outcome. Each and every picture is awesome.',
      name: 'Archana & Rejoy',
      location: 'Pune',
      src: 'https://images.unsplash.com/photo-1537633552985-df8429e8048b?w=600&q=80&auto=format&fit=crop',
    },
    {
      quote: 'Thank you for making our wedding so beautiful through your lens. It was great working with you and we would definitely be giving your reference to all our friends and family.',
      name: 'Deepika & Karan',
      location: 'New Delhi',
      src: 'https://images.unsplash.com/photo-1522673607200-164d1b6ce486?w=600&q=80&auto=format&fit=crop',
    },
    {
      quote: 'After seeing what Taher had clicked, we were all amazed at what he had captured. Every moment captured has its own little story. You all are truly talented and wonderful at what you do.',
      name: 'Gayatri & Nikhil',
      location: 'Pune',
      src: 'https://images.unsplash.com/photo-1591604466107-ec97de577aff?w=600&q=80&auto=format&fit=crop',
    },
    {
      quote: 'Your work is exceptional and it speaks for itself. You are there at all the right places, capturing the moments and making them outstanding with your creative touch. Its not just pictures but memories captured with a timeless appeal.',
      name: 'Mamta & Tejender',
      location: 'Kuwait',
      src: 'https://images.unsplash.com/photo-1541614101331-1a5a3a194e92?w=600&q=80&auto=format&fit=crop',
    },
    {
      quote: 'We are glad to have a large collection of beautiful candid moments captured, popping up a smile on our family\'s faces every time we come together to see them. Keep up the good work.',
      name: 'Khushboo & Sahil',
      location: 'Pune',
      src: 'https://images.unsplash.com/photo-1470290378698-263fa7ca60ab?w=600&q=80&auto=format&fit=crop',
    },
    {
      quote: 'Our pictures look alive! We cannot thank you enough for being so patient with us. Each moment is captured so beautifully as if it was rehearsed. The magical aura of every picture is just incomparable.',
      name: 'Nikita & Swaroop',
      location: 'Nasik',
      src: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=600&q=80&auto=format&fit=crop',
    },
    {
      quote: 'Exceptionally good work. Beautiful natural moments shot. Every time I see the pictures it takes me back to my most memorable day. A visual delight of reliving that day with every shot.',
      name: 'Afsha & Mohosin',
      location: 'Bangalore',
      src: 'https://images.unsplash.com/photo-1583939003579-730e3918a45a?w=600&q=80&auto=format&fit=crop',
    },
    {
      quote: 'He perfectly captured not only the venue and the outfits but also the emotions on our faces. He brings so much energy and light to all the pictures. An exceptionally brilliant photographer.',
      name: 'Shrishti & Karan',
      location: 'Mumbai',
      src: 'https://images.unsplash.com/photo-1519741347686-c1e0aadf4611?w=600&q=80&auto=format&fit=crop',
    },
    {
      quote: 'The photos are just fantastic. You really have left us with a stunning visual diary of the day. Thank you for capturing every single moment for us and the photos really do contain memories to treasure.',
      name: 'Harsha & Anup',
      location: 'Pune',
      src: 'https://images.unsplash.com/photo-1509927083803-4bd519298ac4?w=600&q=80&auto=format&fit=crop',
    },
  ],
  // ── Row 3 ──
  [
    {
      quote: 'We have gotten some unbelievable comments from friends and family. They say we look like we are in a movie, out of a magazine. Our wedding photographs captured and preserved our many memories of our magical day.',
      name: 'Prianca & Karan',
      location: 'Mumbai',
      src: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=600&q=80&auto=format&fit=crop',
    },
    {
      quote: 'Thoroughly professional, great at making the couple feel at ease. Thank you for capturing our best moments and giving us a chance to relive the moments every time we see the pictures.',
      name: 'Yukti & Kamesh',
      location: 'Pune',
      src: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=600&q=80&auto=format&fit=crop',
    },
    {
      quote: 'Each and every picture captures the beautiful emotions and essence of the wedding. Most importantly looking at each picture warms your heart and makes you smile. A very professional team.',
      name: 'Rashida & Mustafa',
      location: 'London',
      src: 'https://images.unsplash.com/photo-1591604466107-ec97de577aff?w=600&q=80&auto=format&fit=crop',
    },
    {
      quote: 'Planning a wedding can be a very stressful time, but Taher immediately put our minds at ease with his calm, measured approach. The end results are truly amazing, something we will cherish for the rest of our lives.',
      name: 'Sarrah & Aliasgar',
      location: 'Pune',
      src: 'https://images.unsplash.com/photo-1606216794074-735e91aa2c92?w=600&q=80&auto=format&fit=crop',
    },
    {
      quote: 'The images look crisp, fresh and bring a sense of satisfaction on how beautifully the moments have been captured. Amour Affairs indeed offers a complete package of enticing and dazzling moments.',
      name: 'Jyoti & Saurabh',
      location: 'Pune',
      src: 'https://images.unsplash.com/photo-1583939003579-730e3918a45a?w=600&q=80&auto=format&fit=crop',
    },
    {
      quote: 'Your professionalism, the way you made us feel comfortable, your poses for us were amazing. I was surprised I looked so pretty in the pictures. You are wonderful guys to work with.',
      name: 'Namrata & Chris',
      location: 'Texas',
      src: 'https://images.unsplash.com/photo-1604017011826-d3b4c23f8914?w=600&q=80&auto=format&fit=crop',
    },
    {
      quote: 'You guys are completely magical. The photos and movie have come out mind blowing. You have exceeded our expectations. These memories are not just memories but a life event, magical and mesmerizing.',
      name: 'Tejaswini & Nikhil',
      location: 'Pune',
      src: 'https://images.unsplash.com/photo-1529636798458-92182e662485?w=600&q=80&auto=format&fit=crop',
    },
    {
      quote: 'Each picture has a different story to tell, full of emotions captured at the right moment. We would definitely recommend Amour Affairs to all couples out there ready to get hooked for life.',
      name: 'Silky & Sujeet',
      location: 'Pune',
      src: 'https://images.unsplash.com/photo-1537633552985-df8429e8048b?w=600&q=80&auto=format&fit=crop',
    },
    {
      quote: 'The pics are absolutely fantastic! Stunning shots, and the post processing is just spot on perfect, vibrant colors and great lighting. The candid shots are very nice indeed. We\'re glad we picked you.',
      name: 'Madhu & Sudipto',
      location: 'Oregon',
      src: 'https://images.unsplash.com/photo-1522673607200-164d1b6ce486?w=600&q=80&auto=format&fit=crop',
    },
    {
      quote: 'During the celebrations Amour Affairs became a part of our family. They have provided us with such amazing candid pictures that it feels there couldn\'t have been a better way to relive those moments.',
      name: 'Neelam & Jeetendra',
      location: 'Aurangabad',
      src: 'https://images.unsplash.com/photo-1591604466107-ec97de577aff?w=600&q=80&auto=format&fit=crop',
    },
    {
      quote: 'When choosing our photographer, the photos instantly stood out above the rest. Amazing photography, professional service and abundant creative flair. You have truly captured the essence of our day.',
      name: 'Meenal & Shakti',
      location: 'Pune',
      src: 'https://images.unsplash.com/photo-1541614101331-1a5a3a194e92?w=600&q=80&auto=format&fit=crop',
    },
    {
      quote: 'He alone captured the entire wedding and made those special moments last forever. Thank you for the memories which we will cherish for a lifetime.',
      name: 'Neha & Vaibhav',
      location: 'Pune',
      src: 'https://images.unsplash.com/photo-1470290378698-263fa7ca60ab?w=600&q=80&auto=format&fit=crop',
    },
    {
      quote: 'The pictures have captured everything from the entry of bride and groom to all the pujas, friends and family. Wedding itself is beautiful but pictures like these make it an absolute delight.',
      name: 'Neha & Punit',
      location: 'Noida',
      src: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=600&q=80&auto=format&fit=crop',
    },
    {
      quote: 'They gave us more than we expected and we are tremendously grateful. Put your faith in them and you\'ll have the sweetest memories to look back on forever.',
      name: 'Akshay & Sapna',
      location: 'Pune',
      src: 'https://images.unsplash.com/photo-1583939003579-730e3918a45a?w=600&q=80&auto=format&fit=crop',
    },
    {
      quote: 'The pictures and videos have left us awestruck. Very well presented and aptly portrayed every aspect of the wedding which we will cherish for a lifetime. A big thank you for weaving their magic so beautifully.',
      name: 'Gautam & Karishma',
      location: 'Pune',
      src: 'https://images.unsplash.com/photo-1519741347686-c1e0aadf4611?w=600&q=80&auto=format&fit=crop',
    },
    {
      quote: 'It was all natural and we hardly felt his presence until we heard the click. I have an album full of photos and memories to thank him for. Highly, highly recommended.',
      name: 'Gayatri & Avinash',
      location: 'Pune',
      src: 'https://images.unsplash.com/photo-1509927083803-4bd519298ac4?w=600&q=80&auto=format&fit=crop',
    },
    {
      quote: 'We loved the attitude, patience and creativeness of the team during our shoots. Each and every photo was just so beautiful. They just make us relive the memories every time we look at the photos.',
      name: 'Sidesh & Kiarah',
      location: 'Pune',
      src: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=600&q=80&auto=format&fit=crop',
    },
  ],
];

// The testimonials page now runs two marquee rows (row 1 left, row 2 right).
// Flatten the archive and split it evenly so every unique review still shows,
// just redistributed across the two rows.
const _flat = archive.flat();
const _half = Math.ceil(_flat.length / 2);
export const fallbackTestimonialRows = [
  _flat.slice(0, _half),
  _flat.slice(_half),
];

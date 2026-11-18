/* ============================================================
   GALLERY.JS — Custom Instagram Feed Renderer
   Amour Affairs · Premium Wedding Photography
   Fetches dynamic JSON feed and renders masonry grid
   ============================================================ */

export async function initInstagramFeed() {
  const container = document.getElementById('instaFeed');
  if (!container) return;

  try {
    const response = await fetch('https://feeds.behold.so/5zyZIu1WdFvY5icC6QCN');
    const data = await response.json();
    
    // We only need the latest 6 posts
    const posts = data.posts.slice(0, 6);

    container.innerHTML = posts.map((post, i) => {
      // Prioritize medium size if available, fallback to original mediaUrl
      const thumb = post.sizes?.medium?.mediaUrl || post.mediaUrl;
      let caption = post.prunedCaption || post.caption || "Amour Affairs Instagram Post";
      
      // Truncate caption if it's too long
      if (caption.length > 80) {
        caption = caption.substring(0, 80) + '...';
      }

      return `
        <a
          href="${post.permalink}"
          target="_blank"
          rel="noopener noreferrer"
          class="insta-tile"
          id="insta-post-${post.id}"
          style="animation-delay: ${i * 0.1}s"
          aria-label="View post on Instagram"
        >
          <div class="insta-tile__inner">
            <img
              src="${thumb}"
              alt="${caption.replace(/"/g, '&quot;')}"
              loading="lazy"
              decoding="async"
              width="320"
              height="320"
              class="insta-tile__img"
            >
            <div class="insta-tile__overlay">
              <div class="insta-tile__overlay-body">
                <svg class="insta-tile__ig-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
                </svg>
                <p class="insta-tile__caption">${caption}</p>
                <span class="insta-tile__cta">View Post ↗</span>
              </div>
            </div>
          </div>
        </a>
      `;
    }).join('');

    // Staggered reveal
    const tiles = container.querySelectorAll('.insta-tile');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('insta-tile--visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });

    tiles.forEach(tile => observer.observe(tile));

  } catch (error) {
    console.error('Error fetching Instagram feed:', error);
    container.innerHTML = `<p style="color: var(--color-text-dim);">Unable to load Instagram feed at this time.</p>`;
  }
}

-- ============================================================
-- AMOUR AFFAIRS — Complete Database Schema
-- MySQL 5.7+ / MariaDB 10.3+
--
-- FRESH INSTALLS ONLY. The seed INSERTs below are not
-- idempotent — re-running this file on an existing database
-- fails on duplicate keys (and would duplicate testimonials).
-- To upgrade an existing database, run api/migrations.sql,
-- which is guarded and safe to run any number of times.
-- ============================================================

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET AUTOCOMMIT = 0;
START TRANSACTION;
SET time_zone = "+05:30";
-- Force a 4-byte-capable client connection so emoji in the seed data
-- (festival icons, greeting templates) store intact. Without this, an
-- import over a latin1/utf8(3-byte) client silently turns every 4-byte
-- emoji (🎂 🎉 🪔 …) into a literal "?" even though the columns are utf8mb4.
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ────────────────────────────────────────────────────────────
-- 1. ADMIN USERS (Authentication)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `admin_users` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `email` VARCHAR(255) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `role` ENUM('super_admin','admin','editor') NOT NULL DEFAULT 'admin',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `last_login` DATETIME DEFAULT NULL,
  `login_attempts` TINYINT UNSIGNED NOT NULL DEFAULT 0,
  `locked_until` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Default admin user is created by api/seed.php (password set there, stored hashed)

-- ────────────────────────────────────────────────────────────
-- 2. REFRESH TOKENS (Secure Token Rotation)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `refresh_tokens` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT UNSIGNED NOT NULL,
  `token_hash` VARCHAR(64) NOT NULL,
  `expires_at` DATETIME NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user` (`user_id`),
  KEY `idx_token` (`token_hash`),
  KEY `idx_expires` (`expires_at`),
  CONSTRAINT `fk_refresh_user` FOREIGN KEY (`user_id`) REFERENCES `admin_users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ────────────────────────────────────────────────────────────
-- 3. GALLERY IMAGES
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `gallery_images` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `category` ENUM('wedding','couple_shoot','film','premium_album','general') NOT NULL,
  `album_id` INT UNSIGNED DEFAULT NULL, -- FK to albums (constraint added after albums table, section 15)
  `title` VARCHAR(255) DEFAULT NULL,
  `caption` VARCHAR(500) DEFAULT NULL,
  `file_path` VARCHAR(500) NOT NULL,
  `thumbnail_path` VARCHAR(500) DEFAULT NULL,
  `original_filename` VARCHAR(255) DEFAULT NULL,
  `file_size` INT UNSIGNED DEFAULT NULL,
  `width` SMALLINT UNSIGNED DEFAULT NULL,
  `height` SMALLINT UNSIGNED DEFAULT NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  `is_featured` TINYINT(1) NOT NULL DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `uploaded_by` INT UNSIGNED DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_category` (`category`, `is_active`, `sort_order`),
  KEY `idx_featured` (`is_featured`, `is_active`),
  KEY `idx_album` (`album_id`, `is_active`, `sort_order`),
  CONSTRAINT `fk_gallery_user` FOREIGN KEY (`uploaded_by`) REFERENCES `admin_users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ────────────────────────────────────────────────────────────
-- 4. PACKAGES
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `packages` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(150) NOT NULL,
  `category` VARCHAR(50) NOT NULL DEFAULT 'Wedding',
  `price` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `description` TEXT DEFAULT NULL,
  `inclusions` JSON DEFAULT NULL,
  `addons` JSON DEFAULT NULL,
  `required_roles` JSON DEFAULT NULL,
  `popularity` TINYINT UNSIGNED NOT NULL DEFAULT 0,
  `bookings_count` INT UNSIGNED NOT NULL DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_category` (`category`, `is_active`),
  KEY `idx_active` (`is_active`, `sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ────────────────────────────────────────────────────────────
-- 5. TEAM MEMBERS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `team_members` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(150) NOT NULL,
  `role` VARCHAR(100) NOT NULL,
  `status` ENUM('Available','On Shoot','Editing','On Leave') NOT NULL DEFAULT 'Available',
  `current_assignment` VARCHAR(255) DEFAULT NULL,
  `phone` VARCHAR(30) DEFAULT NULL,
  `email` VARCHAR(255) DEFAULT NULL,
  `avatar_initials` VARCHAR(5) DEFAULT NULL,
  `photo_path` VARCHAR(500) DEFAULT NULL,
  `bio` TEXT DEFAULT NULL,
  `skills` JSON DEFAULT NULL,
  `equipment` JSON DEFAULT NULL,
  `rating` DECIMAL(2,1) NOT NULL DEFAULT 0.0,
  `on_time_delivery_rate` TINYINT UNSIGNED NOT NULL DEFAULT 0,
  `month_earnings` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `upcoming_shoots_count` INT UNSIGNED NOT NULL DEFAULT 0,
  `join_date` DATE DEFAULT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_active` (`is_active`, `sort_order`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ────────────────────────────────────────────────────────────
-- 6. TESTIMONIALS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `testimonials` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `client_name` VARCHAR(150) NOT NULL,
  `event_type` VARCHAR(50) DEFAULT 'Wedding',
  `event_date` DATE DEFAULT NULL,
  `review_text` TEXT NOT NULL,
  `rating` TINYINT UNSIGNED NOT NULL DEFAULT 5,
  `photo_path` VARCHAR(500) DEFAULT NULL,
  `city` VARCHAR(100) DEFAULT NULL,
  `is_featured` TINYINT(1) NOT NULL DEFAULT 0,
  `show_on_weddings` TINYINT(1) NOT NULL DEFAULT 0,
  -- Testimonials-page marquee row (1, 2, 3, ...). 0 = not yet assigned;
  -- scroll direction is derived from row position, never stored.
  `marquee_row` TINYINT UNSIGNED NOT NULL DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_active` (`is_active`, `sort_order`),
  KEY `idx_featured` (`is_featured`, `is_active`),
  KEY `idx_weddings` (`show_on_weddings`, `is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ────────────────────────────────────────────────────────────
-- 7. SETTINGS (Key-Value Store)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `settings` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `setting_key` VARCHAR(100) NOT NULL,
  `setting_value` TEXT DEFAULT NULL,
  `setting_group` VARCHAR(50) NOT NULL DEFAULT 'general',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_key` (`setting_key`),
  KEY `idx_group` (`setting_group`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Default settings
INSERT INTO `settings` (`setting_key`, `setting_value`, `setting_group`) VALUES
('studio_name', 'Amour Affairs', 'profile'),
('studio_tagline', 'Photography Studio', 'profile'),
('studio_email', 'info@amouraffairs.in', 'profile'),
('studio_phone', '+91 9921000052', 'profile'),
('studio_whatsapp', '919921000052', 'profile'),
('studio_address', 'Rowshni Bungalow,
5, Finance Road,
Opp. Ministry of Defence,
Agarkar Nagar,
Pune, Maharashtra — 411001,
India', 'profile'),
('studio_rating_value', '4.9', 'profile'),
('studio_review_count', '198', 'profile'),
('social_instagram', 'https://www.instagram.com/amouraffairs/', 'social'),
('social_facebook', 'https://www.facebook.com/memoriesbyamouraffairs/', 'social'),
('social_youtube', 'https://www.youtube.com/channel/UCYGQScVZ25nK3Ti-O-Xuo4g', 'social'),
('social_pinterest', 'https://in.pinterest.com/amouraffairs/', 'social'),
('social_vimeo', 'https://vimeo.com/amouraffairs', 'social'),
('hero_stat_weddings', '500+', 'hero'),
('hero_stat_years', '15+', 'hero'),
('hero_stat_couples', '1000+', 'hero'),
('hero_headline', 'Beyond the moment, we capture the eternal.', 'hero'),
('hero_description', 'Pune''s most celebrated wedding photographers and filmmakers. We immortalize every stolen glance, every teardrop of joy — crafting cinematic love stories that endure a lifetime.', 'hero'),
-- Urgency / booking-availability notice (announcement bar + floating badge)
('notice_enabled', '1', 'notice'),
('notice_message', 'Now booking 2026 & 2027 weddings — limited dates remain', 'notice'),
('notice_cta_label', 'Check your date', 'notice'),
('notice_cta_link', '/contact/', 'notice'),
('notice_bar_enabled', '1', 'notice'),
('notice_bar_position', 'top', 'notice'),
('notice_bg_color', '#2A1E16', 'notice'),
('notice_text_color', '#F5EDE2', 'notice'),
('notice_dismissible', '1', 'notice'),
('notice_badge_enabled', '1', 'notice'),
('notice_badge_text', 'Limited 2026 dates', 'notice');

-- ────────────────────────────────────────────────────────────
-- 8. CLIENTS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `clients` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(200) NOT NULL,
  `phone` VARCHAR(30) DEFAULT NULL,
  `email` VARCHAR(255) DEFAULT NULL,
  `whatsapp` VARCHAR(30) DEFAULT NULL,
  `instagram` VARCHAR(255) DEFAULT NULL,
  `city` VARCHAR(100) DEFAULT NULL,
  `type` ENUM('Wedding','Corporate','Individual') NOT NULL DEFAULT 'Wedding',
  `total_bookings` INT UNSIGNED NOT NULL DEFAULT 0,
  `total_spend` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `last_shoot_date` DATE DEFAULT NULL,
  `rating` DECIMAL(2,1) NOT NULL DEFAULT 0.0,
  `tags` JSON DEFAULT NULL,
  `notes` TEXT DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_type` (`type`),
  KEY `idx_name` (`name`(100))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ────────────────────────────────────────────────────────────
-- 9. BOOKINGS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `bookings` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `booking_ref` VARCHAR(20) NOT NULL,
  `client_id` INT UNSIGNED DEFAULT NULL,
  `client_name` VARCHAR(200) NOT NULL,
  `event_type` VARCHAR(50) NOT NULL DEFAULT 'Wedding',
  `date_start` DATETIME NOT NULL,
  `date_end` DATETIME NOT NULL,
  `venue` VARCHAR(255) DEFAULT NULL,
  `city` VARCHAR(100) DEFAULT NULL,
  `package_id` INT UNSIGNED DEFAULT NULL,
  `package_name` VARCHAR(150) DEFAULT NULL,
  `team_assigned` JSON DEFAULT NULL,
  `amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `status` ENUM('Pending','Confirmed','Completed','Cancelled') NOT NULL DEFAULT 'Pending',
  `notes` TEXT DEFAULT NULL,
  `timeline` JSON DEFAULT NULL,
  `payment_total` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `payment_paid` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `payment_due` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_ref` (`booking_ref`),
  KEY `idx_client` (`client_id`),
  KEY `idx_status` (`status`),
  KEY `idx_date` (`date_start`),
  CONSTRAINT `fk_booking_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_booking_package` FOREIGN KEY (`package_id`) REFERENCES `packages` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ────────────────────────────────────────────────────────────
-- 10. LEADS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `leads` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `lead_ref` VARCHAR(20) NOT NULL,
  `client_name` VARCHAR(200) NOT NULL,
  `phone` VARCHAR(30) DEFAULT NULL,
  `email` VARCHAR(255) DEFAULT NULL,
  `instagram` VARCHAR(255) DEFAULT NULL,
  `event_type` VARCHAR(50) NOT NULL DEFAULT 'Wedding',
  `event_date` DATE DEFAULT NULL,
  `venue` VARCHAR(255) DEFAULT NULL,
  `guest_count` VARCHAR(50) DEFAULT NULL,
  `budget_range` VARCHAR(100) DEFAULT NULL,
  `bride_name` VARCHAR(200) DEFAULT NULL,
  `bride_phone` VARCHAR(30) DEFAULT NULL,
  `bride_whatsapp` VARCHAR(30) DEFAULT NULL,
  `groom_name` VARCHAR(200) DEFAULT NULL,
  `groom_phone` VARCHAR(30) DEFAULT NULL,
  `groom_whatsapp` VARCHAR(30) DEFAULT NULL,
  `referrer_name` VARCHAR(200) DEFAULT NULL,
  `source` VARCHAR(120) NOT NULL DEFAULT 'Website',
  `stage` ENUM('New Inquiry','Contacted','Consultation Scheduled','Proposal Sent','Won','Lost') NOT NULL DEFAULT 'New Inquiry',
  `assigned_to` INT UNSIGNED DEFAULT NULL,
  `last_activity` DATETIME DEFAULT NULL,
  `moved_to_stage_at` DATETIME DEFAULT NULL,
  `notes` JSON DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_ref` (`lead_ref`),
  KEY `idx_stage` (`stage`),
  KEY `idx_source` (`source`),
  KEY `idx_assigned` (`assigned_to`),
  CONSTRAINT `fk_lead_team` FOREIGN KEY (`assigned_to`) REFERENCES `team_members` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ────────────────────────────────────────────────────────────
-- 11. INVOICES
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `invoices` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `invoice_ref` VARCHAR(20) NOT NULL,
  `client_id` INT UNSIGNED DEFAULT NULL,
  `client_name` VARCHAR(200) NOT NULL,
  `booking_id` INT UNSIGNED DEFAULT NULL,
  `booking_ref` VARCHAR(20) DEFAULT NULL,
  `issue_date` DATE NOT NULL,
  `due_date` DATE NOT NULL,
  `amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `amount_paid` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `status` ENUM('Paid','Partially Paid','Pending','Overdue') NOT NULL DEFAULT 'Pending',
  `items` JSON DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_ref` (`invoice_ref`),
  KEY `idx_client` (`client_id`),
  KEY `idx_booking` (`booking_id`),
  KEY `idx_status` (`status`),
  CONSTRAINT `fk_invoice_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_invoice_booking` FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ────────────────────────────────────────────────────────────
-- 12. TRANSACTIONS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `transactions` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `transaction_ref` VARCHAR(20) NOT NULL,
  `date` DATETIME NOT NULL,
  `client_id` INT UNSIGNED DEFAULT NULL,
  `client_name` VARCHAR(200) NOT NULL,
  `booking_id` INT UNSIGNED DEFAULT NULL,
  `booking_ref` VARCHAR(20) DEFAULT NULL,
  `method` ENUM('UPI','Bank Transfer','Cash','Card') NOT NULL DEFAULT 'UPI',
  `amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `notes` TEXT DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_ref` (`transaction_ref`),
  KEY `idx_client` (`client_id`),
  KEY `idx_booking` (`booking_id`),
  KEY `idx_date` (`date`),
  CONSTRAINT `fk_txn_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_txn_booking` FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ────────────────────────────────────────────────────────────
-- 13. RATE LIMITING (Brute force protection)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `rate_limits` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `ip_address` VARCHAR(45) NOT NULL,
  `endpoint` VARCHAR(100) NOT NULL,
  `attempts` INT UNSIGNED NOT NULL DEFAULT 1,
  `window_start` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ip_endpoint` (`ip_address`, `endpoint`, `window_start`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ────────────────────────────────────────────────────────────
-- 14. AUDIT LOG (Track all admin actions)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `audit_log` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT UNSIGNED DEFAULT NULL,
  `action` VARCHAR(50) NOT NULL,
  `entity_type` VARCHAR(50) NOT NULL,
  `entity_id` INT UNSIGNED DEFAULT NULL,
  `details` JSON DEFAULT NULL,
  `ip_address` VARCHAR(45) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user` (`user_id`),
  KEY `idx_entity` (`entity_type`, `entity_id`),
  KEY `idx_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ────────────────────────────────────────────────────────────
-- 15. ALBUMS (Website archives: weddings, couple shoots, premium albums)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `albums` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `type` ENUM('wedding','couple_shoot','premium_album') NOT NULL DEFAULT 'wedding',
  `couple` VARCHAR(200) NOT NULL,
  `location` VARCHAR(150) DEFAULT NULL,
  `date_label` VARCHAR(100) DEFAULT NULL,
  `description` TEXT DEFAULT NULL,
  `film_youtube_id` VARCHAR(20) DEFAULT NULL,
  `cover_path` VARCHAR(500) DEFAULT NULL,
  `cover_thumbnail` VARCHAR(500) DEFAULT NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_by` INT UNSIGNED DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_type` (`type`, `is_active`, `sort_order`),
  CONSTRAINT `fk_album_user` FOREIGN KEY (`created_by`) REFERENCES `admin_users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Album photos live in gallery_images via album_id (deleting an album removes its photos)
ALTER TABLE `gallery_images`
  ADD CONSTRAINT `fk_gallery_album` FOREIGN KEY (`album_id`) REFERENCES `albums` (`id`) ON DELETE CASCADE;

-- ────────────────────────────────────────────────────────────
-- 16. FILMS (YouTube films shown on the Films page)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `films` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `youtube_id` VARCHAR(20) NOT NULL,
  `title` VARCHAR(200) NOT NULL,
  `caption` VARCHAR(200) DEFAULT NULL,
  `is_featured` TINYINT(1) NOT NULL DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_youtube` (`youtube_id`),
  KEY `idx_active` (`is_active`, `sort_order`),
  KEY `idx_featured` (`is_featured`, `is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Real Amour Affairs films currently shown on the website
-- (is_featured = 1 → eligible for the "Now Showing" random pool)
INSERT INTO `films` (`youtube_id`, `title`, `caption`, `is_featured`, `sort_order`) VALUES
('p38a2BZKXLQ', 'Annie & Shyam', 'Wedding Trailer', 1, 1),
('H-9VEi9q1NI', 'Taniya & Neeraj', 'Della Resorts, Lonavla', 1, 2),
('53z3LB8dXo0', 'Neha & Gaurav', 'Wedding Teaser', 1, 3),
('gvlezU6RDC0', 'Medini & Abishal', 'Haldi Highlight', 1, 4),
('8GXP7T-o72U', 'Annie & Shyam', 'Final Trailer', 1, 5),
('cHWYpSlPYE8', 'Disha & Kunal', 'Prewedding Film', 1, 6),
('WN0VRFZKPTA', 'Bhairavi & Apurv', 'Wedding Trailer 2019', 0, 7),
('I2lyZU1mL7U', 'Suraksha & Harsh', 'Oxford Golf Resort, Pune', 0, 8),
('llT0dTpTGQU', 'Medini & Abishal', 'Final Trailer', 0, 9),
('xPad7IwJumE', 'Medini & Abishal', 'A Tale of Two Hearts', 0, 10),
('gxecVMBOajM', 'Bansri & Chintan', 'Dream Wedding, Rishikesh', 0, 11);

-- Real client testimonials (source: all_testimonials.txt).
-- is_featured = 1 → shown in the home-page carousel; those six use
-- shorter curated excerpts so they fit the carousel layout. The rest
-- are stored full-length for dashboard curation / future pages.
INSERT INTO `testimonials` (`client_name`, `event_type`, `review_text`, `city`, `is_featured`, `sort_order`) VALUES
('Sarrah & Aliasgar', 'Wedding', 'Planning a wedding can be a very stressful time, but Taher immediately put our minds at ease with his calm, measured approach. On the day he blended into the background, capturing an array of shots we didn''t think were possible. The end results are truly amazing, something we will cherish for the rest of our lives together. You are utterly brilliant, and we are already recommending you to others.', 'Pune', 1, 1),
('Tasneem & Ammar', 'Wedding', 'Amour Affairs is the perfect combination of everything a team of wedding photographers should be. Taher and his team surpassed every expectation. Not only were they magically present wherever a shot was required, they were punctual and worked well with the family and guests. The photographs take you back to the almost fairytale-like dream that the wedding was. The images are crisp, the colours vibrant, and the moments unforgettable.', 'Dubai', 1, 2),
('Shaista & Ali', 'Wedding', 'As a little girl I dreamed of piecing my wedding together bit by bit as I flipped through vintage photographs of my parents — picturing what it would be like one day for me. Amour Affairs has given us just that. We will always cherish the moments captured of our big day and I''m certain so will our little ones. Amour Affairs did a remarkable job in capturing the essence of our wedding — the laughter, the tears, promises made — we couldn''t ask for anything better.', 'Abu Dhabi', 1, 3),
('Prianca & Karan', 'Wedding', 'We wanted to thank Amour Affairs for their incredible ability to capture the essence of our wedding day in such an enchanting way. We have gotten some unbelievable comments from friends and family — they say we look like we are in a movie, out of a magazine. Our wedding photographs captured and preserved our many memories of our magical day. We couldn''t be happier with the choice of photographer that we made.', 'Mumbai', 1, 4),
('Zoya & Azhar', 'Wedding', 'Taher and team added a lot of thought process, effort and planning even before arriving for the shoot. Innumerable candid shots bring detail to the memories and we will cherish them for life. Amour Affairs felt like family. All the pictures are truly mesmerizing and a wonderful reminder of an amazing time we had. The team is highly professional and always try to attain perfection.', 'U.S.', 1, 5),
('Neha & Hussein', 'Wedding', 'The Amour Affairs team have pretty much been the official photographers for all our family weddings and with good reason — they don''t just capture moments, they make memories, ones we will cherish for a lifetime. Thank you Taher and team for helping me relive our special day so beautifully.', 'Pune', 1, 6),
('Sana & Mustafa', 'Wedding', 'What can we say, the photos are just amazing. From the moment we met you, we were filled with confidence because of your professionalism. Our guests have commented on how skilled you were at capturing such natural photographs, without us even knowing you were there. We didn''t have to worry about a thing and all the shots we wanted have been covered; it''s such a beautiful way to remember our day. You truly captured every single moment for us and the album really does contain memories to treasure! Without doubt Amour Affairs, you are the difference that makes a difference!', NULL, 0, 7),
('Naqiyaa & Abdul', 'Wedding', 'As it is rightly quoted, "There are no rules for good photography, there are only good photographs" — the team at Amour Affairs delivers exactly this. Choosing Amour Affairs to shoot our wedding video and photographs was a perfect choice. The team beautifully captured all our wedding memories and each picture has a story to tell. Emotions captured at their best! Thank you Taher and the entire Amour Affairs team for giving us memories to cherish for a lifetime.', 'Pune', 0, 8),
('Dhiraj & Mittal', 'Wedding', 'We had a fantastic wedding shoot with Amour Affairs — Taher and his team were endlessly patient with us. He ensured that the atmosphere was comfortable and relaxed, and put us at ease with such amazing photo poses. The photos were superb, amazing moments captured. We are also happy to share all the images on social media — such hard work that the team has put in. Thank you so much for your brilliant service and fantastic memories.', 'Pune', 0, 9),
('Priyanka & Ajinkya', 'Wedding', 'It was our priority to find the best candid photographers out there, and we are so glad we chose you! Our entire wedding trip to India was on a tight schedule, giving us no time at all for couple shoots. Nevertheless, we have amazing pictures of our wedding and we can relive those days millions of times through the photos you have captured. We will highly recommend Amour Affairs to our friends and family for the professionalism and amazing skill of capturing the special moments masterfully.', 'Bellevue, Washington', 0, 10),
('Lubayna & Mustafa', 'Wedding', 'The Amour Affairs website speaks of the quality of the work they produce. I was very glad that Taher and his team could make themselves available at a relatively short notice of less than a week. Taher and his team were very patient, cooperative and calm during all the functions. Working with them was an extremely humble and pleasant experience. I appreciate all of their work — and as you may see from the pictures, they are creative.', 'Singapore', 0, 11),
('Tasneem & Hamza', 'Wedding', 'We are so glad to write a testimonial as it takes us to a flashback of beautiful, artistic, stupendous pictures of our wedding. Taher and team, you all are the best, and we have no words to describe your work as it takes us back to our wonderful memories captured in the frame so aesthetically. The wedding film is so well done — you have made us express all our emotions, happiness, love and dreams in that moment with absolute finesse. Thank you so much for making our wedding a fairytale which we can see over and over again.', 'Dubai', 0, 12),
('Zahra & Husein', 'Wedding', 'We absolutely are delighted with them. You have somehow managed to capture the moment as a whole — it instantly takes us back to how we were feeling, what we were saying to each other and what happened before and after. For me, the entire wedding was a blur; looking at the pictures we slowly started reliving each moment all over again. Everyone is very impressed and happy as well.', 'Dubai', 0, 13),
('Rashida & Iqbal', 'Wedding', 'If you too are camera shy, then make sure you hire a photographer who would not be intrusive and would not make you realise that there is a lens capturing you. This was perfectly delivered by our awesome photographers, Amour Affairs, who have given us the most magnificent memories of our momentous occasion. Each image is a work of art with great attention to detail. Every moment of our wedding has been captured for eternity, and no one could have done that job better than Taher and his team.', 'Pune', 0, 14),
('Mariya & Moiz', 'Wedding', 'Taher, my wedding photographs are beyond amazing. You have done an absolutely beautiful job at capturing all the special moments of those memorable days. The best thing was that you didn''t force us to stage moments — you just happened to somehow be there when those moments happened naturally. I cannot stop looking through my wedding pictures; they speak of exactly what we felt. Thank you for giving us perfect memories of our most perfect days.', 'Dubai', 0, 15),
('Sumaiyah & Danish', 'Wedding', 'I always wished for a fairytale wedding and Amour Affairs exactly captured the feel of it. Whenever I see my photos I feel they helped my dream come true. Taher has done a wonderful job in capturing all the memories in the most exquisite and professional way. I want to thank the whole team for the amazing work they have done and for making me and my family smile every time we look at the photographs.', 'Dubai', 0, 16),
('Sakina & Juzer', 'Wedding', 'Thank you so much for the tremendous job — well done with our wedding. The pictures you guys click are just amazing, capturing each special moment. When you see the pictures, they make you feel alive and brighten the moments. So many pictures capture the soulful essence of the moment. We appreciate all your energy and creativity in capturing all our priceless memories.', 'Pune', 0, 17),
('Swati & Aalap', 'Wedding', 'I cannot forget that a tear rolled down my eye when I saw my wedding trailer for the first time! That is the magnitude of the way you brought together all the moments of our wedding in a beautiful wedding film. I love the way it brings all our priceless memories in front of us in an absolutely theatrical style. Taher, you have been the most patient person in our wedding planning, and brought across absolute professionalism and astounding quality in our wedding video.', 'Pune', 0, 18),
('Saumya & Abhishek', 'Engagement', 'We just wanted to say a massive thank you to you and your incredible team for capturing every beautiful moment on our engagement day. We love the photos and they are amazing! Everyone loves our pictures. Thank you for making such a good masterpiece for us — it was a pleasure to work with your team.', 'Pune', 0, 19),
('Amruta & Akshay', 'Wedding', 'A big thanks to Taher and the Amour Affairs team for taking such beautiful pictures of our wedding! The images capture each moment and each emotion stunningly and will continue to remind us of the amazing time we had at our wedding. It has been a pleasure working with the Amour Affairs team.', 'Singapore', 0, 20),
('Nikita & Swaroop', 'Wedding', 'The magical aura that is created by every picture of Amour Affairs is just incomparable. Our pictures look alive! We cannot thank you enough for being so patient with us and managing all our requests. We are scanning through them on a loop but our eyes just can''t get enough! Each moment is captured so beautifully as if it was rehearsed. Thanks a ton Taher and team for the amazing work.', 'Nasik', 0, 21),
('Afsha & Mohosin', 'Wedding', 'Capturing moments during an affair like a wedding can be done by any photographer, but capturing the right moment is what we wanted — and that is what Taher delivered. Exceptionally good work, beautiful natural moments shot. Every time I see the pictures it takes me back to my most memorable day, and I thank you for giving me the visual delight of reliving that day every time I see the beautiful shots you took.', 'Bangalore', 0, 22),
('Shrishti & Karan', 'Engagement', 'Taher is an exceptionally brilliant photographer. He brings so much energy and light to all the pictures he clicks. He perfectly captured not only the venue and the outfits, but also the emotions on our faces. I have been getting so many compliments on my engagement pictures and of course all the credit goes to him. We are really happy with his work and glad we took the correct decision of calling him for our engagement ceremony.', 'Mumbai', 0, 23),
('Yukti & Kamesh', 'Wedding', 'We definitely were more than pleased with the amazing clicks at our wedding by Taher. He was around all the time capturing our best moments and yet so discreet about it — thoroughly professional and great at making the couple feel at ease, since we both are camera shy. Thank you Amour Affairs and Taher for capturing our best moments and giving us a chance to relive them every time we see the pictures.', 'Pune', 0, 24),
('Rashida & Mustafa', 'Wedding', 'Wedding is a celebration of one of the most important events of your life; it is something that you will remember in years to come. Keeping this in mind, we wanted to capture as many beautiful memories of this day as we could, and Amour Affairs did an amazing job with the wedding photography. Each and every picture captures the beautiful emotions and essence of the wedding. Most importantly, looking at each picture warms your heart and makes you smile! Taher and his team handled our wedding in a very professional way.', 'London', 0, 25),
('Jyoti & Saurabh', 'Wedding', 'It''s indeed a delight to get clicked by Taher and his ultra-creative team for an occasion like a wedding. The images look crisp and fresh, and bring a sense of satisfaction at how beautifully the moments have been captured by this wonderful team of accomplished photographers. Every time I go through the clicks, it brings a broad smile to my face and a proud feeling that I made Amour Affairs a part of my wedding.', 'Pune', 0, 26),
('Tejaswini & Nikhil', 'Wedding', 'Taher, you have no idea what you and your team at Amour Affairs do! You guys are completely magical. The photos and film have come out mind-blowing — you have exceeded our expectations. These are the memories we carry all our life, and because of Amour Affairs these memories are not just memories but a life event which is so magical and mesmerising. Take a bow, guys!', 'Pune', 0, 27),
('Madhu & Sudipto', 'Wedding', 'The pics are absolutely fantastic! Many many thanks to Neha, Gagan and Taher! You got some stunning shots, and the post processing is just spot on perfect — vibrant colours and great lighting. Madhu says you made her look stunning. The candid shots are very nice indeed. Thanks again team Amour! We''re glad we picked you.', 'Portland, Oregon', 0, 28),
('Sejal & Anniket', 'Pre-Wedding', 'We had the idea of a pre-wedding video ever since we got engaged but never got the time to make one till only a few days were left for the sangeet. To Taher and his team we are truly thankful for capturing our moments in an amazing video that was made with only one day of filming. This video has become a part of our new life together and will always be a reminder of our beginning.', 'Nasik', 0, 29),
('Deepika & Karan', 'Wedding', 'Thank you Amour Affairs for making our wedding so beautiful through your lens. It was great working with you and we would definitely be giving your reference to all our friends and family. We appreciate all your insights and you being able to make it to the function despite your booked schedule. Everyone loved your work!', 'New Delhi', 0, 30);

-- ────────────────────────────────────────────────────────────
-- 20. FAQS — editable Q&A powering the /faqs page + FAQ schema
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `faqs` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `question` VARCHAR(500) NOT NULL,
  `answer` TEXT NOT NULL,
  `category` ENUM('before','during','after') NOT NULL DEFAULT 'before',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_faq_active` (`is_active`, `category`, `sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ────────────────────────────────────────────────────────────
-- 21. GUIDES — educational blog/guide articles (AEO/GEO content)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `guides` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `slug` VARCHAR(200) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `excerpt` VARCHAR(500) DEFAULT NULL,
  `body` MEDIUMTEXT NOT NULL,
  `category` VARCHAR(80) NOT NULL DEFAULT 'Wedding Planning',
  `cover_path` VARCHAR(255) DEFAULT NULL,
  `author` VARCHAR(120) NOT NULL DEFAULT 'Amour Affairs',
  `read_minutes` INT UNSIGNED NOT NULL DEFAULT 5,
  `meta_title` VARCHAR(255) DEFAULT NULL,
  `meta_description` VARCHAR(320) DEFAULT NULL,
  `is_published` TINYINT(1) NOT NULL DEFAULT 0,
  `is_featured` TINYINT(1) NOT NULL DEFAULT 0,
  `sort_order` INT NOT NULL DEFAULT 0,
  `published_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_guide_slug` (`slug`),
  KEY `idx_guide_pub` (`is_published`, `sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ────────────────────────────────────────────────────────────
-- 22. CASE_STUDIES — detailed wedding stories (E-E-A-T content)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `case_studies` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `slug` VARCHAR(200) NOT NULL,
  `couple` VARCHAR(200) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `location` VARCHAR(200) DEFAULT NULL,
  `event_date` DATE DEFAULT NULL,
  `event_type` VARCHAR(80) NOT NULL DEFAULT 'Wedding',
  `summary` VARCHAR(500) DEFAULT NULL,
  `body` MEDIUMTEXT NOT NULL,
  `services` VARCHAR(300) DEFAULT NULL,
  `guest_count` VARCHAR(50) DEFAULT NULL,
  `cover_path` VARCHAR(255) DEFAULT NULL,
  `gallery` JSON DEFAULT NULL,
  `film_youtube_id` VARCHAR(20) DEFAULT NULL,
  `meta_title` VARCHAR(255) DEFAULT NULL,
  `meta_description` VARCHAR(320) DEFAULT NULL,
  `is_published` TINYINT(1) NOT NULL DEFAULT 0,
  `is_featured` TINYINT(1) NOT NULL DEFAULT 0,
  `sort_order` INT NOT NULL DEFAULT 0,
  `published_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_case_slug` (`slug`),
  KEY `idx_case_pub` (`is_published`, `sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ────────────────────────────────────────────────────────────
-- 23. LEAD_MAGNETS — downloadable guides gated by an email capture
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `lead_magnets` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `slug` VARCHAR(200) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `description` VARCHAR(500) DEFAULT NULL,
  `file_path` VARCHAR(255) DEFAULT NULL,
  `cover_path` VARCHAR(255) DEFAULT NULL,
  `button_label` VARCHAR(80) NOT NULL DEFAULT 'Download Free Guide',
  `download_count` INT UNSIGNED NOT NULL DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_magnet_slug` (`slug`),
  KEY `idx_magnet_active` (`is_active`, `sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ────────────────────────────────────────────────────────────
-- PAGE VIEWS — first-party website analytics (no raw IP stored)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `page_views` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `path` VARCHAR(255) NOT NULL,
  `referrer_host` VARCHAR(255) DEFAULT NULL,
  `source` VARCHAR(120) DEFAULT NULL,
  `device` VARCHAR(16) DEFAULT NULL,
  `browser` VARCHAR(40) DEFAULT NULL,
  `country` VARCHAR(60) DEFAULT NULL,
  `session_id` CHAR(36) DEFAULT NULL,
  `visitor_hash` CHAR(40) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_pv_created` (`created_at`),
  KEY `idx_pv_path` (`path`),
  KEY `idx_pv_source` (`source`),
  KEY `idx_pv_visitor` (`visitor_hash`),
  KEY `idx_pv_session` (`session_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ────────────────────────────────────────────────────────────
-- 24. CRM — client special dates, festivals, greeting log
-- (curated WhatsApp wishes for birthdays / anniversaries /
-- kids' birthdays / festivals, driven from the dashboard)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `client_dates` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `client_id` INT UNSIGNED NOT NULL,
  `occasion` VARCHAR(30) NOT NULL DEFAULT 'birthday', -- birthday | anniversary | kid_birthday | other
  `label` VARCHAR(150) DEFAULT NULL,
  `person_name` VARCHAR(150) DEFAULT NULL,
  `occasion_date` DATE NOT NULL,
  `year_known` TINYINT(1) NOT NULL DEFAULT 1,
  `notes` VARCHAR(255) DEFAULT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_cd_client` (`client_id`, `is_active`),
  KEY `idx_cd_date` (`occasion_date`),
  CONSTRAINT `fk_cd_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `festivals` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(120) NOT NULL,
  `emoji` VARCHAR(8) DEFAULT NULL,
  `festival_date` DATE NOT NULL,
  `is_movable` TINYINT(1) NOT NULL DEFAULT 0, -- lunar festival: confirm the date each year
  `message_template` TEXT DEFAULT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_festival_name` (`name`),
  KEY `idx_festival_active` (`is_active`, `festival_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `crm_greetings` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `client_id` INT UNSIGNED DEFAULT NULL,
  `client_date_id` INT UNSIGNED DEFAULT NULL,
  `festival_id` INT UNSIGNED DEFAULT NULL,
  `occasion_year` SMALLINT UNSIGNED NOT NULL,
  `message` TEXT DEFAULT NULL,
  `sent_by` INT UNSIGNED DEFAULT NULL,
  `sent_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_g_date` (`client_date_id`, `occasion_year`),
  KEY `idx_g_festival` (`festival_id`, `occasion_year`),
  KEY `idx_g_client` (`client_id`),
  CONSTRAINT `fk_g_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_g_date` FOREIGN KEY (`client_date_id`) REFERENCES `client_dates` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_g_festival` FOREIGN KEY (`festival_id`) REFERENCES `festivals` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Starter festival calendar (2026 dates; movable ones confirmed yearly)
INSERT IGNORE INTO `festivals` (`name`, `emoji`, `festival_date`, `is_movable`) VALUES
('New Year', '🎉', '2026-01-01', 0),
('Valentine''s Day', '❤️', '2026-02-14', 0),
('Holi', '🎨', '2026-03-04', 1),
('Eid al-Fitr', '🌙', '2026-03-20', 1),
('Raksha Bandhan', '💛', '2026-08-28', 1),
('Ganesh Chaturthi', '🙏', '2026-09-14', 1),
('Diwali', '🪔', '2026-11-08', 1),
('Christmas', '🎄', '2026-12-25', 0);

-- Default CRM greeting templates ({name} {person} {label} {festival}
-- placeholders are filled at send time; dashboard-editable)
INSERT IGNORE INTO `settings` (`setting_key`, `setting_value`, `setting_group`) VALUES
('crm_tpl_birthday', 'Dear {name}, wishing you a very happy birthday from all of us at Amour Affairs! 🎂 May your year ahead be filled with love, laughter and beautiful moments.', 'crm'),
('crm_tpl_anniversary', 'Happy anniversary, {name}! 💍 It was our honour to capture your special day — wishing you both a lifetime of love and happiness. — Team Amour Affairs', 'crm'),
('crm_tpl_kid_birthday', 'Dear {name}, a very happy birthday to {person}! 🎈 Wishing your little one a day full of joy and wonder. With love, Team Amour Affairs', 'crm'),
('crm_tpl_festival', 'Dear {name}, warm wishes to you and your family on {festival}! ✨ May the celebrations bring you happiness and light. — Team Amour Affairs', 'crm'),
('crm_tpl_other', 'Dear {name}, warm wishes on {label}! — Team Amour Affairs', 'crm');

-- ────────────────────────────────────────────────────────────
-- POST-SEED DEFAULTS
-- The seed INSERTs above leave the curation flags at their
-- column defaults — give a fresh install sensible starting values.
-- ────────────────────────────────────────────────────────────

-- Surface the seeded reviews in the weddings-page marquee by default
UPDATE `testimonials` SET `show_on_weddings` = 1 WHERE `is_active` = 1;

-- Spread unassigned reviews evenly across the three testimonials-page
-- marquee rows (0 = unassigned, so curated rows are never reshuffled)
UPDATE `testimonials` SET `marquee_row` = ((`id` - 1) % 3) + 1 WHERE `marquee_row` = 0;

-- ────────────────────────────────────────────────────────────
-- CRM v2 — family records (fresh-install schema).
-- On an existing live DB the bride/groom lead columns are added
-- by api/_migrate_crm2.php (information_schema-guarded); here
-- they are part of the leads CREATE TABLE above.
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `families` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `display_name` VARCHAR(200) NOT NULL,
  `anniversary_date` DATE DEFAULT NULL,
  `anniversary_year_known` TINYINT(1) NOT NULL DEFAULT 1,
  `notes` TEXT DEFAULT NULL,
  `album_given` TINYINT(1) NOT NULL DEFAULT 0,
  `album_given_at` DATE DEFAULT NULL,
  `testimonial_given` TINYINT(1) NOT NULL DEFAULT 0,
  `testimonial_given_at` DATE DEFAULT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_fam_active` (`is_active`),
  KEY `idx_fam_anniv` (`anniversary_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `family_members` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `family_id` INT UNSIGNED NOT NULL,
  `role` VARCHAR(20) NOT NULL DEFAULT 'husband',
  `name` VARCHAR(200) NOT NULL,
  `dob` DATE DEFAULT NULL,
  `dob_year_known` TINYINT(1) NOT NULL DEFAULT 1,
  `phone` VARCHAR(30) DEFAULT NULL,
  `whatsapp` VARCHAR(30) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_fm_family` (`family_id`),
  KEY `idx_fm_dob` (`dob`),
  CONSTRAINT `fk_fm_family` FOREIGN KEY (`family_id`) REFERENCES `families` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `family_greetings` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `family_id` INT UNSIGNED NOT NULL,
  `family_member_id` INT UNSIGNED DEFAULT NULL,
  `festival_id` INT UNSIGNED DEFAULT NULL,
  `occasion` VARCHAR(20) NOT NULL DEFAULT 'birthday',
  `occasion_year` SMALLINT UNSIGNED NOT NULL,
  `message` TEXT DEFAULT NULL,
  `sent_by` INT UNSIGNED DEFAULT NULL,
  `sent_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_fg_family` (`family_id`, `occasion_year`),
  KEY `idx_fg_member` (`family_member_id`, `occasion_year`),
  KEY `idx_fg_festival` (`festival_id`, `occasion_year`),
  CONSTRAINT `fk_fg_family` FOREIGN KEY (`family_id`) REFERENCES `families` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_fg_member` FOREIGN KEY (`family_member_id`) REFERENCES `family_members` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_fg_festival` FOREIGN KEY (`festival_id`) REFERENCES `festivals` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

COMMIT;

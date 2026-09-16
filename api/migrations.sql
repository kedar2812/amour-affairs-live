-- ============================================================
-- AMOUR AFFAIRS — Migrations for an EXISTING database
-- MySQL 5.7+ / MariaDB 10.2+
--
-- Safe to run any number of times: every ALTER is guarded via
-- information_schema (dynamic prepared statement), and every
-- data backfill only touches rows still at their pre-migration
-- default. Run this instead of database.sql when the database
-- already exists; database.sql is for fresh installs only.
-- ============================================================

-- Force a 4-byte-capable client connection so emoji in the seed data
-- (festival icons, greeting templates) store intact. Without this, an
-- import over a latin1/utf8(3-byte) client silently turns every 4-byte
-- emoji (🎂 🎉 🪔 …) into a literal "?" even though the columns are utf8mb4.
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

-- albums.film_youtube_id — film attached to a wedding / couple-shoot folder
SET @stmt := (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `albums` ADD COLUMN `film_youtube_id` VARCHAR(20) DEFAULT NULL AFTER `description`',
    'DO 0'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'albums' AND COLUMN_NAME = 'film_youtube_id'
);
PREPARE migrate_albums_film FROM @stmt;
EXECUTE migrate_albums_film;
DEALLOCATE PREPARE migrate_albums_film;

-- testimonials.show_on_weddings — surface this review in the weddings-page marquee
SET @stmt := (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `testimonials` ADD COLUMN `show_on_weddings` TINYINT(1) NOT NULL DEFAULT 0 AFTER `is_featured`',
    'DO 0'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'testimonials' AND COLUMN_NAME = 'show_on_weddings'
);
PREPARE migrate_testi_weddings FROM @stmt;
EXECUTE migrate_testi_weddings;
DEALLOCATE PREPARE migrate_testi_weddings;

-- Track whether show_on_weddings was just created, so its backfill
-- runs exactly once and never overrides later dashboard curation.
SET @weddings_was_added := (@stmt NOT LIKE 'DO 0');

-- Index for the weddings-marquee query (guarded the same way)
SET @stmt := (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `testimonials` ADD KEY `idx_weddings` (`show_on_weddings`, `is_active`)',
    'DO 0'
  )
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'testimonials' AND INDEX_NAME = 'idx_weddings'
);
PREPARE migrate_testi_idx FROM @stmt;
EXECUTE migrate_testi_idx;
DEALLOCATE PREPARE migrate_testi_idx;

-- Backfill: surface existing reviews in the weddings marquee, but only
-- when the column was created by this run (otherwise the dashboard owns it)
SET @stmt := IF(
  @weddings_was_added,
  'UPDATE `testimonials` SET `show_on_weddings` = 1 WHERE `is_active` = 1',
  'DO 0'
);
PREPARE backfill_weddings FROM @stmt;
EXECUTE backfill_weddings;
DEALLOCATE PREPARE backfill_weddings;

-- testimonials.marquee_row — which testimonials-page marquee row a review
-- sits on (1, 2, 3, ...). 0 = unassigned; scroll direction is derived from
-- row position on the website, never stored.
SET @stmt := (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `testimonials` ADD COLUMN `marquee_row` TINYINT UNSIGNED NOT NULL DEFAULT 0 AFTER `show_on_weddings`',
    'DO 0'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'testimonials' AND COLUMN_NAME = 'marquee_row'
);
PREPARE migrate_testi_row FROM @stmt;
EXECUTE migrate_testi_row;
DEALLOCATE PREPARE migrate_testi_row;

-- Backfill: spread unassigned reviews evenly across the three marquee rows.
-- Idempotent (only rows still at 0), so re-runs never reshuffle curated rows.
UPDATE `testimonials` SET `marquee_row` = ((`id` - 1) % 3) + 1 WHERE `marquee_row` = 0;

-- ────────────────────────────────────────────────────────────
-- leads.venue — venue captured from the enhanced website inquiry form
-- ────────────────────────────────────────────────────────────
SET @stmt := (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `leads` ADD COLUMN `venue` VARCHAR(255) DEFAULT NULL AFTER `event_date`',
    'DO 0'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'leads' AND COLUMN_NAME = 'venue'
);
PREPARE migrate_leads_venue FROM @stmt;
EXECUTE migrate_leads_venue;
DEALLOCATE PREPARE migrate_leads_venue;

-- leads.guest_count — approximate guest count (stored as text to allow ranges)
SET @stmt := (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `leads` ADD COLUMN `guest_count` VARCHAR(50) DEFAULT NULL AFTER `venue`',
    'DO 0'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'leads' AND COLUMN_NAME = 'guest_count'
);
PREPARE migrate_leads_guests FROM @stmt;
EXECUTE migrate_leads_guests;
DEALLOCATE PREPARE migrate_leads_guests;

-- leads.source — widen from ENUM to VARCHAR so per-page website tags
-- ('Website (Weddings)', 'Website (Home)', …) that leads.php whitelists can
-- actually be stored. The old ENUM only held the six manual channels, so those
-- tags were silently truncated (dashboard already reads source as free text and
-- matches with source.startsWith('Website')). Fires only while it is still an enum.
SET @stmt := (
  SELECT IF(
    COUNT(*) = 1,
    'ALTER TABLE `leads` MODIFY COLUMN `source` VARCHAR(120) NOT NULL DEFAULT ''Website''',
    'DO 0'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'leads'
    AND COLUMN_NAME = 'source' AND DATA_TYPE = 'enum'
);
PREPARE migrate_leads_source FROM @stmt;
EXECUTE migrate_leads_source;
DEALLOCATE PREPARE migrate_leads_source;

-- ────────────────────────────────────────────────────────────
-- New content tables (CREATE TABLE IF NOT EXISTS is idempotent).
-- These power the SEO content systems: FAQs, Guides, Case Studies,
-- Lead Magnets. Safe to run repeatedly.
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
-- Studio Google rating settings — power the LocalBusiness
-- aggregateRating rich snippet, editable from the dashboard.
-- INSERT IGNORE only seeds them when absent, so it never
-- clobbers values the studio has already edited.
-- ────────────────────────────────────────────────────────────
INSERT IGNORE INTO `settings` (`setting_key`, `setting_value`, `setting_group`) VALUES
('studio_rating_value', '4.9', 'profile'),
('studio_review_count', '198', 'profile');

-- ────────────────────────────────────────────────────────────
-- Urgency / booking-availability notice (announcement bar + floating
-- badge). All dashboard-editable. INSERT IGNORE never clobbers values
-- the studio has already set.
-- ────────────────────────────────────────────────────────────
INSERT IGNORE INTO `settings` (`setting_key`, `setting_value`, `setting_group`) VALUES
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
-- First-party website analytics — one row per page view. No raw
-- IP is stored: visitor_hash is a daily one-way hash so unique
-- visitors can be counted without retaining personal data.
-- CREATE TABLE IF NOT EXISTS is idempotent.
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
-- CRM — client special dates, festivals and the greeting log
-- behind the "send curated WhatsApp wishes" feature.
-- CREATE TABLE IF NOT EXISTS + INSERT IGNORE = idempotent.
-- ────────────────────────────────────────────────────────────

-- Per-client recurring dates (birthdays, anniversaries, kids' birthdays).
-- occasion_date keeps the original year when known (year_known = 1) so the
-- dashboard can show "turns 5" / "8th anniversary".
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

-- Global festivals. Fixed-date ones recur automatically; movable (lunar)
-- ones recur too but is_movable = 1 flags them in the dashboard so the
-- studio confirms the new date each year.
CREATE TABLE IF NOT EXISTS `festivals` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(120) NOT NULL,
  `emoji` VARCHAR(8) DEFAULT NULL,
  `festival_date` DATE NOT NULL,
  `is_movable` TINYINT(1) NOT NULL DEFAULT 0,
  `message_template` TEXT DEFAULT NULL, -- optional override of the generic festival template
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_festival_name` (`name`),
  KEY `idx_festival_active` (`is_active`, `festival_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- One row per greeting actually sent, keyed by occasion year, so the
-- "already wished this year" state survives across devices and sessions.
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

-- Starter festival calendar. 2026 dates; movable (lunar) festivals are
-- flagged so the dashboard reminds the studio to confirm each year.
-- INSERT IGNORE never duplicates or clobbers edits (unique on name).
INSERT IGNORE INTO `festivals` (`name`, `emoji`, `festival_date`, `is_movable`) VALUES
('New Year', '🎉', '2026-01-01', 0),
('Valentine''s Day', '❤️', '2026-02-14', 0),
('Holi', '🎨', '2026-03-04', 1),
('Eid al-Fitr', '🌙', '2026-03-20', 1),
('Raksha Bandhan', '💛', '2026-08-28', 1),
('Ganesh Chaturthi', '🙏', '2026-09-14', 1),
('Diwali', '🪔', '2026-11-08', 1),
('Christmas', '🎄', '2026-12-25', 0);

-- Default greeting templates (dashboard-editable; {name} {person}
-- {label} {festival} {years} placeholders are filled at send time)
INSERT IGNORE INTO `settings` (`setting_key`, `setting_value`, `setting_group`) VALUES
('crm_tpl_birthday', 'Dear {name}, wishing you a very happy birthday from all of us at Amour Affairs! 🎂 May your year ahead be filled with love, laughter and beautiful moments.', 'crm'),
('crm_tpl_anniversary', 'Happy anniversary, {name}! 💍 It was our honour to capture your special day — wishing you both a lifetime of love and happiness. — Team Amour Affairs', 'crm'),
('crm_tpl_kid_birthday', 'Dear {name}, a very happy birthday to {person}! 🎈 Wishing your little one a day full of joy and wonder. With love, Team Amour Affairs', 'crm'),
('crm_tpl_festival', 'Dear {name}, warm wishes to you and your family on {festival}! ✨ May the celebrations bring you happiness and light. — Team Amour Affairs', 'crm'),
('crm_tpl_other', 'Dear {name}, warm wishes on {label}! — Team Amour Affairs', 'crm');

-- ────────────────────────────────────────────────────────────
-- CRM v2 — family records + bride/groom lead capture.
-- STRICTLY ADDITIVE: new nullable columns and new tables only;
-- no existing row is modified. The ALTERs below are not
-- idempotent in plain SQL on MySQL 5.x — on the live host run
-- api/_migrate_crm2.php instead, which checks
-- information_schema before each ADD COLUMN.
-- ────────────────────────────────────────────────────────────

-- Lead form v2: bride & groom captured separately, plus the
-- referrer's name when source = Referral. Legacy leads keep
-- client_name/phone as their primary record — nothing remapped.
ALTER TABLE `leads` ADD COLUMN `bride_name` VARCHAR(200) DEFAULT NULL;
ALTER TABLE `leads` ADD COLUMN `bride_phone` VARCHAR(30) DEFAULT NULL;
ALTER TABLE `leads` ADD COLUMN `bride_whatsapp` VARCHAR(30) DEFAULT NULL;
ALTER TABLE `leads` ADD COLUMN `groom_name` VARCHAR(200) DEFAULT NULL;
ALTER TABLE `leads` ADD COLUMN `groom_phone` VARCHAR(30) DEFAULT NULL;
ALTER TABLE `leads` ADD COLUMN `groom_whatsapp` VARCHAR(30) DEFAULT NULL;
ALTER TABLE `leads` ADD COLUMN `referrer_name` VARCHAR(200) DEFAULT NULL;

-- One record per family, displayed as "Vikram & Priyanka".
-- The anniversary belongs to the family, not a member.
CREATE TABLE IF NOT EXISTS `families` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `display_name` VARCHAR(200) NOT NULL,
  `anniversary_date` DATE DEFAULT NULL,
  `anniversary_year_known` TINYINT(1) NOT NULL DEFAULT 1,
  `notes` TEXT DEFAULT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_fam_active` (`is_active`),
  KEY `idx_fam_anniv` (`anniversary_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Member sub-entries: husband | wife | child (children repeat).
-- role is VARCHAR, not ENUM — same lesson as leads.source.
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

-- One row per wish actually sent (birthday | anniversary |
-- festival), keyed by occasion year for cross-device sent state.
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


-- ────────────────────────────────────────────────────────────
-- ALBUM SECTIONS (2026-08-03)
-- Ritual/segment filters inside a folder: Haldi, Mehendi, Sangeet…
-- A photo belongs to at most one section; section_id NULL means
-- "unsorted", which still shows under the website's "All" filter.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `album_sections` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `album_id` INT UNSIGNED NOT NULL,
  `name` VARCHAR(80) NOT NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_sec_album` (`album_id`, `sort_order`),
  CONSTRAINT `fk_sec_album` FOREIGN KEY (`album_id`) REFERENCES `albums` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ON DELETE SET NULL is deliberate: removing a section must never destroy
-- photographs — they simply fall back to unsorted.
ALTER TABLE `gallery_images`
  ADD COLUMN `section_id` INT UNSIGNED DEFAULT NULL AFTER `album_id`,
  ADD KEY `idx_gi_section` (`section_id`),
  ADD CONSTRAINT `fk_gi_section` FOREIGN KEY (`section_id`) REFERENCES `album_sections` (`id`) ON DELETE SET NULL;

COMMIT;

-- ────────────────────────────────────────────────────────────
-- CRM FAMILY FOLLOW-UPS (2026-09-16)
-- "Album given?" / "Testimonial given?" per family, with the
-- date each was first marked. Existing families start as "No".
-- Live DB: run api/_migrate_family_flags.php (guarded), not this.
-- ────────────────────────────────────────────────────────────
ALTER TABLE `families` ADD COLUMN `album_given` TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE `families` ADD COLUMN `album_given_at` DATE DEFAULT NULL;
ALTER TABLE `families` ADD COLUMN `testimonial_given` TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE `families` ADD COLUMN `testimonial_given_at` DATE DEFAULT NULL;

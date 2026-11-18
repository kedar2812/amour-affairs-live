/**
 * Unit tests for the folder section (ritual) filters.
 * Framework-free so it runs anywhere:  node src/js/album-sections.test.mjs
 */

import assert from 'node:assert';
import { photoSrc, photoSection, usableSections, filterPhotos } from './album-sections.js';

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log(`  ✓ ${name}`); };

// Album as the CMS delivers it: photo objects carrying their section.
const cmsAlbum = {
  couple: 'Aarohi & Vedant',
  sections: [
    { id: 1, name: 'Haldi' },
    { id: 2, name: 'Mehendi' },
    { id: 3, name: 'Reception' }, // deliberately empty
  ],
  photos: [
    { src: '/a.jpg', section: 1 },
    { src: '/b.jpg', section: 1 },
    { src: '/c.jpg', section: 2 },
    { src: '/d.jpg', section: null },  // unsorted
  ],
};

// Album as the bundled fallback data delivers it: plain URL strings.
const fallbackAlbum = { couple: 'Isha & Rohan', photos: ['/x.jpg', '/y.jpg'] };

console.log('\nphoto readers');

test('reads src from both photo shapes', () => {
  assert.strictEqual(photoSrc('/x.jpg'), '/x.jpg');
  assert.strictEqual(photoSrc({ src: '/a.jpg', section: 1 }), '/a.jpg');
});

test('a bare URL string has no section', () => {
  assert.strictEqual(photoSection('/x.jpg'), null);
  assert.strictEqual(photoSection({ src: '/a.jpg' }), null);
  assert.strictEqual(photoSection({ src: '/a.jpg', section: 2 }), 2);
});

console.log('\nusableSections');

test('returns only sections that hold photographs, with counts', () => {
  const s = usableSections(cmsAlbum);
  assert.deepStrictEqual(s.map(x => x.name), ['Haldi', 'Mehendi']);
  assert.deepStrictEqual(s.map(x => x.count), [2, 1]);
});

test('an empty section never becomes a chip', () => {
  assert.ok(!usableSections(cmsAlbum).some(s => s.name === 'Reception'));
});

test('albums with no sections yield none — the filter row stays hidden', () => {
  assert.deepStrictEqual(usableSections(fallbackAlbum), []);
  assert.deepStrictEqual(usableSections({ ...cmsAlbum, sections: [] }), []);
  assert.deepStrictEqual(usableSections(null), []);
});

test('sections keep the studio-set order', () => {
  const reordered = { ...cmsAlbum, sections: [{ id: 2, name: 'Mehendi' }, { id: 1, name: 'Haldi' }] };
  assert.deepStrictEqual(usableSections(reordered).map(s => s.name), ['Mehendi', 'Haldi']);
});

test('tolerates string ids from the API', () => {
  const stringy = { ...cmsAlbum, sections: [{ id: '1', name: 'Haldi' }] };
  assert.strictEqual(usableSections(stringy)[0].count, 2);
});

console.log('\nfilterPhotos');

test('"all" includes unsorted photos — they never become unreachable', () => {
  const all = filterPhotos(cmsAlbum, 'all');
  assert.strictEqual(all.length, 4);
  assert.ok(all.some(p => p.src === '/d.jpg'));
});

test('a section shows only its own photographs', () => {
  assert.deepStrictEqual(filterPhotos(cmsAlbum, '1').map(p => p.src), ['/a.jpg', '/b.jpg']);
  assert.deepStrictEqual(filterPhotos(cmsAlbum, '2').map(p => p.src), ['/c.jpg']);
});

test('numeric and string keys behave the same', () => {
  assert.deepStrictEqual(filterPhotos(cmsAlbum, 1).map(p => p.src), filterPhotos(cmsAlbum, '1').map(p => p.src));
});

test('an unknown key falls back to the full album, never a blank wall', () => {
  assert.strictEqual(filterPhotos(cmsAlbum, '999').length, 4);
  assert.strictEqual(filterPhotos(cmsAlbum, '3').length, 4); // the empty section
});

test('fallback albums (plain strings) filter safely', () => {
  assert.strictEqual(filterPhotos(fallbackAlbum, 'all').length, 2);
  assert.strictEqual(filterPhotos(fallbackAlbum, '1').length, 2);
});

test('filtering preserves the studio-set photo order', () => {
  const album = {
    sections: [{ id: 1, name: 'Haldi' }],
    photos: [
      { src: '/1.jpg', section: 1 },
      { src: '/2.jpg', section: null },
      { src: '/3.jpg', section: 1 },
    ],
  };
  assert.deepStrictEqual(filterPhotos(album, '1').map(p => p.src), ['/1.jpg', '/3.jpg']);
});

console.log(`\n${passed} tests passed.\n`);

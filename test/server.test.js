"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { canonicalUrl, mergeOrganic, resolvePosition } = require("../server");

test("resolvePosition converts page-local positions to absolute positions", function () {
  assert.equal(resolvePosition(1, 2, 0), 11);
  assert.equal(resolvePosition(10, 3, 9), 30);
});

test("resolvePosition preserves already absolute positions", function () {
  assert.equal(resolvePosition(11, 2, 0), 11);
  assert.equal(resolvePosition(27, 3, 6), 27);
});

test("resolvePosition uses page and index when provider position is invalid", function () {
  assert.equal(resolvePosition(undefined, 4, 2), 33);
  assert.equal(resolvePosition(999, 4, 2), 33);
});

test("canonicalUrl removes common tracking and normalizes hosts", function () {
  assert.equal(
    canonicalUrl("https://www.Example.com/page/?utm_source=test&gclid=123&keep=yes#top"),
    "https://example.com/page?keep=yes"
  );
});

test("mergeOrganic de-duplicates URLs without compressing real positions", function () {
  const pages = [
    { page: 1, data: { organic: [{ position: 10, title: "A", link: "https://example.com/a" }] } },
    {
      page: 2,
      data: {
        organic: [
          { position: 1, title: "Duplicate", link: "https://www.example.com/a?utm_source=x" },
          { position: 2, title: "B", link: "https://example.com/b" }
        ]
      }
    }
  ];

  const merged = mergeOrganic(pages, 100);
  assert.deepEqual(merged.map(function (item) { return item.position; }), [10, 12]);
  assert.deepEqual(merged.map(function (item) { return item.page; }), [1, 2]);
});
test("mergeOrganic returns all 100 absolute ranks across ten pages", function () {
  const pages = Array.from({ length: 10 }, function (_, pageIndex) {
    return {
      page: pageIndex + 1,
      data: {
        organic: Array.from({ length: 10 }, function (_, itemIndex) {
          const rank = pageIndex * 10 + itemIndex + 1;
          return {
            position: itemIndex + 1,
            title: "Result " + rank,
            link: "https://example.com/result-" + rank
          };
        })
      }
    };
  });

  const merged = mergeOrganic(pages, 100);
  assert.equal(merged.length, 100);
  assert.equal(merged[0].position, 1);
  assert.equal(merged[99].position, 100);
});


import test from "node:test";
import assert from "node:assert/strict";
import { citeText, safeSourceUrl } from "../src/lib/web-search";

test("citations reject executable schemes and embedded credentials", () => {
  for (const url of [
    "javascript:alert(1)",
    "data:text/html,x",
    "https://user:secret@example.com",
    "file:///etc/passwd",
    "//example.com",
  ])
    assert.equal(safeSourceUrl(url), null);
  const result = citeText("Hello", [
    {
      type: "url_citation",
      url: "javascript:alert(1)",
      start_index: 0,
      end_index: 5,
    },
  ]);
  assert.equal(result.text, "Hello");
  assert.deepEqual(result.sources, []);
});
test("provider markers become clickable links without consuming prose", () => {
  const marker = "\uE200cite\uE202turn0search0\uE201";
  const prefix = "İstanbul 🌤️: açık. ";
  const a = {
    type: "url_citation",
    url: "https://example.com/weather(today)",
    title: "Forecast",
    start_index: prefix.length,
    end_index: prefix.length + marker.length,
  };
  const result = citeText(prefix + marker, [a, a]);
  assert.equal(
    result.text,
    prefix + " [1](https://example.com/weather%28today%29)",
  );
  assert.equal(result.sources.length, 1);
});
test("ordinary cited prose and already linked sources are retained", () => {
  const plain = "The forecast is sunny.";
  assert.equal(
    citeText(plain, [
      {
        type: "url_citation",
        url: "https://example.com",
        start_index: 0,
        end_index: plain.length,
      },
    ]).text,
    plain + " [1](https://example.com/)",
  );
  const linked = "[Forecast](https://example.com)";
  assert.equal(
    citeText(linked, [
      {
        type: "url_citation",
        url: "https://example.com",
        start_index: 0,
        end_index: linked.length,
      },
    ]).text,
    linked,
  );
});
test("malformed and overlapping spans cannot remove unrelated answer text", () => {
  const text = "Original answer";
  const ranges = [
    [-1, 4],
    [2, 1],
    [0, 999],
    [1.2, 4],
    [NaN, 4],
  ];
  const result = citeText(
    text,
    ranges.map(([start_index, end_index]) => ({
      type: "url_citation",
      url: "https://example.com",
      start_index,
      end_index,
    })),
  );
  assert.equal(result.text, text);
  assert.equal(result.sources.length, 1);
  const withMarker = "Keep this prose \uE200cite\uE201";
  assert.ok(
    citeText(withMarker, [
      {
        type: "url_citation",
        url: "https://example.com",
        start_index: 0,
        end_index: withMarker.length,
      },
    ]).text.startsWith("Keep this prose "),
  );
});
test("sources share stable numbering across output parts", () => {
  const first = citeText("One", [
    {
      type: "url_citation",
      url: "https://one.example",
      start_index: 0,
      end_index: 3,
    },
  ]);
  const second = citeText(
    "Two",
    [
      {
        type: "url_citation",
        url: "https://two.example",
        start_index: 0,
        end_index: 3,
      },
    ],
    first.sources,
  );
  assert.match(second.text, /\[2\]/);
  assert.equal(second.sources.length, 2);
});

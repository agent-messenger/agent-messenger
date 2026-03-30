import { describe, test, expect } from "bun:test";
import { formatTimestamp, truncate, fuzzyMatch, stripHtml } from "./utils";

describe("formatTimestamp", () => {
  test("today's date returns HH:MM", () => {
    const now = new Date();
    const epochSeconds = (now.getTime() / 1000).toFixed(6);
    const result = formatTimestamp(epochSeconds);
    expect(result).toMatch(/^\d{2}:\d{2}$/);
  });

  test("yesterday's date returns MM/DD HH:MM", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const epochSeconds = (yesterday.getTime() / 1000).toFixed(6);
    const result = formatTimestamp(epochSeconds);
    expect(result).toMatch(/^\d{2}\/\d{2} \d{2}:\d{2}$/);
  });

  test("ISO 8601 string for today returns HH:MM", () => {
    const now = new Date();
    const iso = now.toISOString();
    const result = formatTimestamp(iso);
    expect(result).toMatch(/^\d{2}:\d{2}$/);
  });

  test("ISO 8601 string for past date returns MM/DD HH:MM", () => {
    const result = formatTimestamp("2024-03-15T10:30:00Z");
    expect(result).toMatch(/^\d{2}\/\d{2} \d{2}:\d{2}$/);
  });

  test("invalid string returns original", () => {
    expect(formatTimestamp("not-a-date")).toBe("not-a-date");
    expect(formatTimestamp("abc123")).toBe("abc123");
  });

  test("Slack-style epoch with microseconds", () => {
    const now = new Date();
    const slackTs = `${Math.floor(now.getTime() / 1000)}.123456`;
    const result = formatTimestamp(slackTs);
    expect(result).toMatch(/^\d{2}:\d{2}$/);
  });
});

describe("truncate", () => {
  test("short string returned unchanged", () => {
    expect(truncate("hello", 10)).toBe("hello");
  });

  test("exact length returned unchanged", () => {
    expect(truncate("hello", 5)).toBe("hello");
  });

  test("long string gets truncated with ellipsis", () => {
    expect(truncate("hello world", 8)).toBe("hello...");
  });

  test("maxLen of 3 truncates without ellipsis", () => {
    expect(truncate("hello", 3)).toBe("hel");
  });

  test("maxLen of 1 truncates without ellipsis", () => {
    expect(truncate("hello", 1)).toBe("h");
  });

  test("maxLen of 0 returns empty string", () => {
    expect(truncate("hello", 0)).toBe("");
  });

  test("maxLen of 4 adds ellipsis", () => {
    expect(truncate("hello", 4)).toBe("h...");
  });
});

describe("fuzzyMatch", () => {
  test("exact match returns true", () => {
    expect(fuzzyMatch("general", "general")).toBe(true);
  });

  test("partial match in order returns true", () => {
    expect(fuzzyMatch("gnrl", "general")).toBe(true);
  });

  test("case insensitive match", () => {
    expect(fuzzyMatch("GNRL", "general")).toBe(true);
    expect(fuzzyMatch("gnrl", "GENERAL")).toBe(true);
  });

  test("empty query returns true", () => {
    expect(fuzzyMatch("", "anything")).toBe(true);
    expect(fuzzyMatch("", "")).toBe(true);
  });

  test("no match returns false", () => {
    expect(fuzzyMatch("xyz", "general")).toBe(false);
  });

  test("characters out of order returns false", () => {
    expect(fuzzyMatch("lrng", "general")).toBe(false);
  });

  test("query longer than text returns false", () => {
    expect(fuzzyMatch("generalgeneral", "general")).toBe(false);
  });
});

describe("stripHtml", () => {
  test("removes simple tags", () => {
    expect(stripHtml("<p>hello</p>")).toBe("hello");
  });

  test("removes nested tags", () => {
    expect(stripHtml("<div><p><strong>hello</strong></p></div>")).toBe("hello");
  });

  test("decodes &amp;", () => {
    expect(stripHtml("a &amp; b")).toBe("a & b");
  });

  test("decodes &lt; and &gt;", () => {
    expect(stripHtml("&lt;tag&gt;")).toBe("<tag>");
  });

  test("decodes &quot;", () => {
    expect(stripHtml('say &quot;hello&quot;')).toBe('say "hello"');
  });

  test("decodes &#39;", () => {
    expect(stripHtml("it&#39;s")).toBe("it's");
  });

  test("collapses multiple whitespace", () => {
    expect(stripHtml("hello   world")).toBe("hello world");
  });

  test("trims leading and trailing whitespace", () => {
    expect(stripHtml("  hello  ")).toBe("hello");
  });

  test("handles multiple entities and tags together", () => {
    expect(stripHtml("<p>Hello &amp; <strong>World</strong></p>")).toBe(
      "Hello & World",
    );
  });

  test("whitespace from tag removal is collapsed", () => {
    expect(stripHtml("<p>hello</p> <p>world</p>")).toBe("hello world");
  });
});

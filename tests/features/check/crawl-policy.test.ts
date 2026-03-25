import { describe, expect, it } from 'vitest'

import { applyCrawlPolicy } from '../../../src/features/check/crawl-policy'

describe('applyCrawlPolicy', () => {
  it('accepts only same-domain candidates and records skipped external links', () => {
    const input = {
      startUrl: 'https://example.com/',
      visitedUrls: ['https://example.com/'],
      candidates: [
        { url: 'https://example.com/about', depth: 1, sourceUrl: 'https://example.com/' },
        { url: 'https://cdn.example.net/file.js', depth: 1, sourceUrl: 'https://example.com/' },
      ],
      maxPages: 100,
      maxDepth: 4,
      sampleLimit: 10,
    }

    const result = applyCrawlPolicy(input)

    expect(result.accepted).toEqual([
      { url: 'https://example.com/about', depth: 1, sourceUrl: 'https://example.com/' },
    ])
    expect(result.skipped).toContainEqual({
      url: 'https://cdn.example.net/file.js',
      reason: 'cross-domain',
      sourceUrl: 'https://example.com/',
    })
  })

  it('rejects candidates beyond the configured depth and records them as unchecked scopes', () => {
    const result = applyCrawlPolicy({
      startUrl: 'https://example.com/',
      visitedUrls: ['https://example.com/', 'https://example.com/a', 'https://example.com/b'],
      candidates: [
        { url: 'https://example.com/deep/page', depth: 5, sourceUrl: 'https://example.com/b' },
      ],
      maxPages: 100,
      maxDepth: 4,
      sampleLimit: 10,
    })

    expect(result.accepted).toEqual([])
    expect(result.skipped).toContainEqual({
      url: 'https://example.com/deep/page',
      reason: 'depth-limit',
      sourceUrl: 'https://example.com/b',
    })
    expect(result.uncheckedScopes).toContainEqual({
      pagePath: '/deep/page',
      reason: 'depth-limit',
      detail: 'Maximum crawl depth 4 exceeded from https://example.com/b.',
    })
  })

  it('keeps only the first ten siblings from a large index page and marks the remainder as sampled out', () => {
    const candidates = Array.from({ length: 12 }, (_, index) => ({
      url: `https://example.com/news/${index + 1}`,
      depth: 1,
      sourceUrl: 'https://example.com/news',
    }))

    const result = applyCrawlPolicy({
      startUrl: 'https://example.com/',
      visitedUrls: ['https://example.com/', 'https://example.com/news'],
      candidates,
      maxPages: 100,
      maxDepth: 4,
      sampleLimit: 10,
    })

    expect(result.accepted).toHaveLength(10)
    expect(result.accepted.map((candidate) => candidate.url)).toEqual(
      candidates.slice(0, 10).map((candidate) => candidate.url),
    )
    expect(result.skipped).toContainEqual({
      url: 'https://example.com/news/11',
      reason: 'sample-limit',
      sourceUrl: 'https://example.com/news',
    })
    expect(result.uncheckedScopes).toContainEqual({
      pagePath: '/news',
      reason: 'sample-limit',
      detail: 'Representative sampling capped sibling links at 10 entries.',
    })
  })

  it('stops accepting new pages once the crawl reaches the max page budget', () => {
    const result = applyCrawlPolicy({
      startUrl: 'https://example.com/',
      visitedUrls: Array.from({ length: 100 }, (_, index) => `https://example.com/visited-${index}`),
      candidates: [
        { url: 'https://example.com/extra-1', depth: 1, sourceUrl: 'https://example.com/' },
        { url: 'https://example.com/extra-2', depth: 1, sourceUrl: 'https://example.com/' },
      ],
      maxPages: 100,
      maxDepth: 4,
      sampleLimit: 10,
    })

    expect(result.accepted).toEqual([])
    expect(result.skipped).toContainEqual({
      url: 'https://example.com/extra-1',
      reason: 'page-limit',
      sourceUrl: 'https://example.com/',
    })
    expect(result.uncheckedScopes).toContainEqual({
      pagePath: '/',
      reason: 'page-limit',
      detail: 'Maximum crawl page limit 100 reached before visiting queued links.',
    })
  })
})

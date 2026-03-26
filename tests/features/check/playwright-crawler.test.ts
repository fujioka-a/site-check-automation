import { mkdtemp } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { beforeEach, describe, expect, it, vi } from 'vitest'

type EventHandler = (...args: unknown[]) => void

const launchMock = vi.fn()

vi.mock('playwright', () => ({
  chromium: {
    launch: launchMock,
  },
}))

describe('crawlSite', () => {
  beforeEach(() => {
    launchMock.mockReset()
  })

  it('collects page errors and HTTP error responses from the crawler events', async () => {
    const handlers = new Map<string, EventHandler>()
    const page = {
      on: vi.fn((event: string, handler: EventHandler) => {
        handlers.set(event, handler)
      }),
      goto: vi.fn(async () => {
        handlers.get('pageerror')?.(new Error('ReferenceError: app is not defined'))
        handlers.get('response')?.({
          url: () => 'https://example.com/api/articles',
          status: () => 500,
        })
      }),
      screenshot: vi.fn(async () => undefined),
      locator: vi.fn(() => ({
        evaluateAll: vi.fn(async () => []),
      })),
      close: vi.fn(async () => undefined),
    }
    const browser = {
      newPage: vi.fn(async () => page),
      close: vi.fn(async () => undefined),
    }
    launchMock.mockResolvedValue(browser)

    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'crawler-test-'))
    const { crawlSite } = await import('../../../src/features/check/playwright-crawler')

    const report = await crawlSite({
      url: 'https://example.com/',
      outputDir: tempDir,
      maxPages: 1,
      maxDepth: 0,
      sampleLimit: 1,
      now: new Date('2026-03-25T00:00:00.000Z'),
    })

    expect(report.pages[0]?.pageErrors).toEqual(['ReferenceError: app is not defined'])
    expect(report.pages[0]?.httpErrors).toEqual(['https://example.com/api/articles (500)'])
    expect(report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'page-error',
          evidence: 'ReferenceError: app is not defined',
        }),
        expect.objectContaining({
          category: 'http-error',
          evidence: 'https://example.com/api/articles (500)',
        }),
      ]),
    )
  })

  it('excludes third-party font fetch failures from findings while preserving raw page diagnostics', async () => {
    const handlers = new Map<string, EventHandler>()
    const page = {
      on: vi.fn((event: string, handler: EventHandler) => {
        handlers.set(event, handler)
      }),
      goto: vi.fn(async () => {
        handlers.get('requestfailed')?.({
          url: () => 'https://fonts.gstatic.com/s/inter/v1/font.woff2',
          failure: () => ({ errorText: 'net::ERR_ABORTED' }),
        })
      }),
      screenshot: vi.fn(async () => undefined),
      locator: vi.fn(() => ({
        evaluateAll: vi.fn(async () => []),
      })),
      close: vi.fn(async () => undefined),
    }
    const browser = {
      newPage: vi.fn(async () => page),
      close: vi.fn(async () => undefined),
    }
    launchMock.mockResolvedValue(browser)

    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'crawler-test-'))
    const { crawlSite } = await import('../../../src/features/check/playwright-crawler')

    const report = await crawlSite({
      url: 'https://example.com/',
      outputDir: tempDir,
      maxPages: 1,
      maxDepth: 0,
      sampleLimit: 1,
      now: new Date('2026-03-25T00:00:00.000Z'),
    })

    expect(report.pages[0]?.failedRequests).toEqual([
      'https://fonts.gstatic.com/s/inter/v1/font.woff2 (net::ERR_ABORTED)',
    ])
    expect(report.findings).toEqual([])
    expect(report).toEqual(
      expect.objectContaining({
        excludedFindings: expect.arrayContaining([
          expect.objectContaining({
            category: 'failed-request',
            evidence: 'https://fonts.gstatic.com/s/inter/v1/font.woff2 (net::ERR_ABORTED)',
            reason: '外部ドメインのコンテンツアセット取得失敗は評価対象外',
          }),
        ]),
      }),
    )
  })

  it('excludes unauthenticated third-party widget errors from findings while preserving raw console diagnostics', async () => {
    const handlers = new Map<string, EventHandler>()
    const page = {
      on: vi.fn((event: string, handler: EventHandler) => {
        handlers.set(event, handler)
      }),
      goto: vi.fn(async () => {
        handlers.get('console')?.({
          type: () => 'error',
          text: () => 'Facebook SDK login status check failed: user is not logged in',
        })
      }),
      screenshot: vi.fn(async () => undefined),
      locator: vi.fn(() => ({
        evaluateAll: vi.fn(async () => []),
      })),
      close: vi.fn(async () => undefined),
    }
    const browser = {
      newPage: vi.fn(async () => page),
      close: vi.fn(async () => undefined),
    }
    launchMock.mockResolvedValue(browser)

    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'crawler-test-'))
    const { crawlSite } = await import('../../../src/features/check/playwright-crawler')

    const report = await crawlSite({
      url: 'https://example.com/',
      outputDir: tempDir,
      maxPages: 1,
      maxDepth: 0,
      sampleLimit: 1,
      now: new Date('2026-03-25T00:00:00.000Z'),
    })

    expect(report.pages[0]?.console.error).toEqual([
      'Facebook SDK login status check failed: user is not logged in',
    ])
    expect(report.findings).toEqual([])
    expect(report).toEqual(
      expect.objectContaining({
        excludedFindings: expect.arrayContaining([
          expect.objectContaining({
            category: 'console-error',
            evidence: 'Facebook SDK login status check failed: user is not logged in',
            reason: '未ログイン状態の外部ウィジェットエラーは評価対象外',
          }),
        ]),
      }),
    )
  })

  it('excludes third-party stylesheet fetch failures as content asset noise', async () => {
    const handlers = new Map<string, EventHandler>()
    const page = {
      on: vi.fn((event: string, handler: EventHandler) => {
        handlers.set(event, handler)
      }),
      goto: vi.fn(async () => {
        handlers.get('requestfailed')?.({
          url: () => 'https://cdn.example.net/assets/site.css',
          failure: () => ({ errorText: 'net::ERR_ABORTED' }),
        })
      }),
      screenshot: vi.fn(async () => undefined),
      locator: vi.fn(() => ({
        evaluateAll: vi.fn(async () => []),
      })),
      close: vi.fn(async () => undefined),
    }
    const browser = {
      newPage: vi.fn(async () => page),
      close: vi.fn(async () => undefined),
    }
    launchMock.mockResolvedValue(browser)

    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'crawler-test-'))
    const { crawlSite } = await import('../../../src/features/check/playwright-crawler')

    const report = await crawlSite({
      url: 'https://example.com/',
      outputDir: tempDir,
      maxPages: 1,
      maxDepth: 0,
      sampleLimit: 1,
      now: new Date('2026-03-25T00:00:00.000Z'),
    })

    expect(report.pages[0]?.failedRequests).toEqual([
      'https://cdn.example.net/assets/site.css (net::ERR_ABORTED)',
    ])
    expect(report.findings).toEqual([])
    expect(report.excludedFindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          evidence: 'https://cdn.example.net/assets/site.css (net::ERR_ABORTED)',
          reason: '外部ドメインのコンテンツアセット取得失敗は評価対象外',
        }),
      ]),
    )
  })

  it('keeps same-domain and migration-risk failures as reportable findings even if they look like fetch noise', async () => {
    const handlers = new Map<string, EventHandler>()
    const page = {
      on: vi.fn((event: string, handler: EventHandler) => {
        handlers.set(event, handler)
      }),
      goto: vi.fn(async () => {
        handlers.get('requestfailed')?.({
          url: () => 'https://example.com/api/bootstrap',
          failure: () => ({ errorText: 'CORS preflight failed on CloudFront origin' }),
        })
      }),
      screenshot: vi.fn(async () => undefined),
      locator: vi.fn(() => ({
        evaluateAll: vi.fn(async () => []),
      })),
      close: vi.fn(async () => undefined),
    }
    const browser = {
      newPage: vi.fn(async () => page),
      close: vi.fn(async () => undefined),
    }
    launchMock.mockResolvedValue(browser)

    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'crawler-test-'))
    const { crawlSite } = await import('../../../src/features/check/playwright-crawler')

    const report = await crawlSite({
      url: 'https://example.com/',
      outputDir: tempDir,
      maxPages: 1,
      maxDepth: 0,
      sampleLimit: 1,
      now: new Date('2026-03-25T00:00:00.000Z'),
    })

    expect(report.pages[0]?.failedRequests).toEqual([
      'https://example.com/api/bootstrap (CORS preflight failed on CloudFront origin)',
    ])
    expect(report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'failed-request',
          evidence: 'https://example.com/api/bootstrap (CORS preflight failed on CloudFront origin)',
          migrationRisk: true,
        }),
      ]),
    )
    expect(report).toEqual(
      expect.objectContaining({
        excludedFindings: [],
      }),
    )
  })

  it('keeps same-site sibling subdomain asset failures as reportable findings', async () => {
    const handlers = new Map<string, EventHandler>()
    const page = {
      on: vi.fn((event: string, handler: EventHandler) => {
        handlers.set(event, handler)
      }),
      goto: vi.fn(async () => {
        handlers.get('requestfailed')?.({
          url: () => 'https://cdn.example.com/assets/app.css',
          failure: () => ({ errorText: 'net::ERR_ABORTED' }),
        })
      }),
      screenshot: vi.fn(async () => undefined),
      locator: vi.fn(() => ({
        evaluateAll: vi.fn(async () => []),
      })),
      close: vi.fn(async () => undefined),
    }
    const browser = {
      newPage: vi.fn(async () => page),
      close: vi.fn(async () => undefined),
    }
    launchMock.mockResolvedValue(browser)

    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'crawler-test-'))
    const { crawlSite } = await import('../../../src/features/check/playwright-crawler')

    const report = await crawlSite({
      url: 'https://www.example.com/',
      outputDir: tempDir,
      maxPages: 1,
      maxDepth: 0,
      sampleLimit: 1,
      now: new Date('2026-03-25T00:00:00.000Z'),
    })

    expect(report.pages[0]?.failedRequests).toEqual([
      'https://cdn.example.com/assets/app.css (net::ERR_ABORTED)',
    ])
    expect(report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'failed-request',
          evidence: 'https://cdn.example.com/assets/app.css (net::ERR_ABORTED)',
        }),
      ]),
    )
    expect(report.excludedFindings).toEqual([])
  })

  it('keeps same-domain youtube oauth 403 responses as reportable findings', async () => {
    const handlers = new Map<string, EventHandler>()
    const page = {
      on: vi.fn((event: string, handler: EventHandler) => {
        handlers.set(event, handler)
      }),
      goto: vi.fn(async () => {
        handlers.get('response')?.({
          url: () => 'https://example.com/api/youtube/oauth',
          status: () => 403,
        })
      }),
      screenshot: vi.fn(async () => undefined),
      locator: vi.fn(() => ({
        evaluateAll: vi.fn(async () => []),
      })),
      close: vi.fn(async () => undefined),
    }
    const browser = {
      newPage: vi.fn(async () => page),
      close: vi.fn(async () => undefined),
    }
    launchMock.mockResolvedValue(browser)

    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'crawler-test-'))
    const { crawlSite } = await import('../../../src/features/check/playwright-crawler')

    const report = await crawlSite({
      url: 'https://example.com/',
      outputDir: tempDir,
      maxPages: 1,
      maxDepth: 0,
      sampleLimit: 1,
      now: new Date('2026-03-25T00:00:00.000Z'),
    })

    expect(report.pages[0]?.httpErrors).toEqual(['https://example.com/api/youtube/oauth (403)'])
    expect(report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'http-error',
          evidence: 'https://example.com/api/youtube/oauth (403)',
        }),
      ]),
    )
    expect(report.excludedFindings).toEqual([])
  })
})

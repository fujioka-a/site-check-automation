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
})

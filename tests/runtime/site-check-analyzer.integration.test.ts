import { mkdtemp, readFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createFinding, createSiteReport } from '../support/report-fixtures'

const crawlSiteMock = vi.fn()

vi.mock('../../src/features/check/playwright-crawler', () => ({
  crawlSite: crawlSiteMock,
}))

describe('runSiteCheckAnalyzer', () => {
  beforeEach(() => {
    crawlSiteMock.mockReset()
  })

  it('executes the check flow from the site-check-analyzer entry and writes both artifacts', async () => {
    crawlSiteMock.mockResolvedValue(
      createSiteReport({
        findings: [
          createFinding({
            id: 'critical-1',
            severity: 'critical',
            title: 'Main visual failed',
            evidence: 'main.css returned 404.',
            cause: 'Deployment uploaded HTML before assets.',
          }),
        ],
      }),
    )
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'site-check-analyzer-'))
    const { runSiteCheckAnalyzer } = await import('../../src/runtime/site-check-analyzer')

    await runSiteCheckAnalyzer([
      'check',
      '--url',
      'https://example.com/',
      '--output',
      tempDir,
      '--max-pages',
      '3',
      '--max-depth',
      '2',
      '--sample-limit',
      '5',
    ])

    expect(crawlSiteMock).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://example.com/',
        outputDir: tempDir,
        maxPages: 3,
        maxDepth: 2,
        sampleLimit: 5,
      }),
    )

    const today = new Date().toISOString().slice(0, 10)
    const jsonPath = path.join(tempDir, 'example.com', `result_example_com_${today}.json`)
    const markdownPath = path.join(tempDir, 'example.com', `result_example_com_${today}.md`)

    await expect(readFile(jsonPath, 'utf8')).resolves.toContain('"overallJudgement": "問題あり"')
    await expect(readFile(markdownPath, 'utf8')).resolves.toContain('# Site Check Report')
  })
})

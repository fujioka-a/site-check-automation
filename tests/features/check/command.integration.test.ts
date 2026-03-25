import { describe, expect, it, vi } from 'vitest'

import { runCheckCommand } from '../../../src/features/check/command'
import { createFinding, createSiteReport } from '../../support/report-fixtures'

describe('runCheckCommand', () => {
  it('passes crawl limits through the command and writes both markdown and json artifacts', async () => {
    const crawlSite = vi.fn().mockResolvedValue(
      createSiteReport({
        findings: [
          createFinding({
            severity: 'critical',
            title: 'App shell failed to render',
            evidence: 'main.js returned 500.',
            cause: 'Broken asset deployment',
          }),
        ],
      }),
    )
    const renderCheckMarkdown = vi.fn().mockReturnValue('# markdown')
    const writeArtifact = vi.fn().mockResolvedValue(undefined)

    await runCheckCommand(
      {
        url: 'https://example.com/',
        outputDir: 'reports',
        maxPages: 25,
        maxDepth: 3,
        sampleLimit: 7,
      },
      {
        crawlSite,
        renderCheckMarkdown,
        writeArtifact,
        now: () => new Date('2026-03-25T00:00:00Z'),
      },
    )

    expect(crawlSite).toHaveBeenCalledWith({
      url: 'https://example.com/',
      maxPages: 25,
      maxDepth: 3,
      sampleLimit: 7,
    })
    expect(renderCheckMarkdown).toHaveBeenCalledWith(
      expect.objectContaining({
        summary: expect.objectContaining({
          overallJudgement: '問題あり',
        }),
      }),
    )
    expect(writeArtifact).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        format: 'markdown',
        path: 'reports/example.com/result_example_com_2026-03-25.md',
        contents: '# markdown',
      }),
    )
    expect(writeArtifact).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        format: 'json',
        path: 'reports/example.com/result_example_com_2026-03-25.json',
      }),
    )
  })
})

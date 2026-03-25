import { describe, expect, it, vi } from 'vitest'

import { runDiffCommand } from '../../../src/features/diff/command'
import { createFinding, createSiteReport } from '../../support/report-fixtures'

describe('runDiffCommand', () => {
  it('reads before and after reports, renders markdown, and writes the diff artifact', async () => {
    const beforeReport = createSiteReport({
      summary: {
        pagesVisited: 1,
        totalFindings: 0,
        overallJudgement: '問題なし',
      },
    })
    const afterReport = createSiteReport({
      summary: {
        pagesVisited: 1,
        totalFindings: 1,
        overallJudgement: '問題あり',
      },
      findings: [
        createFinding({
          id: 'critical-1',
          severity: 'critical',
          category: 'render-failure',
          title: 'Main visual collapsed',
          evidence: 'main.css returned 404.',
          cause: 'Asset path mismatch after deploy',
        }),
      ],
    })
    const readArtifact = vi
      .fn()
      .mockResolvedValueOnce(JSON.stringify(beforeReport))
      .mockResolvedValueOnce(JSON.stringify(afterReport))
    const compareReports = vi.fn().mockReturnValue({
      summary: {
        beforeJudgement: '問題なし',
        afterJudgement: '問題あり',
        changed: true,
      },
      addedFindings: [
        {
          id: 'critical-1',
          severity: 'critical',
          title: 'Main visual collapsed',
          pagePath: '/',
          evidence: 'main.css returned 404.',
          cause: 'Asset path mismatch after deploy',
        },
      ],
      removedFindings: [],
      consoleChanges: [],
    })
    const renderDiffMarkdown = vi.fn().mockReturnValue('# diff markdown')
    const writeArtifact = vi.fn().mockResolvedValue(undefined)

    await runDiffCommand(
      {
        before: 'reports/example.com/result_example_com_2026-03-24.json',
        after: 'reports/example.com/result_example_com_2026-03-25.json',
        outputPath: 'reports/example.com/diff_2026-03-25.md',
      },
      {
        readArtifact,
        compareReports,
        renderDiffMarkdown,
        writeArtifact,
      },
    )

    expect(readArtifact).toHaveBeenNthCalledWith(
      1,
      'reports/example.com/result_example_com_2026-03-24.json',
    )
    expect(readArtifact).toHaveBeenNthCalledWith(
      2,
      'reports/example.com/result_example_com_2026-03-25.json',
    )
    expect(compareReports).toHaveBeenCalledWith(beforeReport, afterReport)
    expect(renderDiffMarkdown).toHaveBeenCalledWith(
      expect.objectContaining({
        summary: expect.objectContaining({
          beforeJudgement: '問題なし',
          afterJudgement: '問題あり',
        }),
      }),
    )
    expect(writeArtifact).toHaveBeenCalledWith({
      format: 'markdown',
      path: 'reports/example.com/diff_2026-03-25.md',
      contents: '# diff markdown',
    })
  })

  it('fails fast when a diff input is not valid JSON', async () => {
    const readArtifact = vi.fn().mockResolvedValue('not-json')
    const compareReports = vi.fn()
    const renderDiffMarkdown = vi.fn()
    const writeArtifact = vi.fn()

    await expect(
      runDiffCommand(
        {
          before: 'reports/example.com/result_example_com_2026-03-24.json',
          after: 'reports/example.com/result_example_com_2026-03-25.json',
          outputPath: 'reports/example.com/diff_2026-03-25.md',
        },
        {
          readArtifact,
          compareReports,
          renderDiffMarkdown,
          writeArtifact,
        },
      ),
    ).rejects.toThrow(
      'Failed to parse diff input: reports/example.com/result_example_com_2026-03-24.json',
    )

    expect(compareReports).not.toHaveBeenCalled()
    expect(renderDiffMarkdown).not.toHaveBeenCalled()
    expect(writeArtifact).not.toHaveBeenCalled()
  })
})

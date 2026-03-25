import { describe, expect, it } from 'vitest'

import { compareReports } from '../../../src/features/diff/compare-report'
import { createFinding, createSiteReport } from '../../support/report-fixtures'

describe('compareReports', () => {
  it('detects newly added findings and warning growth between before and after reports', () => {
    const beforeReport = createSiteReport({
      summary: {
        pagesVisited: 1,
        totalFindings: 1,
        overallJudgement: '問題なし',
      },
      findings: [
        createFinding({
          id: 'warning-1',
          severity: 'low',
          category: 'console-warning',
          title: 'Analytics warning',
        }),
      ],
      pages: [
        {
          url: 'https://example.com/',
          path: '/',
          depth: 0,
          screenshotPath: 'reports/example.com/screenshots/home.png',
          console: {
            warning: ['analytics warning'],
            error: [],
          },
          pageErrors: [],
          failedRequests: [],
          httpErrors: [],
          notes: [],
        },
      ],
    })
    const afterReport = createSiteReport({
      summary: {
        pagesVisited: 1,
        totalFindings: 2,
        overallJudgement: '要確認',
      },
      findings: [
        createFinding({
          id: 'warning-1',
          severity: 'low',
          category: 'console-warning',
          title: 'Analytics warning',
        }),
        createFinding({
          id: 'warning-2',
          severity: 'medium',
          category: 'console-warning',
          title: 'New deprecated API warning',
          evidence: 'warning: deprecated API on /',
          cause: 'New frontend bundle introduced a deprecated call',
        }),
      ],
      pages: [
        {
          url: 'https://example.com/',
          path: '/',
          depth: 0,
          screenshotPath: 'reports/example.com/screenshots/home.png',
          console: {
            warning: ['analytics warning', 'deprecated API warning'],
            error: [],
          },
          pageErrors: [],
          failedRequests: [],
          httpErrors: [],
          notes: [],
        },
      ],
    })

    const diff = compareReports(beforeReport, afterReport)

    expect(diff.summary).toEqual({
      beforeJudgement: '問題なし',
      afterJudgement: '要確認',
      changed: true,
    })
    expect(diff.addedFindings).toContainEqual(
      expect.objectContaining({
        id: 'warning-2',
        title: 'New deprecated API warning',
      }),
    )
    expect(diff.consoleChanges).toContainEqual({
      pagePath: '/',
      warningsAdded: ['deprecated API warning'],
      warningsRemoved: [],
      errorsAdded: [],
      errorsRemoved: [],
    })
  })

  it('reports removed findings as improvements and keeps unchanged findings out of the diff', () => {
    const sharedFinding = createFinding({
      id: 'shared-1',
      severity: 'medium',
      title: 'Shared warning',
    })
    const beforeReport = createSiteReport({
      findings: [
        sharedFinding,
        createFinding({
          id: 'removed-1',
          severity: 'high',
          title: 'Broken API bootstrap',
          evidence: 'GET /api/bootstrap returned 500.',
          cause: 'Backend deployment missing environment variable',
        }),
      ],
    })
    const afterReport = createSiteReport({
      findings: [sharedFinding],
    })

    const diff = compareReports(beforeReport, afterReport)

    expect(diff.removedFindings).toContainEqual(
      expect.objectContaining({
        id: 'removed-1',
        title: 'Broken API bootstrap',
      }),
    )
    expect(diff.addedFindings).toEqual([])
  })

  it('treats matching findings as unchanged even when the runtime-generated id differs', () => {
    const beforeReport = createSiteReport({
      findings: [
        createFinding({
          id: 'before-generated-id',
          category: 'console-error',
          title: 'Chunk load failed',
          evidence: 'Loading chunk 99 failed.',
          cause: 'Static asset cache mismatch',
        }),
      ],
    })
    const afterReport = createSiteReport({
      findings: [
        createFinding({
          id: 'after-generated-id',
          category: 'console-error',
          title: 'Chunk load failed',
          evidence: 'Loading chunk 99 failed.',
          cause: 'Static asset cache mismatch',
        }),
      ],
    })

    const diff = compareReports(beforeReport, afterReport)

    expect(diff.addedFindings).toEqual([])
    expect(diff.removedFindings).toEqual([])
  })

  it('reports removed console messages for pages that only exist in the before report', () => {
    const beforeReport = createSiteReport({
      pages: [
        {
          url: 'https://example.com/legacy',
          path: '/legacy',
          depth: 1,
          screenshotPath: 'reports/example.com/screenshots/legacy.png',
          console: {
            warning: ['legacy warning'],
            error: ['legacy error'],
          },
          pageErrors: [],
          failedRequests: [],
          httpErrors: [],
          notes: [],
        },
      ],
    })
    const afterReport = createSiteReport({
      pages: [],
    })

    const diff = compareReports(beforeReport, afterReport)

    expect(diff.consoleChanges).toContainEqual({
      pagePath: '/legacy',
      warningsAdded: [],
      warningsRemoved: ['legacy warning'],
      errorsAdded: [],
      errorsRemoved: ['legacy error'],
    })
  })
})

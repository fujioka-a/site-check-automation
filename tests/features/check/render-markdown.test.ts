import { describe, expect, it } from 'vitest'

import { renderCheckMarkdown } from '../../../src/features/check/render-markdown'
import { createFinding, createSiteReport, createUncheckedScope } from '../../support/report-fixtures'

describe('renderCheckMarkdown', () => {
  it('renders the required sections for summary, severity buckets, page details, and recommendations', () => {
    const report = createSiteReport({
      summary: {
        pagesVisited: 2,
        totalFindings: 2,
        overallJudgement: '問題あり',
      },
      findings: [
        createFinding({
          id: 'critical-1',
          severity: 'critical',
          category: 'render-failure',
          title: 'Global navigation is missing',
          evidence: 'Header area collapsed on first paint.',
          cause: 'Critical CSS was not loaded.',
        }),
        createFinding({
          id: 'high-1',
          severity: 'high',
          category: 'cors',
          title: 'CORS error on API bootstrap',
          evidence: 'GET /api/bootstrap blocked by CORS.',
          cause: 'Origin allow-list does not include production host.',
          migrationRisk: true,
        }),
      ],
      uncheckedScopes: [createUncheckedScope()],
    })

    const markdown = renderCheckMarkdown(report)

    expect(markdown).toContain('# Site Check Report')
    expect(markdown).toContain('## Summary')
    expect(markdown).toContain('- Target: https://example.com/')
    expect(markdown).toContain('- Pages visited: 2')
    expect(markdown).toContain('- Overall judgement: 問題あり')
    expect(markdown).toContain('## Critical')
    expect(markdown).toContain('Global navigation is missing')
    expect(markdown).toContain('## High')
    expect(markdown).toContain('CORS error on API bootstrap')
    expect(markdown).toContain('## Page Details')
    expect(markdown).toContain('## Migration Risk')
    expect(markdown).toContain('## Recommended Actions')
  })

  it('includes evidence, estimated cause, screenshot, and unchecked scope notes in markdown output', () => {
    const report = createSiteReport({
      summary: {
        pagesVisited: 1,
        totalFindings: 1,
        overallJudgement: '要確認',
      },
      findings: [
        createFinding({
          severity: 'medium',
          title: 'Hero image is missing',
          evidence: 'GET /images/hero.webp returned 404.',
          cause: 'Image path changed during deployment.',
          screenshotPath: 'reports/example.com/screenshots/hero.png',
        }),
      ],
      uncheckedScopes: [
        createUncheckedScope({
          pagePath: '/products',
          reason: 'sample-limit',
          detail: 'Representative sampling capped sibling links at 10 entries.',
        }),
      ],
    })

    const markdown = renderCheckMarkdown(report)

    expect(markdown).toContain('根拠: GET /images/hero.webp returned 404.')
    expect(markdown).toContain('原因推定: Image path changed during deployment.')
    expect(markdown).toContain('スクリーンショット: reports/example.com/screenshots/hero.png')
    expect(markdown).toContain('## Limitations')
    expect(markdown).toContain('/products')
    expect(markdown).toContain('Representative sampling capped sibling links at 10 entries.')
  })
})

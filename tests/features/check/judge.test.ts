import { describe, expect, it } from 'vitest'

import { judgeSiteResult } from '../../../src/features/check/judge'
import { createFinding, createSiteReport } from '../../support/report-fixtures'

describe('judgeSiteResult', () => {
  it('returns 問題なし when no findings were collected', () => {
    const report = createSiteReport()

    const judgement = judgeSiteResult(report)

    expect(judgement).toEqual({
      overallJudgement: '問題なし',
      reasons: [],
    })
  })

  it('returns 問題あり when the report contains a visible-impact error', () => {
    const report = createSiteReport({
      findings: [
        createFinding({
          severity: 'critical',
          category: 'render-failure',
          title: 'Hero section is blank',
          evidence: 'Main stylesheet failed and the first view rendered without layout.',
          cause: 'CSS asset path mismatch after deployment',
        }),
      ],
    })

    const judgement = judgeSiteResult(report)

    expect(judgement.overallJudgement).toBe('問題あり')
    expect(judgement.reasons).toContain('見た目に影響する重大な異常を検出しました。')
  })

  it('returns 問題あり when AWS migration-related failures are detected', () => {
    const report = createSiteReport({
      findings: [
        createFinding({
          severity: 'high',
          category: 'asset-load-failure',
          title: 'CDN asset returned 403',
          evidence: 'https://assets.example.com/app.js returned 403 from CloudFront.',
          cause: 'AWS migration related asset path or permission mismatch',
          migrationRisk: true,
        }),
      ],
    })

    const judgement = judgeSiteResult(report)

    expect(judgement.overallJudgement).toBe('問題あり')
    expect(judgement.reasons).toContain('AWS移行に関連する異常の疑いがあります。')
  })

  it('returns 要確認 when only warnings without visible breakage remain', () => {
    const report = createSiteReport({
      findings: [
        createFinding({
          severity: 'medium',
          category: 'console-warning',
          title: 'Deprecated API warning',
          evidence: 'warning: deprecated API on /news',
          cause: 'Legacy warning emitted after hydration',
        }),
      ],
    })

    const judgement = judgeSiteResult(report)

    expect(judgement).toEqual({
      overallJudgement: '要確認',
      reasons: ['warning 相当の異常が検出されました。'],
    })
  })
})

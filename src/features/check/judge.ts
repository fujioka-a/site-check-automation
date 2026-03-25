import { JUDGEMENTS, type SiteJudgement, type SiteReport } from '../../shared/report-schema'

const REASON_VISIBLE_BREAKAGE = '見た目に影響する重大な異常を検出しました。'
const REASON_MIGRATION_RISK = 'AWS移行に関連する異常の疑いがあります。'
const REASON_WARNING = 'warning 相当の異常が検出されました。'

const VISIBLE_IMPACT_SEVERITIES = new Set(['critical'])

export function judgeSiteResult(report: SiteReport): SiteJudgement {
  const reasons: string[] = []
  const hasVisibleImpact = report.findings.some((finding) =>
    VISIBLE_IMPACT_SEVERITIES.has(finding.severity),
  )
  const hasMigrationRisk = report.findings.some((finding) => finding.migrationRisk === true)

  if (hasVisibleImpact) {
    reasons.push(REASON_VISIBLE_BREAKAGE)
  }

  if (hasMigrationRisk) {
    reasons.push(REASON_MIGRATION_RISK)
  }

  if (reasons.length > 0) {
    return {
      overallJudgement: JUDGEMENTS.problem,
      reasons,
    }
  }

  if (report.findings.length > 0) {
    return {
      overallJudgement: JUDGEMENTS.review,
      reasons: [REASON_WARNING],
    }
  }

  return {
    overallJudgement: JUDGEMENTS.ok,
    reasons: [],
  }
}

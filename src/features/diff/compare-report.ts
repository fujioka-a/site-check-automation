import type {
  ConsoleChange,
  DiffFinding,
  DiffReport,
  SiteFinding,
  SiteReport,
} from '../../shared/report-schema'
import { buildFindingComparisonKey } from '../../shared/report-schema'

export function compareReports(beforeReport: SiteReport, afterReport: SiteReport): DiffReport {
  const beforeFindings = new Map(
    beforeReport.findings.map((finding) => [buildFindingComparisonKey(finding), finding]),
  )
  const afterFindings = new Map(
    afterReport.findings.map((finding) => [buildFindingComparisonKey(finding), finding]),
  )

  return {
    summary: {
      beforeJudgement: beforeReport.summary.overallJudgement,
      afterJudgement: afterReport.summary.overallJudgement,
      changed: beforeReport.summary.overallJudgement !== afterReport.summary.overallJudgement,
    },
    addedFindings: collectFindings(afterFindings, beforeFindings),
    removedFindings: collectFindings(beforeFindings, afterFindings),
    consoleChanges: collectConsoleChanges(beforeReport, afterReport),
  }
}

function collectFindings(
  source: Map<string, SiteFinding>,
  comparison: Map<string, SiteFinding>,
): DiffFinding[] {
  const findings: DiffFinding[] = []

  for (const [id, finding] of source.entries()) {
    if (comparison.has(id)) {
      continue
    }

    findings.push({
      id: finding.id,
      severity: finding.severity,
      title: finding.title,
      pagePath: finding.pagePath,
      evidence: finding.evidence,
      cause: finding.cause,
    })
  }

  return findings
}

function collectConsoleChanges(beforeReport: SiteReport, afterReport: SiteReport): ConsoleChange[] {
  const beforePages = new Map(beforeReport.pages.map((page) => [page.path, page]))
  const afterPages = new Map(afterReport.pages.map((page) => [page.path, page]))
  const changes: ConsoleChange[] = []

  for (const pagePath of collectPagePaths(beforeReport, afterReport)) {
    const beforePage = beforePages.get(pagePath)
    const afterPage = afterPages.get(pagePath)
    const beforeWarnings = beforePage ? beforePage.console.warning : []
    const afterWarnings = afterPage ? afterPage.console.warning : []
    const beforeErrors = beforePage ? beforePage.console.error : []
    const afterErrors = afterPage ? afterPage.console.error : []
    const warningsAdded = subtract(afterWarnings, beforeWarnings)
    const warningsRemoved = subtract(beforeWarnings, afterWarnings)
    const errorsAdded = subtract(afterErrors, beforeErrors)
    const errorsRemoved = subtract(beforeErrors, afterErrors)

    if (
      warningsAdded.length === 0 &&
      warningsRemoved.length === 0 &&
      errorsAdded.length === 0 &&
      errorsRemoved.length === 0
    ) {
      continue
    }

    changes.push({
      pagePath,
      warningsAdded,
      warningsRemoved,
      errorsAdded,
      errorsRemoved,
    })
  }

  return changes
}

function subtract(source: string[], comparison: string[]): string[] {
  return source.filter((value) => !comparison.includes(value))
}

function collectPagePaths(beforeReport: SiteReport, afterReport: SiteReport): string[] {
  return [...new Set([...beforeReport.pages.map((page) => page.path), ...afterReport.pages.map((page) => page.path)])]
}

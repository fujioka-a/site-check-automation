import type { ExcludedFinding, SiteFinding, SiteReport } from '../../shared/report-schema'

const SEVERITY_HEADINGS: Record<SiteFinding['severity'], string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

export function renderCheckMarkdown(report: SiteReport): string {
  const sections: string[] = [
    '# Site Check Report',
    '',
    '## Summary',
    `- Target: ${report.targetUrl}`,
    `- Pages visited: ${report.summary.pagesVisited}`,
    `- Total findings: ${report.summary.totalFindings}`,
    `- Evaluation exclusions: ${report.excludedFindings.length}`,
    `- Overall judgement: ${report.summary.overallJudgement}`,
  ]

  for (const severity of ['critical', 'high', 'medium', 'low'] as const) {
    const findings = report.findings.filter((finding) => finding.severity === severity)
    if (findings.length === 0) {
      continue
    }

    sections.push('', `## ${SEVERITY_HEADINGS[severity]}`)
    for (const finding of findings) {
      sections.push(...renderFinding(finding))
    }
  }

  sections.push('', '## Page Details')
  for (const page of report.pages) {
    sections.push(`- ${page.path} (${page.url})`)
  }

  const migrationFindings = report.findings.filter((finding) => finding.migrationRisk === true)
  if (migrationFindings.length > 0) {
    sections.push('', '## Migration Risk')
    for (const finding of migrationFindings) {
      sections.push(`- ${finding.title}`)
    }
  }

  sections.push('', '## Recommended Actions')
  sections.push('- 重大な異常から優先して修正し、再チェックを実施してください。')

  if (report.uncheckedScopes.length > 0) {
    sections.push('', '## Limitations')
    for (const scope of report.uncheckedScopes) {
      sections.push(`- ${scope.pagePath}: ${scope.detail}`)
    }
  }

  if (report.excludedFindings.length > 0) {
    sections.push('', '## Evaluation Exclusions')
    for (const finding of report.excludedFindings) {
      sections.push(...renderExcludedFinding(finding))
    }
  }

  return sections.join('\n')
}

function renderFinding(finding: SiteFinding): string[] {
  const lines = [`- ${finding.title}`, `  - 根拠: ${finding.evidence}`, `  - 原因推定: ${finding.cause}`]

  if (finding.screenshotPath) {
    lines.push(`  - スクリーンショット: ${finding.screenshotPath}`)
  }

  return lines
}

function renderExcludedFinding(finding: ExcludedFinding): string[] {
  const lines = [
    `- ${finding.title}`,
    `  - 根拠: ${finding.evidence}`,
    `  - 原因推定: ${finding.cause}`,
    `  - 評価除外理由: ${finding.reason}`,
  ]

  if (finding.screenshotPath) {
    lines.push(`  - スクリーンショット: ${finding.screenshotPath}`)
  }

  return lines
}

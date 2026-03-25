import type { ConsoleChange, DiffFinding, DiffReport } from '../../shared/report-schema'

export function renderDiffMarkdown(report: DiffReport): string {
  const lines: string[] = [
    '# Site Check Diff Report',
    '',
    '## Summary',
    `- Before: ${report.summary.beforeJudgement}`,
    `- After: ${report.summary.afterJudgement}`,
    `- Changed: ${report.summary.changed ? 'yes' : 'no'}`,
    '',
    '## Added Findings',
  ]

  lines.push(...renderFindings(report.addedFindings))
  lines.push('', '## Removed Findings')
  lines.push(...renderFindings(report.removedFindings))
  lines.push('', '## Console Differences')
  lines.push(...renderConsoleChanges(report.consoleChanges))

  return lines.join('\n')
}

function renderFindings(findings: DiffFinding[]): string[] {
  if (findings.length === 0) {
    return ['- None']
  }

  return findings.flatMap((finding) => [
    `- ${finding.title}`,
    `  - Severity: ${finding.severity}`,
    `  - Page: ${finding.pagePath}`,
    `  - Evidence: ${finding.evidence}`,
    `  - Cause: ${finding.cause}`,
  ])
}

function renderConsoleChanges(changes: ConsoleChange[]): string[] {
  if (changes.length === 0) {
    return ['- None']
  }

  const lines: string[] = []
  for (const change of changes) {
    lines.push(`- ${change.pagePath}`)
    for (const warning of change.warningsAdded) {
      lines.push(`  - Warning added: ${warning}`)
    }
    for (const warning of change.warningsRemoved) {
      lines.push(`  - Warning removed: ${warning}`)
    }
    for (const error of change.errorsAdded) {
      lines.push(`  - Error added: ${error}`)
    }
    for (const error of change.errorsRemoved) {
      lines.push(`  - Error removed: ${error}`)
    }
  }

  return lines
}

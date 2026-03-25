export const JUDGEMENTS = {
  ok: '問題なし',
  review: '要確認',
  problem: '問題あり',
} as const

export type OverallJudgement = (typeof JUDGEMENTS)[keyof typeof JUDGEMENTS]

export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low'

export interface SiteFinding {
  id: string
  severity: FindingSeverity
  category: string
  title: string
  pagePath: string
  evidence: string
  cause: string
  screenshotPath?: string
  migrationRisk?: boolean
}

export function buildFindingComparisonKey(
  finding: Pick<SiteFinding, 'pagePath' | 'category' | 'title' | 'evidence'>,
): string {
  return JSON.stringify([finding.pagePath, finding.category, finding.title, finding.evidence])
}

export interface PageConsoleReport {
  warning: string[]
  error: string[]
}

export interface PageReport {
  url: string
  path: string
  depth: number
  screenshotPath: string
  console: PageConsoleReport
  pageErrors: string[]
  failedRequests: string[]
  httpErrors: string[]
  notes: string[]
}

export interface UncheckedScope {
  pagePath: string
  reason: string
  detail: string
}

export interface SiteReport {
  targetUrl: string
  domain: string
  scannedAt: string
  summary: {
    pagesVisited: number
    totalFindings: number
    overallJudgement: OverallJudgement
  }
  findings: SiteFinding[]
  pages: PageReport[]
  uncheckedScopes: UncheckedScope[]
}

export interface SiteJudgement {
  overallJudgement: OverallJudgement
  reasons: string[]
}

export interface DiffFinding {
  id: string
  severity: FindingSeverity
  title: string
  pagePath: string
  evidence: string
  cause: string
}

export interface ConsoleChange {
  pagePath: string
  warningsAdded: string[]
  warningsRemoved: string[]
  errorsAdded: string[]
  errorsRemoved: string[]
}

export interface DiffReport {
  summary: {
    beforeJudgement: OverallJudgement
    afterJudgement: OverallJudgement
    changed: boolean
  }
  addedFindings: DiffFinding[]
  removedFindings: DiffFinding[]
  consoleChanges: ConsoleChange[]
}

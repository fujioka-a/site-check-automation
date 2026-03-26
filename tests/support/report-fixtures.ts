import type {
  ExcludedFinding,
  SiteFinding,
  SiteReport,
  UncheckedScope,
} from '../../src/shared/report-schema'

type SiteReportOverride = Partial<SiteReport>
type SiteFindingOverride = Partial<SiteFinding>
type ExcludedFindingOverride = Partial<ExcludedFinding>
type UncheckedScopeOverride = Partial<UncheckedScope>

export function createSiteReport(overrides: SiteReportOverride = {}): SiteReport {
  return {
    targetUrl: 'https://example.com/',
    domain: 'example.com',
    scannedAt: '2026-03-25',
    summary: {
      pagesVisited: 1,
      totalFindings: 0,
      overallJudgement: '問題なし',
    },
    findings: [],
    pages: [
      {
        url: 'https://example.com/',
        path: '/',
        depth: 0,
        screenshotPath: 'reports/example.com/screenshots/home.png',
        console: {
          warning: [],
          error: [],
        },
        pageErrors: [],
        failedRequests: [],
        httpErrors: [],
        notes: [],
      },
    ],
    uncheckedScopes: [],
    excludedFindings: [],
    ...overrides,
  }
}

export function createFinding(overrides: SiteFindingOverride = {}): SiteFinding {
  return {
    id: 'finding-1',
    severity: 'low',
    category: 'console-warning',
    title: 'Analytics warning',
    pagePath: '/',
    evidence: 'warning: analytics.js timeout',
    cause: 'Third-party analytics timeout',
    screenshotPath: 'reports/example.com/screenshots/home.png',
    migrationRisk: false,
    ...overrides,
  }
}

export function createUncheckedScope(overrides: UncheckedScopeOverride = {}): UncheckedScope {
  return {
    pagePath: '/news',
    reason: 'sample-limit',
    detail: 'Representative sampling capped sibling links at 10 entries.',
    ...overrides,
  }
}

export function createExcludedFinding(
  overrides: ExcludedFindingOverride = {},
): ExcludedFinding {
  return {
    id: 'excluded-finding-1',
    severity: 'low',
    category: 'failed-request',
    title: 'External font request failed',
    pagePath: '/',
    evidence: 'https://fonts.gstatic.com/s/example.woff2 (net::ERR_BLOCKED_BY_CLIENT)',
    cause: 'The page depends on a third-party font resource that is unavailable outside normal browser conditions.',
    reason: '外部ドメインのフォント取得失敗は評価対象外',
    screenshotPath: 'reports/example.com/screenshots/home.png',
    migrationRisk: false,
    ...overrides,
  }
}

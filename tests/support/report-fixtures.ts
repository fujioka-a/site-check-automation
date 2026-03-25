import type { SiteFinding, SiteReport, UncheckedScope } from '../../src/shared/report-schema'

type SiteReportOverride = Partial<SiteReport>
type SiteFindingOverride = Partial<SiteFinding>
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

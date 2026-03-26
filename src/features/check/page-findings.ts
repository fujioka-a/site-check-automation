import {
  buildFindingComparisonKey,
  type ExcludedFinding,
  type PageReport,
  type SiteFinding,
} from '../../shared/report-schema'
import { findEvaluationExclusion } from './evaluation-exclusions'

const AWS_RISK_PATTERN = /(cloudfront|s3|elasticloadbalancing|alb|api gateway|csp|cors|mixed content|accessdenied)/i
const NOISE_PATTERN = /(analytics|gtm|favicon|tag manager|beacon)/i

interface PageFindingResult {
  findings: SiteFinding[]
  excludedFindings: ExcludedFinding[]
}

interface FindingSource {
  values: (page: PageReport) => string[]
  build: (value: string, page: PageReport) => Omit<SiteFinding, 'id'>
  allowEvaluationExclusion: boolean
}

const FINDING_SOURCES: readonly FindingSource[] = [
  {
    values: (page) => page.console.error,
    build: (error, page) => ({
      severity: classifyErrorSeverity(error),
      category: 'console-error',
      title: 'Console error detected',
      pagePath: page.path,
      evidence: error,
      cause: 'A runtime error was emitted in the browser console.',
      screenshotPath: page.screenshotPath,
      migrationRisk: detectMigrationRisk(error),
    }),
    allowEvaluationExclusion: true,
  },
  {
    values: (page) => page.console.warning,
    build: (warning, page) => ({
      severity: NOISE_PATTERN.test(warning) ? 'low' : 'medium',
      category: 'console-warning',
      title: 'Console warning detected',
      pagePath: page.path,
      evidence: warning,
      cause: 'A browser warning was emitted while rendering the page.',
      screenshotPath: page.screenshotPath,
      migrationRisk: detectMigrationRisk(warning),
    }),
    allowEvaluationExclusion: false,
  },
  {
    values: (page) => page.failedRequests,
    build: (failedRequest, page) => ({
      severity: classifyRequestSeverity(failedRequest),
      category: 'failed-request',
      title: 'Failed request detected',
      pagePath: page.path,
      evidence: failedRequest,
      cause: 'A required network request failed while loading the page.',
      screenshotPath: page.screenshotPath,
      migrationRisk: detectMigrationRisk(failedRequest),
    }),
    allowEvaluationExclusion: true,
  },
  {
    values: (page) => page.pageErrors,
    build: (pageError, page) => ({
      severity: classifyErrorSeverity(pageError),
      category: 'page-error',
      title: 'Page error detected',
      pagePath: page.path,
      evidence: pageError,
      cause: 'An uncaught runtime exception was emitted by the page.',
      screenshotPath: page.screenshotPath,
      migrationRisk: detectMigrationRisk(pageError),
    }),
    allowEvaluationExclusion: false,
  },
  {
    values: (page) => page.httpErrors,
    build: (httpError, page) => ({
      severity: classifyRequestSeverity(httpError),
      category: 'http-error',
      title: 'HTTP error response detected',
      pagePath: page.path,
      evidence: httpError,
      cause: 'A network response returned an HTTP error status while loading the page.',
      screenshotPath: page.screenshotPath,
      migrationRisk: detectMigrationRisk(httpError),
    }),
    allowEvaluationExclusion: true,
  },
] as const

export function buildPageFindings(page: PageReport, siteDomain: string): PageFindingResult {
  const findings: SiteFinding[] = []
  const excludedFindings: ExcludedFinding[] = []

  for (const source of FINDING_SOURCES) {
    for (const value of source.values(page)) {
      routeFinding({
        finding: createFinding(source.build(value, page)),
        allowEvaluationExclusion: source.allowEvaluationExclusion,
        siteDomain,
        findings,
        excludedFindings,
      })
    }
  }

  return { findings, excludedFindings }
}

function routeFinding(input: {
  finding: SiteFinding
  allowEvaluationExclusion: boolean
  siteDomain: string
  findings: SiteFinding[]
  excludedFindings: ExcludedFinding[]
}): void {
  if (!input.allowEvaluationExclusion) {
    input.findings.push(input.finding)
    return
  }

  const excludedFinding = findEvaluationExclusion(input.finding, { siteDomain: input.siteDomain })
  if (excludedFinding) {
    input.excludedFindings.push(excludedFinding)
    return
  }

  input.findings.push(input.finding)
}

function createFinding(input: Omit<SiteFinding, 'id'>): SiteFinding {
  return {
    ...input,
    id: buildFindingComparisonKey(input),
  }
}

function classifyErrorSeverity(error: string): SiteFinding['severity'] {
  if (/chunk|hydrate|uncaught|syntaxerror|referenceerror|typeerror/i.test(error)) {
    return 'critical'
  }

  return 'high'
}

function classifyRequestSeverity(request: string): SiteFinding['severity'] {
  if (/\.(css|js)(\?|$)/i.test(request) || / 5\d\d\b/.test(request)) {
    return 'critical'
  }

  if (/\.(png|jpg|jpeg|gif|webp|svg|woff2?)(\?|$)/i.test(request)) {
    return 'medium'
  }

  return 'high'
}

function detectMigrationRisk(text: string): boolean {
  return AWS_RISK_PATTERN.test(text)
}

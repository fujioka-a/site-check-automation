import { mkdir } from 'node:fs/promises'
import path from 'node:path'

import {
  chromium,
  type Browser,
  type ConsoleMessage,
  type Page,
  type Request,
  type Response,
} from 'playwright'

import { buildReportPaths } from '../../shared/report-path'
import {
  buildFindingComparisonKey,
  JUDGEMENTS,
  type PageReport,
  type SiteFinding,
  type SiteReport,
  type UncheckedScope,
} from '../../shared/report-schema'
import { applyCrawlPolicy, type CrawlCandidate } from './crawl-policy'

export interface CrawlSiteInput {
  url: string
  outputDir: string
  maxPages: number
  maxDepth: number
  sampleLimit: number
  now: Date
}

interface QueueItem {
  url: string
  depth: number
  sourceUrl: string
}

const AWS_RISK_PATTERN = /(cloudfront|s3|elasticloadbalancing|alb|api gateway|csp|cors|mixed content|accessdenied)/i
const NOISE_PATTERN = /(analytics|gtm|favicon|tag manager|beacon)/i

export async function crawlSite(input: CrawlSiteInput): Promise<SiteReport> {
  const browser = await chromium.launch()

  try {
    return await crawlWithBrowser(browser, input)
  } finally {
    await browser.close()
  }
}

async function crawlWithBrowser(browser: Browser, input: CrawlSiteInput): Promise<SiteReport> {
  const targetUrl = new URL(input.url)
  const domain = targetUrl.hostname
  const date = input.now.toISOString().slice(0, 10)
  const paths = buildReportPaths({ outputDir: input.outputDir, url: input.url, date })
  const screenshotDir = path.join(path.dirname(paths.markdownPath), 'screenshots')

  await mkdir(screenshotDir, { recursive: true })

  const visitedUrls = new Set<string>()
  const findingsByKey = new Map<string, SiteFinding>()
  const pages: PageReport[] = []
  const uncheckedScopes: UncheckedScope[] = []
  const queue: QueueItem[] = [{ url: targetUrl.toString(), depth: 0, sourceUrl: targetUrl.toString() }]

  while (queue.length > 0) {
    const current = queue.shift()
    if (!current || visitedUrls.has(current.url)) {
      continue
    }

    visitedUrls.add(current.url)
    const pageResult = await inspectPage(browser, current, screenshotDir, domain)
    pages.push(pageResult.page)
    mergeFindings(findingsByKey, pageResult.findings)
    mergeUncheckedScopes(uncheckedScopes, pageResult.uncheckedScopes)

    const policy = applyCrawlPolicy({
      startUrl: targetUrl.toString(),
      visitedUrls: [...visitedUrls],
      candidates: pageResult.links,
      maxPages: input.maxPages,
      maxDepth: input.maxDepth,
      sampleLimit: input.sampleLimit,
    })
    queue.push(...policy.accepted)
    mergeUncheckedScopes(uncheckedScopes, policy.uncheckedScopes)
  }

  return {
    targetUrl: targetUrl.toString(),
    domain,
    scannedAt: input.now.toISOString(),
    summary: {
      pagesVisited: pages.length,
      totalFindings: findingsByKey.size,
      overallJudgement: findingsByKey.size > 0 ? JUDGEMENTS.review : JUDGEMENTS.ok,
    },
    findings: [...findingsByKey.values()],
    pages,
    uncheckedScopes,
  }
}

async function inspectPage(
  browser: Browser,
  item: QueueItem,
  screenshotDir: string,
  domain: string,
): Promise<{
  page: PageReport
  findings: SiteFinding[]
  links: CrawlCandidate[]
  uncheckedScopes: UncheckedScope[]
}> {
  const page = await browser.newPage()
  const warnings: string[] = []
  const errors: string[] = []
  const pageErrors: string[] = []
  const failedRequests: string[] = []
  const httpErrors: string[] = []

  page.on('console', (message) => recordConsole(message, warnings, errors))
  page.on('pageerror', (error) => pageErrors.push(describePageError(error)))
  page.on('requestfailed', (request) => failedRequests.push(describeFailedRequest(request)))
  page.on('response', (response) => {
    const httpError = describeHttpError(response)
    if (httpError) {
      httpErrors.push(httpError)
    }
  })

  try {
    await page.goto(item.url, { waitUntil: 'networkidle' })

    const screenshotPath = buildScreenshotPath(screenshotDir, item.url)
    await page.screenshot({ path: screenshotPath, fullPage: true })
    const links = await extractLinks(page, item, domain)
    const pageReport = buildPageReport(item, screenshotPath, warnings, errors, pageErrors, failedRequests, httpErrors)
    const findings = buildPageFindings(pageReport)

    return {
      page: pageReport,
      findings,
      links,
      uncheckedScopes: [],
    }
  } catch (error) {
    const screenshotPath = buildScreenshotPath(screenshotDir, item.url)
    const message = error instanceof Error ? error.message : String(error)
    const pageReport = {
      ...buildPageReport(item, screenshotPath, warnings, errors, pageErrors, failedRequests, httpErrors),
      notes: [`Navigation failed: ${message}`],
    }
    const findings = [
      createFinding({
        severity: 'critical',
        category: 'navigation-error',
        title: 'Page navigation failed',
        pagePath: pageReport.path,
        evidence: message,
        cause: 'The page could not be loaded successfully during the crawl.',
        screenshotPath,
        migrationRisk: detectMigrationRisk(message),
      }),
    ]

    return {
      page: pageReport,
      findings,
      links: [],
      uncheckedScopes: [],
    }
  } finally {
    await page.close()
  }
}

function recordConsole(message: ConsoleMessage, warnings: string[], errors: string[]): void {
  const text = message.text()
  if (message.type() === 'warning') {
    warnings.push(text)
  }
  if (message.type() === 'error') {
    errors.push(text)
  }
}

function describeFailedRequest(request: Request): string {
  const failure = request.failure()
  if (!failure) {
    return request.url()
  }

  return `${request.url()} (${failure.errorText})`
}

function describePageError(error: Error): string {
  return error.message
}

function describeHttpError(response: Response): string | null {
  if (response.status() < 400) {
    return null
  }

  return `${response.url()} (${response.status()})`
}

async function extractLinks(page: Page, item: QueueItem, domain: string): Promise<CrawlCandidate[]> {
  const hrefs = await page.locator('a[href]').evaluateAll((anchors) =>
    anchors
      .map((anchor) => anchor.getAttribute('href'))
      .filter((href): href is string => href !== null && href.trim().length > 0),
  )

  const links: CrawlCandidate[] = []
  for (const href of hrefs) {
    const resolved = new URL(href, item.url)
    if (!isNavigableLink(resolved, domain)) {
      continue
    }

    links.push({
      url: resolved.toString(),
      depth: item.depth + 1,
      sourceUrl: item.url,
    })
  }

  return links
}

function isNavigableLink(url: URL, domain: string): boolean {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return false
  }
  if (url.hostname !== domain) {
    return true
  }
  if (url.hash.length > 0) {
    url.hash = ''
  }

  return true
}

function buildPageReport(
  item: QueueItem,
  screenshotPath: string,
  warnings: string[],
  errors: string[],
  pageErrors: string[],
  failedRequests: string[],
  httpErrors: string[],
): PageReport {
  return {
    url: item.url,
    path: new URL(item.url).pathname || '/',
    depth: item.depth,
    screenshotPath,
    console: {
      warning: dedupe(warnings),
      error: dedupe(errors),
    },
    pageErrors: dedupe(pageErrors),
    failedRequests: dedupe(failedRequests),
    httpErrors: dedupe(httpErrors),
    notes: [],
  }
}

function buildPageFindings(page: PageReport): SiteFinding[] {
  const findings: SiteFinding[] = []

  for (const error of page.console.error) {
    findings.push(
      createFinding({
        severity: classifyErrorSeverity(error),
        category: 'console-error',
        title: 'Console error detected',
        pagePath: page.path,
        evidence: error,
        cause: 'A runtime error was emitted in the browser console.',
        screenshotPath: page.screenshotPath,
        migrationRisk: detectMigrationRisk(error),
      }),
    )
  }

  for (const warning of page.console.warning) {
    findings.push(
      createFinding({
        severity: NOISE_PATTERN.test(warning) ? 'low' : 'medium',
        category: 'console-warning',
        title: 'Console warning detected',
        pagePath: page.path,
        evidence: warning,
        cause: 'A browser warning was emitted while rendering the page.',
        screenshotPath: page.screenshotPath,
        migrationRisk: detectMigrationRisk(warning),
      }),
    )
  }

  for (const failedRequest of page.failedRequests) {
    findings.push(
      createFinding({
        severity: classifyRequestSeverity(failedRequest),
        category: 'failed-request',
        title: 'Failed request detected',
        pagePath: page.path,
        evidence: failedRequest,
        cause: 'A required network request failed while loading the page.',
        screenshotPath: page.screenshotPath,
        migrationRisk: detectMigrationRisk(failedRequest),
      }),
    )
  }

  for (const pageError of page.pageErrors) {
    findings.push(
      createFinding({
        severity: classifyErrorSeverity(pageError),
        category: 'page-error',
        title: 'Page error detected',
        pagePath: page.path,
        evidence: pageError,
        cause: 'An uncaught runtime exception was emitted by the page.',
        screenshotPath: page.screenshotPath,
        migrationRisk: detectMigrationRisk(pageError),
      }),
    )
  }

  for (const httpError of page.httpErrors) {
    findings.push(
      createFinding({
        severity: classifyRequestSeverity(httpError),
        category: 'http-error',
        title: 'HTTP error response detected',
        pagePath: page.path,
        evidence: httpError,
        cause: 'A network response returned an HTTP error status while loading the page.',
        screenshotPath: page.screenshotPath,
        migrationRisk: detectMigrationRisk(httpError),
      }),
    )
  }

  return findings
}

function createFinding(
  input: Omit<SiteFinding, 'id'>,
): SiteFinding {
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

function buildScreenshotPath(screenshotDir: string, pageUrl: string): string {
  const pathname = new URL(pageUrl).pathname || '/'
  const slug = pathname === '/' ? 'home' : pathname.replaceAll('/', '_').replace(/^_+/, '')

  return path.join(screenshotDir, `${slug}.png`)
}

function mergeFindings(target: Map<string, SiteFinding>, findings: SiteFinding[]): void {
  for (const finding of findings) {
    target.set(buildFindingComparisonKey(finding), finding)
  }
}

function mergeUncheckedScopes(target: UncheckedScope[], scopes: UncheckedScope[]): void {
  for (const scope of scopes) {
    const exists = target.some(
      (current) =>
        current.pagePath === scope.pagePath &&
        current.reason === scope.reason &&
        current.detail === scope.detail,
    )
    if (!exists) {
      target.push(scope)
    }
  }
}

function dedupe(values: string[]): string[] {
  return [...new Set(values)]
}

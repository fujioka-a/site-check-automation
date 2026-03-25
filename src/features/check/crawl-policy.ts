import type { UncheckedScope } from '../../shared/report-schema'

export interface CrawlCandidate {
  url: string
  depth: number
  sourceUrl: string
}

interface SkippedCandidate {
  url: string
  reason: string
  sourceUrl: string
}

export interface ApplyCrawlPolicyInput {
  startUrl: string
  visitedUrls: string[]
  candidates: CrawlCandidate[]
  maxPages: number
  maxDepth: number
  sampleLimit: number
}

export interface CrawlPolicyResult {
  accepted: CrawlCandidate[]
  skipped: SkippedCandidate[]
  uncheckedScopes: UncheckedScope[]
}

export function applyCrawlPolicy(input: ApplyCrawlPolicyInput): CrawlPolicyResult {
  const accepted: CrawlCandidate[] = []
  const skipped: SkippedCandidate[] = []
  const uncheckedScopes: UncheckedScope[] = []
  const startDomain = new URL(input.startUrl).hostname
  const queuedBySource = new Map<string, number>()

  for (const candidate of input.candidates) {
    if (input.visitedUrls.length + accepted.length >= input.maxPages) {
      skipped.push(createSkipped(candidate, 'page-limit'))
      pushUniqueUncheckedScope(
        uncheckedScopes,
        buildPageLimitScope(candidate.sourceUrl, input.maxPages),
      )
      continue
    }

    if (new URL(candidate.url).hostname !== startDomain) {
      skipped.push(createSkipped(candidate, 'cross-domain'))
      continue
    }

    if (candidate.depth > input.maxDepth) {
      skipped.push(createSkipped(candidate, 'depth-limit'))
      pushUniqueUncheckedScope(
        uncheckedScopes,
        buildDepthLimitScope(candidate.url, candidate.sourceUrl, input.maxDepth),
      )
      continue
    }

    const nextCount = (queuedBySource.get(candidate.sourceUrl) ?? 0) + 1
    queuedBySource.set(candidate.sourceUrl, nextCount)

    if (nextCount > input.sampleLimit) {
      skipped.push(createSkipped(candidate, 'sample-limit'))
      pushUniqueUncheckedScope(
        uncheckedScopes,
        buildSampleLimitScope(candidate.sourceUrl, input.sampleLimit),
      )
      continue
    }

    accepted.push(candidate)
  }

  return {
    accepted,
    skipped,
    uncheckedScopes,
  }
}

function createSkipped(candidate: CrawlCandidate, reason: string): SkippedCandidate {
  return {
    url: candidate.url,
    reason,
    sourceUrl: candidate.sourceUrl,
  }
}

function buildDepthLimitScope(url: string, sourceUrl: string, maxDepth: number): UncheckedScope {
  return {
    pagePath: new URL(url).pathname,
    reason: 'depth-limit',
    detail: `Maximum crawl depth ${maxDepth} exceeded from ${sourceUrl}.`,
  }
}

function buildSampleLimitScope(sourceUrl: string, sampleLimit: number): UncheckedScope {
  return {
    pagePath: new URL(sourceUrl).pathname,
    reason: 'sample-limit',
    detail: `Representative sampling capped sibling links at ${sampleLimit} entries.`,
  }
}

function buildPageLimitScope(sourceUrl: string, maxPages: number): UncheckedScope {
  return {
    pagePath: new URL(sourceUrl).pathname,
    reason: 'page-limit',
    detail: `Maximum crawl page limit ${maxPages} reached before visiting queued links.`,
  }
}

function pushUniqueUncheckedScope(scopes: UncheckedScope[], scope: UncheckedScope): void {
  const exists = scopes.some(
    (current) =>
      current.pagePath === scope.pagePath &&
      current.reason === scope.reason &&
      current.detail === scope.detail,
  )

  if (!exists) {
    scopes.push(scope)
  }
}

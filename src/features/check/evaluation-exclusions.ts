import { getDomain } from 'tldts'

import type { ExcludedFinding, SiteFinding } from '../../shared/report-schema'

interface ExclusionContext {
  siteDomain: string
}

interface ExclusionRule {
  categories: readonly SiteFinding['category'][] | 'any'
  matches: (finding: SiteFinding, context: ExclusionContext) => boolean
  reason: string
  cause: string
  title: string
}

const THIRD_PARTY_ASSET_EXTENSIONS = new Set([
  '.avif',
  '.bmp',
  '.css',
  '.eot',
  '.gif',
  '.ico',
  '.jpeg',
  '.jpg',
  '.mp3',
  '.mp4',
  '.ogg',
  '.otf',
  '.png',
  '.svg',
  '.ttf',
  '.wav',
  '.webm',
  '.webp',
  '.woff',
  '.woff2',
])
const SOCIAL_PROVIDER_PATTERN = /(facebook|instagram|twitter|line|linkedin|tiktok|youtube|\bx\b)/i
const AUTHENTICATION_PATTERN =
  /(not logged in|login status|login required|login_required|requires authentication|sign(?:ed)? in|sign-?in required|unauthori[sz]ed|forbidden|access token|oauth)/i
const STATUS_AUTH_PATTERN = /\((401|403)\)\s*$/i
const THIRD_PARTY_WIDGET_SIGNATURE_PATTERN =
  /(facebook sdk|instagram embed|twitter widgets|youtube embed|line add friend|linkedin insight|tiktok embed|connect\.facebook\.net|platform\.twitter\.com|staticxx\.facebook\.com|instagram\.com\/embed|youtube\.com\/embed|youtube-nocookie\.com\/embed|line\.me|snapkit|tiktok\.com\/embed|linkedin\.com\/embed)/i
const THIRD_PARTY_ASSET_EXCLUSION = {
  matches: isThirdPartyAssetFetchNoise,
  reason: '外部ドメインのコンテンツアセット取得失敗は評価対象外',
  cause:
    'The page references a third-party asset that can fail under crawler-only conditions without indicating a visible site defect.',
  title: 'Third-party content asset request failed',
} as const
const EXCLUSION_RULES: readonly ExclusionRule[] = [
  {
    categories: ['failed-request', 'http-error'],
    ...THIRD_PARTY_ASSET_EXCLUSION,
  },
  {
    categories: 'any',
    matches: isUnauthenticatedWidgetNoise,
    reason: '未ログイン状態の外部ウィジェットエラーは評価対象外',
    cause: 'An embedded third-party widget attempted to resolve an authenticated viewer state that is unavailable during the crawl.',
    title: 'Third-party widget authentication state error',
  },
] as const

export function findEvaluationExclusion(
  finding: SiteFinding,
  context: ExclusionContext,
): ExcludedFinding | null {
  if (finding.migrationRisk === true) {
    return null
  }

  for (const rule of EXCLUSION_RULES) {
    if (rule.categories !== 'any' && !rule.categories.includes(finding.category)) {
      continue
    }
    if (!rule.matches(finding, context)) {
      continue
    }

    return {
      ...finding,
      title: rule.title,
      cause: rule.cause,
      reason: rule.reason,
    }
  }

  return null
}

function isThirdPartyAssetFetchNoise(finding: SiteFinding, context: ExclusionContext): boolean {
  const resourceUrl = parseEvidenceUrl(finding.evidence)
  if (!resourceUrl) {
    return false
  }
  if (!isThirdPartyHost(resourceUrl, context.siteDomain)) {
    return false
  }

  return THIRD_PARTY_ASSET_EXTENSIONS.has(pathExtension(resourceUrl.pathname))
}

function isUnauthenticatedWidgetNoise(
  finding: SiteFinding,
  context: ExclusionContext,
): boolean {
  const evidence = finding.evidence
  if (!SOCIAL_PROVIDER_PATTERN.test(evidence)) {
    return false
  }
  if (!AUTHENTICATION_PATTERN.test(evidence) && !STATUS_AUTH_PATTERN.test(evidence)) {
    return false
  }

  if (finding.category === 'failed-request' || finding.category === 'http-error') {
    const resourceUrl = parseEvidenceUrl(evidence)
    if (!resourceUrl) {
      return false
    }

    return isThirdPartyHost(resourceUrl, context.siteDomain)
  }

  return THIRD_PARTY_WIDGET_SIGNATURE_PATTERN.test(evidence)
}

function parseEvidenceUrl(evidence: string): URL | null {
  const match = evidence.match(/https?:\/\/\S+/)
  if (!match) {
    return null
  }
  const normalizedUrl = match[0].replace(/[),.;]+$/, '')
  if (!URL.canParse(normalizedUrl)) {
    return null
  }

  return new URL(normalizedUrl)
}

function isThirdPartyHost(resourceUrl: URL, siteDomain: string): boolean {
  return !isSameSiteHost(resourceUrl.hostname, siteDomain)
}

function isSameSiteHost(resourceHostname: string, siteDomain: string): boolean {
  const normalizedResourceHostname = resourceHostname.toLowerCase()
  const normalizedSiteDomain = siteDomain.toLowerCase()
  const resourceDomain = getDomain(normalizedResourceHostname)
  const targetDomain = getDomain(normalizedSiteDomain)

  if (!resourceDomain || !targetDomain) {
    return normalizedResourceHostname === normalizedSiteDomain
  }

  return resourceDomain === targetDomain
}

function pathExtension(pathname: string): string {
  const lastDotIndex = pathname.lastIndexOf('.')
  if (lastDotIndex === -1) {
    return ''
  }

  return pathname.slice(lastDotIndex).toLowerCase()
}

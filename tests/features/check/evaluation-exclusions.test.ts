import { describe, expect, it } from 'vitest'

import { findEvaluationExclusion } from '../../../src/features/check/evaluation-exclusions'
import { createFinding } from '../../support/report-fixtures'

describe('findEvaluationExclusion', () => {
  it('excludes third-party content assets across representative asset types', () => {
    const stylesheetFinding = createFinding({
      category: 'failed-request',
      severity: 'critical',
      title: 'Failed request detected',
      evidence: 'https://cdn.example.net/assets/site.css (net::ERR_ABORTED)',
      cause: 'A required network request failed while loading the page.',
    })
    const imageFinding = createFinding({
      category: 'http-error',
      severity: 'medium',
      title: 'HTTP error response detected',
      evidence: 'https://images.example.net/banners/hero.webp (403)',
      cause: 'A network response returned an HTTP error status while loading the page.',
    })

    const stylesheetExclusion = findEvaluationExclusion(stylesheetFinding, { siteDomain: 'example.com' })
    const imageExclusion = findEvaluationExclusion(imageFinding, { siteDomain: 'example.com' })

    expect(stylesheetExclusion).toEqual(
      expect.objectContaining({
        title: 'Third-party content asset request failed',
        reason: '外部ドメインのコンテンツアセット取得失敗は評価対象外',
      }),
    )
    expect(imageExclusion).toEqual(
      expect.objectContaining({
        title: 'Third-party content asset request failed',
        reason: '外部ドメインのコンテンツアセット取得失敗は評価対象外',
      }),
    )
    expect(stylesheetExclusion?.title).toBe(imageExclusion?.title)
    expect(stylesheetExclusion?.reason).toBe(imageExclusion?.reason)
    expect(stylesheetExclusion?.cause).toBe(imageExclusion?.cause)
  })

  it('excludes unauthenticated third-party widget errors across message variants', () => {
    const facebookFinding = createFinding({
      category: 'console-error',
      severity: 'high',
      title: 'Console error detected',
      evidence: 'Facebook SDK login status check failed: user is not logged in',
      cause: 'A runtime error was emitted in the browser console.',
    })
    const instagramFinding = createFinding({
      category: 'console-error',
      severity: 'high',
      title: 'Console error detected',
      evidence: 'Instagram embed login_required: access token missing',
      cause: 'A runtime error was emitted in the browser console.',
    })

    expect(findEvaluationExclusion(facebookFinding, { siteDomain: 'example.com' })).toEqual(
      expect.objectContaining({
        title: 'Third-party widget authentication state error',
        reason: '未ログイン状態の外部ウィジェットエラーは評価対象外',
      }),
    )
    expect(findEvaluationExclusion(instagramFinding, { siteDomain: 'example.com' })).toEqual(
      expect.objectContaining({
        title: 'Third-party widget authentication state error',
        reason: '未ログイン状態の外部ウィジェットエラーは評価対象外',
      }),
    )
  })

  it('does not exclude same-site, same-domain, or migration-risk failures', () => {
    const sameDomainFinding = createFinding({
      category: 'failed-request',
      severity: 'critical',
      title: 'Failed request detected',
      evidence: 'https://example.com/assets/app.css (net::ERR_ABORTED)',
      cause: 'A required network request failed while loading the page.',
    })
    const migrationRiskFinding = createFinding({
      category: 'failed-request',
      severity: 'high',
      title: 'Failed request detected',
      evidence: 'https://cdn.example.net/fonts/app.woff2 (CORS blocked by CloudFront)',
      cause: 'A required network request failed while loading the page.',
      migrationRisk: true,
    })
    const sameDomainWidgetFinding = createFinding({
      category: 'http-error',
      severity: 'high',
      title: 'HTTP error response detected',
      evidence: 'https://example.com/api/youtube/oauth (403)',
      cause: 'A network response returned an HTTP error status while loading the page.',
    })
    const sameSiteSubdomainFinding = createFinding({
      category: 'failed-request',
      severity: 'critical',
      title: 'Failed request detected',
      evidence: 'https://cdn.example.com/assets/app.css (net::ERR_ABORTED)',
      cause: 'A required network request failed while loading the page.',
    })

    expect(findEvaluationExclusion(sameDomainFinding, { siteDomain: 'example.com' })).toBeNull()
    expect(findEvaluationExclusion(migrationRiskFinding, { siteDomain: 'example.com' })).toBeNull()
    expect(findEvaluationExclusion(sameDomainWidgetFinding, { siteDomain: 'example.com' })).toBeNull()
    expect(findEvaluationExclusion(sameSiteSubdomainFinding, { siteDomain: 'www.example.com' })).toBeNull()
  })

  it('keeps multi-label public suffix domains distinct when classifying third-party assets', () => {
    const thirdPartyAssetFinding = createFinding({
      category: 'failed-request',
      severity: 'critical',
      title: 'Failed request detected',
      evidence: 'https://tracker.other.co.za/assets/app.css (net::ERR_ABORTED)',
      cause: 'A required network request failed while loading the page.',
    })
    const sameSiteSubdomainFinding = createFinding({
      category: 'failed-request',
      severity: 'critical',
      title: 'Failed request detected',
      evidence: 'https://cdn.example.co.za/assets/app.css (net::ERR_ABORTED)',
      cause: 'A required network request failed while loading the page.',
    })

    expect(findEvaluationExclusion(thirdPartyAssetFinding, { siteDomain: 'shop.example.co.za' })).toEqual(
      expect.objectContaining({
        title: 'Third-party content asset request failed',
        reason: '外部ドメインのコンテンツアセット取得失敗は評価対象外',
      }),
    )
    expect(findEvaluationExclusion(sameSiteSubdomainFinding, { siteDomain: 'shop.example.co.za' })).toBeNull()
  })
})

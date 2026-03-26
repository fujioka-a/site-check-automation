import { describe, expect, it } from 'vitest'

import { buildPageFindings } from '../../../src/features/check/page-findings'
import { createSiteReport } from '../../support/report-fixtures'

describe('buildPageFindings', () => {
  it('routes excludable and reportable diagnostics into separate collections', () => {
    const page = {
      ...createSiteReport().pages[0],
      console: {
        warning: ['analytics.js timeout'],
        error: ['Facebook SDK login status check failed: user is not logged in'],
      },
      failedRequests: ['https://fonts.gstatic.com/s/inter/v1/font.woff2 (net::ERR_ABORTED)'],
      pageErrors: ['ReferenceError: app is not defined'],
      httpErrors: ['https://example.com/api/articles (500)'],
    }

    const result = buildPageFindings(page, 'example.com')

    expect(result.excludedFindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'console-error',
          evidence: 'Facebook SDK login status check failed: user is not logged in',
        }),
        expect.objectContaining({
          category: 'failed-request',
          evidence: 'https://fonts.gstatic.com/s/inter/v1/font.woff2 (net::ERR_ABORTED)',
        }),
      ]),
    )
    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'console-warning',
          evidence: 'analytics.js timeout',
        }),
        expect.objectContaining({
          category: 'page-error',
          evidence: 'ReferenceError: app is not defined',
        }),
        expect.objectContaining({
          category: 'http-error',
          evidence: 'https://example.com/api/articles (500)',
        }),
      ]),
    )
  })
})

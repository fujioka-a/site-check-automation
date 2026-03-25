import { describe, expect, it } from 'vitest'

import { buildReportPaths } from '../../src/shared/report-path'

describe('buildReportPaths', () => {
  it('builds markdown and json paths under a per-domain directory', () => {
    const paths = buildReportPaths({
      outputDir: 'reports',
      url: 'https://example.com/news?id=1',
      date: '2026-03-25',
    })

    expect(paths).toEqual({
      domainDirectory: 'reports/example.com',
      markdownPath: 'reports/example.com/result_example_com_2026-03-25.md',
      jsonPath: 'reports/example.com/result_example_com_2026-03-25.json',
    })
  })

  it('preserves subdomains in the directory name and normalizes them in file names', () => {
    const paths = buildReportPaths({
      outputDir: 'reports',
      url: 'https://type-a.example.com/',
      date: '2026-03-25',
    })

    expect(paths).toEqual({
      domainDirectory: 'reports/type-a.example.com',
      markdownPath: 'reports/type-a.example.com/result_type-a_example_com_2026-03-25.md',
      jsonPath: 'reports/type-a.example.com/result_type-a_example_com_2026-03-25.json',
    })
  })
})

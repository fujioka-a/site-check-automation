import { describe, expect, it } from 'vitest'

import { renderDiffMarkdown } from '../../../src/features/diff/render-markdown'

describe('renderDiffMarkdown', () => {
  it('renders judgement changes, added findings, removed findings, and console deltas', () => {
    const markdown = renderDiffMarkdown({
      summary: {
        beforeJudgement: '問題なし',
        afterJudgement: '問題あり',
        changed: true,
      },
      addedFindings: [
        {
          id: 'critical-1',
          severity: 'critical',
          title: 'Main visual collapsed',
          pagePath: '/',
          evidence: 'main.css returned 404.',
          cause: 'Asset path mismatch after deploy',
        },
      ],
      removedFindings: [
        {
          id: 'low-1',
          severity: 'low',
          title: 'Old analytics warning',
          pagePath: '/',
          evidence: 'analytics warning',
          cause: 'Third-party analytics timeout',
        },
      ],
      consoleChanges: [
        {
          pagePath: '/',
          warningsAdded: [],
          warningsRemoved: ['analytics warning'],
          errorsAdded: ['Uncaught TypeError: app bootstrap failed'],
          errorsRemoved: [],
        },
      ],
    })

    expect(markdown).toContain('# Site Check Diff Report')
    expect(markdown).toContain('Before: 問題なし')
    expect(markdown).toContain('After: 問題あり')
    expect(markdown).toContain('## Added Findings')
    expect(markdown).toContain('Main visual collapsed')
    expect(markdown).toContain('## Removed Findings')
    expect(markdown).toContain('Old analytics warning')
    expect(markdown).toContain('## Console Differences')
    expect(markdown).toContain('Uncaught TypeError: app bootstrap failed')
  })
})

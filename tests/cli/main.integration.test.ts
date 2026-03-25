import { describe, expect, it, vi } from 'vitest'

import { runCli } from '../../src/cli/main'

describe('runCli', () => {
  it('routes check arguments to the check command with typed numeric options', async () => {
    const runCheckCommand = vi.fn().mockResolvedValue(undefined)
    const runDiffCommand = vi.fn().mockResolvedValue(undefined)

    await runCli(
      [
        'check',
        '--url',
        'https://example.com/',
        '--output',
        'reports',
        '--max-pages',
        '50',
        '--max-depth',
        '3',
        '--sample-limit',
        '8',
      ],
      { runCheckCommand, runDiffCommand },
    )

    expect(runCheckCommand).toHaveBeenCalledWith({
      url: 'https://example.com/',
      outputDir: 'reports',
      maxPages: 50,
      maxDepth: 3,
      sampleLimit: 8,
    })
    expect(runDiffCommand).not.toHaveBeenCalled()
  })

  it('routes diff arguments to the diff command without leaking them into check inputs', async () => {
    const runCheckCommand = vi.fn().mockResolvedValue(undefined)
    const runDiffCommand = vi.fn().mockResolvedValue(undefined)

    await runCli(
      [
        'diff',
        '--before',
        'reports/example.com/result_example_com_2026-03-24.json',
        '--after',
        'reports/example.com/result_example_com_2026-03-25.json',
        '--output',
        'reports/example.com/diff_2026-03-25.md',
      ],
      { runCheckCommand, runDiffCommand },
    )

    expect(runDiffCommand).toHaveBeenCalledWith({
      before: 'reports/example.com/result_example_com_2026-03-24.json',
      after: 'reports/example.com/result_example_com_2026-03-25.json',
      outputPath: 'reports/example.com/diff_2026-03-25.md',
    })
    expect(runCheckCommand).not.toHaveBeenCalled()
  })

  it('fails fast when a numeric check option cannot be parsed', async () => {
    const runCheckCommand = vi.fn().mockResolvedValue(undefined)
    const runDiffCommand = vi.fn().mockResolvedValue(undefined)

    await expect(
      runCli(
        [
          'check',
          '--url',
          'https://example.com/',
          '--output',
          'reports',
          '--max-pages',
          'not-a-number',
          '--max-depth',
          '3',
          '--sample-limit',
          '8',
        ],
        { runCheckCommand, runDiffCommand },
      ),
    ).rejects.toThrow('Invalid value for --max-pages: not-a-number')

    expect(runCheckCommand).not.toHaveBeenCalled()
    expect(runDiffCommand).not.toHaveBeenCalled()
  })

  it('fails fast when --max-pages is outside the supported range', async () => {
    const runCheckCommand = vi.fn().mockResolvedValue(undefined)
    const runDiffCommand = vi.fn().mockResolvedValue(undefined)

    await expect(
      runCli(
        [
          'check',
          '--url',
          'https://example.com/',
          '--output',
          'reports',
          '--max-pages',
          '101',
          '--max-depth',
          '3',
          '--sample-limit',
          '8',
        ],
        { runCheckCommand, runDiffCommand },
      ),
    ).rejects.toThrow('Invalid value for --max-pages: 101. Expected 1-100.')

    expect(runCheckCommand).not.toHaveBeenCalled()
    expect(runDiffCommand).not.toHaveBeenCalled()
  })

  it('fails fast when --max-depth is outside the supported range', async () => {
    const runCheckCommand = vi.fn().mockResolvedValue(undefined)
    const runDiffCommand = vi.fn().mockResolvedValue(undefined)

    await expect(
      runCli(
        [
          'check',
          '--url',
          'https://example.com/',
          '--output',
          'reports',
          '--max-pages',
          '100',
          '--max-depth',
          '0',
          '--sample-limit',
          '8',
        ],
        { runCheckCommand, runDiffCommand },
      ),
    ).rejects.toThrow('Invalid value for --max-depth: 0. Expected 1-4.')

    expect(runCheckCommand).not.toHaveBeenCalled()
    expect(runDiffCommand).not.toHaveBeenCalled()
  })
})

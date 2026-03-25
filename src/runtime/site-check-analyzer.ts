import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { runCli } from '../cli/main'
import { runCheckCommand } from '../features/check/command'
import { crawlSite } from '../features/check/playwright-crawler'
import { renderCheckMarkdown } from '../features/check/render-markdown'
import { runDiffCommand } from '../features/diff/command'
import { compareReports } from '../features/diff/compare-report'
import { renderDiffMarkdown } from '../features/diff/render-markdown'

export async function runSiteCheckAnalyzer(args: string[]): Promise<void> {
  await runCli(args, {
    runCheckCommand: async (input) => {
      const now = new Date()
      await runCheckCommand(input, {
        crawlSite: (crawlInput) =>
          crawlSite({
            ...crawlInput,
            outputDir: input.outputDir,
            now,
          }),
        renderCheckMarkdown,
        writeArtifact,
        now: () => now,
      })
    },
    runDiffCommand: async (input) => {
      await runDiffCommand(input, {
        readArtifact: (artifactPath) => readFile(artifactPath, 'utf8'),
        compareReports,
        renderDiffMarkdown,
        writeArtifact,
      })
    },
  })
}

async function writeArtifact(input: {
  format?: 'markdown' | 'json'
  path: string
  contents: string
}): Promise<void> {
  await mkdir(path.dirname(input.path), { recursive: true })
  await writeFile(input.path, input.contents, 'utf8')
}

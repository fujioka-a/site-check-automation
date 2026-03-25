import { buildReportPaths } from '../../shared/report-path'
import type { SiteReport } from '../../shared/report-schema'
import { judgeSiteResult } from './judge'

export interface RunCheckCommandInput {
  url: string
  outputDir: string
  maxPages: number
  maxDepth: number
  sampleLimit: number
}

interface WriteArtifactInput {
  format: 'markdown' | 'json'
  path: string
  contents: string
}

export interface CheckCommandDependencies {
  crawlSite: (input: {
    url: string
    maxPages: number
    maxDepth: number
    sampleLimit: number
  }) => Promise<SiteReport>
  renderCheckMarkdown: (report: SiteReport) => string
  writeArtifact: (input: WriteArtifactInput) => Promise<void>
  now: () => Date
}

export async function runCheckCommand(
  input: RunCheckCommandInput,
  dependencies: CheckCommandDependencies,
): Promise<void> {
  const crawledReport = await dependencies.crawlSite({
    url: input.url,
    maxPages: input.maxPages,
    maxDepth: input.maxDepth,
    sampleLimit: input.sampleLimit,
  })
  const judgement = judgeSiteResult(crawledReport)
  const report: SiteReport = {
    ...crawledReport,
    summary: {
      ...crawledReport.summary,
      totalFindings: crawledReport.findings.length,
      overallJudgement: judgement.overallJudgement,
    },
  }
  const date = dependencies.now().toISOString().slice(0, 10)
  const paths = buildReportPaths({
    outputDir: input.outputDir,
    url: input.url,
    date,
  })
  const markdown = dependencies.renderCheckMarkdown(report)

  await dependencies.writeArtifact({
    format: 'markdown',
    path: paths.markdownPath,
    contents: markdown,
  })
  await dependencies.writeArtifact({
    format: 'json',
    path: paths.jsonPath,
    contents: JSON.stringify(report, null, 2),
  })
}

import type { DiffReport, SiteReport } from '../../shared/report-schema'

export interface RunDiffCommandInput {
  before: string
  after: string
  outputPath: string
}

interface WriteArtifactInput {
  format: 'markdown'
  path: string
  contents: string
}

export interface DiffCommandDependencies {
  readArtifact: (path: string) => Promise<string>
  compareReports: (beforeReport: SiteReport, afterReport: SiteReport) => DiffReport
  renderDiffMarkdown: (report: DiffReport) => string
  writeArtifact: (input: WriteArtifactInput) => Promise<void>
}

export async function runDiffCommand(
  input: RunDiffCommandInput,
  dependencies: DiffCommandDependencies,
): Promise<void> {
  const beforeReport = await readReport(input.before, dependencies.readArtifact)
  const afterReport = await readReport(input.after, dependencies.readArtifact)
  const diffReport = dependencies.compareReports(beforeReport, afterReport)
  const markdown = dependencies.renderDiffMarkdown(diffReport)

  await dependencies.writeArtifact({
    format: 'markdown',
    path: input.outputPath,
    contents: markdown,
  })
}

async function readReport(
  path: string,
  readArtifact: (path: string) => Promise<string>,
): Promise<SiteReport> {
  const rawReport = await readArtifact(path)

  try {
    return JSON.parse(rawReport) as SiteReport
  } catch {
    throw new Error(`Failed to parse diff input: ${path}`)
  }
}

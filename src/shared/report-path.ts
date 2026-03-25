const RESULT_FILE_PREFIX = 'result'

export interface BuildReportPathsInput {
  outputDir: string
  url: string
  date: string
}

export interface ReportPaths {
  domainDirectory: string
  markdownPath: string
  jsonPath: string
}

export function buildReportPaths(input: BuildReportPathsInput): ReportPaths {
  const parsedUrl = new URL(input.url)
  const domain = parsedUrl.hostname
  const normalizedDomain = domain.replaceAll('.', '_')
  const domainDirectory = `${input.outputDir}/${domain}`
  const baseFileName = `${RESULT_FILE_PREFIX}_${normalizedDomain}_${input.date}`

  return {
    domainDirectory,
    markdownPath: `${domainDirectory}/${baseFileName}.md`,
    jsonPath: `${domainDirectory}/${baseFileName}.json`,
  }
}

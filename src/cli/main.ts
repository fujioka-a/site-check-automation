import type { RunCheckCommandInput } from '../features/check/command'
import type { RunDiffCommandInput } from '../features/diff/command'

const COMMANDS = {
  check: 'check',
  diff: 'diff',
} as const

const CHECK_OPTIONS = {
  url: '--url',
  output: '--output',
  maxPages: '--max-pages',
  maxDepth: '--max-depth',
  sampleLimit: '--sample-limit',
} as const

const DIFF_OPTIONS = {
  before: '--before',
  after: '--after',
  output: '--output',
} as const

const CHECK_LIMITS = {
  maxPages: { min: 1, max: 100 },
  maxDepth: { min: 1, max: 4 },
} as const

export interface CliDependencies {
  runCheckCommand: (input: RunCheckCommandInput) => Promise<void>
  runDiffCommand: (input: RunDiffCommandInput) => Promise<void>
}

export async function runCli(args: string[], dependencies: CliDependencies): Promise<void> {
  const [command, ...restArgs] = args

  if (command === COMMANDS.check) {
    await dependencies.runCheckCommand(parseCheckCommand(restArgs))
    return
  }

  if (command === COMMANDS.diff) {
    await dependencies.runDiffCommand(parseDiffCommand(restArgs))
    return
  }

  throw new Error(`Unknown command: ${String(command)}`)
}

function parseCheckCommand(args: string[]): RunCheckCommandInput {
  const options = parseOptionMap(args)

  return {
    url: getRequiredOption(options, CHECK_OPTIONS.url),
    outputDir: getRequiredOption(options, CHECK_OPTIONS.output),
    maxPages: parseRangedIntegerOption(
      getRequiredOption(options, CHECK_OPTIONS.maxPages),
      CHECK_OPTIONS.maxPages,
      CHECK_LIMITS.maxPages.min,
      CHECK_LIMITS.maxPages.max,
    ),
    maxDepth: parseRangedIntegerOption(
      getRequiredOption(options, CHECK_OPTIONS.maxDepth),
      CHECK_OPTIONS.maxDepth,
      CHECK_LIMITS.maxDepth.min,
      CHECK_LIMITS.maxDepth.max,
    ),
    sampleLimit: parseIntegerOption(
      getRequiredOption(options, CHECK_OPTIONS.sampleLimit),
      CHECK_OPTIONS.sampleLimit,
    ),
  }
}

function parseDiffCommand(args: string[]): RunDiffCommandInput {
  const options = parseOptionMap(args)

  return {
    before: getRequiredOption(options, DIFF_OPTIONS.before),
    after: getRequiredOption(options, DIFF_OPTIONS.after),
    outputPath: getRequiredOption(options, DIFF_OPTIONS.output),
  }
}

function parseOptionMap(args: string[]): Map<string, string> {
  if (args.length % 2 !== 0) {
    throw new Error('Arguments must be passed as option-value pairs')
  }

  const options = new Map<string, string>()

  for (let index = 0; index < args.length; index += 2) {
    options.set(args[index], args[index + 1])
  }

  return options
}

function getRequiredOption(options: Map<string, string>, optionName: string): string {
  const value = options.get(optionName)
  if (!value) {
    throw new Error(`Missing required option: ${optionName}`)
  }

  return value
}

function parseIntegerOption(rawValue: string, optionName: string): number {
  const parsedValue = Number.parseInt(rawValue, 10)
  if (Number.isNaN(parsedValue)) {
    throw new Error(`Invalid value for ${optionName}: ${rawValue}`)
  }

  return parsedValue
}

function parseRangedIntegerOption(
  rawValue: string,
  optionName: string,
  minimum: number,
  maximum: number,
): number {
  const parsedValue = parseIntegerOption(rawValue, optionName)
  if (parsedValue < minimum || parsedValue > maximum) {
    throw new Error(`Invalid value for ${optionName}: ${rawValue}. Expected ${minimum}-${maximum}.`)
  }

  return parsedValue
}

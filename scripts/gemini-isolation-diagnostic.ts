import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { GoogleGenAI } from '@google/genai';
import nextEnv from '@next/env';

import {
  geminiImageInput,
  geminiJsonResponseFormat,
  geminiRequestOptions,
  safeGeminiErrorDetails,
} from '../src/lib/ai/gemini/adapter';
import { getGeminiRuntimeConfiguration } from '../src/lib/ai/server-config';

type IsolationCase = 'multimodal' | 'structured' | 'combined';

interface IsolationInteraction {
  status?: unknown;
  output_text?: unknown;
  model?: unknown;
  sdkHttpResponse?: { responseInternal?: { status?: unknown } };
}

const workspaceRoot = process.cwd();
const referenceImagePath = resolve(workspaceRoot, 'public/reference/masdr-bucket-hat-reference.png');

function isolationCase(): IsolationCase | null {
  const value = process.argv.find((argument) => argument.startsWith('--case='))?.slice('--case='.length);
  return value === 'multimodal' || value === 'structured' || value === 'combined' ? value : null;
}

function safeStatus(value: unknown): string | null {
  return typeof value === 'string' && /^[A-Za-z0-9_.:+/-]{1,100}$/.test(value) ? value : null;
}

function safeHttpStatus(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 100 && value <= 599
    ? value
    : null;
}

function expectedOutput(testCase: IsolationCase, outputText: unknown): {
  jsonParse: 'success' | 'failure' | 'not_attempted';
  outputMatchesExpectation: boolean;
} {
  if (typeof outputText !== 'string' || outputText.trim().length === 0) {
    return { jsonParse: 'not_attempted', outputMatchesExpectation: false };
  }
  if (testCase === 'multimodal') {
    return { jsonParse: 'not_attempted', outputMatchesExpectation: outputText.trim() === 'OK' };
  }
  try {
    const parsed = JSON.parse(outputText) as unknown;
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return { jsonParse: 'success', outputMatchesExpectation: false };
    }
    if (testCase === 'structured') {
      return {
        jsonParse: 'success',
        outputMatchesExpectation: (parsed as { ok?: unknown }).ok === true,
      };
    }
    return {
      jsonParse: 'success',
      outputMatchesExpectation: typeof (parsed as { product_type?: unknown }).product_type === 'string'
        && (parsed as { product_type: string }).product_type.trim().length > 0,
    };
  } catch {
    return { jsonParse: 'failure', outputMatchesExpectation: false };
  }
}

async function main(): Promise<void> {
  const startedAt = Date.now();
  const testCase = isolationCase();
  if (testCase === null) {
    process.stdout.write(`${JSON.stringify({ error: 'invalid_case', providerCallCount: 0 })}\n`);
    return;
  }

  const { loadEnvConfig } = nextEnv;
  const silentLogger = { error: () => undefined, info: () => undefined, warn: () => undefined };
  loadEnvConfig(workspaceRoot, true, silentLogger);
  let configuration: ReturnType<typeof getGeminiRuntimeConfiguration>;
  try {
    configuration = getGeminiRuntimeConfiguration();
  } catch {
    process.stdout.write(`${JSON.stringify({
      case: testCase,
      provider: 'gemini',
      providerCallCount: 0,
      safeErrorCategory: 'configuration_error',
      durationMs: Date.now() - startedAt,
    })}\n`);
    return;
  }

  const imageBytes = testCase === 'structured'
    ? null
    : new Uint8Array(await readFile(referenceImagePath));
  const input = testCase === 'structured'
    ? 'Return a JSON object with ok set to true.'
    : [
        {
          type: 'text' as const,
          text: testCase === 'multimodal'
            ? 'Reply with exactly: OK if you can see this image.'
            : 'Return the visible product type in the required JSON object.',
        },
        geminiImageInput(imageBytes as Uint8Array, 'image/png'),
      ];
  const responseFormat = testCase === 'multimodal'
    ? undefined
    : testCase === 'structured'
      ? geminiJsonResponseFormat({
          type: 'object',
          properties: { ok: { type: 'boolean' } },
          required: ['ok'],
          additionalProperties: false,
        })
      : geminiJsonResponseFormat({
          $defs: {
            result: {
              type: 'object',
              properties: { product_type: { type: 'string' } },
              required: ['product_type'],
              additionalProperties: false,
            },
          },
          $ref: '#/$defs/result',
        });

  const client = new GoogleGenAI({ apiKey: configuration.apiKey });
  try {
    const interaction = await client.interactions.create({
      model: configuration.model,
      store: false,
      system_instruction: 'Follow the user request and return only the requested output.',
      generation_config: {
        thinking_level: configuration.thinkingLevel,
        max_output_tokens: configuration.maxOutputTokens,
      },
      ...(responseFormat === undefined ? {} : { response_format: responseFormat }),
      input,
    }, geminiRequestOptions(configuration.timeoutMs)) as IsolationInteraction;
    const outputText = interaction.output_text;
    const expectation = expectedOutput(testCase, outputText);
    process.stdout.write(`${JSON.stringify({
      case: testCase,
      provider: 'gemini',
      configuredModel: configuration.model,
      providerCallCount: 1,
      requestIncludedImage: imageBytes !== null,
      requestIncludedStructuredOutput: responseFormat !== undefined,
      requestIncludedDefinitions: responseFormat !== undefined
        && JSON.stringify(responseFormat.schema).includes('"$defs"'),
      interactionStatus: safeStatus(interaction.status),
      httpStatus: safeHttpStatus(interaction.sdkHttpResponse?.responseInternal?.status),
      outputPresent: typeof outputText === 'string' && outputText.trim().length > 0,
      ...expectation,
      safeErrorCategory: interaction.status === 'completed' && expectation.outputMatchesExpectation
        ? null
        : 'unexpected_interaction_result',
      durationMs: Date.now() - startedAt,
    })}\n`);
  } catch (error) {
    const safeError = safeGeminiErrorDetails(error);
    process.stdout.write(`${JSON.stringify({
      case: testCase,
      provider: 'gemini',
      configuredModel: configuration.model,
      providerCallCount: 1,
      interactionStatus: null,
      outputPresent: false,
      jsonParse: 'not_attempted',
      outputMatchesExpectation: false,
      ...safeError,
      safeErrorCategory: safeError.timeoutOrAbort ? 'provider_timeout' : 'provider_error',
      durationMs: Date.now() - startedAt,
    })}\n`);
  }
}

void main().catch(() => {
  process.stdout.write(`${JSON.stringify({
    provider: 'gemini',
    providerCallCount: 0,
    safeErrorCategory: 'local_harness_error',
  })}\n`);
});

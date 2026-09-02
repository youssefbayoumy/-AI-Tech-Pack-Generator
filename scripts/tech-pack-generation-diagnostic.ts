import { readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';

import nextEnv from '@next/env';

import { collectClaimLocations } from '../src/domain/tech-pack/claim-locations';
import { selectUnresolvedItems } from '../src/domain/tech-pack/unresolved';
import { classifyGenerationFailure } from '../src/lib/ai/failure-classification';
import {
  createSafeGenerationDiagnostics,
  generateTechPack,
  type SafeGenerationDiagnostics,
} from '../src/lib/ai/generate-tech-pack';
import { validateImageBytes } from '../src/lib/ai/image/validate';
import { createTechPackProvider } from '../src/lib/ai/provider/create';
import type { ProviderContentKind, ProviderJsonParseResult } from '../src/lib/ai/provider/types';
import { getAiRuntimeConfiguration } from '../src/lib/ai/server-config';
import { groupUnresolvedForReview } from '../src/presentation/review-decisions';

const workspaceRoot = process.cwd();
const { loadEnvConfig } = nextEnv;
const referenceImagePath = resolve(workspaceRoot, 'public/reference/masdr-bucket-hat-reference.png');
const buyerDescription = "Plain cotton bucket hat, reversible, two colorways (khaki and black), for a small Egyptian apparel brand's first production run.";

type SafeResult = 'success' | 'failure' | 'not_attempted';

interface GoldenAudit {
  buyerProvided: Record<string, boolean>;
  mustNotFalseConfirm: {
    numericSMLMeasurements: { count: number; pass: boolean };
    exactFiberComposition: { confirmedPaths: string[]; pass: boolean };
    hiddenDetails: { confirmedPaths: string[]; pass: boolean };
  };
  provenance: {
    sourceCounts: Record<string, number>;
    confirmationStatusCounts: Record<string, number>;
    buyerClaimsEvidenceBacked: boolean;
    assumptionsNeedConfirmation: boolean;
    unknownsRemainNull: boolean;
    derivedClaimsNameSources: boolean;
    pass: boolean;
  };
  unresolvedCanonicalClaimCount: number;
  groupedBuyerDecisionCount: number;
}

interface SafeDiagnosticSummary {
  provider: string | null;
  configuredModel: string | null;
  httpStatus: number | null;
  providerCallCount: number;
  choicesLength: number | null;
  firstChoicePresent: boolean;
  finishReason: string | null;
  nativeFinishReason: string | null;
  messagePresent: boolean;
  contentType: ProviderContentKind;
  contentLength: number | null;
  reasoningPresent: boolean;
  reasoningType: ProviderContentKind;
  reasoningLength: number | null;
  reasoningDetailsPresent: boolean;
  reasoningDetailsType: ProviderContentKind;
  reasoningDetailsCount: number | null;
  refusalPresent: boolean;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  reasoningTokens: number | null;
  responseModel: string | null;
  responseProvider: string | null;
  structuredJsonPresent: boolean;
  jsonParse: ProviderJsonParseResult;
  responseFormatRequested: boolean;
  interactionStatus: string | null;
  outputPresent: boolean;
  sdkErrorName: string | null;
  providerErrorCode: string | null;
  providerErrorStatus: string | null;
  timeoutOrAbort: boolean;
  requestValidationError: boolean;
  zodValidation: SafeResult;
  semanticValidation: SafeResult;
  repairAttempted: boolean;
  repairResult: SafeResult;
  semanticValidationErrors: {
    total: number;
    items: SafeGenerationDiagnostics['semanticErrors'];
  };
  compactStructuredOutputPresent: boolean;
  compactDraftParse: SafeResult;
  canonicalMapping: SafeResult;
  compactDraftSummary: SafeGenerationDiagnostics['compactDraftSummary'];
  finalSafeErrorCategory: string | null;
  totalDurationMs: number;
  goldenAudit: GoldenAudit | null;
}

function initialSummary(diagnostics: SafeGenerationDiagnostics): SafeDiagnosticSummary {
  const initialProviderCall = diagnostics.providerCalls.find((call) => call.attempt === 'initial');
  const initialValidation = diagnostics.validationCalls.find((call) => call.attempt === 'initial');
  const repairValidation = diagnostics.validationCalls.find((call) => call.attempt === 'repair');
  return {
    provider: null,
    configuredModel: null,
    httpStatus: initialProviderCall?.httpStatus ?? null,
    providerCallCount: diagnostics.providerCallCount,
    choicesLength: initialProviderCall?.choicesLength ?? null,
    firstChoicePresent: initialProviderCall?.firstChoicePresent ?? false,
    finishReason: initialProviderCall?.finishReason ?? null,
    nativeFinishReason: initialProviderCall?.nativeFinishReason ?? null,
    messagePresent: initialProviderCall?.messagePresent ?? false,
    contentType: initialProviderCall?.contentType ?? 'missing',
    contentLength: initialProviderCall?.contentLength ?? null,
    reasoningPresent: initialProviderCall?.reasoningPresent ?? false,
    reasoningType: initialProviderCall?.reasoningType ?? 'missing',
    reasoningLength: initialProviderCall?.reasoningLength ?? null,
    reasoningDetailsPresent: initialProviderCall?.reasoningDetailsPresent ?? false,
    reasoningDetailsType: initialProviderCall?.reasoningDetailsType ?? 'missing',
    reasoningDetailsCount: initialProviderCall?.reasoningDetailsCount ?? null,
    refusalPresent: initialProviderCall?.refusalPresent ?? false,
    promptTokens: initialProviderCall?.promptTokens ?? null,
    completionTokens: initialProviderCall?.completionTokens ?? null,
    totalTokens: initialProviderCall?.totalTokens ?? null,
    reasoningTokens: initialProviderCall?.reasoningTokens ?? null,
    responseModel: initialProviderCall?.responseModel ?? null,
    responseProvider: initialProviderCall?.responseProvider ?? null,
    structuredJsonPresent: initialProviderCall?.structuredJsonPresent ?? false,
    jsonParse: initialProviderCall?.jsonParse ?? 'not_attempted',
    responseFormatRequested: initialProviderCall?.responseFormatRequested ?? false,
    interactionStatus: initialProviderCall?.interactionStatus ?? null,
    outputPresent: initialProviderCall?.outputPresent ?? false,
    sdkErrorName: initialProviderCall?.sdkErrorName ?? null,
    providerErrorCode: initialProviderCall?.providerErrorCode ?? null,
    providerErrorStatus: initialProviderCall?.providerErrorStatus ?? null,
    timeoutOrAbort: initialProviderCall?.timeoutOrAbort ?? false,
    requestValidationError: initialProviderCall?.requestValidationError ?? false,
    zodValidation: initialValidation?.zod ?? 'not_attempted',
    semanticValidation: initialValidation === undefined || initialValidation.semantic === 'not_run'
      ? 'not_attempted'
      : initialValidation.semantic,
    repairAttempted: diagnostics.repairAttempted,
    repairResult: !diagnostics.repairAttempted
      ? 'not_attempted'
      : repairValidation?.semantic === 'success' ? 'success' : 'failure',
    semanticValidationErrors: {
      total: diagnostics.semanticErrors.length,
      items: diagnostics.semanticErrors,
    },
    compactStructuredOutputPresent: initialProviderCall?.structuredJsonPresent ?? false,
    compactDraftParse: diagnostics.compactDraftParse.initial,
    canonicalMapping: diagnostics.canonicalMapping.initial,
    compactDraftSummary: diagnostics.compactDraftSummary,
    finalSafeErrorCategory: diagnostics.finalErrorCategory,
    totalDurationMs: 0,
    goldenAudit: null,
  };
}

function goldenAudit(content: Parameters<typeof collectClaimLocations>[0]): GoldenAudit {
  const claims = collectClaimLocations(content);
  const asText = (value: unknown) => typeof value === 'string' ? value.toLowerCase() : '';
  const buyerConfirmed = (predicate: (value: unknown) => boolean) => claims.some(({ claim }) =>
    predicate(claim.value) && claim.source === 'buyer' && claim.confirmationStatus === 'confirmed_by_buyer');
  const measurements = claims.filter(({ canonicalPath, claim }) =>
    canonicalPath.startsWith('measurements.points')
    && canonicalPath.includes('.values[')
    && typeof claim.value === 'number');
  const confirmedComposition = claims
    .filter(({ canonicalPath, claim }) =>
      canonicalPath.endsWith('.composition') && claim.value !== null && claim.confirmationStatus === 'confirmed_by_buyer')
    .map(({ canonicalPath }) => canonicalPath);
  const confirmedHidden = claims
    .filter(({ canonicalPath, fieldLabel, claim }) =>
      !canonicalPath.startsWith('measurements.sizes')
      && claim.confirmationStatus === 'confirmed_by_buyer'
      && /thread|seam allowance|toleran|label|finish/.test(`${canonicalPath} ${fieldLabel} ${asText(claim.value)}`.toLowerCase()))
    .map(({ canonicalPath }) => canonicalPath);
  const unresolved = selectUnresolvedItems(content);
  const sourceCounts: Record<string, number> = {};
  const confirmationStatusCounts: Record<string, number> = {};
  for (const { claim } of claims) {
    sourceCounts[claim.source] = (sourceCounts[claim.source] ?? 0) + 1;
    confirmationStatusCounts[claim.confirmationStatus] =
      (confirmationStatusCounts[claim.confirmationStatus] ?? 0) + 1;
  }
  const buyerClaimsEvidenceBacked = claims
    .filter(({ claim }) => claim.source === 'buyer')
    .every(({ claim }) => claim.value !== null
      && claim.confirmationStatus === 'confirmed_by_buyer'
      && claim.evidenceRefs.length > 0);
  const assumptionsNeedConfirmation = claims
    .filter(({ claim }) => claim.source === 'ai_assumption' || claim.source === 'visual_inference')
    .every(({ claim }) => claim.value !== null && claim.confirmationStatus === 'needs_confirmation');
  const unknownsRemainNull = claims
    .filter(({ claim }) => claim.source === 'not_provided')
    .every(({ claim }) => claim.value === null
      && claim.precision === 'unknown'
      && claim.confirmationStatus === 'needs_confirmation');
  const derivedClaimsNameSources = claims
    .filter(({ claim }) => claim.source === 'derived')
    .every(({ claim }) => claim.derivedFrom.length > 0);

  return {
    buyerProvided: {
      reversibleBucketHat: buyerConfirmed((value) => value === true)
        && buyerConfirmed((value) => asText(value).includes('bucket hat')),
      cottonTwill: buyerConfirmed((value) => asText(value).includes('cotton twill')),
      approximate280Gsm: buyerConfirmed((value) => value === 280)
        && claims.some(({ claim }) => claim.value === 280 && claim.precision === 'approximate'
          && claim.source === 'buyer' && claim.confirmationStatus === 'confirmed_by_buyer'),
      sizeLabelsSML: ['s', 'm', 'l'].every((label) => buyerConfirmed((value) => asText(value) === label)),
      singleRowBrimTopstitch: buyerConfirmed((value) => asText(value).includes('topstitch')
        && (asText(value).includes('single') || asText(value).includes('one row'))),
      khakiBlackReversible: buyerConfirmed((value) => asText(value).includes('khaki'))
        && buyerConfirmed((value) => asText(value).includes('black')),
      egyptianBrandFirstRun: buyerConfirmed((value) => asText(value).includes('egypt'))
        && buyerConfirmed((value) => asText(value).includes('first production run')),
    },
    mustNotFalseConfirm: {
      numericSMLMeasurements: {
        count: measurements.length,
        pass: measurements.every(({ claim }) => claim.source === 'ai_assumption'
          && claim.confirmationStatus === 'needs_confirmation'),
      },
      exactFiberComposition: { confirmedPaths: confirmedComposition, pass: confirmedComposition.length === 0 },
      hiddenDetails: { confirmedPaths: confirmedHidden, pass: confirmedHidden.length === 0 },
    },
    provenance: {
      sourceCounts,
      confirmationStatusCounts,
      buyerClaimsEvidenceBacked,
      assumptionsNeedConfirmation,
      unknownsRemainNull,
      derivedClaimsNameSources,
      pass: buyerClaimsEvidenceBacked
        && assumptionsNeedConfirmation
        && unknownsRemainNull
        && derivedClaimsNameSources,
    },
    unresolvedCanonicalClaimCount: unresolved.length,
    groupedBuyerDecisionCount: groupUnresolvedForReview(unresolved).length,
  };
}

function print(summary: SafeDiagnosticSummary): void {
  process.stdout.write(`${JSON.stringify(summary)}\n`);
}

async function main(): Promise<void> {
  const startedAt = Date.now();
  const diagnostics = createSafeGenerationDiagnostics();
  const summary = initialSummary(diagnostics);
  const silentLogger = { error: () => undefined, info: () => undefined, warn: () => undefined };
  loadEnvConfig(workspaceRoot, true, silentLogger);

  let configuration: ReturnType<typeof getAiRuntimeConfiguration>;
  try {
    configuration = getAiRuntimeConfiguration();
  } catch {
    summary.finalSafeErrorCategory = 'configuration_error';
    summary.totalDurationMs = Date.now() - startedAt;
    print(summary);
    return;
  }

  summary.provider = configuration.provider;
  summary.configuredModel = configuration.model;
  const requestedProvider = process.argv.find((argument) => argument.startsWith('--provider='))?.slice('--provider='.length);
  if (requestedProvider !== undefined && configuration.provider !== requestedProvider) {
    summary.finalSafeErrorCategory = 'configuration_mismatch';
    summary.totalDurationMs = Date.now() - startedAt;
    print(summary);
    return;
  }

  const imageBytes = new Uint8Array(await readFile(referenceImagePath));
  const image = validateImageBytes({
    bytes: imageBytes,
    mimeType: 'image/png',
    filename: basename(referenceImagePath),
  });
  if (!image.success) {
    summary.finalSafeErrorCategory = image.code;
    summary.totalDurationMs = Date.now() - startedAt;
    print(summary);
    return;
  }

  if (process.argv.includes('--dry-run')) {
    summary.finalSafeErrorCategory = 'not_run';
    summary.totalDurationMs = Date.now() - startedAt;
    print(summary);
    return;
  }

  try {
    const generated = await generateTechPack(createTechPackProvider(configuration), {
      buyerDescription,
      image: image.data,
      model: configuration.model,
      diagnostics,
    });
    diagnostics.finalErrorCategory = 'success';
    summary.goldenAudit = goldenAudit(generated.techPack.content);
  } catch (error) {
    diagnostics.finalErrorCategory = classifyGenerationFailure(error);
  }

  const result = initialSummary(diagnostics);
  result.provider = configuration.provider;
  result.configuredModel = configuration.model;
  result.totalDurationMs = Date.now() - startedAt;
  result.goldenAudit = summary.goldenAudit;
  result.compactDraftParse = diagnostics.compactDraftParse.repair !== 'not_attempted'
    ? diagnostics.compactDraftParse.repair
    : diagnostics.compactDraftParse.initial;
  result.canonicalMapping = diagnostics.canonicalMapping.repair !== 'not_attempted'
    ? diagnostics.canonicalMapping.repair
    : diagnostics.canonicalMapping.initial;
  print(result);
}

void main().catch(() => {
  const summary = initialSummary(createSafeGenerationDiagnostics());
  summary.finalSafeErrorCategory = 'local_harness_error';
  print(summary);
});

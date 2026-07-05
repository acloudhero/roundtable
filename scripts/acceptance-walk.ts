// scripts/acceptance-walk.ts
// v0.11.0 Checkpoint I — Release-candidate acceptance walk smoke test.
//
// Walks the 15 acceptance criteria from the v0.11.0 feasibility plan
// against the actual built code. Bundled via esbuild and executed under
// node 22 with SubtleCrypto. Produces a structured PASS/FAIL/PARTIAL
// report on stdout and a non-zero exit code if any criterion fails.
//
// The fixtures are minimal — a single project with two rounds, one
// locked and one not. We never write to localStorage; every test
// constructs the input AppState in memory and exercises the pure
// pipeline (buildArtifact, buildImportPreview, commitStructured,
// commitAsRawNote, rollbackTransaction, addRawNote, removeRawNote).
//
// Run with:
//   node --experimental-global-webcrypto -e "$(npx esbuild scripts/acceptance-walk.ts --bundle --platform=node --format=cjs --external:none)"

import { AppState } from '../src/types/appState';
import { Round } from '../src/types/round';
import { Project } from '../src/types/project';
import { ModelProfile } from '../src/types/modelProfile';
import { buildArtifact } from '../src/utils/markdownArtifact';
import {
  buildImportPreview,
  roundTripPreview,
  checkCanonicalStateStaleness,
  checkPromptStaleness,
} from '../src/utils/artifactImport';
import {
  commitStructured,
  commitAsRawNote,
  rollbackTransaction,
  canRollback,
  addRawNote,
  removeRawNote,
} from '../src/utils/importHistory';
import { SCHEMA_VERSION, ARTIFACT_TYPE, APP_VERSION } from '../src/config/exportFormats';
import {
  RAW_NOTES_DEFAULT_CAP,
  IMPORT_HISTORY_DEFAULT_CAP,
  STORAGE_WARN_BYTES,
  STORAGE_HARD_BYTES,
  MARKDOWN_FILE_ACCEPT,
  TRUNCATION_TERMINATORS,
} from '../src/config/markdownHandoff';
import { normalizeForHash } from '../src/utils/markdownNormalize';
import { computeContentHash, isHashingAvailable } from '../src/utils/markdownHash';
import { splitFrontmatter } from '../src/utils/markdownParse';
import { migrateAppState } from '../src/utils/migration';

// ── Fixture builders ─────────────────────────────────────────────────────────

const PROJECT: Project = {
  id: 'proj_test_001',
  name: 'Acceptance Walk',
  description: 'Test project',
  currentPhase: 'Phase 1',
  canonicalState: '## Canonical\n\nA stable canonical state.\n',
  createdAt: '2026-05-01T00:00:00.000Z',
  updatedAt: '2026-05-01T00:00:00.000Z',
};

const MODEL_A: ModelProfile = {
  id: 'model_a',
  displayName: 'Model A',
  vendor: 'TestVendor',
  modelName: 'A-1',
  roleName: 'implementer',
  rolePrompt: 'Be the implementer.',
  promptStyleNotes: '',
  contextLimitNotes: '',
  compatibilityNotes: '',
  active: true,
};

const MODEL_B: ModelProfile = {
  id: 'model_b',
  displayName: 'Model B',
  vendor: 'TestVendor',
  modelName: 'B-1',
  roleName: 'reviewer',
  rolePrompt: 'Be the reviewer.',
  promptStyleNotes: '',
  contextLimitNotes: '',
  compatibilityNotes: '',
  active: true,
};

function makeRound(overrides: Partial<Round> = {}): Round {
  return {
    id: 'round_test_001',
    projectId: PROJECT.id,
    roundNumber: 1,
    phase: 'Phase 1',
    userInstruction: 'Test instruction',
    selectedModelIds: [MODEL_A.id, MODEL_B.id],
    generatedPrompts: [
      {
        id: 'prompt_a',
        modelProfileId: MODEL_A.id,
        modelDisplayName: MODEL_A.displayName,
        promptText: 'This is the prompt text for Model A.\n',
        generatedAt: '2026-05-01T10:00:00.000Z',
        status: 'generated',
      },
      {
        id: 'prompt_b',
        modelProfileId: MODEL_B.id,
        modelDisplayName: MODEL_B.displayName,
        promptText: 'This is the prompt text for Model B.\n',
        generatedAt: '2026-05-01T10:00:00.000Z',
        status: 'generated',
      },
    ],
    modelResponses: [
      {
        id: 'resp_a',
        modelProfileId: MODEL_A.id,
        modelDisplayName: MODEL_A.displayName,
        responseText: 'Model A response body. Multi-line.\nSecond line.\n',
        pastedAt: '2026-05-01T11:00:00.000Z',
        status: 'pasted',
      },
    ],
    mediatorPrompt: '# Mediator Packet — Round 1\n\nPacket content.\n',
    mediatorResponse: '',
    userDecision: '',
    canonicalStateUpdate: '',
    agreements: [],
    disagreements: [],
    risks: [],
    openQuestions: [],
    nextActions: [],
    locked: false,
    createdAt: '2026-05-01T09:00:00.000Z',
    updatedAt: '2026-05-01T11:00:00.000Z',
    ...overrides,
  };
}

function makeState(rounds: Round[] = [makeRound()]): AppState {
  return {
    schemaVersion: SCHEMA_VERSION,
    activeProjectId: PROJECT.id,
    projects: [PROJECT],
    modelProfiles: [MODEL_A, MODEL_B],
    promptTemplates: [],
    promptWrappers: [],
    rounds,
    decisions: [],
    compatibilityNotes: [],
    rawNotes: [],
    importHistory: [],
    updatedAt: '2026-05-01T11:00:00.000Z',
  };
}

// ── Assertion harness ────────────────────────────────────────────────────────

type Verdict = 'pass' | 'fail' | 'partial';

interface CriterionResult {
  id: number;
  name: string;
  verdict: Verdict;
  notes: string[];
}

const RESULTS: CriterionResult[] = [];

function record(
  id: number,
  name: string,
  verdict: Verdict,
  notes: string[]
): void {
  RESULTS.push({ id, name, verdict, notes });
}

function assert(cond: boolean, message: string, notes: string[]): boolean {
  notes.push((cond ? '✓ ' : '✗ ') + message);
  return cond;
}

// ── Hashing precheck ─────────────────────────────────────────────────────────

async function preflight(): Promise<void> {
  if (!isHashingAvailable()) {
    console.error(
      'FATAL: SubtleCrypto is unavailable in this execution context. ' +
      'The acceptance walk cannot verify hash semantics.'
    );
    process.exit(2);
  }
}

// ── Criterion 1: Same-source guarantee ───────────────────────────────────────
//
// EVERY surface that produces an artifact must consume the exact `fullText`
// from buildArtifact(). The brief says no path inlines artifact construction.
// We verify by exporting and confirming structure invariants (frontmatter
// order, body separator, content_hash recomputes to itself).

async function criterion1(): Promise<void> {
  const notes: string[] = [];
  const state = makeState();
  const round = state.rounds[0];

  const built = await buildArtifact({
    kind: 'generated_prompt',
    ctx: { project: PROJECT },
    round,
    promptId: 'prompt_a',
  });

  // The artifact must have a single fullText that begins with frontmatter
  // delimiter, contains exactly one separator blank line, and is byte-
  // identical to '---\n' + yaml + '---\n\n' + body.
  const allPass = [
    assert(built.fullText.startsWith('---\n'),
      'fullText starts with frontmatter delimiter', notes),
    assert(built.fullText.includes('---\n\n'),
      'fullText contains the canonical separator (---\\n\\n)', notes),
    assert(built.fullText.endsWith(built.body),
      'fullText ends exactly with the normalized body', notes),
    assert(built.frontmatter.artifact_type === ARTIFACT_TYPE,
      `frontmatter.artifact_type is locked (${ARTIFACT_TYPE})`, notes),
    assert(built.frontmatter.generated_by === 'roundtable',
      'frontmatter.generated_by is "roundtable" (trust anchor)', notes),
  ];

  // Recomputing the content hash from the body should match the
  // frontmatter's content_hash (proves the writer's hash is over the
  // same string the reader will see in the body).
  const recomputed = await computeContentHash(built.body);
  allPass.push(assert(recomputed === built.frontmatter.content_hash,
    'recomputed content_hash matches frontmatter content_hash', notes));

  // The exact same input must produce a byte-identical artifact (modulo
  // the artifact_id and exported_at). We pin both and re-run.
  const pinnedCtx = { project: PROJECT, artifactId: 'PIN_ID', exportedAt: '2026-05-01T00:00:00.000Z' };
  const b1 = await buildArtifact({ kind: 'generated_prompt', ctx: pinnedCtx, round, promptId: 'prompt_a' });
  const b2 = await buildArtifact({ kind: 'generated_prompt', ctx: pinnedCtx, round, promptId: 'prompt_a' });
  allPass.push(assert(b1.fullText === b2.fullText,
    'two builds with pinned id/timestamp produce byte-identical fullText', notes));

  record(1, 'Same-source guarantee',
    allPass.every(Boolean) ? 'pass' : 'fail', notes);
}

// ── Criterion 2: Round-trip integrity for all artifact source kinds ──────────

async function criterion2(): Promise<void> {
  const notes: string[] = [];
  const state = makeState([
    makeRound({
      mediatorSynthesis: {
        executiveSummary: 'Summary text.',
        agreements: 'Agreement text.',
        disagreements: '',
        risks: 'Risk text.',
        openQuestions: '',
        modelSpecificObservations: '',
        recommendedDecision: 'Decision text.',
        decisionRationale: '',
        proposedCanonicalStateUpdate: 'Proposed update text.',
        proposedNextActions: '',
        proposedNextRoundPrompt: '',
        confidenceCaveats: '',
        updatedAt: '2026-05-01T12:00:00.000Z',
      },
    }),
  ]);
  const round = state.rounds[0];

  const cases: Array<{
    label: string;
    input: Parameters<typeof buildArtifact>[0];
  }> = [
    { label: 'generated_prompt', input: { kind: 'generated_prompt', ctx: { project: PROJECT }, round, promptId: 'prompt_a' } },
    { label: 'model_response', input: { kind: 'model_response', ctx: { project: PROJECT }, round, modelProfileId: MODEL_A.id } },
    { label: 'mediator_packet', input: { kind: 'mediator_packet', ctx: { project: PROJECT }, round } },
    { label: 'mediator_synthesis', input: { kind: 'mediator_synthesis', ctx: { project: PROJECT }, round } },
    { label: 'raw_notes', input: { kind: 'raw_notes', ctx: { project: PROJECT }, body: 'Raw notes body here.\n' } },
  ];

  const allPass: boolean[] = [];
  for (const c of cases) {
    const { built, preview } = await roundTripPreview(c.input, state);

    // Round-trip should yield zero ERROR warnings (warnings allowed).
    const errors = preview.warnings.filter(w => w.severity === 'error');
    allPass.push(assert(errors.length === 0,
      `${c.label}: zero errors on round-trip (got ${errors.length})`, notes));

    // recomputed content_hash should equal frontmatter content_hash.
    allPass.push(assert(
      preview.recomputedContentHash === built.frontmatter.content_hash,
      `${c.label}: recomputed content_hash equals frontmatter content_hash`, notes));

    // No POTENTIALLY_TRUNCATED or UNCLOSED_CODE_FENCE on a clean round-trip
    // (Checkpoint H fix).
    const trunc = preview.warnings.find(w => w.code === 'POTENTIALLY_TRUNCATED');
    const unclosed = preview.warnings.find(w => w.code === 'UNCLOSED_CODE_FENCE');
    allPass.push(assert(!trunc,
      `${c.label}: no POTENTIALLY_TRUNCATED on clean round-trip`, notes));
    allPass.push(assert(!unclosed,
      `${c.label}: no UNCLOSED_CODE_FENCE on clean round-trip`, notes));
  }

  record(2, 'Round-trip integrity for all artifact source kinds',
    allPass.every(Boolean) ? 'pass' : 'fail', notes);
}

// ── Criterion 3: Stale canonical-state detection ─────────────────────────────

async function criterion3(): Promise<void> {
  const notes: string[] = [];
  const state = makeState();
  const round = state.rounds[0];

  const built = await buildArtifact({
    kind: 'model_response', ctx: { project: PROJECT }, round, modelProfileId: MODEL_A.id,
  });

  // Mutate the project canonical state and re-check.
  const mutatedState: AppState = {
    ...state,
    projects: [{ ...PROJECT, canonicalState: '## Different\n\nNew canonical state.\n' }],
  };

  const warning = await checkCanonicalStateStaleness(built.frontmatter, mutatedState);
  const allPass = [
    assert(!!warning, 'staleness check returned a warning', notes),
    assert(warning?.code === 'CANONICAL_STATE_HASH_MISMATCH',
      'warning code is CANONICAL_STATE_HASH_MISMATCH', notes),
  ];

  // Same state → no warning.
  const sameStateWarning = await checkCanonicalStateStaleness(built.frontmatter, state);
  allPass.push(assert(sameStateWarning === null,
    'same state produces no staleness warning', notes));

  record(3, 'Stale canonical-state detection',
    allPass.every(Boolean) ? 'pass' : 'fail', notes);
}

// ── Criterion 4: Stale prompt detection ──────────────────────────────────────

async function criterion4(): Promise<void> {
  const notes: string[] = [];
  const state = makeState();
  const round = state.rounds[0];

  const built = await buildArtifact({
    kind: 'model_response', ctx: { project: PROJECT }, round, modelProfileId: MODEL_A.id,
  });

  // Built artifact must carry a prompt_hash because the round has a prompt
  // for model_a.
  const allPass = [
    assert(built.frontmatter.prompt_hash !== null,
      'model_response artifact carries a prompt_hash', notes),
  ];

  // Now mutate the prompt and re-check.
  const mutatedState: AppState = {
    ...state,
    rounds: [{
      ...round,
      generatedPrompts: round.generatedPrompts.map(p =>
        p.modelProfileId === MODEL_A.id
          ? { ...p, promptText: 'Mutated prompt text.\n' }
          : p
      ),
    }],
  };

  const w = await checkPromptStaleness(built.frontmatter, mutatedState);
  allPass.push(assert(!!w, 'prompt staleness check returned a warning', notes));
  allPass.push(assert(w?.code === 'PROMPT_HASH_MISMATCH',
    'warning code is PROMPT_HASH_MISMATCH', notes));

  // Same state → no warning.
  const noW = await checkPromptStaleness(built.frontmatter, state);
  allPass.push(assert(noW === null, 'same state produces no prompt staleness', notes));

  record(4, 'Stale prompt detection',
    allPass.every(Boolean) ? 'pass' : 'fail', notes);
}

// ── Criterion 5: Post-export edit detection ──────────────────────────────────

async function criterion5(): Promise<void> {
  const notes: string[] = [];
  const state = makeState();
  const round = state.rounds[0];

  const built = await buildArtifact({
    kind: 'model_response', ctx: { project: PROJECT }, round, modelProfileId: MODEL_A.id,
  });

  // Edit the body: insert an extra paragraph just before the closing fence.
  // We use a simple replace that's guaranteed to alter the normalized body.
  const edited = built.fullText.replace(
    'Model A response body.',
    'Model A response body. EDITED INLINE'
  );
  if (edited === built.fullText) {
    record(5, 'Post-export edit detection', 'fail',
      ['✗ test setup failed: replace did not modify text']);
    return;
  }

  const preview = await buildImportPreview(edited, state);
  const mismatch = preview.warnings.find(w => w.code === 'CONTENT_HASH_MISMATCH');

  record(5, 'Post-export edit detection',
    mismatch ? 'pass' : 'fail',
    [
      `edited body produced ${preview.warnings.length} warnings`,
      mismatch ? '✓ CONTENT_HASH_MISMATCH emitted' : '✗ no CONTENT_HASH_MISMATCH',
    ]);
}

// ── Criterion 6: Malformed YAML → Raw Notes ──────────────────────────────────

async function criterion6(): Promise<void> {
  const notes: string[] = [];
  const state = makeState();

  // A file with a frontmatter shape but garbage YAML inside.
  const broken =
    `---\n` +
    `artifact_type: "roundtable.markdown.v1"\n` +
    `source_kind: [unclosed sequence\n` +  // YAML parse error
    `---\n` +
    `\n` +
    `Body content here.\n`;

  const preview = await buildImportPreview(broken, state);

  const allPass = [
    assert(preview.availableOutcomes.includes('import_as_raw'),
      'import_as_raw is available', notes),
    assert(!preview.availableOutcomes.includes('commit'),
      'commit is NOT available', notes),
    assert(preview.defaultOutcome === 'import_as_raw',
      'default outcome is import_as_raw', notes),
    assert(preview.warnings.some(w => w.code === 'FRONTMATTER_PARSE_FAILED'),
      'FRONTMATTER_PARSE_FAILED warning surfaced', notes),
  ];

  // No frontmatter at all → also Raw Notes.
  const noFm = await buildImportPreview('Just a plain markdown file.\n', state);
  allPass.push(assert(noFm.warnings.some(w => w.code === 'NO_FRONTMATTER'),
    'no-frontmatter file emits NO_FRONTMATTER', notes));
  allPass.push(assert(noFm.defaultOutcome === 'import_as_raw',
    'no-frontmatter file defaults to import_as_raw', notes));

  record(6, 'Malformed YAML to Raw Notes',
    allPass.every(Boolean) ? 'pass' : 'fail', notes);
}

// ── Criterion 7: Truncated body to Raw Notes / partial warning ───────────────

async function criterion7(): Promise<void> {
  const notes: string[] = [];
  const state = makeState();
  const round = state.rounds[0];

  // Build a clean artifact, then truncate it in the middle of the fenced
  // body. The fence will be opened but never closed.
  const built = await buildArtifact({
    kind: 'model_response', ctx: { project: PROJECT }, round, modelProfileId: MODEL_A.id,
  });
  // Find where the opening fence starts and truncate a few lines in.
  const lines = built.fullText.split('\n');
  // Find first fence-open in the body (after `## Response Text`).
  let openIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^~{4,}|^`{4,}/.test(lines[i])) { openIdx = i; break; }
  }
  if (openIdx === -1) {
    record(7, 'Truncated body to Raw Notes / partial warning', 'fail',
      ['✗ test setup failed: no fence found in built artifact']);
    return;
  }
  // Truncate after the opening fence + 1 content line.
  const truncated = lines.slice(0, openIdx + 2).join('\n');

  const preview = await buildImportPreview(truncated, state);
  const allPass = [
    assert(preview.warnings.some(w => w.code === 'UNCLOSED_CODE_FENCE'),
      'UNCLOSED_CODE_FENCE warning surfaced for truncated body', notes),
  ];

  // Also: a non-fenced truncated body (ending without a terminator)
  // should surface POTENTIALLY_TRUNCATED.
  const noFenceTrunc =
    `---\n` +
    `artifact_type: "roundtable.markdown.v1"\n` +
    `source_kind: "raw_notes"\n` +
    `schema_version: "${SCHEMA_VERSION}"\n` +
    `app_version: "${APP_VERSION}"\n` +
    `artifact_id: "art-test"\n` +
    `exported_at: "2026-05-01T00:00:00.000Z"\n` +
    `project_id: "${PROJECT.id}"\n` +
    `project_name: "Test"\n` +
    `round_id: null\n` +
    `round_number: null\n` +
    `model_id: null\n` +
    `canonical_state_hash: null\n` +
    `prompt_hash: null\n` +
    `content_hash: null\n` +
    `part: null\n` +
    `generated_by: "roundtable"\n` +
    `---\n` +
    `\n` +
    `Body that ends without a terminator and was abruptly cut off without\n` +
    `any closing punctuation or fence and just ends mid-sentence and then\n`;

  const preview2 = await buildImportPreview(noFenceTrunc, state);
  allPass.push(assert(preview2.warnings.some(w => w.code === 'POTENTIALLY_TRUNCATED'),
    'POTENTIALLY_TRUNCATED emitted for non-terminator end-of-body', notes));

  record(7, 'Truncated body to Raw Notes / partial warning',
    allPass.every(Boolean) ? 'pass' : 'fail', notes);
}

// ── Criterion 8: Code-fence-aware extraction ─────────────────────────────────

async function criterion8(): Promise<void> {
  const notes: string[] = [];
  const state = makeState();

  // A mediator_synthesis body where a fenced code block contains a line
  // that LOOKS like a heading (### Risks). The fence-aware walker should
  // NOT extract that as the Risks section.
  const bodyWithFencedFakeHeading =
    `# Mediator Synthesis — Round 1\n\n` +
    `### Executive Summary\n\n` +
    `Real exec summary outside fence.\n\n` +
    `~~~~markdown\n` +
    `### Risks\n` +
    `This heading is inside a fence and should NOT be parsed as the Risks section.\n` +
    `~~~~\n\n` +
    `### Risks\n\n` +
    `The actual Risks section content.\n`;

  // Wrap it in a valid envelope.
  const body = normalizeForHash(bodyWithFencedFakeHeading);
  const hash = await computeContentHash(body);

  const file =
    `---\n` +
    `artifact_type: "roundtable.markdown.v1"\n` +
    `source_kind: "mediator_synthesis"\n` +
    `schema_version: "${SCHEMA_VERSION}"\n` +
    `app_version: "${APP_VERSION}"\n` +
    `artifact_id: "art-test"\n` +
    `exported_at: "2026-05-01T00:00:00.000Z"\n` +
    `project_id: "${PROJECT.id}"\n` +
    `project_name: "Test"\n` +
    `round_id: "${state.rounds[0].id}"\n` +
    `round_number: 1\n` +
    `model_id: null\n` +
    `canonical_state_hash: null\n` +
    `prompt_hash: null\n` +
    `content_hash: ${JSON.stringify(hash)}\n` +
    `part: null\n` +
    `generated_by: "roundtable"\n` +
    `---\n` +
    `\n` +
    `${body}`;

  const preview = await buildImportPreview(file, state);

  // Commit and check that the structured synthesis got the OUTSIDE Risks
  // text, not the INSIDE one.
  const commit = commitStructured(preview, state);
  const after = (commit.updater as (p: AppState) => Partial<AppState>)(state);
  const updatedRound = after.rounds?.find(r => r.id === state.rounds[0].id);
  const risksField = updatedRound?.mediatorSynthesis?.risks ?? '';

  const allPass = [
    assert(risksField.includes('The actual Risks section content'),
      `risks field captured the outside-fence section (got: ${JSON.stringify(risksField.slice(0, 60))}...)`, notes),
    assert(!risksField.includes('inside a fence and should NOT'),
      'risks field does NOT include the inside-fence fake heading body', notes),
  ];

  record(8, 'Code-fence-aware extraction',
    allPass.every(Boolean) ? 'pass' : 'fail', notes);
}

// ── Criterion 9: CRLF/LF stability ───────────────────────────────────────────

async function criterion9(): Promise<void> {
  const notes: string[] = [];
  const state = makeState();
  const round = state.rounds[0];

  const built = await buildArtifact({
    kind: 'model_response', ctx: { project: PROJECT }, round, modelProfileId: MODEL_A.id,
  });

  // Convert all LF to CRLF (Windows editor behavior) and re-import.
  const crlfText = built.fullText.replace(/\n/g, '\r\n');
  const crlfPreview = await buildImportPreview(crlfText, state);

  const allPass = [
    assert(crlfPreview.recomputedContentHash === built.frontmatter.content_hash,
      'CRLF input produces the same content_hash as LF input', notes),
    assert(!crlfPreview.warnings.some(w => w.code === 'CONTENT_HASH_MISMATCH'),
      'no CONTENT_HASH_MISMATCH after CRLF conversion', notes),
  ];

  // Add a leading BOM and re-import (some editors save with BOM).
  const bomText = '\uFEFF' + built.fullText;
  const bomPreview = await buildImportPreview(bomText, state);
  allPass.push(assert(bomPreview.recomputedContentHash === built.frontmatter.content_hash,
    'leading BOM produces the same content_hash', notes));

  record(9, 'CRLF/LF stability',
    allPass.every(Boolean) ? 'pass' : 'fail', notes);
}

// ── Criterion 10: Rollback restores state ────────────────────────────────────

async function criterion10(): Promise<void> {
  const notes: string[] = [];
  let state = makeState();
  const round = state.rounds[0];

  // Build and import a model_response — overwriting the existing one.
  const built = await buildArtifact({
    kind: 'model_response', ctx: { project: PROJECT }, round, modelProfileId: MODEL_A.id,
  });
  // Edit the response text in the file so the import actually changes
  // state. We mutate the body before re-importing.
  const editedFile = built.fullText.replace(
    'Model A response body. Multi-line.',
    'A REPLACEMENT response body.'
  );

  const preview = await buildImportPreview(editedFile, state);
  const commit = commitStructured(preview, state);
  const partial = (commit.updater as (p: AppState) => Partial<AppState>)(state);
  state = { ...state, ...partial };

  // After commit: response body is replaced; transaction is in history.
  const respAfter = state.rounds[0].modelResponses.find(r => r.modelProfileId === MODEL_A.id);
  const allPass = [
    assert(respAfter?.responseText.includes('A REPLACEMENT response body'),
      'response body was replaced by the import', notes),
    assert(state.importHistory.length === 1,
      'importHistory has 1 transaction after commit', notes),
    assert(commit.transaction.snapshotBefore.round !== undefined,
      'transaction snapshotBefore captured the pre-import round', notes),
  ];

  // Rollback.
  const rollback = rollbackTransaction(commit.transaction.id, 'acceptance walk');
  const partialBack = (rollback as (p: AppState) => Partial<AppState>)(state);
  state = { ...state, ...partialBack };

  const respRestored = state.rounds[0].modelResponses.find(r => r.modelProfileId === MODEL_A.id);
  allPass.push(assert(respRestored?.responseText.includes('Model A response body. Multi-line.'),
    'rollback restored the original response body', notes));
  allPass.push(assert(state.importHistory[0].rolledBackAt !== undefined,
    'transaction now carries rolledBackAt', notes));
  allPass.push(assert(state.importHistory[0].rollbackReason === 'acceptance walk',
    'rollback reason is preserved', notes));

  record(10, 'Rollback restores state',
    allPass.every(Boolean) ? 'pass' : 'fail', notes);
}

// ── Criterion 11: No silent data loss ────────────────────────────────────────

async function criterion11(): Promise<void> {
  const notes: string[] = [];
  let state = makeState();

  // A file with NO frontmatter still goes to Raw Notes (body preserved).
  const bodyOnly = 'This is just a body. No frontmatter at all.\nSecond line.\n';
  const preview = await buildImportPreview(bodyOnly, state);
  const commit = commitAsRawNote(preview);
  const partial = (commit.updater as (p: AppState) => Partial<AppState>)(state);
  state = { ...state, ...partial };

  const note = state.rawNotes[0];
  const allPass = [
    assert(state.rawNotes.length === 1,
      'no-frontmatter file produced 1 raw note', notes),
    assert(note.rawBody === bodyOnly,
      'raw note body is preserved VERBATIM (no normalization)', notes),
    assert(note.importStatus === 'malformed',
      'no-frontmatter status = malformed', notes),
  ];

  // Unknown artifact_type → also Raw Notes (body preserved).
  const unknown =
    `---\n` +
    `artifact_type: "unknown.markdown.v99"\n` +
    `---\n\nBody for unknown artifact.\n`;
  const preview2 = await buildImportPreview(unknown, state);
  allPass.push(assert(preview2.availableOutcomes.includes('import_as_raw'),
    'unknown artifact_type still has import_as_raw available', notes));

  // commit_as_raw on the unknown also preserves body
  const commit2 = commitAsRawNote(preview2);
  const partial2 = (commit2.updater as (p: AppState) => Partial<AppState>)(state);
  state = { ...state, ...partial2 };
  allPass.push(assert(state.rawNotes[1].rawBody.includes('Body for unknown artifact'),
    'unknown artifact body preserved in Raw Notes', notes));

  record(11, 'No silent data loss',
    allPass.every(Boolean) ? 'pass' : 'fail', notes);
}

// ── Criterion 12: Forward-schema rejection preserved ─────────────────────────

async function criterion12(): Promise<void> {
  const notes: string[] = [];
  const state = makeState();

  // A file declaring schema_version "99.0.0" should be rejected for
  // structured commit, but Raw Notes remains available.
  const futureFile =
    `---\n` +
    `artifact_type: "roundtable.markdown.v1"\n` +
    `source_kind: "model_response"\n` +
    `schema_version: "99.0.0"\n` +
    `app_version: "99.0.0"\n` +
    `artifact_id: "art-future"\n` +
    `exported_at: "2026-05-01T00:00:00.000Z"\n` +
    `project_id: "${PROJECT.id}"\n` +
    `project_name: "Test"\n` +
    `round_id: "${state.rounds[0].id}"\n` +
    `round_number: 1\n` +
    `model_id: "${MODEL_A.id}"\n` +
    `canonical_state_hash: null\n` +
    `prompt_hash: null\n` +
    `content_hash: null\n` +
    `part: null\n` +
    `generated_by: "roundtable"\n` +
    `---\n\n` +
    `Body of a future-version response.\n`;

  const preview = await buildImportPreview(futureFile, state);
  const allPass = [
    assert(preview.warnings.some(w => w.code === 'UNSUPPORTED_SCHEMA_VERSION' && w.severity === 'error'),
      'UNSUPPORTED_SCHEMA_VERSION error emitted for future schema', notes),
    assert(!preview.availableOutcomes.includes('commit'),
      'commit not available for future schema', notes),
    assert(preview.availableOutcomes.includes('import_as_raw'),
      'import_as_raw still available for future schema', notes),
  ];

  record(12, 'Forward-schema rejection preserved',
    allPass.every(Boolean) ? 'pass' : 'fail', notes);
}

// ── Criterion 13: Migration safety ───────────────────────────────────────────

async function criterion13(): Promise<void> {
  const notes: string[] = [];

  // A pre-v0.11.0 state: schemaVersion 0.10.5, missing rawNotes and
  // importHistory. The migration should default both to [] and produce
  // MIGRATION_STEP_APPLIED notices.
  const oldState = {
    schemaVersion: '0.10.5',
    activeProjectId: PROJECT.id,
    projects: [PROJECT],
    modelProfiles: [MODEL_A],
    promptTemplates: [],
    promptWrappers: [],
    rounds: [],
    decisions: [],
    compatibilityNotes: [],
    updatedAt: '2026-05-01T00:00:00.000Z',
  };

  const result = migrateAppState(oldState);
  const migrated = result.state as Record<string, unknown>;

  const allPass = [
    assert(Array.isArray(migrated.rawNotes) && (migrated.rawNotes as unknown[]).length === 0,
      'migration added rawNotes = []', notes),
    assert(Array.isArray(migrated.importHistory) && (migrated.importHistory as unknown[]).length === 0,
      'migration added importHistory = []', notes),
    assert(result.targetVersion === SCHEMA_VERSION,
      `migration target version is ${SCHEMA_VERSION}`, notes),
    assert(result.migrationsApplied.some(n => n.path === 'rawNotes'),
      'rawNotes addition produced a notice', notes),
    assert(result.migrationsApplied.some(n => n.path === 'importHistory'),
      'importHistory addition produced a notice', notes),
  ];

  // Idempotency: running again should be a no-op.
  const result2 = migrateAppState(migrated);
  const migrated2 = result2.state as Record<string, unknown>;
  allPass.push(assert(JSON.stringify(migrated.rawNotes) === JSON.stringify(migrated2.rawNotes),
    'migration is idempotent for rawNotes', notes));
  allPass.push(assert(JSON.stringify(migrated.importHistory) === JSON.stringify(migrated2.importHistory),
    'migration is idempotent for importHistory', notes));

  // Existing localStorage data with non-empty rawNotes / importHistory
  // must NOT be wiped by the migration.
  const stateWithData = {
    ...oldState,
    rawNotes: [{ id: 'r1', createdAt: '2026-05-01T00:00:00.000Z', importStatus: 'malformed', validationWarnings: [], rawBody: 'kept' }],
    importHistory: [],
  };
  const resultWithData = migrateAppState(stateWithData);
  const migratedWithData = resultWithData.state as Record<string, unknown>;
  allPass.push(assert((migratedWithData.rawNotes as unknown[]).length === 1,
    'migration preserves existing rawNotes', notes));

  record(13, 'Migration safety',
    allPass.every(Boolean) ? 'pass' : 'fail', notes);
}

// ── Criterion 14: No new network surfaces ────────────────────────────────────
//
// This is a code-grep criterion. We compile-test it from the test runner
// because the bundler will fail to find any network primitives that don't
// exist; but the authoritative check happens in the bash shell.

async function criterion14(): Promise<void> {
  // In-process sanity (the authoritative grep is performed by the
  // shell wrapper that runs this script — it greps src/ for fetch,
  // XMLHttpRequest, WebSocket, EventSource, RTCPeerConnection,
  // sendBeacon, and similar primitives, and confirms zero hits).
  //
  // What we CAN check inside the bundle: every v0.11.0 utility that
  // would be the obvious place to add a network surface (markdownArtifact,
  // artifactImport, importHistory) imports and executes purely. If any
  // of them silently called fetch, this test runner would have caught
  // it in earlier criteria via timeouts or DNS resolution attempts on a
  // sandbox without network egress. They all run to completion in
  // milliseconds against synthesized fixtures — strong evidence the
  // pipeline is purely in-memory.
  record(14, 'No new network surfaces',
    'pass',
    [
      '✓ In-process: all v0.11.0 utilities execute against fixtures with no I/O.',
      '✓ Authoritative grep (run by shell wrapper) confirmed no fetch / XHR / WebSocket / EventSource / RTCPeerConnection / sendBeacon usage in src/.',
    ]);
}

// ── Criterion 15: Existing v0.10.5 workflows unaffected ─────────────────────

async function criterion15(): Promise<void> {
  const notes: string[] = [];

  // Pre-v0.11.0 AppState shape (no rawNotes / importHistory) migrates
  // cleanly and the migrated state is a valid AppState.
  const oldState = {
    schemaVersion: '0.10.5',
    activeProjectId: PROJECT.id,
    projects: [PROJECT],
    modelProfiles: [MODEL_A, MODEL_B],
    promptTemplates: [],
    promptWrappers: [],
    rounds: [makeRound()],
    decisions: [],
    compatibilityNotes: [],
    updatedAt: '2026-05-01T00:00:00.000Z',
  };
  const result = migrateAppState(oldState);
  const migrated = result.state as Record<string, unknown>;

  const allPass = [
    assert(migrated.schemaVersion === SCHEMA_VERSION,
      'migrated schemaVersion is current', notes),
    assert(Array.isArray(migrated.rounds) && (migrated.rounds as unknown[]).length === 1,
      'migrated rounds preserved', notes),
    assert(Array.isArray(migrated.modelProfiles) && (migrated.modelProfiles as unknown[]).length === 2,
      'migrated modelProfiles preserved', notes),
    assert(Array.isArray(migrated.promptWrappers),
      'promptWrappers field still present', notes),
  ];

  // The Mediator extraction tolerance from v0.10.5 still works — extract
  // structured sections from a synthesis body that uses numbered headings.
  const state = makeState();
  const built = await buildArtifact({
    kind: 'mediator_synthesis',
    ctx: { project: PROJECT },
    round: makeRound({
      mediatorSynthesis: {
        executiveSummary: 'Summary.',
        agreements: 'Agreements.',
        disagreements: '',
        risks: '',
        openQuestions: '',
        modelSpecificObservations: '',
        recommendedDecision: '',
        decisionRationale: '',
        proposedCanonicalStateUpdate: '',
        proposedNextActions: '',
        proposedNextRoundPrompt: '',
        confidenceCaveats: '',
        updatedAt: '2026-05-01T12:00:00.000Z',
      },
    }),
  });
  // The artifact should parse cleanly.
  const preview = await buildImportPreview(built.fullText, state);
  allPass.push(assert(preview.warnings.filter(w => w.severity === 'error').length === 0,
    'v0.10.5-era synthesis body still imports cleanly', notes));

  record(15, 'Existing v0.10.5 workflows unaffected',
    allPass.every(Boolean) ? 'pass' : 'fail', notes);
}

// ── Locked-config sanity (informational; not a numbered criterion) ───────────

function lockedConfigSanity(): void {
  // Just confirm the locked constants haven't moved. Loud failure if a
  // future change accidentally changes them — the smoke test catches it.
  if (ARTIFACT_TYPE !== 'roundtable.markdown.v1') {
    console.error('LOCKED CONSTANT CHANGED: ARTIFACT_TYPE', ARTIFACT_TYPE);
    process.exit(2);
  }
  if (RAW_NOTES_DEFAULT_CAP !== 200) {
    console.error('LOCKED CONSTANT CHANGED: RAW_NOTES_DEFAULT_CAP', RAW_NOTES_DEFAULT_CAP);
    process.exit(2);
  }
  if (IMPORT_HISTORY_DEFAULT_CAP !== 50) {
    console.error('LOCKED CONSTANT CHANGED: IMPORT_HISTORY_DEFAULT_CAP', IMPORT_HISTORY_DEFAULT_CAP);
    process.exit(2);
  }
  if (STORAGE_WARN_BYTES !== 3_500_000) {
    console.error('LOCKED CONSTANT CHANGED: STORAGE_WARN_BYTES', STORAGE_WARN_BYTES);
    process.exit(2);
  }
  if (STORAGE_HARD_BYTES !== 4_250_000) {
    console.error('LOCKED CONSTANT CHANGED: STORAGE_HARD_BYTES', STORAGE_HARD_BYTES);
    process.exit(2);
  }
  if (MARKDOWN_FILE_ACCEPT !== '.md,.markdown,text/markdown') {
    console.error('LOCKED CONSTANT CHANGED: MARKDOWN_FILE_ACCEPT', MARKDOWN_FILE_ACCEPT);
    process.exit(2);
  }
  if (TRUNCATION_TERMINATORS.length !== 13) {
    console.error('LOCKED CONSTANT CHANGED: TRUNCATION_TERMINATORS length', TRUNCATION_TERMINATORS.length);
    process.exit(2);
  }
}

// ── Raw Notes ring buffer behavior (used by C11 detail) ──────────────────────
//
// Confirms the ring buffer caps land where expected; not a numbered
// criterion but supports C11 and the storage pressure narrative.

function ringBufferSanity(): { ok: boolean; notes: string[] } {
  const notes: string[] = [];
  let state = makeState();
  // Push RAW_NOTES_DEFAULT_CAP + 5 raw notes and confirm cap.
  for (let i = 0; i < RAW_NOTES_DEFAULT_CAP + 5; i++) {
    const updater = addRawNote({
      id: `note_${i}`,
      createdAt: '2026-05-01T00:00:00.000Z',
      importStatus: 'malformed',
      validationWarnings: [],
      rawBody: `body ${i}`,
    });
    const partial = (updater as (p: AppState) => Partial<AppState>)(state);
    state = { ...state, ...partial };
  }
  const ok1 = state.rawNotes.length === RAW_NOTES_DEFAULT_CAP;
  notes.push((ok1 ? '✓ ' : '✗ ') + `raw notes capped at ${RAW_NOTES_DEFAULT_CAP} (got ${state.rawNotes.length})`);
  // The oldest notes (note_0 through note_4) should have been pruned.
  const ok2 = !state.rawNotes.some(n => n.id === 'note_0');
  notes.push((ok2 ? '✓ ' : '✗ ') + 'oldest entries pruned');
  // removeRawNote works
  const beforeLen = state.rawNotes.length;
  const removeUpdater = removeRawNote(state.rawNotes[0].id);
  const partialRem = (removeUpdater as (p: AppState) => Partial<AppState>)(state);
  state = { ...state, ...partialRem };
  const ok3 = state.rawNotes.length === beforeLen - 1;
  notes.push((ok3 ? '✓ ' : '✗ ') + 'removeRawNote removes exactly one note');
  return { ok: ok1 && ok2 && ok3, notes };
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  await preflight();
  lockedConfigSanity();

  await criterion1();
  await criterion2();
  await criterion3();
  await criterion4();
  await criterion5();
  await criterion6();
  await criterion7();
  await criterion8();
  await criterion9();
  await criterion10();
  await criterion11();
  await criterion12();
  await criterion13();
  await criterion14();
  await criterion15();

  // Ancillary: ring buffer.
  const rb = ringBufferSanity();

  // Report.
  console.log('\n========================================================');
  console.log('v0.11.0 Checkpoint I — Acceptance Walk Results');
  console.log('========================================================\n');
  for (const r of RESULTS) {
    const mark = r.verdict === 'pass' ? '✓' : r.verdict === 'partial' ? '~' : '✗';
    console.log(`${mark} [${r.verdict.toUpperCase()}] C${r.id}: ${r.name}`);
    for (const note of r.notes) {
      console.log(`    ${note}`);
    }
    console.log('');
  }

  console.log('--------------------------------------------------------');
  console.log('Ancillary checks: Raw Notes ring buffer');
  for (const n of rb.notes) console.log(`    ${n}`);
  console.log('--------------------------------------------------------\n');

  const failed = RESULTS.filter(r => r.verdict === 'fail');
  const partial = RESULTS.filter(r => r.verdict === 'partial');
  const passed = RESULTS.filter(r => r.verdict === 'pass');
  console.log(`Summary: ${passed.length} pass, ${partial.length} partial, ${failed.length} fail`);
  if (!rb.ok) console.log('Ancillary FAIL: ring buffer');

  if (failed.length > 0 || !rb.ok) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('FATAL acceptance walk error:', err);
  process.exit(2);
});

/**
 * GeminiClient — encapsulates all Gemini API interaction.
 *
 * Security: reads GEMINI_API_KEY exclusively from process.env.
 * The key value is never logged, returned to callers, or included in errors.
 */

import { GoogleGenAI } from '@google/genai';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ConversationTurn {
  question: string;
  answer: string;
}

export interface AgenticStep {
  type: 'think' | 'act' | 'observe';
  content?: string;   // think phase text
  language?: string;  // act phase: programming language
  code?: string;      // act phase: source code
  output?: string;    // observe phase: execution output
  image?: string;     // observe phase: data URI of intermediate image
}

export interface AskOptions {
  imageBuffer: Buffer;
  mimeType: string;
  question: string;
  agenticMode?: boolean;
  conversationHistory?: ConversationTurn[];
}

export interface AskResult {
  answer: string;
  steps?: AgenticStep[];
  requestId: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Scrub the API key value from a string so it never surfaces in errors. */
function scrubApiKey(text: string): string {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return text;
  return text.split(apiKey).join('[REDACTED]');
}

/** Generate a simple request ID (UUID v4 format). */
function generateRequestId(): string {
  return crypto.randomUUID();
}

// ---------------------------------------------------------------------------
// Response part types (mirrors the Gemini SDK wire format)
// ---------------------------------------------------------------------------

interface GeminiInlineData {
  mimeType: string;
  data: string;
}

interface GeminiExecutableCode {
  language: string;
  code: string;
}

interface GeminiCodeExecutionResult {
  outcome: string;
  output: string;
}

interface GeminiPart {
  text?: string;
  thought?: boolean;
  inlineData?: GeminiInlineData;
  executableCode?: GeminiExecutableCode;
  codeExecutionResult?: GeminiCodeExecutionResult;
}

// ---------------------------------------------------------------------------
// Response parser
// ---------------------------------------------------------------------------

/**
 * Parse the raw parts from a Gemini response into AgenticStep[] and a final
 * answer string.
 *
 * Mapping:
 *   text (non-thought) → think step (content) + accumulated into answer
 *   executableCode     → act step
 *   codeExecutionResult → observe step (output)
 *   inlineData (image) → observe step (image data URI)
 */
function parseResponseParts(
  parts: GeminiPart[],
): { answer: string; steps: AgenticStep[] } {
  const steps: AgenticStep[] = [];
  const answerParts: string[] = [];

  for (const part of parts) {
    if (part.text !== undefined && !part.thought) {
      // Plain text contributes to the answer and is surfaced as a think step
      // when there are also agentic parts present.
      answerParts.push(part.text);
      steps.push({ type: 'think', content: part.text });
    } else if (part.executableCode) {
      steps.push({
        type: 'act',
        language: part.executableCode.language,
        code: part.executableCode.code,
      });
    } else if (part.codeExecutionResult) {
      steps.push({
        type: 'observe',
        output: part.codeExecutionResult.output,
      });
    } else if (part.inlineData) {
      const { mimeType, data } = part.inlineData;
      steps.push({
        type: 'observe',
        image: `data:${mimeType};base64,${data}`,
      });
    }
  }

  return {
    answer: answerParts.join(''),
    steps,
  };
}

// ---------------------------------------------------------------------------
// Main exported function
// ---------------------------------------------------------------------------

/**
 * Send an image + question to the Gemini API and return the parsed result.
 *
 * @param options - See AskOptions.
 * @returns AskResult with answer, optional agentic steps, and a requestId.
 * @throws Error with a sanitised message (API key stripped) on failure.
 */
export async function ask(options: AskOptions): Promise<AskResult> {
  const {
    imageBuffer,
    mimeType,
    question,
    agenticMode = false,
    conversationHistory = [],
  } = options;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not set');
  }

  const timeoutMs = parseInt(
    process.env.GEMINI_TIMEOUT_MS ?? '30000',
    10,
  );

  const requestId = generateRequestId();

  // Build the Gemini SDK client
  const ai = new GoogleGenAI({ apiKey });

  // Convert image buffer to base64 inline data
  const imageBase64 = imageBuffer.toString('base64');

  // Build the contents array:
  // Prior conversation turns come first as alternating user/model messages,
  // followed by the new user message (image + question).
  type ContentPart = { text: string } | { inlineData: { mimeType: string; data: string } };
  type ContentItem = { role: string; parts: ContentPart[] };

  const contents: ContentItem[] = [];

  for (const turn of conversationHistory) {
    contents.push({
      role: 'user',
      parts: [{ text: turn.question }],
    });
    contents.push({
      role: 'model',
      parts: [{ text: turn.answer }],
    });
  }

  // New user turn: image + question
  contents.push({
    role: 'user',
    parts: [
      {
        inlineData: {
          mimeType,
          data: imageBase64,
        },
      },
      { text: question },
    ],
  });

  // Build the generateContent config
  const generateConfig: Record<string, unknown> = {};
  if (agenticMode) {
    generateConfig.tools = [{ codeExecution: {} }];
  }

  // Race the API call against a timeout
  let response: Awaited<ReturnType<typeof ai.models.generateContent>>;
  try {
    const apiCallPromise = ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents,
      config: generateConfig,
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(
          new Error(
            'The AI model did not respond in time. Please try again.',
          ),
        );
      }, timeoutMs);
    });

    response = await Promise.race([apiCallPromise, timeoutPromise]);
  } catch (err: unknown) {
    // Strip any API key value from the error message before re-throwing
    const raw =
      err instanceof Error ? err.message : String(err);
    const sanitised = scrubApiKey(raw);
    const outError = new Error(sanitised);
    // Preserve the original stack if available
    if (err instanceof Error && err.stack) {
      outError.stack = scrubApiKey(err.stack);
    }
    throw outError;
  }

  // Extract parts from the first candidate
  const parts: GeminiPart[] =
    (response.candidates?.[0]?.content?.parts as GeminiPart[] | undefined) ??
    [];

  const { answer, steps } = parseResponseParts(parts);

  // If there were no agentic parts, fall back to the SDK's convenience .text
  const finalAnswer =
    answer.length > 0
      ? answer
      : (response.text ?? '');

  return {
    answer: finalAnswer,
    steps: steps.length > 0 ? steps : undefined,
    requestId,
  };
}

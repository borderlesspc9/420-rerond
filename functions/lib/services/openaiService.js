"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initOpenAI = initOpenAI;
exports.buildFileInput = buildFileInput;
exports.buildTextInput = buildTextInput;
exports.analyze = analyze;
const openai_1 = __importDefault(require("openai"));
let client = null;
function initOpenAI(apiKey) {
    client = new openai_1.default({ apiKey });
}
function getClient() {
    if (!client) {
        throw new Error("OpenAI não inicializado. Chame initOpenAI primeiro.");
    }
    return client;
}
function buildFileInput(filename, buffer) {
    const base64 = buffer.toString("base64");
    return {
        type: "input_file",
        filename,
        file_data: `data:application/pdf;base64,${base64}`,
    };
}
function buildTextInput(text) {
    return { type: "input_text", text };
}
async function analyze(parts, options) {
    const ai = getClient();
    const maxTokens = options?.maxOutputTokens ?? 8000;
    const temperature = options?.temperature ?? 0.1;
    const response = await ai.responses.create({
        model: "gpt-4o",
        input: [
            {
                role: "user",
                content: parts,
            },
        ],
        max_output_tokens: maxTokens,
        temperature,
        ...(options?.jsonMode
            ? {
                text: {
                    format: { type: "json_object" },
                },
            }
            : {}),
    });
    const content = response.output_text;
    if (!content) {
        throw new Error("OpenAI não retornou resposta.");
    }
    return {
        content,
        model: response.model,
        tokensUsed: response.usage?.total_tokens ?? undefined,
    };
}
//# sourceMappingURL=openaiService.js.map
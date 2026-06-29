import "server-only";
import { asc, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { chatMessages } from "@/db/schema";
import { portkey, coachModel } from "./client";
import { buildSystemPrompt } from "./context";
import { TOOL_DEFS, runTool } from "./tools";

/* eslint-disable @typescript-eslint/no-explicit-any */

const MAX_HISTORY = 20;
const MAX_TOOL_ROUNDS = 6;

export type ChatResult = {
  reply: string;
  actions: string[]; // tool names executed this turn (for inline UI hints)
};

/** Load recent persisted transcript as OpenAI-format messages. */
async function loadHistory(
  userId: number,
): Promise<{ role: string; content: string }[]> {
  const rows = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.userId, userId))
    .orderBy(desc(chatMessages.createdAt))
    .limit(MAX_HISTORY);
  return rows
    .reverse()
    .map((m) => ({ role: m.role, content: m.content }));
}

/** Run one coach turn: persist the user message, call Claude (with tools),
 *  execute any tool calls, persist + return the assistant reply. */
export async function runChat(
  userId: number,
  userText: string,
): Promise<ChatResult> {
  const text = userText.trim();
  if (!text) return { reply: "", actions: [] };

  await db.insert(chatMessages).values({ userId, role: "user", content: text });

  const { prompt, profile } = await buildSystemPrompt(userId);
  const history = await loadHistory(userId);

  const messages: any[] = [
    { role: "system", content: prompt },
    ...history,
  ];

  const client = portkey();
  const model = coachModel(profile.model);
  const actions: string[] = [];
  let reply = "";

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const res: any = await client.chat.completions.create({
      model,
      max_tokens: 1200,
      messages,
      tools: TOOL_DEFS,
    });
    const msg = res.choices?.[0]?.message;
    if (!msg) break;

    const toolCalls = msg.tool_calls as any[] | undefined;
    if (toolCalls && toolCalls.length) {
      // record the assistant's tool-call message, then each tool result
      messages.push({
        role: "assistant",
        content: msg.content ?? "",
        tool_calls: toolCalls,
      });
      for (const tc of toolCalls) {
        const name = tc.function?.name;
        let parsed: Record<string, unknown> = {};
        try {
          parsed = tc.function?.arguments
            ? JSON.parse(tc.function.arguments)
            : {};
        } catch {
          parsed = {};
        }
        actions.push(name);
        let result: unknown;
        try {
          result = await runTool(name, parsed, userId);
        } catch (e) {
          result = { ok: false, message: e instanceof Error ? e.message : "tool error" };
        }
        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify(result),
        });
      }
      continue; // let the model respond to the tool results
    }

    reply = (msg.content ?? "").toString().trim();
    break;
  }

  if (reply) {
    await db
      .insert(chatMessages)
      .values({ userId, role: "assistant", content: reply });
  }
  // tool actions may have changed workouts/memory/config
  if (actions.length) {
    revalidatePath("/coach");
    revalidatePath("/calendar");
  }

  return { reply, actions };
}

/** Full persisted transcript (oldest first) for rendering the chat page. */
export async function getTranscript(userId: number) {
  return db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.userId, userId))
    .orderBy(asc(chatMessages.createdAt));
}

export async function clearTranscript(userId: number) {
  await db.delete(chatMessages).where(eq(chatMessages.userId, userId));
  revalidatePath("/coach");
}

import Anthropic from "@anthropic-ai/sdk";

function getClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

interface RecommendationInput {
  profileName: string;
  likedBooks: { title: string; author: string; series?: string | null }[];
}

export async function getBookRecommendations(input: RecommendationInput) {
  const client = getClient();
  const { profileName, likedBooks } = input;

  const bookList = likedBooks
    .map(
      (b) =>
        `- "${b.title}" by ${b.author}${b.series ? ` (${b.series} series)` : ""}`
    )
    .join("\n");

  const msg = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system: `You are a children's book expert helping recommend books for young readers.
Give specific, enthusiastic recommendations kids will love. Respond with valid JSON only.`,
    messages: [
      {
        role: "user",
        content: `${profileName} loved these books:\n${bookList}\n\nRecommend 6 books or series they would enjoy.

Respond with this exact JSON (no markdown):
{
  "recommendations": [
    {
      "title": "Book Title",
      "author": "Author Name",
      "series_name": "Series Name or null",
      "reason": "Fun 1-2 sentence reason why they'll love it"
    }
  ]
}`,
      },
    ],
  });

  const content = msg.content[0];
  if (content.type !== "text") throw new Error("Unexpected response");

  try {
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : content.text);
    return parsed.recommendations || [];
  } catch {
    return [];
  }
}

interface NewReleaseInput {
  seriesName: string;
  author: string;
  currentBookCount: number;
}

export async function checkForNewRelease(input: NewReleaseInput) {
  const client = getClient();
  const { seriesName, author, currentBookCount } = input;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools: any[] = [{ type: "web_search_20250305", name: "web_search" }];

  const msg = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    tools,
    messages: [
      {
        role: "user",
        content: `Search the web: how many books are currently published in the "${seriesName}" series by ${author}? We currently track ${currentBookCount} books.

After searching, respond with ONLY this JSON (no other text):
{
  "has_more": true or false,
  "total_known": <total books in series as a number>,
  "next_book": { "title": "exact title of the first book beyond what we track", "release_info": "release date or availability info if found" } or null
}`,
      },
    ],
  });

  // With web_search the content may include tool_use/tool_result blocks — find the text block
  const textBlock = msg.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") return null;

  try {
    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch ? jsonMatch[0] : textBlock.text);
  } catch {
    return null;
  }
}

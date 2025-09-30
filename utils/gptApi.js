// utils/gptApi.js
import { getChatGPTKey } from "../utils/firestore";

export const getAIFeedback = async (statsJSON) => {
  try {
    const apiKey = await getChatGPTKey();
    if (!apiKey) {
      throw new Error("ChatGPT API key not found");
    }
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`, 
      },
      body: JSON.stringify({
        model: "gpt-5-chat-latest",
        input: `Act as a driving safety coach.
        Stats (30 days): ${JSON.stringify(statsJSON)}

        Thresholds:
        - Speeding Margin: <3=excellent; 3–7=fair; >7=risky
        - Sudden Stops: <10=safe; 10–20=moderate; >20=risky
        - Sudden Accels: same as stops
        - Distance: <100mi → mention data may be insufficient

        Output JSON only:
        {
          "score": 0-100,
          "summary": "1-2 sentences on strengths/weaknesses (mention 30 days)",
          "tips": ["5-10 concise tips referencing stats, casual/constructive"]
        }

        Rules:
        - Don’t use variable names (e.g. no "avgSpeedingMargin")
        - Must cite actual numbers (e.g. "22 hard stops")
        - Be encouraging
        - No text outside JSON`

      }),
    });

    const data = await response.json();

    let text = "";
    if (data.output_text) text = data.output_text;
    else if (data.output && Array.isArray(data.output)) {
      const item = data.output.find(i => i.content);
      const textPart = item?.content?.find(c => c.type === "output_text" || c.type === "text");
      if (textPart?.text) text = textPart.text;
    }

    if (!text) return null;

    try {
      const cleaned = text
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .trim();
      return JSON.parse(cleaned);
    } catch (err) {
      console.error("Failed to parse AI JSON:", text, err);
      return null;
    }
  } catch (error) {
    console.error("Error fetching AI feedback:", error);
    throw error;
  }
};

export const getRoadConditionSummary = async (metrics) => {
  try {
    const apiKey = await getChatGPTKey();
    if (!apiKey) {
      throw new Error("ChatGPT API key not found");
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-5-nano",
        input: `You are evaluating road conditions.
        Metrics: ${JSON.stringify(metrics)}

        Return ONLY valid JSON in this schema, use commas to separate phrases:
        {
          "summary": "3-6 words about conditions",
          "score": 1-5 (1 = very dangerous, 5 = very safe)
        }`,
        reasoning: {effort: "minimal"},
      }),
    });

    const data = await response.json();

    let text = "";
    if (data.output_text) text = data.output_text.trim();
    else if (data.output && Array.isArray(data.output)) {
      const item = data.output.find(i => i.content);
      const textPart = item?.content?.find(
        c => c.type === "output_text" || c.type === "text"
      );
      if (textPart?.text) text = textPart.text.trim();
    }

    if (!text) return null;

    try {
      return JSON.parse(text); // { summary, score }
    } catch (err) {
      console.error("Failed to parse GPT JSON:", text, err);
      return null;
    }
  } catch (error) {
    console.error("Error fetching road condition summary:", error);
    throw error;
  }
};

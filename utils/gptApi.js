// utils/gptApi.js
import { getChatGPTKey } from "../utils/firestore";

export const getAIFeedback = async (statsJSON) => {
  try {
    const apiKey = await getChatGPTKey();
    if (!apiKey) {
      throw new Error("ChatGPT API key not found in Firestore");
    }
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`, 
      },
      body: JSON.stringify({
        model: "gpt-5-mini",
        input: `You are an expert driving safety coach.
Here is a JSON of my driving statistics: ${JSON.stringify(statsJSON)}

Please respond ONLY in valid JSON with the following format:

{
  "score": 0-100,
  "summary": "A brief sentence or two describing what the user does well and what needs improvement",
  "tips": [
    "Tip 1",
    "Tip 2",
    "Tip 3",
    "Tip 4",
    "Tip 5"
  ]
}

for the tips section, there should be 5-10 tips, and each tip should be a brief sentence or two describing actions the user can take or things to take note of to improve their driving safety. 
Be concise, casual, and constructive. Do not include any extra text outside the JSON.`,
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
      return JSON.parse(text);
    } catch (err) {
      console.error("Failed to parse AI JSON:", text, err);
      return null;
    }
  } catch (error) {
    console.error("Error fetching AI feedback:", error);
    throw error;
  }
};
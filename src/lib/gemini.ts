import { GoogleGenAI, Type } from "@google/genai";
import { PlanItem, ExcelRow } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function analyzeExcelData(data: ExcelRow[]): Promise<Partial<PlanItem>[]> {
  const prompt = `
    Analyze the following data extracted from an Excel file and map it to a list of planning items.
    Each item should have:
    - title: A short, descriptive title.
    - description: A more detailed explanation.
    - date: The date (YYYY-MM-DD format if possible).
    - priority: One of "Low", "Medium", "High".
    - category: A general category for the task.

    Excel Data (JSON):
    ${JSON.stringify(data.slice(0, 50))} // Limit to first 50 rows for token efficiency

    Return only a JSON array of objects matching the schema.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              date: { type: Type.STRING },
              priority: { type: Type.STRING, enum: ["Low", "Medium", "High"] },
              category: { type: Type.STRING },
            },
            required: ["title", "description", "date", "priority", "category"],
          },
        },
      },
    });

    const result = JSON.parse(response.text || "[]");
    return result;
  } catch (error) {
    console.error("AI Analysis failed:", error);
    return [];
  }
}

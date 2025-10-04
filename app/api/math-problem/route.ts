import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { supabase } from "@/utils/supabase";

// 1. Initialize Gemini Client
// The GOOGLE_API_KEY must be set in your server environment (e.g., .env.local)
const apiKey = process.env.GOOGLE_API_KEY;

if (!apiKey) {
  throw new Error("GOOGLE_API_KEY environment variable is not set.");
}

// FIX: Initialize with the apiKey inside an options object { apiKey: apiKey }
const ai = new GoogleGenAI({ apiKey });

// Define the required JSON structure for the Gemini response
const mathProblemSchema = {
  type: "OBJECT",
  properties: {
    problem_text: {
      type: "STRING",
      description: "The complete text of the math word problem.",
    },
    final_answer: {
      type: "NUMBER",
      description: "The correct numerical answer to the problem.",
    },
  },
  required: ["problem_text", "final_answer"],
};

export async function POST(req: NextRequest) {
  try {
    // 2. Define the System Instruction for context
    const systemInstruction =
      "You are a specialized math problem generator. Your sole task is to generate a single Primary 5 (Singapore equivalent) math word problem and its final answer. The generated problem MUST involve numerical calculations and be solvable. Respond only with the requested JSON format, using standard text and ASCII characters for fractions (e.g., 3/5) to ensure readability.";

    // 3. Call the Gemini API for Structured Output
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [{ text: "Generate a new math word problem." }],
        },
      ],
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: mathProblemSchema as any, // Cast is needed for GoogleGenAI typing
      },
    });

    // 4. Parse the JSON string output from the model
    const jsonString = response.text.trim();
    const problemData = JSON.parse(jsonString);

    // 5. Save the generated problem to Supabase
    const { data, error } = await supabase
      .from("problems") // Assuming a table named 'problems'
      .insert([problemData])
      .select()
      .single();

    if (error) {
      console.error("Supabase Error:", error);
      return NextResponse.json(
        { error: "Failed to save problem to database." },
        { status: 500 }
      );
    }

    // 6. Return the problem data and the new ID (sessionId) to the client
    const responseData = {
      problem_text: data.problem_text,
      final_answer: data.final_answer, // Note: We should avoid sending final_answer to client later, but for now we keep it for debugging
      sessionId: data.id, // Supabase uses 'id' by default
    };

    return NextResponse.json(responseData, { status: 200 });
  } catch (e) {
    console.error("API Processing Error:", e);
    return NextResponse.json(
      { error: "An error occurred during problem generation or processing." },
      { status: 500 }
    );
  }
}

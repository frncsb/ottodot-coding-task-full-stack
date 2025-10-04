import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { supabase } from "@/lib/supabaseClient";

// 1. Initialize Gemini Client
const apiKey = process.env.GOOGLE_API_KEY;

if (!apiKey) {
  throw new Error("GOOGLE_API_KEY environment variable is not set.");
}

const ai = new GoogleGenAI({ apiKey });

// Define the required JSON structure for the Gemini response
const mathProblemSchema = {
  type: "OBJECT",
  properties: {
    // Note: Mapped to problem_text in the JSON output
    problem_text: {
      type: "STRING",
      description: "The complete text of the math word problem.",
    },
    // Note: Mapped to correct_answer in the Supabase table
    correct_answer: {
      type: "NUMBER",
      description: "The correct numerical answer to the problem.",
    },
  },
  required: ["problem_text", "correct_answer"],
};

// NEW: Helper function to create the system instruction based on difficulty
function createSystemInstruction(difficulty: string) {
  let complexityHint = "";
  switch (difficulty.toLowerCase()) {
    case "easy":
      // Easy problems focus on basic operations and small numbers
      complexityHint =
        "The problem should primarily involve single-step addition or subtraction with small whole numbers. Avoid complex fractions or multiple operations.";
      break;
    case "hard":
      // Hard problems require multi-step logic and complex numbers
      complexityHint =
        "The problem MUST involve multiple steps, require converting between units (e.g., time, mass, money, or units of length), and heavily use fractions, decimals, and percentages in a combined scenario.";
      break;
    case "medium":
    default:
      // Medium problems use a balance of complexity
      complexityHint =
        "The problem should involve 2-3 steps, often combining multiplication/division with addition/subtraction, or include straightforward operations with simple fractions/decimals.";
      break;
  }

  return `
    You are a specialized math problem generator. Your sole task is to generate a single Primary 5 (Singapore equivalent) math word problem and its final answer. 

    Requirements: 
    - ${complexityHint}
    - The problem MUST be varied in topic and can involve whole numbers, addition, subtraction, multiplication, division, fractions, decimals, or percentages. 
    - The problem must be solvable and realistic for a Primary 5 student. 
    - Use standard text and ASCII characters for mathematical notation (e.g., 3/5, 2.75, 40%). 
    - Respond ONLY in the following JSON format.
  `;
}

export async function POST(req: NextRequest) {
  try {
    // 1. Receive difficulty from the request body
    const { difficulty } = await req.json();

    // 2. Define the System Instruction based on difficulty
    const currentDifficulty = difficulty || "Medium";
    const systemInstruction = createSystemInstruction(currentDifficulty);

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
        responseSchema: mathProblemSchema as any,
      },
    });

    // 4. Parse the JSON string output from the model
    const jsonString = response.text.trim();
    const problemData = JSON.parse(jsonString);

    // 5. Save the generated problem to Supabase
    // Using the correct table name 'math_problem_sessions'
    // NOTE: The 'difficulty' field is not saved to the DB in this version.
    // If you want to save it, you must add a 'difficulty' column to your 'math_problem_sessions' table.
    const { data, error } = await supabase
      .from("math_problem_sessions")
      .insert([problemData])
      .select()
      .single();

    if (error) {
      console.error("Supabase Insert Error:", error);
      return NextResponse.json(
        { error: "Failed to save problem to database." },
        { status: 500 }
      );
    }

    // 6. Return the problem data, ID, AND the difficulty used to the client
    const responseData = {
      problem_text: data.problem_text,
      final_answer: data.correct_answer, // Map the Supabase 'correct_answer' back to client's 'final_answer'
      sessionId: data.id, // Supabase uses 'id' by default
      difficulty: currentDifficulty, // Return the difficulty used for frontend display
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

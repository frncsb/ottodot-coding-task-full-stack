import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { supabase } from "@/lib/supabaseClient";

// 1. Initialize Gemini Client
const apiKey = process.env.GOOGLE_API_KEY;

if (!apiKey) {
  throw new Error("GOOGLE_API_KEY environment variable is not set.");
}

const ai = new GoogleGenAI({ apiKey });

// Define the expected structure for the incoming request
interface SubmissionRequestBody {
  sessionId: string;
  userAnswer: number;
}

/**
 * Generates the detailed, step-by-step solution for an incorrect submission.
 */
async function generateDetailedSolution(
  problemText: string,
  correctAnswer: number
): Promise<string> {
  const solutionInstruction = `
    You are a math solver. Your task is to provide the full, step-by-step solution to the problem.
    
    Instructions:
    1. Output the steps as a numbered list, showing **only the calculations strictly required** to reach the final answer.
    2. ONLY use numbers and basic arithmetic symbols (+, -, *, /) in the steps.
    3. DO NOT use any words, descriptions, or labels.
    4. Use the following format for each step: <calculation> = <result>.
    5. The result of the final step must exactly match the Correct Answer provided.
    
    Example of a two-step solution:
    1. 3.5 - 0.8 = 2.7
    2. 2.7 / 5 = 0.54
    
    Problem: ${problemText}
    Correct Answer: ${correctAnswer}
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: solutionInstruction }] }],
    });
    return response.text.trim();
  } catch (error) {
    console.error("Error generating detailed solution:", error);
    return "Error generating steps.";
  }
}

export async function POST(req: NextRequest) {
  try {
    const { sessionId, userAnswer }: SubmissionRequestBody = await req.json();

    if (!sessionId || typeof userAnswer !== "number") {
      return NextResponse.json(
        { error: "Invalid session ID or answer format." },
        { status: 400 }
      );
    } // A. Retrieve the original problem data (including the correct answer)

    const { data: problemSession, error: fetchError } = await supabase
      .from("math_problem_sessions")
      .select("problem_text, correct_answer")
      .eq("id", sessionId)
      .single();

    if (fetchError || !problemSession) {
      console.error("Supabase Fetch Error:", fetchError);
      return NextResponse.json(
        { error: "Problem session not found." },
        { status: 404 }
      );
    }

    const { problem_text, correct_answer } = problemSession; // Check for correctness (allowing for float comparison precision by rounding slightly)

    const isCorrect = Math.abs(userAnswer - correct_answer) < 0.0001;

    let detailedSolution = ""; // Conditional generation of detailed steps ONLY if the answer is incorrect

    if (!isCorrect) {
      detailedSolution = await generateDetailedSolution(
        problem_text,
        correct_answer
      );
    } // B. Generate AI Feedback (standard, concise feedback)

    const feedbackInstruction = `
      You are an encouraging and helpful math tutor. Generate personalized feedback based on the user's attempt.
      
      Instructions:
      1. Keep the feedback concise (max 3 sentences).
      2. Maintain a positive and supportive tone, regardless of correctness.
      3. If the answer is correct, give a simple confirmation and praise.
      4. If the answer is incorrect, gently explain a small hint or suggest a step they might have missed without giving away the full solution.
      
      Problem: ${problem_text}
      Correct Answer: ${correct_answer}
      User's Answer: ${userAnswer}
      Result: ${isCorrect ? "CORRECT" : "INCORRECT"}
    `;

    const feedbackResponse = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: feedbackInstruction }] }],
    });

    const feedbackText = feedbackResponse.text.trim(); // C. Save the submission to the database

    const submissionData = {
      session_id: sessionId,
      user_answer: userAnswer,
      is_correct: isCorrect,
      feedback_text: feedbackText, // SAVE detailedSolution
      detailed_solution: detailedSolution,
    };

    const { error: insertError } = await supabase
      .from("math_problem_submissions")
      .insert([submissionData]);

    if (insertError) {
      console.error("Supabase Submission Insert Error:", insertError); // Log the error but continue to return the feedback
    } // D. Return the result to the client

    return NextResponse.json(
      {
        isCorrect,
        feedback: feedbackText,
        correctAnswer: correct_answer, // RETURN detailedSolution
        detailedSolution: detailedSolution,
      },
      { status: 200 }
    );
  } catch (e) {
    console.error("Submission API Error:", e);
    return NextResponse.json(
      {
        error:
          "An error occurred during answer submission or feedback generation.",
      },
      { status: 500 }
    );
  }
}

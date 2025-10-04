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

export async function POST(req: NextRequest) {
  try {
    const { sessionId, userAnswer }: SubmissionRequestBody = await req.json();

    if (!sessionId || typeof userAnswer !== "number") {
      return NextResponse.json(
        { error: "Invalid session ID or answer format." },
        { status: 400 }
      );
    }

    // A. Retrieve the original problem data (including the correct answer)
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

    const { problem_text, correct_answer } = problemSession;

    // Check for correctness (allowing for float comparison precision by rounding slightly)
    const isCorrect = Math.abs(userAnswer - correct_answer) < 0.0001;

    // B. Generate AI Feedback
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

    const feedbackText = feedbackResponse.text.trim();

    // C. Save the submission to the database
    const submissionData = {
      session_id: sessionId,
      user_answer: userAnswer,
      is_correct: isCorrect,
      feedback_text: feedbackText,
    };

    const { error: insertError } = await supabase
      .from("math_problem_submissions")
      .insert([submissionData]);

    if (insertError) {
      console.error("Supabase Submission Insert Error:", insertError);
      // Log the error but continue to return the feedback
    }

    // D. Return the result to the client
    return NextResponse.json(
      {
        isCorrect,
        feedback: feedbackText,
        correctAnswer: correct_answer,
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

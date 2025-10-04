"use client";

import { useState, useEffect } from "react";

type Difficulty = "Easy" | "Medium" | "Hard";

// Matches the data returned by the /api/math-problem route
interface MathProblem {
  problem_text: string;
  final_answer: number;
  sessionId: string;
  difficulty: Difficulty; // Now includes difficulty
}

export default function Home() {
  const [problem, setProblem] = useState<MathProblem | null>(null);
  const [userAnswer, setUserAnswer] = useState("");
  const [feedback, setFeedback] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);

  // NEW GAMIFICATION STATES
  const [difficulty, setDifficulty] = useState<Difficulty>("Medium");
  const [score, setScore] = useState(0);
  const scoreQuota = 5; // e.g., complete 5 problems for a badge/level
  const progressPercent = Math.min((score / scoreQuota) * 100, 100);

  // Audio control for simple background music
  useEffect(() => {
    // Using a free looping audio track URL for demonstration
    const audio = document.getElementById("bkg-music") as HTMLAudioElement;
    if (audio) {
      audio.volume = 0.1; // Low volume background music
      audio.loop = true;
      // Autoplay can be blocked, so we try to play it once user interacts (e.g., clicks generate)
    }
  }, []);

  const generateProblem = async () => {
    setIsLoading(true);
    setProblem(null);
    setUserAnswer("");
    setFeedback("");
    setIsCorrect(null);

    try {
      const response = await fetch("/api/math-problem", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        // PASS DIFFICULTY TO THE API
        body: JSON.stringify({ difficulty }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate problem.");
      }

      // Ensure the data type includes the difficulty returned from the API
      const data: Omit<MathProblem, "final_answer"> & {
        final_answer: number;
        difficulty: Difficulty;
      } = await response.json();

      // Attempt to play music on user interaction
      const audio = document.getElementById("bkg-music") as HTMLAudioElement;
      if (audio && audio.paused) {
        audio.play().catch((e) => console.log("Autoplay blocked:", e));
      }

      // Update state with the newly generated problem and session ID
      setProblem({
        problem_text: data.problem_text,
        final_answer: data.final_answer,
        sessionId: data.sessionId,
        difficulty: data.difficulty,
      });
      setSessionId(data.sessionId);
    } catch (error) {
      console.error("Error generating problem:", error);
      setFeedback("Error: Could not generate a new problem.");
    } finally {
      setIsLoading(false);
    }
  };

  const submitAnswer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionId || !problem) return;

    setIsLoading(true);
    setFeedback("");

    try {
      const response = await fetch("/api/math-submission", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId: sessionId,
          // Convert input string to number
          userAnswer: parseFloat(userAnswer),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to submit answer.");
      }

      const data = await response.json();

      const correct = data.isCorrect;

      // SCORE UPDATE: Increment score on correct answer
      if (correct) {
        setScore((prev) => prev + 1);
      }

      // Update state with feedback from the API
      setIsCorrect(correct);
      setFeedback(data.feedback);

      // Clear the input field after submission
      setUserAnswer("");
    } catch (error) {
      console.error("Error submitting answer:", error);
      setFeedback("Error: Failed to submit answer and receive feedback.");
      setIsCorrect(false);
    } finally {
      setIsLoading(false);
    }
  };

  const difficultyClasses = (level: Difficulty) => {
    const base =
      "px-4 py-2 rounded-full font-semibold transition-all duration-300 ";
    if (level === difficulty) {
      switch (level) {
        case "Easy":
          return base + "bg-green-500 text-white shadow-md";
        case "Medium":
          return base + "bg-yellow-500 text-white shadow-md";
        case "Hard":
          return base + "bg-red-500 text-white shadow-md";
      }
    }
    return base + "bg-gray-200 text-gray-700 hover:bg-gray-300";
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white font-sans">
      {/* MUSIC ELEMENT */}
      <audio
        id="bkg-music"
        src="https://www.learningcontainer.com/wp-content/uploads/2020/02/Sample-MP3-File-Download.mp3"
        preload="auto"
      />

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <h1 className="text-4xl font-extrabold text-center mb-4 text-gray-800 flex items-center justify-center">
          <span role="img" aria-label="brain" className="mr-3 text-4xl">
            🧠
          </span>
          Math Mastery Pad
        </h1>

        {/* SCORE AND PROGRESS BAR (Duolingo Inspired) */}
        <div className="bg-white rounded-xl shadow-inner p-4 mb-6 border border-gray-100">
          <div className="flex justify-between items-center mb-2">
            <span className="text-lg font-bold text-gray-700">
              Current Score: {score} / {scoreQuota}
            </span>
            <span
              className={`text-sm font-semibold ${
                score >= scoreQuota ? "text-blue-600" : "text-gray-500"
              }`}
            >
              {score >= scoreQuota ? "🎯 Goal Reached!" : "Keep Going!"}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="h-3 rounded-full transition-all duration-500 ease-out"
              style={{
                width: `${progressPercent}%`,
                backgroundColor: score >= scoreQuota ? "#3B82F6" : "#FBBF24",
              }}
            ></div>
          </div>
        </div>

        {/* DIFFICULTY SELECTOR */}
        <div className="bg-white rounded-xl shadow-lg p-4 mb-6 flex justify-around border-t-4 border-blue-500">
          <button
            onClick={() => setDifficulty("Easy")}
            className={difficultyClasses("Easy")}
          >
            Easy
          </button>
          <button
            onClick={() => setDifficulty("Medium")}
            className={difficultyClasses("Medium")}
          >
            Medium
          </button>
          <button
            onClick={() => setDifficulty("Hard")}
            className={difficultyClasses("Hard")}
          >
            Hard
          </button>
        </div>

        {/* GENERATE BUTTON - Now uses the selected difficulty */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6 border-b-4 border-blue-500">
          <button
            onClick={generateProblem}
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-3 px-4 rounded-lg transition duration-200 ease-in-out transform hover:scale-105"
          >
            {isLoading && !problem
              ? "Generating..."
              : `Generate ${difficulty} Problem`}
          </button>
        </div>

        {problem && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6 border border-gray-200">
            <div className="text-sm font-medium text-blue-500 mb-2">
              Difficulty:{" "}
              <span
                className={`font-semibold ${
                  problem.difficulty === "Hard"
                    ? "text-red-600"
                    : problem.difficulty === "Medium"
                    ? "text-yellow-600"
                    : "text-green-600"
                }`}
              >
                {problem.difficulty}
              </span>
            </div>

            <h2 className="text-xl font-semibold mb-4 text-gray-700">
              Problem:
            </h2>
            <p className="text-xl text-gray-800 leading-relaxed mb-6 p-4 bg-gray-50 rounded-lg border border-gray-100">
              {problem.problem_text}
            </p>

            <form onSubmit={submitAnswer} className="space-y-4">
              <div>
                <label
                  htmlFor="answer"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Your Answer:
                </label>
                <input
                  type="number"
                  id="answer"
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-lg"
                  placeholder="Enter your answer"
                  required
                  // Disable input if feedback has already been received
                  disabled={!!feedback || isLoading}
                />
              </div>

              <button
                type="submit"
                disabled={!userAnswer || isLoading || !!feedback}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-bold py-3 px-4 rounded-lg transition duration-200 ease-in-out transform hover:scale-105"
              >
                {isLoading && problem ? "Checking..." : "Submit Answer"}
              </button>
            </form>
          </div>
        )}

        {feedback && (
          <div
            className={`rounded-xl shadow-xl p-6 border-l-8 ${
              isCorrect
                ? "bg-green-50 border-green-500"
                : "bg-red-50 border-red-500"
            }`}
          >
            <h2
              className={`text-2xl font-bold mb-3 ${
                isCorrect ? "text-green-700" : "text-red-700"
              }`}
            >
              {isCorrect ? "✅ Great Job! Correct!" : "❌ Keep Trying!"}
            </h2>
            <p className="text-gray-800 leading-relaxed text-lg">{feedback}</p>
            {!isCorrect && (
              <p className="mt-3 text-sm text-gray-600">
                The correct answer was:{" "}
                <span className="font-semibold">{problem?.final_answer}</span>
              </p>
            )}

            {/* Duolingo-style 'Next Problem' button */}
            <button
              onClick={generateProblem}
              disabled={isLoading}
              className="mt-6 w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-3 px-4 rounded-lg transition duration-200 ease-in-out transform hover:scale-105"
            >
              Continue to Next Problem
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";

type Difficulty = "Easy" | "Medium" | "Hard";

interface MathProblem {
  problem_text: string;
  final_answer: number;
  sessionId: string;
  difficulty: Difficulty;
}

export default function Home() {
  const [problem, setProblem] = useState<MathProblem | null>(null);
  const [userAnswer, setUserAnswer] = useState("");
  const [feedback, setFeedback] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);

  const [detailedSolution, setDetailedSolution] = useState<string>("");
  const [showSteps, setShowSteps] = useState(false);

  const [difficulty, setDifficulty] = useState<Difficulty>("Easy");
  const [score, setScore] = useState(0);
  const scoreQuota = 5;
  const progressPercent = Math.min((score / scoreQuota) * 100, 100);

  const generateProblem = async () => {
    setIsLoading(true);
    setProblem(null);
    setUserAnswer("");
    setFeedback("");
    setIsCorrect(null);
    setDetailedSolution("");
    setShowSteps(false);

    try {
      const response = await fetch("/api/math-problem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ difficulty }),
      });

      if (!response.ok) throw new Error("Failed to generate problem.");

      const data = await response.json();
      setProblem(data);
      setSessionId(data.sessionId);
    } catch (error) {
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, userAnswer: parseFloat(userAnswer) }),
      });

      if (!response.ok) throw new Error("Failed to submit answer.");

      const data = await response.json();
      const correct = data.isCorrect;
      if (correct) setScore((prev) => prev + 1);

      setIsCorrect(correct);
      setFeedback(data.feedback);
      setDetailedSolution(data.detailedSolution);
      setUserAnswer("");
    } catch (error) {
      setFeedback("Error: Failed to submit answer.");
      setIsCorrect(false);
    } finally {
      setIsLoading(false);
    }
  };

  const difficultyClasses = (level: Difficulty) => {
    const base =
      "px-6 py-2 rounded-full font-semibold transition-all duration-300 shadow-sm";
    if (level === difficulty) {
      switch (level) {
        case "Easy":
          return `${base} bg-green-500 text-white shadow-lg scale-105`;
        case "Medium":
          return `${base} bg-yellow-500 text-white shadow-lg scale-105`;
        case "Hard":
          return `${base} bg-red-500 text-white shadow-lg scale-105`;
      }
    }
    return `${base} bg-gray-100 text-gray-700 hover:bg-gray-200 hover:shadow-md`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-100 via-white to-blue-50 font-sans">
      <main className="container mx-auto px-6 py-10 max-w-2xl">
        <h1 className="text-5xl font-extrabold text-center mb-8 text-gray-800 tracking-tight">
          Math Problem Generator
        </h1>

        {/* SCORE AND PROGRESS */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8 border border-gray-100">
          <div className="flex justify-between items-center mb-3">
            <span className="text-lg font-bold text-gray-700">
              Score: {score} / {scoreQuota}
            </span>
            <span
              className={`text-sm font-medium ${
                score >= scoreQuota ? "text-blue-600" : "text-gray-500"
              }`}
            >
              {score >= scoreQuota ? "🎯 Goal Reached!" : "Keep Going!"}
            </span>
          </div>
          <div className="w-full bg-gray-200 h-3 rounded-full overflow-hidden">
            <div
              className="h-3 rounded-full transition-all duration-500"
              style={{
                width: `${progressPercent}%`,
                backgroundColor: score >= scoreQuota ? "#3B82F6" : "#FACC15",
              }}
            ></div>
          </div>
        </div>

        {/* DIFFICULTY SELECTOR */}
        <div className="bg-white rounded-2xl shadow-md p-5 mb-8 border border-gray-100 flex justify-around">
          {["Easy", "Medium", "Hard"].map((lvl) => (
            <button
              key={lvl}
              onClick={() => setDifficulty(lvl as Difficulty)}
              className={difficultyClasses(lvl as Difficulty)}
            >
              {lvl}
            </button>
          ))}
        </div>

        {/* GENERATE BUTTON */}
        <div className="bg-white rounded-2xl shadow-md p-6 mb-8 border border-gray-100">
          <button
            onClick={generateProblem}
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 rounded-xl transition-transform duration-200 hover:scale-105 shadow-md"
          >
            {isLoading && !problem
              ? "Generating..."
              : `Generate ${difficulty} Problem`}
          </button>
        </div>

        {problem && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-8 border border-gray-100">
            <div className="text-sm font-semibold text-blue-500 mb-2">
              Difficulty:{" "}
              <span
                className={`$${
                  problem.difficulty === "Hard"
                    ? "text-red-600"
                    : problem.difficulty === "Medium"
                    ? "text-yellow-600"
                    : "text-green-600"
                } font-bold`}
              >
                {problem.difficulty}
              </span>
            </div>

            <h2 className="text-2xl font-bold text-gray-800 mb-4">Problem:</h2>
            <p className="text-lg bg-gray-50 border border-gray-100 rounded-xl p-4 shadow-inner text-gray-700 mb-6">
              {problem.problem_text}
            </p>

            <form onSubmit={submitAnswer} className="space-y-4">
              <div>
                <label
                  htmlFor="answer"
                  className="block text-sm font-medium text-gray-600 mb-2"
                >
                  Your Answer:
                </label>
                <input
                  type="number"
                  id="answer"
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent text-lg"
                  placeholder="Enter your answer"
                  disabled={!!feedback || isLoading}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={!userAnswer || isLoading || !!feedback}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-3 rounded-xl transition-transform duration-200 hover:scale-105 shadow-md"
              >
                {isLoading && problem ? "Checking..." : "Submit Answer"}
              </button>
            </form>
          </div>
        )}

        {feedback && (
          <div
            className={`rounded-2xl shadow-xl p-6 border-l-8 transition-all duration-300 ${
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
            <p className="text-gray-700 text-lg mb-4">{feedback}</p>

            {!isCorrect && (
              <div className="mt-4 mb-6 p-4 bg-red-100 rounded-xl border border-red-200 flex flex-col sm:flex-row sm:items-center sm:justify-between">
                <span className="text-lg text-gray-700">
                  Correct answer:{" "}
                  <span className="font-bold text-2xl text-red-700">
                    {problem?.final_answer}
                  </span>
                </span>

                <button
                  onClick={() => setShowSteps(!showSteps)}
                  className="mt-3 sm:mt-0 px-4 py-2 text-sm font-semibold rounded-lg text-white bg-red-600 hover:bg-red-700 transition duration-150 shadow-md"
                >
                  {showSteps ? "Hide Steps" : "Show Steps"}
                </button>
              </div>
            )}

            {showSteps && detailedSolution && (
              <div className="mt-4 p-5 bg-white border border-red-300 rounded-xl shadow-inner">
                <h3 className="text-xl font-bold text-red-700 mb-3">
                  Solution Steps:
                </h3>
                <pre className="whitespace-pre-wrap font-mono text-red-900 text-lg leading-relaxed">
                  {detailedSolution}
                </pre>
              </div>
            )}

            <button
              onClick={generateProblem}
              disabled={isLoading}
              className="mt-6 w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 rounded-xl transition-transform duration-200 hover:scale-105 shadow-md"
            >
              Continue to Next Problem
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

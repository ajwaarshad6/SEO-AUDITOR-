const { GoogleGenerativeAI } = require("@google/generative-ai");

// PASTE YOUR REAL KEY HERE
const YOUR_KEY = "AIzaSy..."; 

const MODELS = [
  "gemini-1.5-flash",
  "gemini-1.5-flash-001",
  "gemini-pro"
];

async function test() {
  const genAI = new GoogleGenerativeAI(YOUR_KEY);

  console.log("🔍 Testing multiple models...");

  for (const modelName of MODELS) {
    try {
      process.stdout.write(`Testing ${modelName}... `);
      const model = genAI.getGenerativeModel({ model: modelName });
      await model.generateContent("Hi");
      console.log("✅ WORKING");
    } catch (e) {
      console.log("❌ FAILED");
      // console.log(e.message); // Uncomment to see full error
    }
  }
}

test();
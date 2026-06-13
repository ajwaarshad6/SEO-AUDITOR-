// test-models.js
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

async function listModels() {
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
  try {
    // This requests the list of models YOUR key has access to
    const modelList = await genAI.getGenerativeModel({ model: "gemini-1.5-flash" }).apiKey; 
    // Note: The SDK doesn't have a simple "listModels" helper in older versions, 
    // but let's try the direct API call if the SDK fails.

    console.log("Checking API access...");
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GOOGLE_API_KEY}`);
    const data = await response.json();

    if (data.models) {
        console.log("\n✅ AVAILABLE MODELS FOR YOUR KEY:");
        data.models.forEach(m => {
            if(m.name.includes("gemini")) console.log(` - ${m.name.replace('models/', '')}`);
        });
    } else {
        console.error("❌ Error listing models:", data);
    }
  } catch (error) {
    console.error("❌ Script Error:", error);
  }
}

listModels();
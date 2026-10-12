
import os
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

api_key = os.getenv("OPENROUTER_API_KEY")

if not api_key:
    raise ValueError(
        "OPENROUTER_API_KEY not found. Check your .env file."
    )

client = OpenAI(
    api_key=api_key,
    base_url="https://openrouter.ai/api/v1",
)

response = client.chat.completions.create(
    model="openrouter/free",
    messages=[
        {
            "role": "user",
            "content": (
                "Explain the difference between PCB component "
                "detection and defect verification in simple terms."
            ),
        }
    ],
)

print("\n--- OpenRouter Response ---\n")
print(response.choices[0].message.content)

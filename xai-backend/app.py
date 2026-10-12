
import os

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from openai import OpenAI

load_dotenv()

app = FastAPI(
    title="PCBVision AI Explanation Service",
    version="1.0.0",
    description="Generates explanations from existing PCB inspection results.",
)

api_key = os.getenv("OPENROUTER_API_KEY")

client = (
    OpenAI(
        api_key=api_key,
        base_url="https://openrouter.ai/api/v1",
    )
    if api_key
    else None
)

MODEL = "openrouter/free"


class InspectionExplanationRequest(BaseModel):
    status: str = Field(
        description="Existing pipeline decision: PASS, FAIL, or UNVERIFIED"
    )
    board_type: str = "Unknown"
    detections: list[dict] = Field(default_factory=list)
    xmccv_results: list[dict] = Field(default_factory=list)
    xai_evidence: dict = Field(default_factory=dict)


class InspectionExplanationResponse(BaseModel):
    status: str
    explanation: str
    model: str


@app.get("/health")
def health():
    return {
        "status": "ok",
        "llm_configured": client is not None,
    }


@app.post(
    "/inspection/explain",
    response_model=InspectionExplanationResponse,
)
def explain_inspection(data: InspectionExplanationRequest):
    if client is None:
        raise HTTPException(
            status_code=503,
            detail="OPENROUTER_API_KEY is not configured.",
        )

    if data.status.upper() not in {"PASS", "FAIL", "UNVERIFIED"}:
        raise HTTPException(
            status_code=400,
            detail="Status must be PASS, FAIL, or UNVERIFIED.",
        )

    evidence = data.model_dump()
    prompt = f"""
You are PCBVision's PCB defect explanation assistant.

Explain the supplied inspection evidence clearly to a PCB inspection
operator.

Rules:
- The existing inspection pipeline is authoritative.
- Never change or reinterpret its PASS, FAIL, or UNVERIFIED decision.
- Do not invent components, defects, measurements, or confidence scores.
- Distinguish verified findings from possible causes.
- If evidence is insufficient, explicitly say so.
- If the result is FAIL, explain the supplied findings and suggest
  practical corrective actions only when supported by the evidence.
- If the result is PASS, explain the supplied evidence without
  inventing defects.
- Do not claim that you viewed a PCB image unless image evidence
  was actually provided and supported by the model.

Return a readable explanation with these sections:
1. Inspection summary
2. Detected findings
3. Why the findings matter
4. Possible causes, if supported
5. Recommended corrective actions
6. Verification steps

Inspection evidence (JSON):
{evidence}
"""

    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You provide evidence-grounded PCB inspection "
                        "explanations. You never make inspection decisions."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
        )

        explanation = response.choices[0].message.content

        if not explanation:
            raise ValueError("The model returned an empty explanation.")

        return InspectionExplanationResponse(
            status="success",
            explanation=explanation,
            model=response.model or MODEL,
        )

    except Exception as exc:
        print(f"OpenRouter explanation request failed: {type(exc).__name__}")
        raise HTTPException(
            status_code=502,
            detail="The explanation service is temporarily unavailable.",
        ) from exc

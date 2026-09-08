from fastapi import FastAPI
from pydantic import BaseModel
import joblib
import pandas as pd
import traceback

app = FastAPI()

# Load model
model = joblib.load("model/resume_score_model.pkl")

# Input schema
class ResumeInput(BaseModel):
    skills: str
    experience: float
    education: str
    certifications: str
    projects: int
    salary: float

@app.get("/")
def home():
    return {"message": "Resume Score API is running."}

@app.post("/predict")
def predict(data: ResumeInput):
    try:
        # Convert input to DataFrame
        input_data = {
            "Skills": [data.skills],
            "Experience (Years)": [data.experience],
            "Education": [data.education],
            "Certifications": [data.certifications],
            "Projects Count": [data.projects],
            "Salary Expectation ($)": [data.salary]
        }

        input_df = pd.DataFrame.from_dict(input_data)

        # Predict score
        score = model.predict(input_df)[0]

        return {"score": round(score, 2)}

    except Exception as e:
        return {
            "error": str(e),
            "trace": traceback.format_exc()
        }

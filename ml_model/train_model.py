import pandas as pd
import joblib
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder, StandardScaler

# Load your dataset
df = pd.read_csv("AI_Resume_Screening.csv")

X = df[["Skills", "Experience (Years)", "Education", "Certifications", "Projects Count", "Salary Expectation ($)"]]
y = df["AI Score (0-100)"]

preprocessor = ColumnTransformer([
    ("skills", TfidfVectorizer(), "Skills"),
    ("education", OneHotEncoder(handle_unknown="ignore"), ["Education"]),
    ("certs", OneHotEncoder(handle_unknown="ignore"), ["Certifications"]),
    ("num", StandardScaler(), ["Experience (Years)", "Projects Count", "Salary Expectation ($)"])
])

pipeline = Pipeline([
    ("preprocessor", preprocessor),
    ("regressor", RandomForestRegressor(n_estimators=100, random_state=42))
])

X_train, X_test, y_train, y_test = train_test_split(X, y, random_state=42)

pipeline.fit(X_train, y_train)

# Save model
joblib.dump(pipeline, "model/resume_score_model.pkl")
print("✅ Model saved to model/resume_score_model.pkl")

# test_full.py
# Usage: run from the ml_model directory inside your virtualenv:
# (.venv) PS > python test_full.py

import os
import json
import joblib
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.utils.validation import check_is_fitted

# ---------- Config ----------
CSV_PATH = "AI_Resume_Screening.csv"
MODEL_PATH = os.path.join("model", "resume_score_model.pkl")
OUTPUT_METRICS = "model_metrics.json"
RESIDUAL_PLOT = "model_residuals.png"
TOP_FEATURES_CSV = "top_feature_importances.csv"
CV_FOLDS = 5
RANDOM_STATE = 42
# ----------------------------

def load_data(csv_path):
    df = pd.read_csv(csv_path)
    X = df[["Skills", "Experience (Years)", "Education", "Certifications", "Projects Count", "Salary Expectation ($)"]]
    y = df["AI Score (0-100)"]
    return X, y, df

def safe_load_model(path):
    if not os.path.exists(path):
        raise FileNotFoundError(f"Model file not found at: {path}")
    model = joblib.load(path)
    return model

def evaluate_model(model, X, y):
    # Recreate same train/test split used during training
    X_train, X_test, y_train, y_test = train_test_split(X, y, random_state=RANDOM_STATE)
    
    # Sanity: check fitted
    try:
        check_is_fitted(model)
    except Exception as e:
        # some pipelines don't trigger check_is_fitted; proceed anyway
        pass

    # Predictions
    y_pred = model.predict(X_test)
    y_pred_train = model.predict(X_train)

    # Metrics
    mae = mean_absolute_error(y_test, y_pred)
    mse = mean_squared_error(y_test, y_pred)
    rmse = np.sqrt(mse)
    r2 = r2_score(y_test, y_pred)

    train_r2 = r2_score(y_train, y_pred_train)

    # Cross-validation (use negative MSE then convert)
    # cross_val_score will re-fit the model internally; it expects X,y in raw format
    cv_mse_neg = cross_val_score(model, X, y, cv=CV_FOLDS, scoring='neg_mean_squared_error', n_jobs=-1)
    cv_rmse = np.sqrt(-cv_mse_neg)

    metrics = {
        "MAE": float(mae),
        "MSE": float(mse),
        "RMSE": float(rmse),
        "R2": float(r2),
        "Train_R2": float(train_r2),
        "CV_RMSE_mean": float(np.mean(cv_rmse)),
        "CV_RMSE_std": float(np.std(cv_rmse)),
        "CV_Folds": CV_FOLDS
    }

    # Residual plot
    try:
        plt.figure(figsize=(8,5))
        residuals = (y_test - y_pred)
        plt.scatter(y_pred, residuals, alpha=0.6)
        plt.hlines(0, xmin=min(y_pred), xmax=max(y_pred), colors='r', linestyles='dashed')
        plt.xlabel("Predicted Score")
        plt.ylabel("Residual (True - Predicted)")
        plt.title("Residuals vs Predicted")
        plt.tight_layout()
        plt.savefig(RESIDUAL_PLOT)
        plt.close()
        metrics["residual_plot"] = RESIDUAL_PLOT
    except Exception as e:
        print("Could not create residual plot:", e)

    return metrics, (X_train, X_test, y_train, y_test, y_pred, y_pred_train)

def extract_feature_importances(model):
    """
    Attempts to map feature importances from the RandomForestRegressor
    back to human-readable names including TF-IDF token names.
    Works if model is a Pipeline with a ColumnTransformer named 'preprocessor'
    and a regressor named 'regressor' or similar. Adjust names if different.
    """
    try:
        # try typical pipeline structure: Pipeline([('preprocessor', ColumnTransformer(...)), ('regressor', RandomForestRegressor(...))])
        preprocessor = model.named_steps.get('preprocessor', None)
        regressor = None
        # find regressor (last step)
        steps = list(model.named_steps.keys())
        # get last step name
        last_step_name = steps[-1]
        regressor = model.named_steps[last_step_name]

        importances = regressor.feature_importances_
    except Exception as e:
        print("Could not extract importances automatically:", e)
        return None

    feature_names = []
    try:
        # ct.transformers_ is a list of (name, transformer, columns)
        for name, transformer, cols in preprocessor.transformers_:
            if name == 'skills':
                # transformer is TfidfVectorizer
                try:
                    tfidf = transformer
                    tfidf_feats = tfidf.get_feature_names_out()
                    feature_names.extend([f"skills__{tok}" for tok in tfidf_feats])
                except Exception as ex:
                    print("Error extracting TF-IDF tokens:", ex)
                    # fallback: create placeholder names
                    # We can't infer count easily, so skip detailed mapping here
            elif hasattr(transformer, 'get_feature_names_out') and isinstance(cols, list):
                # OneHotEncoder or similar
                try:
                    names_out = transformer.get_feature_names_out(cols)
                except Exception:
                    # older sklearn: get_feature_names may exist
                    try:
                        names_out = transformer.get_feature_names_out()
                    except Exception:
                        names_out = [f"{name}__{c}" for c in cols]
                feature_names.extend([f"{name}__{n}" for n in names_out])
            else:
                # numeric columns (cols is list)
                if isinstance(cols, (list, tuple)):
                    feature_names.extend(cols if isinstance(cols, list) else list(cols))
                else:
                    # fallback
                    feature_names.append(str(cols))
    except Exception as e:
        print("Exception while building feature names:", e)

    # If lengths match, create dataframe
    if len(feature_names) == len(importances):
        fi_df = pd.DataFrame({
            "feature": feature_names,
            "importance": importances
        }).sort_values("importance", ascending=False).reset_index(drop=True)
        return fi_df
    else:
        # lengths don't match: still try to show top indices
        idx_sorted = np.argsort(importances)[::-1]
        top_indices = idx_sorted[:50]  # top 50 indices
        fi_df = pd.DataFrame({
            "feature_index": top_indices,
            "importance": importances[top_indices]
        })
        print("Warning: Could not map indices to names. Returning indices + importances.")
        return fi_df

def main():
    print("Loading data...")
    X, y, raw_df = load_data(CSV_PATH)

    print("Loading model...")
    model = safe_load_model(MODEL_PATH)

    print("Evaluating model...")
    metrics, aux = evaluate_model(model, X, y)
    (X_train, X_test, y_train, y_test, y_pred, y_pred_train) = aux

    # Save metrics to JSON
    with open(OUTPUT_METRICS, "w") as f:
        json.dump(metrics, f, indent=2)
    print("📊 MODEL EVALUATION RESULTS (saved -> {})".format(OUTPUT_METRICS))
    print(json.dumps(metrics, indent=2))

    # Feature importances
    print("Extracting feature importances (best-effort)...")
    fi_df = extract_feature_importances(model)
    if fi_df is not None:
        fi_df.to_csv(TOP_FEATURES_CSV, index=False)
        print(f"Saved feature importances to {TOP_FEATURES_CSV} (top rows):")
        print(fi_df.head(10).to_string(index=False))
    else:
        print("Feature importances not available.")

    print("Done. Residual plot:", metrics.get("residual_plot", "none"))

if __name__ == "__main__":
    main()

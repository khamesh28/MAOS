"""
Standalone AutoGen pipeline worker.
Called as: python pipeline_worker.py <csv_path> <run_id> <charts_dir>

Runs Phase 1 (Data Analyst) + Phase 2 (Report Writer) exactly like the
working Streamlit app.py — pure synchronous, no async, no event loop.
Writes results to <charts_dir>/<run_id>_done.json when complete.
"""

import sys
import os
import json
import shutil
import time
import glob

try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
except ImportError:
    pass

import autogen
import pandas as pd
import matplotlib
matplotlib.use("Agg")

def main():
    if len(sys.argv) < 4:
        print("Usage: pipeline_worker.py <csv_path> <run_id> <charts_dir>")
        sys.exit(1)

    csv_path   = sys.argv[1]
    run_id     = sys.argv[2]
    charts_dir = sys.argv[3]

    os.makedirs(charts_dir, exist_ok=True)

    # Copy the uploaded CSV to the worker's CWD so autogen code can find it
    worker_csv = os.path.join(os.path.dirname(csv_path), "company_sales.csv")
    if csv_path != worker_csv:
        shutil.copy(csv_path, worker_csv)

    # Change CWD to csv directory so generated PNGs land there
    work_dir = os.path.dirname(worker_csv)
    os.chdir(work_dir)

    llm_config = {
        "config_list": [{
            "model": "llama-3.3-70b-versatile",
            "api_key": os.getenv("GROQ_API_KEY"),
            "api_type": "groq"
        }],
        "temperature": 0.0,
    }

    # ── Phase 1: Data Analyst ────────────────────────────────────────────────
    print("[worker] Phase 1: Data Analyst starting...", flush=True)

    analyst = autogen.AssistantAgent(
        name="Senior_Data_Analyst",
        system_message="""You are a senior data analyst. Your ONLY job is to write complete, executable Python code.
Always wrap code in a ```python block.
NEVER write the word TERMINATE in any message. Ever.
Save all charts to the current working directory.""",
        llm_config=llm_config,
    )

    manager = autogen.UserProxyAgent(
        name="Executive_Manager",
        human_input_mode="NEVER",
        max_consecutive_auto_reply=2,
        is_termination_msg=lambda x: "exitcode: 0" in x.get("content", ""),
        code_execution_config={"work_dir": ".", "use_docker": False},
        system_message="Execute the code provided. Stop after first successful execution.",
    )

    manager_prompt = """You are analyzing a raw, uncleaned enterprise sales dataset saved as 'company_sales.csv'.

IMPORTANT: Column names are exactly: 'Date', 'Region', 'Product_Category', 'Revenue', 'Units_Sold'

The data is messy — expect missing values, duplicates, formatting inconsistencies,
invalid entries (like 'abc' in numeric columns), negative values, and outliers.
Handle all of it professionally before analysis.
Print a data quality report showing exactly what was fixed and how many records were affected.

After cleaning, generate these business intelligence charts:
1. Pie chart of Revenue share by Region → save as 'revenue_share_by_region.png'
2. Horizontal bar chart of Total Units Sold by Product_Category → save as 'units_by_category.png'
3. Cumulative Revenue Over Time (line chart) → save as 'cumulative_revenue.png'
4. Side by side bar chart comparing Revenue vs Units Sold by Region → save as 'revenue_vs_units.png'
5. Boxplot showing Revenue spread across Product_Category → save as 'revenue_boxplot.png'

Do not include TERMINATE."""

    manager.initiate_chat(analyst, message=manager_prompt)
    time.sleep(1)

    # Collect data quality log from chat
    data_quality = ""
    for msg in manager.chat_messages.get(analyst, []):
        content = msg.get("content", "")
        if "exitcode: 0" in content:
            data_quality = content
            break

    print("[worker] Phase 1 complete.", flush=True)

    # ── Phase 2: Report Writer ───────────────────────────────────────────────
    print("[worker] Phase 2: Report Writer starting...", flush=True)

    df_analysis = pd.read_csv("company_sales.csv")
    df_analysis["Revenue"] = pd.to_numeric(df_analysis["Revenue"], errors="coerce")
    df_analysis["Revenue"] = df_analysis["Revenue"].fillna(df_analysis["Revenue"].mean())

    regional      = df_analysis.groupby("Region")["Revenue"].sum().to_dict()
    category      = df_analysis.groupby("Product_Category")["Revenue"].mean().to_dict()
    total_revenue = df_analysis["Revenue"].sum()
    top_region    = max(regional, key=regional.get)
    top_category  = max(category, key=category.get)

    report_writer = autogen.AssistantAgent(
        name="Business_Report_Writer",
        system_message="""You are a senior business intelligence analyst.
You write concise, professional executive summary reports based on data insights.
Format your report with clear sections: Executive Summary, Key Findings, and Recommendations.
Be specific with numbers. Write in a formal business tone.
Do NOT write any code. Just write the report as plain text.""",
        llm_config=llm_config,
    )

    report_manager = autogen.UserProxyAgent(
        name="Report_Manager",
        human_input_mode="NEVER",
        max_consecutive_auto_reply=0,
        code_execution_config=False,
        is_termination_msg=lambda x: True,
    )

    report_task = f"""
Based on the following sales data analysis, write a professional business intelligence report:

DATASET SUMMARY:
- Total Revenue: ${total_revenue:,.2f}
- Top Performing Region: {top_region} (${regional[top_region]:,.2f})
- Revenue by Region: {regional}
- Average Revenue by Product Category: {category}
- Top Product Category: {top_category}
- Dataset had missing Revenue values (filled with column mean)

Write a 3-section report: Executive Summary, Key Findings, and Strategic Recommendations.
"""
    report_manager.initiate_chat(report_writer, message=report_task)
    time.sleep(1)

    chat_history = report_manager.chat_messages.get(report_writer, [])
    report_text = ""
    # AutoGen stores the proxy's own sent message as role="assistant" too,
    # so skip anything that looks like our prompt and grab the real LLM output
    for msg in chat_history:
        content = (msg.get("content") or "").strip()
        if not content or msg.get("role") == "system":
            continue
        if "DATASET SUMMARY" in content or "Write a 3-section report" in content:
            continue  # this is the prompt we sent — skip it
        report_text = content
        break
    # Fallback: last non-empty message
    if not report_text:
        for msg in reversed(chat_history):
            content = (msg.get("content") or "").strip()
            if content and "DATASET SUMMARY" not in content:
                report_text = content
                break

    print("[worker] Phase 2 complete.", flush=True)

    # ── Collect Charts ───────────────────────────────────────────────────────
    chart_map = {
        "revenue_share_by_region.png": f"{run_id}_revenue_share.png",
        "units_by_category.png":       f"{run_id}_units_by_category.png",
        "cumulative_revenue.png":      f"{run_id}_cumulative_revenue.png",
        "revenue_vs_units.png":        f"{run_id}_revenue_vs_units.png",
        "revenue_boxplot.png":         f"{run_id}_revenue_boxplot.png",
    }

    charts = []
    for src_name, dest_name in chart_map.items():
        src = os.path.join(work_dir, src_name)
        if os.path.exists(src):
            dest = os.path.join(charts_dir, dest_name)
            shutil.move(src, dest)
            charts.append(dest_name)
            print(f"[worker] Chart saved: {dest_name}", flush=True)

    # Fallback: grab any PNG we missed
    if not charts:
        for png in glob.glob(os.path.join(work_dir, "*.png")):
            bname = os.path.basename(png)
            dest_name = f"{run_id}_{bname}"
            dest = os.path.join(charts_dir, dest_name)
            shutil.move(png, dest)
            charts.append(dest_name)
            print(f"[worker] Chart saved (fallback): {dest_name}", flush=True)

    # ── Write done marker ────────────────────────────────────────────────────
    done_path = os.path.join(charts_dir, f"{run_id}_done.json")
    result = {
        "status": "completed",
        "charts": charts,
        "report": report_text,
        "data_quality": data_quality,
    }
    with open(done_path, "w") as f:
        json.dump(result, f)

    print(f"[worker] Done. Written to {done_path}", flush=True)


if __name__ == "__main__":
    main()

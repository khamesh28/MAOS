import streamlit as st
import autogen
import os
import pandas as pd
import time

st.set_page_config(page_title="Multi-Agent Orchestration System", layout="wide")

st.markdown("""
    <style>
        .main-title { font-size: 2rem; font-weight: 700; margin-bottom: 0; }
        .sub-title { font-size: 1rem; color: #888; margin-bottom: 2rem; }
        .agent-box {
            background: #1a1a2e;
            border: 1px solid #333;
            border-radius: 10px;
            padding: 1rem 1.2rem;
            margin-bottom: 0.5rem;
        }
        .agent-name { font-weight: 600; font-size: 0.95rem; color: #a78bfa; }
        .agent-role { font-size: 0.8rem; color: #888; margin-top: 2px; }
        .stat-card {
            background: #111;
            border: 1px solid #222;
            border-radius: 8px;
            padding: 1rem;
            text-align: center;
        }
        .stat-num { font-size: 1.8rem; font-weight: 700; color: #a78bfa; }
        .stat-label { font-size: 0.75rem; color: #888; margin-top: 2px; }
        .report-box {
            background: #0f1923;
            border: 1px solid #1e3a5f;
            border-radius: 10px;
            padding: 1.5rem;
            font-size: 0.95rem;
            line-height: 1.8;
            color: #e0f0ff;
            white-space: pre-wrap;
        }
        .pipeline-arrow {
            text-align: center;
            font-size: 1.5rem;
            color: #a78bfa;
            margin: 0.5rem 0;
        }
    </style>
""", unsafe_allow_html=True)

st.markdown('<div class="main-title">🤖 Multi-Agent Orchestration System</div>', unsafe_allow_html=True)
st.markdown('<div class="sub-title">A 3-agent autonomous pipeline that ingests data, generates visualizations, and produces business intelligence reports — entirely on its own.</div>', unsafe_allow_html=True)

st.subheader("🧠 Agent Pipeline Architecture")
col1, col2, col3, col4, col5 = st.columns([3, 1, 3, 1, 3])

with col1:
    st.markdown("""
    <div class="agent-box">
        <div class="agent-name">🟢 Executive Manager</div>
        <div class="agent-role">Orchestrator • Executes code • Validates outputs • Routes between agents</div>
    </div>
    """, unsafe_allow_html=True)

with col2:
    st.markdown('<div class="pipeline-arrow">→</div>', unsafe_allow_html=True)

with col3:
    st.markdown("""
    <div class="agent-box">
        <div class="agent-name">🔵 Senior Data Analyst</div>
        <div class="agent-role">LLM-powered • Writes Python code • Generates 4 visualizations</div>
    </div>
    """, unsafe_allow_html=True)

with col4:
    st.markdown('<div class="pipeline-arrow">→</div>', unsafe_allow_html=True)

with col5:
    st.markdown("""
    <div class="agent-box">
        <div class="agent-name">🟡 Business Report Writer</div>
        <div class="agent-role">LLM-powered • Reads data insights • Writes executive summary</div>
    </div>
    """, unsafe_allow_html=True)

st.markdown("---")

st.subheader("📥 Agnostic Data Ingestion")
uploaded_file = st.file_uploader("Upload any tabular dataset (CSV)", type=["csv"])

if uploaded_file is not None:
    df = pd.read_csv(uploaded_file)
    df.to_csv("company_sales.csv", index=False)
    st.success("Dataset successfully loaded into Agent Sandbox.")
else:
    st.info("Awaiting file upload. Using default system dataset for demonstration.")
    csv_data = """Date,Region,Product_Category,Revenue,Units_Sold
2025-01-01,North,Electronics,5400,120
2025-01-02,South,Office Supplies,1200,45
2025-01-03,East,Furniture,3200,10
2025-01-04,West,Electronics,,90
2025-01-05,North,Furniture,4500,15
2025-01-06,South,Electronics,6100,135
2025-01-07,East,Office Supplies,800,30
2025-01-08,West,Furniture,2900,12
2025-01-09,North,Office Supplies,1500,50
2025-01-10,South,Furniture,,8
2025-01-06,South,Electronics,6100,135
2025-01-03,East,Furniture,3200,10
2025-01-11,North,electronics,99999,5
2025-01-12,,Furniture,1800,7
2025-01-13,West,Office Supplies,-500,20
2025-01-14,East,,2200,
2025-01-15,North,Electronics,4800,110
2025-01-15,North,Electronics,4800,110
2025-01-16,south,Electronics,3100,70
2025-01-17,WEST,Furniture,,9
2025-01-18,East,Office Supplies,950,35
2025-01-19,North,Electronics,abc,100
2025-01-20,South,Furniture,2100,11"""
    with open("company_sales.csv", "w") as f:
        f.write(csv_data)
    df = pd.read_csv("company_sales.csv")

c1, c2, c3, c4 = st.columns(4)
with c1:
    st.markdown(f'<div class="stat-card"><div class="stat-num">{len(df)}</div><div class="stat-label">Total Records</div></div>', unsafe_allow_html=True)
with c2:
    st.markdown(f'<div class="stat-card"><div class="stat-num">{df.isnull().sum().sum()}</div><div class="stat-label">Missing Values</div></div>', unsafe_allow_html=True)
with c3:
    st.markdown(f'<div class="stat-card"><div class="stat-num">{df.select_dtypes(include="object").nunique().max()}</div><div class="stat-label">Unique Categories</div></div>', unsafe_allow_html=True)
with c4:
    st.markdown(f'<div class="stat-card"><div class="stat-num">{len(df.columns)}</div><div class="stat-label">Columns Detected</div></div>', unsafe_allow_html=True)

st.markdown("<br>", unsafe_allow_html=True)
edited_df = st.data_editor(df, width=1400, num_rows="dynamic")
edited_df.to_csv("company_sales.csv", index=False)

st.markdown("---")

st.subheader("⚙️ Autonomous Agent Execution")
st.markdown("Define the Manager's instructions below. The Data Analyst Agent will execute exactly what the Manager commands.")

default_task = """You are analyzing a raw, uncleaned enterprise sales dataset saved as 'company_sales.csv'.

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

manager_prompt = st.text_area(
    "📋 Manager Instructions (editable)",
    value=default_task,
    height=220,
    help="This is the task the Manager Agent sends to the Data Analyst. Edit it to change what the AI does."
)

if st.button("🚀 Launch Multi-Agent Pipeline", type="primary"):

    st.markdown("#### 🔵 Phase 1 — Data Analyst Agent")
    with st.spinner("Senior Data Analyst is writing and executing Python code..."):

        llm_config = {
            "config_list": [{
                "model": "llama-3.3-70b-versatile",
                "api_key": os.getenv("GROQ_API_KEY"),
                "api_type": "groq"
            }],
            "temperature": 0.0,
        }

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

        manager.initiate_chat(analyst, message=manager_prompt)
        time.sleep(1)

    st.success("✅ Phase 1 Complete — Charts generated!")

    st.markdown("#### 🟡 Phase 2 — Business Report Writer Agent")
    with st.spinner("Report Writer Agent is analyzing data and writing business insights..."):

        df_analysis = pd.read_csv("company_sales.csv")
        df_analysis['Revenue'] = pd.to_numeric(df_analysis['Revenue'], errors='coerce')
        df_analysis['Revenue'] = df_analysis['Revenue'].fillna(df_analysis['Revenue'].mean())

        regional = df_analysis.groupby('Region')['Revenue'].sum().to_dict()
        category = df_analysis.groupby('Product_Category')['Revenue'].mean().to_dict()
        total_revenue = df_analysis['Revenue'].sum()
        top_region = max(regional, key=regional.get)
        top_category = max(category, key=category.get)

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

        chat_history = report_manager.chat_messages[report_writer]
        report_text = ""
        for msg in chat_history:
            if msg.get("role") == "assistant":
                report_text = msg.get("content", "")
                break

        with open("business_report.txt", "w") as f:
            f.write(report_text)

    st.success("✅ Phase 2 Complete — Business report generated!")
    st.markdown("---")

    st.subheader("📊 Agent Output 1 — AI-Generated Visualizations")

    import glob
    png_files = [f for f in sorted(glob.glob("*.png"))]

    if png_files:
        col_a, col_b = st.columns(2)
        cols = [col_a, col_b] * (len(png_files) + 1)
        for i, filename in enumerate(png_files):
            with cols[i]:
                title = filename.replace("_", " ").replace(".png", "").title()
                st.markdown(f"**{title}**")
                st.image(filename, use_container_width=True)
    else:
        st.warning("⚠️ No charts found. Make sure the agent ran successfully.")

    st.markdown("---")

    st.subheader("📝 Agent Output 2 — AI-Generated Business Report")

    if os.path.exists("business_report.txt"):
        with open("business_report.txt", "r") as f:
            final_report = f.read()
        st.markdown(f'<div class="report-box">{final_report}</div>', unsafe_allow_html=True)
        st.markdown("<br>", unsafe_allow_html=True)
        st.download_button(
            label="📥 Download Executive Summary (.txt)",
            data=final_report,
            file_name="AI_Business_Report.txt",
            mime="text/plain",
            type="primary"
        )
    else:
        st.warning("⚠️ Report not generated")

    st.markdown("---")

    st.subheader("🔍 Execution Traceability Logs")
    with st.expander("View Raw Agent-to-Agent Communication"):
        st.markdown("### Phase 1: Manager ↔ Data Analyst")
        try:
            for msg in manager.chat_messages[analyst]:
                role = "🤖 Analyst" if msg.get("role") == "assistant" else "⚙️ Manager"
                st.markdown(f"**{role}:**")
                st.code(msg.get("content", ""), language="python")
        except Exception:
            st.write("Logs unavailable.")

        st.markdown("### Phase 2: Manager ↔ Report Writer")
        try:
            for msg in report_manager.chat_messages[report_writer]:
                role = "🟡 Report Writer" if msg.get("role") == "assistant" else "⚙️ Manager"
                st.markdown(f"**{role}:**")
                st.write(msg.get("content", ""))
        except Exception:
            st.write("Logs unavailable.")

    st.markdown("---")
    st.markdown("*All outputs generated autonomously by the 3-agent orchestration pipeline. Zero human intervention.*")

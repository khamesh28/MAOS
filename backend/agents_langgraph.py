"""
Genpact AI Hub — LangGraph Agents
Demonstrates LangGraph 0.2.x / 1.x state machine architecture alongside AutoGen.

Three agents:
  1. SQL Query Agent     — natural language → pandas → plain English result
  2. Forecasting Agent   — CSV → LinearRegression → 30-day forecast + chart
  3. Anomaly Detection   — CSV → Z-score analysis → flagged rows + chart
"""

import os
import io
import base64
import json
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from typing import TypedDict, List, Optional
from langchain_groq import ChatGroq
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver


# ── Shared LLM ────────────────────────────────────────────────
def _get_llm() -> ChatGroq:
    return ChatGroq(
        model="llama-3.3-70b-versatile",
        api_key=os.getenv("GROQ_API_KEY"),
        temperature=0
    )


def _fig_to_b64(fig) -> str:
    """Convert matplotlib figure to base64 PNG string."""
    buf = io.BytesIO()
    fig.savefig(buf, format='png', bbox_inches='tight', facecolor='#0a1628', dpi=120)
    buf.seek(0)
    b64 = base64.b64encode(buf.read()).decode('utf-8')
    plt.close(fig)
    return b64


def _strip_fences(code: str) -> str:
    """Remove markdown code fences from LLM output."""
    code = code.strip()
    for fence in ["```python", "```py", "```"]:
        if code.startswith(fence):
            code = code[len(fence):]
    if code.endswith("```"):
        code = code[:-3]
    return code.strip()


# ═══════════════════════════════════════════════════════════════
# SQL QUERY AGENT  (LangGraph state machine)
# ═══════════════════════════════════════════════════════════════

class SQLState(TypedDict):
    question: str
    csv_path: str
    generated_query: str
    query_result: str
    explanation: str
    error: str
    retry_count: int


def _build_sql_graph():
    llm = _get_llm()

    def sql_generator(state: SQLState) -> dict:
        df_sample = pd.read_csv(state["csv_path"], nrows=5)
        df_full   = pd.read_csv(state["csv_path"])
        cols      = list(df_full.columns)
        dtypes    = {c: str(t) for c, t in df_full.dtypes.items()}
        sample_str = df_sample.to_string(index=False)

        prompt = (
            f"You are a pandas expert. A DataFrame `df` is loaded.\n"
            f"Columns: {cols}\n"
            f"Data types: {dtypes}\n"
            f"Sample (first 5 rows):\n{sample_str}\n"
            f"Shape: {df_full.shape}\n\n"
            f"User question: {state['question']}\n\n"
            f"Write a SINGLE LINE pandas expression to answer the question.\n"
            f"Variable name is `df`. Use standard pandas methods.\n"
            f"Return ONLY the pandas code, no explanations, no markdown, no print statements.\n"
            f"Example: df.groupby('Region')['Revenue'].sum().sort_values(ascending=False)"
        )
        response = llm.invoke(prompt)
        return {"generated_query": _strip_fences(response.content), "retry_count": 0}

    def sql_executor(state: SQLState) -> dict:
        try:
            df = pd.read_csv(state["csv_path"])
            result = eval(state["generated_query"], {"df": df, "pd": pd, "np": np})
            result_str = str(result)
            if len(result_str) > 3000:
                result_str = result_str[:3000] + "\n...(truncated)"
            return {"query_result": result_str, "error": ""}
        except Exception as e:
            return {
                "error": str(e),
                "query_result": "",
                "retry_count": state.get("retry_count", 0) + 1
            }

    def result_explainer(state: SQLState) -> dict:
        prompt = (
            f'The user asked: "{state["question"]}"\n'
            f"The pandas analysis returned:\n{state['query_result']}\n\n"
            f"Write 2-3 sentences explaining this result in plain business English. "
            f"Be specific about numbers."
        )
        response = llm.invoke(prompt)
        return {"explanation": response.content.strip()}

    def error_handler(state: SQLState) -> dict:
        prompt = (
            f"A pandas query failed.\n"
            f"Error: {state['error']}\n"
            f"Failed query: {state['generated_query']}\n\n"
            f"Fix the pandas query. Return ONLY the corrected single-line pandas expression, "
            f"no markdown, no explanation."
        )
        response = llm.invoke(prompt)
        return {"generated_query": _strip_fences(response.content)}

    def route_executor(state: SQLState) -> str:
        if state.get("error") and state.get("retry_count", 0) < 2:
            return "error_handler"
        if state.get("error"):
            return "__end__"
        return "result_explainer"

    g = StateGraph(SQLState)
    g.add_node("sql_generator", sql_generator)
    g.add_node("sql_executor", sql_executor)
    g.add_node("result_explainer", result_explainer)
    g.add_node("error_handler", error_handler)
    g.set_entry_point("sql_generator")
    g.add_edge("sql_generator", "sql_executor")
    g.add_conditional_edges("sql_executor", route_executor, {
        "error_handler":   "error_handler",
        "result_explainer": "result_explainer",
        "__end__": END,
    })
    g.add_edge("error_handler", "sql_executor")
    g.add_edge("result_explainer", END)
    return g.compile()


def run_sql_agent(csv_path: str, question: str) -> dict:
    """Run SQL agent synchronously. Returns {query, result, explanation, error}."""
    graph = _build_sql_graph()
    state = graph.invoke({
        "question": question,
        "csv_path": csv_path,
        "generated_query": "",
        "query_result": "",
        "explanation": "",
        "error": "",
        "retry_count": 0,
    })
    return {
        "query":       state.get("generated_query", ""),
        "result":      state.get("query_result", ""),
        "explanation": state.get("explanation", ""),
        "error":       state.get("error", ""),
    }


# ── SQL Agent with Memory ──────────────────────────────────────

# Module-level singleton — persists across requests, resets on server restart
_sql_memory_store = MemorySaver()


class SQLStateWithHistory(TypedDict):
    question:        str
    csv_path:        str
    generated_query: str
    query_result:    str
    explanation:     str
    error:           str
    retry_count:     int
    history_json:    str  # JSON array of {question, query, result, explanation}


def _build_sql_graph_with_memory():
    llm = _get_llm()

    def sql_generator(state: SQLStateWithHistory) -> dict:
        df_sample  = pd.read_csv(state["csv_path"], nrows=5)
        df_full    = pd.read_csv(state["csv_path"])
        cols       = list(df_full.columns)
        dtypes     = {c: str(t) for c, t in df_full.dtypes.items()}
        sample_str = df_sample.to_string(index=False)

        # Include conversation history so the LLM understands follow-up questions
        history = json.loads(state.get("history_json") or "[]")
        history_text = ""
        if history:
            history_text = "\nPrevious questions in this session:\n"
            for turn in history[-5:]:  # last 5 turns for context
                history_text += (
                    f"  Q: {turn['question']}\n"
                    f"  Result: {str(turn['result'])[:200]}\n\n"
                )

        prompt = (
            f"You are a pandas expert. A DataFrame `df` is loaded.\n"
            f"Columns: {cols}\n"
            f"Data types: {dtypes}\n"
            f"Sample (first 5 rows):\n{sample_str}\n"
            f"Shape: {df_full.shape}\n"
            f"{history_text}"
            f"\nUser question: {state['question']}\n\n"
            f"Write a SINGLE LINE pandas expression to answer the question.\n"
            f"Variable name is `df`. Use standard pandas methods.\n"
            f"Return ONLY the pandas code, no explanations, no markdown, no print statements.\n"
            f"Example: df.groupby('Region')['Revenue'].sum().sort_values(ascending=False)"
        )
        response = llm.invoke(prompt)
        return {"generated_query": _strip_fences(response.content), "retry_count": 0}

    def sql_executor(state: SQLStateWithHistory) -> dict:
        try:
            df = pd.read_csv(state["csv_path"])
            result = eval(state["generated_query"], {"df": df, "pd": pd, "np": np})
            result_str = str(result)
            if len(result_str) > 3000:
                result_str = result_str[:3000] + "\n...(truncated)"
            return {"query_result": result_str, "error": ""}
        except Exception as e:
            return {
                "error": str(e),
                "query_result": "",
                "retry_count": state.get("retry_count", 0) + 1,
            }

    def result_explainer(state: SQLStateWithHistory) -> dict:
        history = json.loads(state.get("history_json") or "[]")
        history_context = ""
        if history:
            history_context = (
                f"\nFor context, previous questions in this session: "
                + "; ".join(f'"{t["question"]}"' for t in history[-3:])
                + "\n"
            )
        prompt = (
            f'The user asked: "{state["question"]}"\n'
            f"The pandas analysis returned:\n{state['query_result']}\n"
            f"{history_context}\n"
            f"Write 2-3 sentences explaining this result in plain business English. "
            f"Be specific about numbers."
        )
        response = llm.invoke(prompt)
        explanation = response.content.strip()

        # Append this Q&A turn to the history
        new_turn = {
            "question":    state["question"],
            "query":       state["generated_query"],
            "result":      state["query_result"][:500],
            "explanation": explanation,
        }
        history.append(new_turn)
        return {
            "explanation":  explanation,
            "history_json": json.dumps(history),
        }

    def error_handler(state: SQLStateWithHistory) -> dict:
        prompt = (
            f"A pandas query failed.\n"
            f"Error: {state['error']}\n"
            f"Failed query: {state['generated_query']}\n\n"
            f"Fix the pandas query. Return ONLY the corrected single-line pandas expression, "
            f"no markdown, no explanation."
        )
        response = llm.invoke(prompt)
        return {"generated_query": _strip_fences(response.content)}

    def route_executor(state: SQLStateWithHistory) -> str:
        if state.get("error") and state.get("retry_count", 0) < 2:
            return "error_handler"
        if state.get("error"):
            return "__end__"
        return "result_explainer"

    g = StateGraph(SQLStateWithHistory)
    g.add_node("sql_generator", sql_generator)
    g.add_node("sql_executor", sql_executor)
    g.add_node("result_explainer", result_explainer)
    g.add_node("error_handler", error_handler)
    g.set_entry_point("sql_generator")
    g.add_edge("sql_generator", "sql_executor")
    g.add_conditional_edges("sql_executor", route_executor, {
        "error_handler":    "error_handler",
        "result_explainer": "result_explainer",
        "__end__":          END,
    })
    g.add_edge("error_handler", "sql_executor")
    g.add_edge("result_explainer", END)
    return g.compile(checkpointer=_sql_memory_store)


def run_sql_agent_with_memory(csv_path: str, question: str, thread_id: str) -> dict:
    """Run SQL agent with conversation memory via MemorySaver checkpointer."""
    graph  = _build_sql_graph_with_memory()
    config = {"configurable": {"thread_id": thread_id}}

    # Check if there's a checkpoint (existing conversation) for this thread
    checkpoint = _sql_memory_store.get(config)
    if checkpoint and checkpoint.get("channel_values", {}).get("history_json"):
        # Follow-up question — pass only question + csv_path; history comes from checkpoint
        inputs = {
            "question":        question,
            "csv_path":        csv_path,
            "generated_query": "",
            "query_result":    "",
            "explanation":     "",
            "error":           "",
            "retry_count":     0,
        }
    else:
        # First question — initialise everything including empty history
        inputs = {
            "question":        question,
            "csv_path":        csv_path,
            "generated_query": "",
            "query_result":    "",
            "explanation":     "",
            "error":           "",
            "retry_count":     0,
            "history_json":    "[]",
        }

    state = graph.invoke(inputs, config=config)
    return {
        "query":        state.get("generated_query", ""),
        "result":       state.get("query_result", ""),
        "explanation":  state.get("explanation", ""),
        "error":        state.get("error", ""),
        "history_json": state.get("history_json", "[]"),
    }


# ═══════════════════════════════════════════════════════════════
# FORECASTING AGENT  (LangGraph state machine)
# ═══════════════════════════════════════════════════════════════

class ForecastState(TypedDict):
    csv_path:      str
    date_col:      str
    value_col:     str
    series_json:   str   # JSON array [{date, value}]
    forecast_json: str   # JSON array [{date, value}]
    chart_b64:     str
    insights:      str
    error:         str


def _build_forecast_graph():
    llm = _get_llm()

    def data_inspector(state: ForecastState) -> dict:
        try:
            df = pd.read_csv(state["csv_path"])
            # Detect date column
            date_col = None
            for col in df.columns:
                if any(kw in col.lower() for kw in
                       ['date', 'time', 'month', 'year', 'day', 'period', 'week']):
                    date_col = col
                    break
            if date_col is None:
                for col in df.columns:
                    try:
                        pd.to_datetime(df[col].dropna().head(5))
                        date_col = col
                        break
                    except Exception:
                        pass
            date_col = date_col or df.columns[0]
            # Detect value column (first numeric)
            numeric_cols = df.select_dtypes(include='number').columns.tolist()
            value_col = numeric_cols[0] if numeric_cols else df.columns[1]
            return {"date_col": date_col, "value_col": value_col, "error": ""}
        except Exception as e:
            return {"error": str(e)}

    def data_cleaner(state: ForecastState) -> dict:
        try:
            df = pd.read_csv(state["csv_path"])
            dc, vc = state["date_col"], state["value_col"]
            df[dc] = pd.to_datetime(df[dc], errors='coerce')
            df[vc] = pd.to_numeric(df[vc], errors='coerce')
            df = df.dropna(subset=[dc, vc]).sort_values(dc)
            series = df[[dc, vc]].copy()
            series.columns = ['date', 'value']
            series['date'] = series['date'].dt.strftime('%Y-%m-%d')
            return {"series_json": series.to_json(orient='records'), "error": ""}
        except Exception as e:
            return {"error": str(e)}

    def forecaster(state: ForecastState) -> dict:
        try:
            from sklearn.linear_model import LinearRegression
            series = pd.read_json(io.StringIO(state["series_json"]))
            series['date'] = pd.to_datetime(series['date'])
            series = series.sort_values('date').reset_index(drop=True)
            series['t'] = np.arange(len(series))

            model = LinearRegression()
            model.fit(series[['t']], series['value'])

            last_date = series['date'].max()
            last_t    = series['t'].max()
            future_dates  = pd.date_range(start=last_date + pd.Timedelta(days=1), periods=30)
            future_t      = np.arange(last_t + 1, last_t + 31).reshape(-1, 1)
            future_values = model.predict(future_t)

            forecast = [
                {"date": d.strftime('%Y-%m-%d'), "value": round(float(v), 2)}
                for d, v in zip(future_dates, future_values)
            ]
            return {"forecast_json": json.dumps(forecast), "error": ""}
        except Exception as e:
            return {"error": str(e)}

    def chart_generator(state: ForecastState) -> dict:
        try:
            series   = pd.read_json(io.StringIO(state["series_json"]))
            series['date'] = pd.to_datetime(series['date'])
            forecast = json.loads(state["forecast_json"])
            f_dates  = [pd.to_datetime(f['date']) for f in forecast]
            f_values = [f['value'] for f in forecast]

            fig, ax = plt.subplots(figsize=(14, 6))
            fig.patch.set_facecolor('#0a1628')
            ax.set_facecolor('#0f1e35')
            ax.plot(series['date'], series['value'],
                    color='#00c8ff', linewidth=2.5, label='Historical', zorder=3)
            ax.plot(f_dates, f_values,
                    color='#00e676', linewidth=2.5, linestyle='--',
                    label='30-Day Forecast', zorder=3)
            ax.fill_between(f_dates, f_values, alpha=0.12, color='#00e676')
            ax.set_xlabel(state["date_col"], color='#7a9cc4', fontsize=11)
            ax.set_ylabel(state["value_col"], color='#7a9cc4', fontsize=11)
            ax.set_title(f'Time Series Forecast — {state["value_col"]}',
                         color='#e8f0fe', fontsize=14, fontweight='bold', pad=15)
            ax.tick_params(colors='#7a9cc4')
            for spine in ['bottom', 'left']:
                ax.spines[spine].set_color('#0052cc')
            for spine in ['top', 'right']:
                ax.spines[spine].set_visible(False)
            ax.legend(facecolor='#0a1628', edgecolor='#0052cc', labelcolor='#e8f0fe')
            ax.grid(True, color='#0052cc', linestyle='--', alpha=0.2)
            plt.tight_layout()
            return {"chart_b64": _fig_to_b64(fig), "error": ""}
        except Exception as e:
            return {"error": str(e)}

    def insight_generator(state: ForecastState) -> dict:
        try:
            series   = pd.read_json(io.StringIO(state["series_json"]))
            forecast = json.loads(state["forecast_json"])
            hist_avg  = float(series['value'].mean())
            hist_last = float(series['value'].iloc[-1])
            f_vals    = [f['value'] for f in forecast]
            f_avg     = round(float(np.mean(f_vals)), 2)
            trend     = "upward" if forecast[-1]['value'] > forecast[0]['value'] else "downward"

            prompt = (
                f"Write exactly 3 numbered business insights.\n\n"
                f"Metric: {state['value_col']}\n"
                f"Historical average: {hist_avg:.2f}\n"
                f"Most recent value: {hist_last:.2f}\n"
                f"30-day forecast average: {f_avg}\n"
                f"Trend direction: {trend}\n"
                f"Forecast range: {min(f_vals):.2f} to {max(f_vals):.2f}\n\n"
                f"Each insight should be 1-2 sentences, specific with numbers, and actionable."
            )
            response = llm.invoke(prompt)
            return {"insights": response.content.strip(), "error": ""}
        except Exception as e:
            return {"error": str(e), "insights": "Forecast analysis complete."}

    g = StateGraph(ForecastState)
    g.add_node("data_inspector",   data_inspector)
    g.add_node("data_cleaner",     data_cleaner)
    g.add_node("forecaster",       forecaster)
    g.add_node("chart_generator",  chart_generator)
    g.add_node("insight_generator", insight_generator)
    g.set_entry_point("data_inspector")
    g.add_edge("data_inspector",   "data_cleaner")
    g.add_edge("data_cleaner",     "forecaster")
    g.add_edge("forecaster",       "chart_generator")
    g.add_edge("chart_generator",  "insight_generator")
    g.add_edge("insight_generator", END)
    return g.compile()


def run_forecast_agent(csv_path: str) -> dict:
    """Run forecasting agent synchronously."""
    graph = _build_forecast_graph()
    state = graph.invoke({
        "csv_path":      csv_path,
        "date_col":      "",
        "value_col":     "",
        "series_json":   "[]",
        "forecast_json": "[]",
        "chart_b64":     "",
        "insights":      "",
        "error":         "",
    })
    forecast = []
    if state.get("forecast_json"):
        try:
            forecast = json.loads(state["forecast_json"])
        except Exception:
            pass
    return {
        "forecast":  forecast,
        "chart_b64": state.get("chart_b64", ""),
        "insights":  state.get("insights", ""),
        "date_col":  state.get("date_col", ""),
        "value_col": state.get("value_col", ""),
        "error":     state.get("error", ""),
    }


# ═══════════════════════════════════════════════════════════════
# ANOMALY DETECTION AGENT  (LangGraph state machine)
# ═══════════════════════════════════════════════════════════════

class AnomalyState(TypedDict):
    csv_path:         str
    numeric_cols:     list
    anomalies_json:   str   # JSON array of anomaly dicts
    chart_b64:        str
    llm_explanations: str
    summary:          str
    error:            str


def _build_anomaly_graph():
    llm = _get_llm()

    def stats_analyzer(state: AnomalyState) -> dict:
        try:
            df = pd.read_csv(state["csv_path"])
            numeric_cols = df.select_dtypes(include='number').columns.tolist()
            if not numeric_cols:
                return {"error": "No numeric columns found in CSV", "numeric_cols": []}
            return {"numeric_cols": numeric_cols, "error": ""}
        except Exception as e:
            return {"error": str(e), "numeric_cols": []}

    def anomaly_flagging(state: AnomalyState) -> dict:
        try:
            df = pd.read_csv(state["csv_path"])
            anomalies = []
            for col in state["numeric_cols"]:
                series = pd.to_numeric(df[col], errors='coerce').dropna()
                if len(series) < 4:
                    continue
                mean = series.mean()
                std  = series.std()
                if std == 0:
                    continue
                zscores = (series - mean) / std
                for idx, zscore in zscores[abs(zscores) > 2.5].items():
                    anomalies.append({
                        "row_index": int(idx),
                        "column":    col,
                        "value":     round(float(df.loc[idx, col]), 4),
                        "zscore":    round(float(zscore), 3),
                        "severity":  ("high" if abs(zscore) > 4
                                      else "medium" if abs(zscore) > 3
                                      else "low"),
                        "explanation": "",
                    })
            anomalies.sort(key=lambda x: abs(x["zscore"]), reverse=True)
            return {"anomalies_json": json.dumps(anomalies[:50]), "error": ""}
        except Exception as e:
            return {"error": str(e)}

    def chart_gen(state: AnomalyState) -> dict:
        try:
            df       = pd.read_csv(state["csv_path"])
            anomalies = json.loads(state["anomalies_json"])
            cols      = state["numeric_cols"][:4]
            n         = len(cols)

            fig, axes = plt.subplots(1, n, figsize=(5 * n, 5))
            fig.patch.set_facecolor('#0a1628')
            if n == 1:
                axes = [axes]

            anom_by_col: dict = {}
            for a in anomalies:
                anom_by_col.setdefault(a["column"], []).append(a["row_index"])

            for ax, col in zip(axes, cols):
                ax.set_facecolor('#0f1e35')
                series     = pd.to_numeric(df[col], errors='coerce')
                anom_idx   = anom_by_col.get(col, [])
                normal_idx = [i for i in series.dropna().index if i not in anom_idx]

                ax.scatter(normal_idx, series[normal_idx],
                           color='#00c8ff', alpha=0.4, s=12, label='Normal')
                if anom_idx:
                    ax.scatter(anom_idx, series[anom_idx],
                               color='#ff4444', alpha=0.9, s=55, zorder=5, label='Anomaly')
                ax.set_title(col, color='#e8f0fe', fontsize=10, pad=8)
                ax.tick_params(colors='#7a9cc4', labelsize=8)
                for sp in ['bottom', 'left']:
                    ax.spines[sp].set_color('#0052cc')
                for sp in ['top', 'right']:
                    ax.spines[sp].set_visible(False)
                if anom_idx:
                    ax.legend(fontsize=7, facecolor='#0a1628',
                              edgecolor='#0052cc', labelcolor='#e8f0fe')

            plt.suptitle('Anomaly Detection Results', color='#e8f0fe',
                         fontsize=13, fontweight='bold', y=1.02)
            plt.tight_layout()
            return {"chart_b64": _fig_to_b64(fig), "error": ""}
        except Exception as e:
            return {"error": str(e)}

    def llm_explainer(state: AnomalyState) -> dict:
        try:
            anomalies = json.loads(state["anomalies_json"])
            top5 = anomalies[:5]
            if not top5:
                return {"llm_explanations": "No anomalies detected in the dataset.", "error": ""}

            rows_str = "\n".join([
                f"- Row {a['row_index']}: {a['column']} = {a['value']} "
                f"(Z-score: {a['zscore']}, severity: {a['severity']})"
                for a in top5
            ])
            prompt = (
                f"You are a data quality analyst. Explain these anomalies in plain business terms:\n"
                f"{rows_str}\n\n"
                f"For each anomaly, write 1 sentence explaining what it means and why it's unusual."
            )
            response = llm.invoke(prompt)
            explanations = response.content.strip()

            # Attach explanation text back to anomaly dicts
            updated = json.loads(state["anomalies_json"])
            lines   = [l.strip() for l in explanations.split('\n') if l.strip()]
            for i, line in enumerate(lines[:len(updated)]):
                cleaned = line.lstrip('0123456789.-) ').strip()
                updated[i]["explanation"] = cleaned

            return {
                "anomalies_json":   json.dumps(updated),
                "llm_explanations": explanations,
                "error": "",
            }
        except Exception as e:
            return {"error": str(e), "llm_explanations": "Analysis complete."}

    def summary_writer(state: AnomalyState) -> dict:
        try:
            anomalies = json.loads(state["anomalies_json"])
            n    = len(anomalies)
            cols = len(set(a["column"] for a in anomalies))
            high   = sum(1 for a in anomalies if a["severity"] == "high")
            medium = sum(1 for a in anomalies if a["severity"] == "medium")
            low    = sum(1 for a in anomalies if a["severity"] == "low")

            prompt = (
                f"Write a 2-3 sentence executive summary of a data quality anomaly scan:\n"
                f"- Total anomalies: {n}\n"
                f"- Columns affected: {cols}\n"
                f"- Severity — High: {high}, Medium: {medium}, Low: {low}\n"
                f"- Method: Z-score analysis (threshold |z| > 2.5)\n\n"
                f"Be professional and recommend 1 corrective action."
            )
            response = llm.invoke(prompt)
            return {"summary": response.content.strip(), "error": ""}
        except Exception as e:
            anomalies = json.loads(state.get("anomalies_json", "[]"))
            return {
                "error": str(e),
                "summary": f"Anomaly scan complete. {len(anomalies)} anomalies found.",
            }

    g = StateGraph(AnomalyState)
    g.add_node("stats_analyzer",  stats_analyzer)
    g.add_node("anomaly_flagging", anomaly_flagging)
    g.add_node("chart_gen",        chart_gen)
    g.add_node("llm_explainer",    llm_explainer)
    g.add_node("summary_writer",   summary_writer)
    g.set_entry_point("stats_analyzer")
    g.add_edge("stats_analyzer",   "anomaly_flagging")
    g.add_edge("anomaly_flagging", "chart_gen")
    g.add_edge("chart_gen",        "llm_explainer")
    g.add_edge("llm_explainer",    "summary_writer")
    g.add_edge("summary_writer",   END)
    return g.compile()


def run_anomaly_agent(csv_path: str) -> dict:
    """Run anomaly detection agent synchronously."""
    graph = _build_anomaly_graph()
    state = graph.invoke({
        "csv_path":         csv_path,
        "numeric_cols":     [],
        "anomalies_json":   "[]",
        "chart_b64":        "",
        "llm_explanations": "",
        "summary":          "",
        "error":            "",
    })
    anomalies = []
    if state.get("anomalies_json"):
        try:
            anomalies = json.loads(state["anomalies_json"])
        except Exception:
            pass
    return {
        "anomalies":         anomalies,
        "chart_b64":         state.get("chart_b64", ""),
        "llm_explanations":  state.get("llm_explanations", ""),
        "summary":           state.get("summary", ""),
        "total_flagged":     len(anomalies),
        "error":             state.get("error", ""),
    }





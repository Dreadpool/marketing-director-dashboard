"""
QuickBooks GL Loader — Cloud Function (Gen2)

Receives JSON payloads of GL transactions from a PowerShell script on the
Windows server, deletes the existing date range, and loads new rows into
BigQuery. Logs every run to the pipeline_runs table.

Entry point: load_gl
"""

import json
import os
import uuid
import time
from datetime import datetime, timezone

import functions_framework
from google.cloud import bigquery

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
API_KEY = os.environ.get("API_KEY", "")
BQ_PROJECT = os.environ.get("BQ_PROJECT", "jovial-root-443516-a7")
BQ_DATASET = os.environ.get("BQ_DATASET", "quickbooks_gl")
TABLE_ID = f"{BQ_PROJECT}.{BQ_DATASET}.gl_transactions"
RUNS_TABLE_ID = f"{BQ_PROJECT}.{BQ_DATASET}.pipeline_runs"

client = bigquery.Client(project=BQ_PROJECT)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _map_row(row: dict, company: str) -> dict:
    """Map an incoming JSON row to the BigQuery schema."""
    debit = float(row.get("debit", 0) or 0)
    credit = float(row.get("credit", 0) or 0)
    amount = float(row.get("amount", debit - credit) or (debit - credit))

    return {
        "txn_date": row["txn_date"],
        "txn_type": row["txn_type"],
        "txn_number": row.get("txn_number"),
        "account_number": row["account_number"],
        "account_name": row["account_name"],
        "name": row.get("name"),
        "memo": row.get("memo"),
        "debit": debit,
        "credit": credit,
        "amount": amount,
        "source_file": row.get("source_file"),
        "loaded_at": datetime.now(timezone.utc).isoformat(),
        "company": company,
    }


def _log_run(run_id, run_ts, status, from_date, to_date, rows_received,
             rows_loaded, rows_deleted, duration_sec, error_message,
             source_ip, company):
    """Insert a row into pipeline_runs."""
    row = {
        "run_id": run_id,
        "run_ts": run_ts,
        "status": status,
        "from_date": from_date,
        "to_date": to_date,
        "rows_received": rows_received,
        "rows_loaded": rows_loaded,
        "rows_deleted": rows_deleted,
        "duration_sec": duration_sec,
        "error_message": error_message,
        "source_ip": source_ip,
        "company": company,
    }
    # pipeline_runs is a small table — streaming insert is fine here
    client.insert_rows_json(RUNS_TABLE_ID, [row])


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
@functions_framework.http
def load_gl(request):
    start = time.time()
    run_id = str(uuid.uuid4())
    run_ts = datetime.now(timezone.utc).isoformat()
    source_ip = request.headers.get("X-Forwarded-For", request.remote_addr)

    # --- Auth ---
    if request.headers.get("X-Api-Key") != API_KEY:
        return (json.dumps({"error": "Unauthorized"}), 401,
                {"Content-Type": "application/json"})

    # --- Parse payload ---
    data = request.get_json(silent=True)
    if not data or "rows" not in data:
        return (json.dumps({"error": "Missing rows in payload"}), 400,
                {"Content-Type": "application/json"})

    from_date = data.get("from_date")
    to_date = data.get("to_date")
    company = data.get("company", "salt_lake_express")
    rows = data["rows"]
    rows_received = len(rows)

    if not from_date or not to_date:
        return (json.dumps({"error": "Missing from_date or to_date"}), 400,
                {"Content-Type": "application/json"})

    try:
        # --- DELETE phase ---
        delete_query = f"""
            DELETE FROM `{TABLE_ID}`
            WHERE company = @company
              AND txn_date BETWEEN @from_date AND @to_date
        """
        job_config = bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter("company", "STRING", company),
                bigquery.ScalarQueryParameter("from_date", "DATE", from_date),
                bigquery.ScalarQueryParameter("to_date", "DATE", to_date),
            ]
        )
        delete_job = client.query(delete_query, job_config=job_config)
        delete_result = delete_job.result()
        rows_deleted = delete_job.num_dml_affected_rows or 0

        # --- INSERT phase (batch load, not streaming) ---
        mapped_rows = [_map_row(r, company) for r in rows]

        # Use load_table_from_json for batch loading.
        # Unlike insert_rows_json (streaming), batch loads do NOT create a
        # streaming buffer, so subsequent DELETE operations are never blocked.
        load_job_config = bigquery.LoadJobConfig(
            source_format=bigquery.SourceFormat.NEWLINE_DELIMITED_JSON,
            write_disposition=bigquery.WriteDisposition.WRITE_APPEND,
        )
        load_job = client.load_table_from_json(
            mapped_rows, TABLE_ID, job_config=load_job_config
        )
        load_job.result()  # wait for completion
        rows_loaded = load_job.output_rows

        duration = round(time.time() - start, 2)

        _log_run(run_id, run_ts, "success", from_date, to_date,
                 rows_received, rows_loaded, rows_deleted, duration,
                 None, source_ip, company)

        return (json.dumps({
            "status": "success",
            "run_id": run_id,
            "rows_deleted": rows_deleted,
            "rows_loaded": rows_loaded,
            "duration_sec": duration,
        }), 200, {"Content-Type": "application/json"})

    except Exception as e:
        duration = round(time.time() - start, 2)
        error_msg = str(e)

        _log_run(run_id, run_ts, "error", from_date, to_date,
                 rows_received, 0, 0, duration, error_msg,
                 source_ip, company)

        return (json.dumps({
            "status": "error",
            "run_id": run_id,
            "error": error_msg,
            "duration_sec": duration,
        }), 500, {"Content-Type": "application/json"})

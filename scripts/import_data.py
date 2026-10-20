"""Extract original cells without modifying the source workbook."""
import json
import hashlib
from datetime import datetime, timezone
from pathlib import Path
import xlrd

root = Path(__file__).resolve().parents[1]
book = xlrd.open_workbook(root / "data.xls")
headers, rows, sources = [], [], []
for sheet in book.sheets():
    if sheet.nrows < 2:
        continue
    current = [str(v).strip() for v in sheet.row_values(1)]
    if not headers:
        headers = current
    assert current == headers, f"Unexpected columns: {sheet.name}"
    count = 0
    for index in range(2, sheet.nrows):
        values = [str(int(v)) if isinstance(v, float) and v.is_integer() else str(v).strip()
                  for v in sheet.row_values(index)]
        if not any(values):
            continue
        assert values[8] and int(values[11]) > 0
        rows.append({"id": f"{values[0]}:{values[8]}", "sheet": sheet.name,
                     "row": index + 1, "values": values})
        count += 1
    sources.append({"name": sheet.name, "count": count})
assert len({r["id"] for r in rows}) == len(rows)
output = {"headers": headers, "rows": rows, "sources": sources, "file": "data.xls", "year": 2027,
          "importedAt": datetime.now(timezone.utc).isoformat(),
          "sourceHash": hashlib.sha256((root / "data.xls").read_bytes()).hexdigest()}
(root / "public" / "positions.json").write_text(json.dumps(output, ensure_ascii=False, separators=(",", ":")))
print(f"Imported {len(rows):,} positions / {sum(int(r['values'][11]) for r in rows):,} openings")

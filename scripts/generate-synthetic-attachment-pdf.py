from pathlib import Path
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

output = Path(__file__).resolve().parents[1] / "artifacts" / "synthetic-attachments" / "synthetic-loto-procedure.pdf"
output.parent.mkdir(parents=True, exist_ok=True)
c = canvas.Canvas(str(output), pagesize=A4)
c.setTitle("Synthetic LOTO Procedure")
c.setFont("Helvetica-Bold", 18)
c.drawString(60, 790, "Synthetic LOTO Safety Procedure")
c.setFont("Helvetica", 11)
lines = [
    "Training fixture only - contains no real company or employee data.",
    "1. Identify every hazardous energy source before shutdown.",
    "2. Notify affected workers and stop equipment normally.",
    "3. Isolate energy and apply individually controlled locks and tags.",
    "4. Release or restrain stored energy and verify a zero-energy state.",
    "5. Before restoration, inspect the work area and confirm personnel are clear.",
    "6. Remove locks only under the controlled procedure and notify affected workers.",
]
y = 750
for line in lines:
    c.drawString(60, y, line)
    y -= 28
c.setFont("Helvetica-Oblique", 9)
c.drawString(60, 70, "Synthetic fixture for YVY HSE attachment validation")
c.save()
print(output)

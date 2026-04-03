import csv
import os
from app import create_app
from models import db, Product

app = create_app()

CSV_FILE = os.path.join(os.path.dirname(__file__), "products.csv")

with app.app_context():
    # Optional: clear old products before importing new ones
    Product.query.delete()

    with open(CSV_FILE, newline="", encoding="utf-8") as file:
        reader = csv.DictReader(file)

        for row in reader:
            product = Product(
                name=row["name"],
                category=row["category"],
                price=float(row["price"]),
                description=row["description"],
                stock=int(row["stock"])
            )
            db.session.add(product)

    db.session.commit()
    print("Products imported successfully.")
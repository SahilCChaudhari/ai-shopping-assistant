import os
from app import create_app
from models import db

app = create_app()

db_path = os.path.join(os.path.dirname(__file__), 'database')
os.makedirs(db_path, exist_ok=True)

with app.app_context():
    db.create_all()
    print("Database and tables created successfully.")
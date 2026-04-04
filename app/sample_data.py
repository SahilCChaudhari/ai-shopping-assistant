from app import create_app
from models import db, Product

app = create_app()

sample_products = [
    Product(name="Nike Running Shoes", category="Shoes", price=45.0, description="Comfortable running shoes", stock=10),
    Product(name="Adidas Sneakers", category="Shoes", price=55.0, description="Stylish everyday sneakers", stock=8),
    Product(name="Dell Laptop", category="Electronics", price=799.0, description="15-inch laptop with 8GB RAM", stock=5),
    Product(name="Wireless Mouse", category="Electronics", price=25.0, description="Bluetooth mouse", stock=20),
    Product(name="Backpack", category="Accessories", price=30.0, description="Travel backpack", stock=15),
    Product(name="Water Bottle", category="Accessories", price=12.0, description="Reusable water bottle", stock=25)
]

with app.app_context():
    db.session.query(Product).delete()

    for product in sample_products:
        db.session.add(product)

    db.session.commit()
    print("Sample products inserted successfully.")
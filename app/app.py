from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from config import Config
from models import db, Product, CartItem, Order, OrderItem
from ai_search import parse_query
import os
import requests


def create_app():
    app = Flask(__name__, template_folder="template", static_folder="static")
    # If your folder name is "templates", change "template" to "templates"

    app.config.from_object(Config)

    CORS(app)
    db.init_app(app)

    @app.route('/')
    def home():
        return render_template('index.html')

    @app.route('/web-search', methods=['POST'])
    def web_search():
        data = request.get_json() or {}
        keyword = data.get('keyword', '').strip()
        max_price = data.get('max_price')

        if not keyword:
            return jsonify({"error": "Keyword required"}), 400

        api_key = os.getenv("SERPAPI_KEY")
        if not api_key:
            return jsonify({"error": "SERPAPI_KEY not set"}), 500

        params = {
            "engine": "google_shopping",
            "q": keyword,
            "api_key": api_key
        }

        try:
            response = requests.get("https://serpapi.com/search", params=params, timeout=20)
            response.raise_for_status()
            results = response.json()

            products = []

            for item in results.get("shopping_results", []):
                extracted_price = item.get("extracted_price")

                if max_price not in (None, '') and extracted_price is not None:
                    try:
                        if float(extracted_price) > float(max_price):
                            continue
                    except ValueError:
                        pass

                products.append({
                    "name": item.get("title", "No title"),
                    "price": item.get("price", "N/A"),
                    "image": item.get("thumbnail"),
                    "link": item.get("product_link") or item.get("link"),
                    "source": item.get("source", "Web"),
                    "description": item.get("snippet", "")
                })

            return jsonify(products)

        except requests.RequestException as e:
            return jsonify({"error": f"Web search failed: {str(e)}"}), 500

    @app.route('/cart/add', methods=['POST'])
    def add_to_cart():
        data = request.get_json() or {}

        product_id = data.get('product_id')
        quantity = data.get('quantity', 1)

        if product_id:
            product = Product.query.get(product_id)
            if not product:
                return jsonify({"error": "Product not found"}), 404

            existing_item = CartItem.query.filter_by(product_id=product_id).first()

            if existing_item:
                existing_item.quantity += quantity
            else:
                item = CartItem(product_id=product_id, quantity=quantity)
                db.session.add(item)

            db.session.commit()
            return jsonify({"message": "Item added to cart"})

        web_name = data.get("name")
        web_price = data.get("price")
        web_description = data.get("description", "")
        web_category = data.get("category", "Web")
        web_image = data.get("image")
        web_link = data.get("link")

        if not web_name:
            return jsonify({"error": "Product info is required"}), 400

        product = Product.query.filter_by(name=web_name).first()

        if not product:
            numeric_price = 0.0

            if isinstance(web_price, str):
                cleaned = web_price.replace("$", "").replace(",", "").strip()
                try:
                    numeric_price = float(cleaned)
                except ValueError:
                    numeric_price = 0.0
            elif isinstance(web_price, (int, float)):
                numeric_price = float(web_price)

            product = Product(
                name=web_name,
                category=web_category,
                price=numeric_price,
                description=web_description
            )

            if hasattr(product, "image"):
                product.image = web_image
            if hasattr(product, "link"):
                product.link = web_link

            db.session.add(product)
            db.session.flush()

        existing_item = CartItem.query.filter_by(product_id=product.id).first()

        if existing_item:
            existing_item.quantity += quantity
        else:
            item = CartItem(product_id=product.id, quantity=quantity)
            db.session.add(item)

        db.session.commit()
        return jsonify({"message": "Web item added to cart"})

    @app.route('/cart', methods=['GET'])
    def view_cart():
        items = CartItem.query.all()
        return jsonify([item.to_dict() for item in items])

    @app.route('/cart/remove', methods=['POST'])
    def remove_from_cart():
        data = request.get_json() or {}
        product_id = data.get('product_id')

        if not product_id:
            return jsonify({"error": "product_id is required"}), 400

        item = CartItem.query.filter_by(product_id=product_id).first()

        if not item:
            return jsonify({"error": "Item not found in cart"}), 404

        db.session.delete(item)
        db.session.commit()

        return jsonify({"message": "Item removed from cart"})

    @app.route('/ai-search', methods=['POST'])
    def ai_search():
        data = request.get_json()
    user_query = data.get("query")

    if not user_query:
        return jsonify({"error": "Query required"}), 400

    # Claude understands the search query
    parsed = parse_query(user_query)

    keyword = parsed.get("search_query", user_query)

    params = {
        "engine": "google_shopping",
        "q": keyword,
        "api_key": os.getenv("SERPAPI_KEY")
    }

    response = requests.get(
        "https://serpapi.com/search",
        params=params
    )

    results = response.json()

    products = []

    for item in results.get("shopping_results", []):
        products.append({
            "name": item.get("title"),
            "price": item.get("price"),
            "image": item.get("thumbnail"),
            "link": item.get("link"),
            "source": "Web"
        })

    return jsonify(products)

    @app.route('/checkout', methods=['POST'])
    def checkout():
        cart_items = CartItem.query.all()

        if not cart_items:
            return jsonify({"message": "Cart is empty"}), 400

        total = 0

        order = Order(total_amount=0, status="Placed")
        db.session.add(order)
        db.session.flush()

        for item in cart_items:
            subtotal = item.product.price * item.quantity
            total += subtotal

            order_item = OrderItem(
                order_id=order.id,
                product_id=item.product_id,
                quantity=item.quantity,
                price=item.product.price
            )
            db.session.add(order_item)

        order.total_amount = total

        for item in cart_items:
            db.session.delete(item)

        db.session.commit()

        return jsonify({
            "message": "Order placed successfully",
            "order_id": order.id,
            "total_amount": total
        })

    @app.route('/order/<int:order_id>', methods=['GET'])
    def track_order(order_id):
        order = Order.query.get(order_id)

        if not order:
            return jsonify({"error": "Order not found"}), 404

        return jsonify(order.to_dict())

    return app


app = create_app()

if __name__ == '__main__':
    app.run(debug=True)
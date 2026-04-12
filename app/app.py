from dotenv import load_dotenv
load_dotenv()

from flask import Flask, current_app, request, jsonify, render_template
from flask_cors import CORS
from config import Config
from models import db, Product, CartItem, Order, OrderItem
from ai_search import parse_query, compare_with_ai, parse_product_image
import os
import requests
import stripe
from openai import OpenAI
# At the top of app.py, add to imports
from sqlalchemy.orm import joinedload

def matches_filters(item, parsed):
    title = (item.get("title") or "").lower()
    source = (item.get("source") or "").lower()
    extracted_price = item.get("extracted_price")

    brand = (parsed.get("brand") or "").lower().strip()
    gender = (parsed.get("gender") or "").lower().strip()
    product_type = (parsed.get("product_type") or "").lower().strip()
    source_filter = (parsed.get("source") or "").lower().strip()
    min_price = parsed.get("min_price")
    max_price = parsed.get("max_price")

    if brand and brand not in title:
        return False

    if gender:
        if gender == "men" and ("women" in title or "kids" in title or "girls" in title):
            return False
        if gender == "women" and ("men" in title or "kids" in title or "boys" in title):
            return False

    broad_types = ["shoes", "footwear", "fashion", "clothing", "product", "item", ""]
    if product_type and product_type not in broad_types:
        if product_type not in title:
            return False

    if source_filter and source_filter not in source:
        return False

    if extracted_price is not None:
        try:
            price = float(extracted_price)
            if min_price is not None and price < float(min_price):
                return False
            if max_price is not None and price > float(max_price):
                return False
        except (ValueError, TypeError):
            return False

    return True


def find_best_product(products, user_query="", parsed=None):
    if not products:
        return None

    query_words = [w.lower() for w in user_query.split() if len(w) > 2]

    trusted_sources = {
        "nike": 10, "adidas": 10, "new balance": 9, "asics": 9,
        "puma": 8, "reebok": 8, "foot locker": 8, "dick's sporting goods": 7,
        "jd sports": 7, "finish line": 7, "amazon": 5, "walmart": 4,
        "target": 4, "old navy": 2
    }

    positive_keywords = {
        "running": 8, "training": 7, "basketball": 7, "comfort": 6,
        "cushion": 6, "support": 6, "premium": 6, "leather": 5,
        "durable": 5, "sport": 4, "athletic": 5, "sneaker": 5
    }

    negative_keywords = {
        "kids": -20, "toddler": -20, "baby": -20,
        "girls": -12, "boys": -12, "flats": -10, "heels": -10, "slingback": -10
    }

    prices = []
    for product in products:
        try:
            p = float(str(product.get("price", "")).replace("$", "").replace(",", "").strip())
            prices.append(p)
        except Exception:
            pass

    min_found_price = min(prices) if prices else 0
    max_found_price = max(prices) if prices else 1

    best_product = None
    best_score = float("-inf")

    for product in products:
        title = (product.get("name") or "").lower()
        source = (product.get("source") or "").lower()
        score = 0

        for word in query_words:
            if word in title:
                score += 10

        for store, value in trusted_sources.items():
            if store in source or store in title:
                score += value
                break

        for word, value in positive_keywords.items():
            if word in title:
                score += value
        for word, value in negative_keywords.items():
            if word in title:
                score += value

        if parsed:
            brand = (parsed.get("brand") or "").lower().strip()
            gender = (parsed.get("gender") or "").lower().strip()
            if brand and brand in title:
                score += 12
            if gender == "men" and "men" in title:
                score += 8
            elif gender == "women" and "women" in title:
                score += 8

        try:
            price_value = float(str(product.get("price", "")).replace("$", "").replace(",", "").strip())
            if max_found_price > min_found_price:
                normalized = (price_value - min_found_price) / (max_found_price - min_found_price)
                score += 12 - (normalized * 12)
            else:
                score += 6
        except Exception:
            score -= 3

        if score > best_score:
            best_score = score
            best_product = product

    return best_product


def fetch_filtered_products(keyword, api_key, parsed=None, limit=20):
    collected = []
    seen = set()
    start = 0
    batch_size = 20
    max_rounds = 10

    for _ in range(max_rounds):
        params = {
            "engine": "google_shopping",
            "q": keyword,
            "api_key": api_key,
            "num": batch_size,
            "start": start
        }

        response = requests.get("https://serpapi.com/search", params=params, timeout=20)
        response.raise_for_status()
        results = response.json()
        shopping_results = results.get("shopping_results", [])

        if not shopping_results:
            break

        for item in shopping_results:
            if parsed is not None and not matches_filters(item, parsed):
                continue

            name = item.get("title")
            source = item.get("source", "Web")
            price = item.get("price")
            unique_key = f"{name}|{source}|{price}"

            if unique_key in seen:
                continue
            seen.add(unique_key)

            collected.append({
                "name": name,
                "price": price,
                "image": item.get("thumbnail"),
                "link": item.get("product_link") or item.get("link"),
                "source": source,
                "description": item.get("snippet", "")
            })

            if len(collected) >= limit:
                return collected

        if len(shopping_results) < batch_size:
            break
        start += batch_size

    return collected


def create_app():
    app = Flask(__name__, template_folder="template", static_folder="static")
    app.config.from_object(Config)

    CORS(app)
    db.init_app(app)

    stripe.api_key = app.config.get("STRIPE_SECRET_KEY")

    # ==================== ROUTES ====================

    @app.route('/')
    def home():
        return render_template('index.html')

    @app.route('/web-search', methods=['POST'])
    def web_search():
        data = request.get_json() or {}
        keyword = data.get('keyword', '').strip()
        if not keyword:
            return jsonify({"error": "Keyword required"}), 400

        api_key = os.getenv("SERPAPI_KEY")
        if not api_key:
            return jsonify({"error": "SERPAPI_KEY not set"}), 500

        try:
            products = fetch_filtered_products(keyword=keyword, api_key=api_key, parsed=None, limit=20)
            best_product = find_best_product(products, keyword, None)
            return jsonify({"products": products, "best_product": best_product, "total_found": len(products)})
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    @app.route('/ai-search', methods=['POST'])
    def ai_search():
        data = request.get_json() or {}
        user_query = data.get("query")
        if not user_query:
            return jsonify({"error": "Query required"}), 400

        api_key = os.getenv("SERPAPI_KEY")
        if not api_key:
            return jsonify({"error": "SERPAPI_KEY not set"}), 500

        try:
            parsed = parse_query(user_query)
            keyword = parsed.get("search_query", user_query)
            products = fetch_filtered_products(keyword=keyword, api_key=api_key, parsed=parsed, limit=20)
            best_product = find_best_product(products, user_query, parsed)
            return jsonify({
                "products": products,
                "best_product": best_product,
                "total_found": len(products),
                "parsed_filters": parsed
            })
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    @app.route('/image-search', methods=['POST'])
    def image_search():
        if "image" not in request.files:
            return jsonify({"error": "Image file is required"}), 400
        image_file = request.files["image"]
        if not image_file or image_file.filename == "":
            return jsonify({"error": "Image file is required"}), 400

        api_key = os.getenv("SERPAPI_KEY")
        if not api_key:
            return jsonify({"error": "SERPAPI_KEY not set"}), 500

        try:
            image_bytes = image_file.read()
            mime_type = image_file.mimetype or "image/jpeg"
            parsed = parse_product_image(image_bytes, mime_type)
            keyword = parsed.get("search_query", "").strip()
            if not keyword:
                return jsonify({"error": "Could not detect product from image"}), 400

            products = fetch_filtered_products(keyword=keyword, api_key=api_key, parsed=None, limit=20)
            best_product = find_best_product(products, keyword, parsed)
            return jsonify({
                "products": products,
                "best_product": best_product,
                "total_found": len(products),
                "parsed_image": parsed
            })
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    @app.route('/compare-products', methods=['POST'])
    def compare_products():
        data = request.get_json() or {}
        products = data.get("products", [])
        if len(products) < 2 or len(products) > 4:
            return jsonify({"error": "Select between 2 and 4 products"}), 400
        try:
            comparison = compare_with_ai(products)
            return jsonify({"comparison": comparison, "products": products})
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    @app.route('/cart/add', methods=['POST'])
    def add_to_cart():
        data = request.get_json() or {}
        web_name = data.get("name")
        if not web_name:
            return jsonify({"error": "Product info required"}), 400

        product = Product.query.filter_by(name=web_name).first()
        if not product:
            numeric_price = 0.0
            try:
                numeric_price = float(str(data.get("price", "")).replace("$", "").replace(",", "").strip())
            except Exception:
                pass
            product = Product(
                name=web_name,
                category=data.get("category", "Web"),
                price=numeric_price,
                description=data.get("description", "")
            )
            db.session.add(product)
            db.session.flush()

        existing_item = CartItem.query.filter_by(product_id=product.id).first()
        if existing_item:
            existing_item.quantity += data.get("quantity", 1)
        else:
            item = CartItem(product_id=product.id, quantity=data.get("quantity", 1))
            db.session.add(item)

        db.session.commit()
        return jsonify({"message": "Item added to cart"})

    @app.route('/cart', methods=['GET'])
    def view_cart():
        items = CartItem.query.all()
        return jsonify([item.to_dict() for item in items])

    @app.route('/cart/remove', methods=['POST'])
    def remove_from_cart():
        data = request.get_json() or {}
        product_id = data.get("product_id")
        item = CartItem.query.filter_by(product_id=product_id).first()
        if not item:
            return jsonify({"error": "Item not found"}), 404
        db.session.delete(item)
        db.session.commit()
        return jsonify({"message": "Item removed from cart"})
    

    @app.route('/order/confirm/<session_id>', methods=['GET'])
    def confirm_order(session_id):
        order = Order.query.options(joinedload(Order.items).joinedload(OrderItem.product))\
        .filter_by(stripe_session_id=session_id).first()
        if not order:
            return jsonify({"error": "Order not found"}), 404
        if order.status == "pending":
            order.status = "paid"
            db.session.commit()
        return jsonify(order.to_dict())

    # ==================== CHECKOUT ROUTE ====================

    @app.route('/checkout', methods=['POST'])
    def checkout():
        if current_app.config.get("USE_MOCK_PAYMENT", False):
            return _handle_mock_checkout()
        return _handle_stripe_checkout()

    def _handle_mock_checkout():
        cart_items = CartItem.query.all()
        if not cart_items:
            return jsonify({"message": "Cart is empty"}), 400

        import random
        if random.random() < 0.1:
            return jsonify({"error": "Mock payment declined"}), 402

        total = sum(item.product.price * item.quantity for item in cart_items)
        order = Order(total_amount=total, status="paid")
        db.session.add(order)
        db.session.flush()

        for item in cart_items:
            order_item = OrderItem(
                order_id=order.id,
                product_id=item.product_id,
                quantity=item.quantity,
                price=item.product.price
            )
            db.session.add(order_item)
            db.session.delete(item)

        db.session.commit()
        return jsonify({
            "message": "Order placed (mock)",
            "order_id": order.id,
            "total_amount": total,
            "mode": "mock"
        })

    def _handle_stripe_checkout():
        cart_items = CartItem.query.all()
        if not cart_items:
            return jsonify({"message": "Cart is empty"}), 400

        if not current_app.config.get("STRIPE_SECRET_KEY"):
            return jsonify({"error": "Stripe secret key not configured"}), 500
        stripe.api_key = current_app.config["STRIPE_SECRET_KEY"]

        line_items = []
        for item in cart_items:
            line_items.append({
                "price_data": {
                    "currency": "usd",
                    "product_data": {
                        "name": item.product.name,
                        **({"description": item.product.description} if item.product.description else {}),
                    },
                    "unit_amount": int(item.product.price * 100),
                },
                "quantity": item.quantity,
            })

        try:
            session = stripe.checkout.Session.create(
                payment_method_types=["card"],
                line_items=line_items,
                mode="payment",
                success_url=f"{current_app.config['FRONTEND_URL']}/?tab=track&order_id={{CHECKOUT_SESSION_ID}}",
                cancel_url=f"{current_app.config['FRONTEND_URL']}/?tab=cart",
                metadata={"cart_items": ",".join([str(item.id) for item in cart_items])}
            )

            total = sum(item.product.price * item.quantity for item in cart_items)
            order = Order(total_amount=total, status="pending", stripe_session_id=session.id)
            db.session.add(order)
            db.session.flush()

            for item in cart_items:
                order_item = OrderItem(
                    order_id=order.id,
                    product_id=item.product_id,
                    quantity=item.quantity,
                    price=item.product.price
                )
                db.session.add(order_item)

            db.session.commit()
            return jsonify({"checkout_url": session.url, "order_id": order.id, "mode": "stripe"})

        except stripe.error.StripeError as e:
            return jsonify({"error": f"Stripe error: {str(e)}"}), 500
        except Exception as e:
            return jsonify({"error": f"Checkout failed: {str(e)}"}), 500

    # ==================== WEBHOOK ROUTE ====================

    @app.route('/webhook/stripe', methods=['POST'])
    def stripe_webhook():
        payload = request.data
        sig_header = request.headers.get('Stripe-Signature')

        try:
            event = stripe.Webhook.construct_event(
                payload, sig_header, current_app.config["STRIPE_WEBHOOK_SECRET"]
            )
        except ValueError:
            return "Invalid payload", 400
        except stripe.error.SignatureVerificationError:
            return "Invalid signature", 400

        if event.type == 'checkout.session.completed':
            session = event.data.object
            order = Order.query.filter_by(stripe_session_id=session.id).first()
            if order and order.status == "pending":
                order.status = "paid"
                CartItem.query.delete()
                db.session.commit()

        elif event.type == 'checkout.session.expired':
            session = event.data.object
            order = Order.query.filter_by(stripe_session_id=session.id).first()
            if order and order.status == "pending":
                order.status = "cancelled"
                db.session.commit()

        return jsonify({"status": "success"}), 200

    # ==================== CHATBOT ROUTE ====================

    @app.route('/chat', methods=['POST'])
    def chat():
        data = request.get_json() or {}
        messages = data.get("messages", [])
        if not messages:
            return jsonify({"error": "No messages provided"}), 400

        client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

        system_prompt = {
            "role": "system",
            "content": (
                "You are AgentCommerce AI, a helpful shopping assistant. "
                "Help users find products, compare prices, suggest deals, "
                "and answer shopping-related questions. Be concise and friendly."
            )
        }

        try:
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[system_prompt] + messages,
                max_tokens=500
            )
            reply = response.choices[0].message.content
            return jsonify({"reply": reply})
        except Exception as e:
            print(f"CHAT ERROR: {e}")          # ← add this
            return jsonify({"error": str(e)}), 500

    # ==================== ORDER TRACKING ROUTE ====================

    @app.route('/order/<int:order_id>', methods=['GET'])
    def track_order(order_id):
        order = Order.query.options(joinedload(Order.items).joinedload(OrderItem.product))\
        .get(order_id)
        if not order:
            return jsonify({"error": "Order not found"}), 404
        return jsonify(order.to_dict())

    return app


# ==================== APP ENTRY POINT ====================
app = create_app()

if __name__ == "__main__":
    app.run(debug=True)

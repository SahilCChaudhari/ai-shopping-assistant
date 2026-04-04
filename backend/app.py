from flask import Flask, request, jsonify
from flask_cors import CORS
from sqlalchemy import or_
from config import Config
from models import db, Product, CartItem, Order, OrderItem


def create_app():
    app = Flask(__name__, template_folder="templates", static_folder="static")
    app.config.from_object(Config)

    CORS(app)
    db.init_app(app)

    @app.route('/')
    def home():
        return render_template('index.html')

    @app.route('/products', methods=['GET'])
    def get_products():
        products = Product.query.all()
        return jsonify([p.to_dict() for p in products])

    @app.route('/search', methods=['POST'])
    def search_products():
        data = request.get_json() or {}

        keyword = data.get('keyword', '').strip()
        max_price = data.get('max_price')

        query = Product.query

        if keyword:
            query = query.filter(
                or_(
                    Product.name.ilike(f"%{keyword}%"),
                    Product.category.ilike(f"%{keyword}%"),
                    Product.description.ilike(f"%{keyword}%")
                )
            )

        if max_price not in (None, ''):
            query = query.filter(Product.price <= float(max_price))

        products = query.all()
        return jsonify([p.to_dict() for p in products])

    @app.route('/cart/add', methods=['POST'])
    def add_to_cart():
        data = request.get_json() or {}

        product_id = data.get('product_id')
        quantity = data.get('quantity', 1)

        if not product_id:
            return jsonify({"error": "product_id is required"}), 400

        product = Product.query.get(product_id)
        if not product:
            return jsonify({"error": "Product not found"}), 404

        existing_item = CartItem.query.filter_by(product_id=product_id).first()

        if existing_item:
            existing_item.quantity += quantity
        else:
            item = CartItem(
                product_id=product_id,
                quantity=quantity
            )
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
        product_id = data.get('product_id')

        if not product_id:
            return jsonify({"error": "product_id is required"}), 400

        item = CartItem.query.filter_by(product_id=product_id).first()

        if not item:
            return jsonify({"error": "Item not found in cart"}), 404

        db.session.delete(item)
        db.session.commit()

        return jsonify({"message": "Item removed from cart"})

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